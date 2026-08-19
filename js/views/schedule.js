/* 课表管理：星期×节次网格
 * 电脑：把课程块拖到其他格子调课（拖到有课的格子 = 两节课互换）
 * 手机：点空格添加、点课程块修改；同一时段只能排一节课 */
(function () {
  const V = window.V = window.V || {};
  const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  // 节次（用户约定，不显示具体时间）：早读 + 上午第1~3节 + 下午第1~3节，共 7 个时段
  const PERIOD_NAMES = ['早读', '上午第一节', '上午第二节', '上午第三节', '下午第一节', '下午第二节', '下午第三节'];

  async function openModal(seed) {
    const classes = await DB.all('classes');
    if (!classes.length) {
      UI.toast('请先到「班级」页创建班级', 'error');
      return;
    }
    const rec = seed && seed.id ? seed : null;
    const m = UI.modal({ title: rec ? '编辑课程' : '添加课程' });

    const weekSel = document.createElement('select');
    WEEK_NAMES.forEach((w, i) => {
      const o = document.createElement('option');
      o.value = i + 1; o.textContent = w;
      weekSel.appendChild(o);
    });
    weekSel.value = rec ? rec.week : (seed ? seed.week : 1);
    const fWeek = UI.field('星期 *', weekSel);

    const perSel = document.createElement('select');
    PERIOD_NAMES.forEach((label, i) => {
      const o = document.createElement('option');
      o.value = i + 1; o.textContent = label;
      perSel.appendChild(o);
    });
    perSel.value = rec ? rec.period : (seed ? seed.period : 1);
    const fPer = UI.field('节次 *', perSel);

    const clsSel = document.createElement('select');
    classes.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      clsSel.appendChild(o);
    });
    clsSel.value = rec ? rec.classId : classes[0].id;
    const fCls = UI.field('班级 *', clsSel);

    const topicInp = document.createElement('input');
    topicInp.placeholder = '这节课上什么，如：素描基础（可不填）';
    topicInp.value = rec ? (rec.topic || '') : '';
    const fTopic = UI.field('课程主题', topicInp);

    const noteInp = document.createElement('input');
    noteInp.placeholder = '备注（可不填）';
    noteInp.value = rec ? (rec.note || '') : '';
    const fNote = UI.field('备注', noteInp);

    m.body.append(fWeek.el, fPer.el, fCls.el, fTopic.el, fNote.el);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.textContent = '删除';
    btnDel.style.display = rec ? '' : 'none';
    btnDel.onclick = async () => {
      const ok = await UI.confirmDlg({
        title: '删除课程',
        message: '确定删除这节课程吗？将移入回收站，可随时还原。',
        okText: '移入回收站', danger: true
      });
      if (ok) {
        m.close();
        await RC.trashRecord('schedule', rec, '课表');
        UI.toast('已移入回收站');
        App.refresh();
      }
    };
    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.textContent = '保存';
    btnSave.onclick = async () => {
      const week = parseInt(weekSel.value, 10);
      const period = parseInt(perSel.value, 10);
      const classId = clsSel.value;
      if (!classId) { fCls.setError('请选择班级'); return; }
      // 同一时段只能排一节课
      const all = await DB.all('schedules');
      const other = all.find(x => x.week === week && x.period === period && (!rec || x.id !== rec.id));
      if (other) {
        const clsName = (await DB.get('classes', other.classId) || {}).name || '其他班级';
        const ok = await UI.confirmDlg({
          title: '时段冲突',
          message: '该时段已有「' + clsName + '」的课，保存后将替换掉原来的课程。确定吗？',
          okText: '替换', danger: true
        });
        if (!ok) return;
        await DB.del('schedules', other.id);
      }
      m.close();
      if (rec) {
        await DB.put('schedules', Object.assign({}, rec, {
          week, period, classId, topic: topicInp.value.trim(), note: noteInp.value.trim()
        }));
        UI.toast('✅ 课程已保存');
      } else {
        await DB.put('schedules', {
          id: U.uid('sch'), week, period, classId,
          topic: topicInp.value.trim(), note: noteInp.value.trim(), createdAt: Date.now()
        });
        UI.toast('✅ 课程已添加');
      }
      App.refresh();
    };
    m.actions.append(btnDel, btnCancel, btnSave);
  }

  V.schedule = {
    async render(el) {
      const [scheds, classes] = await Promise.all([DB.all('schedules'), DB.all('classes')]);
      // 旧版数据兼容：旧版节次为 1~10，超过 7 的一律归入「下午第三节」
      for (const s of scheds) {
        if (s.period > 7) { s.period = 7; await DB.put('schedules', s); }
      }
      const clsMap = {};
      classes.forEach(c => clsMap[c.id] = c);
      const byKey = {};
      scheds.forEach(s => byKey[s.week + '-' + s.period] = s);

      function itemHtml(rec) {
        const name = clsMap[rec.classId] ? clsMap[rec.classId].name : '（班级已删除）';
        return '<div class="sched-item" draggable="true" data-id="' + rec.id + '">' +
          '<b>' + U.escapeHtml(name) + '</b>' +
          (rec.topic ? '<div class="muted">' + U.escapeHtml(rec.topic) + '</div>' : '') +
          '</div>';
      }

      let rows = '';
      for (let p = 1; p <= 7; p++) {
        rows += '<tr><th class="sched-period-head">' + PERIOD_NAMES[p - 1] + '</th>';
        for (let d = 1; d <= 7; d++) {
          const rec = byKey[d + '-' + p];
          rows += '<td class="sched-cell" data-week="' + d + '" data-period="' + p + '">' + (rec ? itemHtml(rec) : '') + '</td>';
        }
        rows += '</tr>';
      }

      el.innerHTML =
        '<div class="card">' +
        '<div class="page-note">💡 电脑：把课程块<b>拖</b>到其他格子即可调课（拖到有课的格子 = 两节课互换）；手机：点空格添加、点课程块修改。同一时段只能排一节课。</div>' +
        '<div class="page-actions">' +
        '<button class="btn" id="btnPrint">🖨️ 打印课表</button>' +
        '<button class="btn btn-primary" id="btnAdd">＋ 添加课程</button>' +
        '</div>' +
        '<div class="sched-wrap"><table class="sched-table">' +
        '<thead><tr><th class="sched-period-head"></th>' +
        WEEK_NAMES.map(w => '<th>' + w + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        (classes.length ? '' : '<div class="muted" style="margin-top:8px">提示：请先到「班级」页创建班级，再来排课</div>') +
        '</div>';

      U.$('#btnAdd', el).addEventListener('click', () => openModal(null));
      U.$('#btnPrint', el).addEventListener('click', () => location.hash = '#/reports/schedule');

      // 点击格子：空格添加、有课修改
      U.$$('.sched-cell', el).forEach(cell => {
        cell.addEventListener('click', e => {
          const item = e.target.closest('.sched-item');
          if (item) {
            const rec = scheds.find(x => x.id === item.getAttribute('data-id'));
            if (rec) openModal(rec);
          } else {
            openModal({
              week: parseInt(cell.getAttribute('data-week'), 10),
              period: parseInt(cell.getAttribute('data-period'), 10)
            });
          }
        });
        // 拖拽调课（桌面端）
        cell.addEventListener('dragover', e => {
          e.preventDefault();
          cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', async e => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          const id = e.dataTransfer.getData('text/plain');
          const rec = scheds.find(x => x.id === id);
          if (!rec) return;
          const week = parseInt(cell.getAttribute('data-week'), 10);
          const period = parseInt(cell.getAttribute('data-period'), 10);
          if (rec.week === week && rec.period === period) return;
          const other = byKey[week + '-' + period];
          if (other) {
            // 两节课互换
            await DB.put('schedules', Object.assign({}, other, { week: rec.week, period: rec.period }));
          }
          await DB.put('schedules', Object.assign({}, rec, { week, period }));
          UI.toast('✅ 已调课');
          App.refresh();
        });
      });
      U.$$('.sched-item', el).forEach(item => {
        item.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', item.getAttribute('data-id'));
          e.dataTransfer.effectAllowed = 'move';
        });
      });
    }
  };
})();
