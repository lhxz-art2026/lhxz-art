/* 回收站：删除一律先进回收站，可整体还原，可彻底清理
 * 规则（见 CLAUDE.md 第 6.3 / 7.1 节）：
 * - 删学生 = 学生 + 其全部记录打包进回收站，还原时一起回来
 * - 删班级 = 班级 + 全部学生及其记录 + 课表 + 备课打包进回收站 */
(function () {
  const TYPE_STORE = {
    homework: 'homeworks', attendance: 'attendances',
    discipline: 'disciplines', plan: 'plans', work: 'works', schedule: 'schedules'
  };

  async function studentBundle(sid) {
    const s = await DB.get('students', sid);
    if (!s) return null;
    const [homeworks, attendances, disciplines, works] = await Promise.all([
      DB.byIndex('homeworks', 'studentId', sid),
      DB.byIndex('attendances', 'studentId', sid),
      DB.byIndex('disciplines', 'studentId', sid),
      DB.byIndex('works', 'studentId', sid)
    ]);
    return { student: s, homeworks, attendances, disciplines, works };
  }

  async function classBundle(cid) {
    const c = await DB.get('classes', cid);
    if (!c) return null;
    const students = await DB.byIndex('students', 'classId', cid);
    const bundles = await Promise.all(students.map(s => studentBundle(s.id)));
    const schedules = await DB.byIndex('schedules', 'classId', cid);
    const plans = await DB.byIndex('plans', 'classId', cid);
    return { cls: c, students: bundles, schedules, plans };
  }

  async function delRecords(store, arr) {
    for (const r of arr) await DB.del(store, r.id);
  }

  // 还原时：确认记录所属的学生/班级还在；不在则从回收站自动连带还原
  async function ensureStudent(sid) {
    if (await DB.get('students', sid)) return true;
    const all = await DB.all('trash');
    const t = all.find(x => x.type === 'student' && x.snapshot.student.id === sid);
    if (t) {
      await RC.restore(t.id);
      return !!(await DB.get('students', sid));
    }
    return false;
  }
  async function ensureClass(cid) {
    if (await DB.get('classes', cid)) return true;
    const all = await DB.all('trash');
    const t = all.find(x => x.type === 'class' && x.snapshot.cls.id === cid);
    if (t) {
      await RC.restore(t.id);
      return !!(await DB.get('classes', cid));
    }
    return false;
  }

  function recLabel(type, rec) {
    switch (type) {
      case 'homework': return rec.topic || '作业记录';
      case 'work': return rec.title || '优秀作业';
      case 'plan': return rec.topic || '备课记录';
      case 'attendance': return (rec.date || '') + ' 考勤';
      case 'discipline': return rec.type || '纪律记录';
      case 'schedule': {
        const P7 = ['早读', '上午第一节', '上午第二节', '上午第三节', '下午第一节', '下午第二节', '下午第三节'];
        return '课表 · ' + (rec.topic || ('周' + rec.week + ' ' + (P7[rec.period - 1] || ('第' + rec.period + '节'))));
      }
      default: return '记录';
    }
  }

  const RC = {
    TYPE_STORE,
    TYPE_LABEL: {
      class: '班级', student: '学生', homework: '作业记录',
      attendance: '考勤记录', discipline: '纪律记录', plan: '备课记录', work: '优秀作业', schedule: '课表课程'
    },

    // 删除班级：班级 + 学生 + 记录 + 课表 + 备课 打包进回收站
    async trashClass(cid) {
      const b = await classBundle(cid);
      if (!b) return;
      await DB.put('trash', {
        id: U.uid('tr'), type: 'class', label: b.cls.name, source: '班级',
        deletedAt: Date.now(), snapshot: b
      });
      await DB.del('classes', cid);
      for (const sb of b.students) {
        await DB.del('students', sb.student.id);
        await delRecords('homeworks', sb.homeworks);
        await delRecords('attendances', sb.attendances);
        await delRecords('disciplines', sb.disciplines);
        await delRecords('works', sb.works);
      }
      await delRecords('schedules', b.schedules);
      await delRecords('plans', b.plans);
    },

    // 删除学生：学生 + 其全部记录打包进回收站
    async trashStudent(sid) {
      const b = await studentBundle(sid);
      if (!b) return;
      const cls = await DB.get('classes', b.student.classId);
      await DB.put('trash', {
        id: U.uid('tr'), type: 'student', label: b.student.name,
        source: cls ? '班级「' + cls.name + '」' : '（班级已删除）',
        deletedAt: Date.now(), snapshot: b
      });
      await DB.del('students', sid);
      await delRecords('homeworks', b.homeworks);
      await delRecords('attendances', b.attendances);
      await delRecords('disciplines', b.disciplines);
      await delRecords('works', b.works);
    },

    // 删除单条记录（作业/考勤/纪律/备课/优秀作业），M2 起使用
    async trashRecord(type, rec, source) {
      await DB.put('trash', {
        id: U.uid('tr'), type, label: recLabel(type, rec),
        source: source || '', deletedAt: Date.now(), snapshot: { record: rec }
      });
      await DB.del(TYPE_STORE[type], rec.id);
    },

    // 一键还原。返回 { ok, msg }
    async restore(id) {
      const t = await DB.get('trash', id);
      if (!t) return { ok: false, msg: '回收站中没有这条记录' };

      if (t.type === 'class') {
        const b = t.snapshot;
        await DB.put('classes', b.cls);
        for (const sb of b.students) {
          await DB.put('students', sb.student);
          await DB.putMany('homeworks', sb.homeworks);
          await DB.putMany('attendances', sb.attendances);
          await DB.putMany('disciplines', sb.disciplines);
          await DB.putMany('works', sb.works);
        }
        await DB.putMany('schedules', b.schedules);
        await DB.putMany('plans', b.plans);
      } else if (t.type === 'student') {
        const b = t.snapshot;
        if (!(await ensureClass(b.student.classId))) {
          return { ok: false, msg: '学生原来所在的班级已不存在（回收站里也没有），无法还原' };
        }
        await DB.put('students', b.student);
        await DB.putMany('homeworks', b.homeworks);
        await DB.putMany('attendances', b.attendances);
        await DB.putMany('disciplines', b.disciplines);
        await DB.putMany('works', b.works);
      } else {
        const rec = t.snapshot.record;
        if (rec.classId && !(await ensureClass(rec.classId))) {
          return { ok: false, msg: '该记录所属的班级已不存在，无法还原' };
        }
        if (rec.studentId && !(await ensureStudent(rec.studentId))) {
          return { ok: false, msg: '该记录所属的学生已不存在，无法还原' };
        }
        await DB.put(TYPE_STORE[t.type], rec);
      }
      await DB.del('trash', id);
      return { ok: true };
    },

    async purgeOne(id) { await DB.del('trash', id); },
    async emptyTrash() { await DB.clear('trash'); }
  };

  window.RC = RC;
})();
