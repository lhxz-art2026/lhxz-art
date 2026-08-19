/* 作业页：按班级 + 课题 + 日期范围查看全部作业记录，可编辑/删除 */
(function () {
  const V = window.V = window.V || {};

  V.homeworks = {
    async render(el) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = V.homeworks._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.homeworks._c = selId;
      const cls = classes.find(c => c.id === selId);
      const topic = V.homeworks._t || '';
      const from = V.homeworks._f || '';
      const to = V.homeworks._t2 || '';

      const students = await DB.byIndex('students', 'classId', selId);
      const stuMap = {};
      students.forEach(s => stuMap[s.id] = s);

      let records = await DB.byIndex('homeworks', 'classId', selId);
      const topicSet = [];
      records.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(h => {
        if (!topicSet.includes(h.topic)) topicSet.push(h.topic);
      });
      if (topic) records = records.filter(h => h.topic === topic);
      if (from) records = records.filter(h => h.date >= from);
      if (to) records = records.filter(h => h.date <= to);
      records.sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));

      const aCount = records.filter(h => ['A++', 'A+', 'A', 'A-'].includes(h.grade)).length;

      // 按日期分组
      const groups = [];
      const gmap = {};
      records.forEach(h => {
        if (!gmap[h.date]) { gmap[h.date] = { date: h.date, items: [] }; groups.push(gmap[h.date]); }
        gmap[h.date].items.push(h);
      });

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<select id="selTopic"><option value="">全部课题</option>' +
        topicSet.map(t => '<option value="' + U.escapeHtml(t) + '"' + (t === topic ? ' selected' : '') + '>' + U.escapeHtml(t) + '</option>').join('') + '</select>' +
        '<input type="date" id="selFrom" value="' + from + '" title="开始日期">' +
        '<span class="muted">至</span>' +
        '<input type="date" id="selTo" value="' + to + '" title="结束日期">' +
        '<button class="btn" id="btnReset">重置筛选</button>' +
        '<button class="btn" id="btnPrint">🖨️ 打印评分表</button>' +
        '<button class="btn" id="btnCsv">📥 导出CSV</button>' +
        '</div>' +
        '<div class="stat-line">共 <b>' + records.length + '</b> 条记录 · A 以上 <b style="color:#16a34a">' + aCount + '</b> 条</div>' +
        '<div class="page-note">💡 登记入口：到「班级 → 学生名单」点学生卡片登记；点下方「编辑」可直接修改记录（自动保存）</div>' +
        '</div>' +
        (groups.length ? groups.map(g =>
          '<h2 class="sec-title">📅 ' + U.escapeHtml(g.date) + '（' + g.items.length + ' 条）</h2>' +
          g.items.map(h => {
            const stu = stuMap[h.studentId];
            return '<div class="card rec-item">' +
              '<div class="rec-head">' +
              '<span class="grade-badge grade-' + U.gradeClass(h.grade) + '">' + U.escapeHtml(h.grade) + '</span>' +
              '<span style="flex:1;text-align:right"><b>' + U.escapeHtml(stu ? stu.name : '（学生已删除）') + '</b>' +
              '<span class="muted"> · ' + U.escapeHtml(h.topic) + '</span></span></div>' +
              '<div class="muted">' + U.escapeHtml(U.dimsText(h)) + '</div>' +
              (h.comment ? '<div class="muted">💬 ' + U.escapeHtml(h.comment) + '</div>' : '') +
              '<div class="rec-actions">' +
              '<button class="btn btn-sm" data-a="edit" data-id="' + h.id + '">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-a="del" data-id="' + h.id + '">删除</button></div></div>';
          }).join('')).join('')
          : '<div class="empty-state">✏️ 没有符合条件的作业记录</div>');

      U.$('#selClass', el).addEventListener('change', e => {
        V.homeworks._c = e.target.value;
        V.homeworks._t = '';
        App.refresh();
      });
      U.$('#selTopic', el).addEventListener('change', e => {
        V.homeworks._t = e.target.value;
        App.refresh();
      });
      U.$('#selFrom', el).addEventListener('change', e => {
        V.homeworks._f = e.target.value;
        App.refresh();
      });
      U.$('#selTo', el).addEventListener('change', e => {
        V.homeworks._t2 = e.target.value;
        App.refresh();
      });
      U.$('#btnReset', el).addEventListener('click', () => {
        V.homeworks._t = '';
        V.homeworks._f = '';
        V.homeworks._t2 = '';
        App.refresh();
      });
      U.$('#btnPrint', el).addEventListener('click', () =>
        location.hash = '#/reports/grades?c=' + selId);
      U.$('#btnCsv', el).addEventListener('click', () => {
        const rows = [['姓名', '日期', '课题', '综合等级', '构图', '线条', '色彩', '造型', '创意', '整洁度', '课堂态度', '评语']]
          .concat(records.map(h => {
            const stu = stuMap[h.studentId];
            return [stu ? stu.name : '（学生已删除）', h.date, h.topic, h.grade]
              .concat(U.DIMS.map(([k]) => (h.dims || {})[k] || ''))
              .concat([h.comment || '']);
          }));
        const csv = '﻿' + rows.map(r => r.map(U.csvCell).join(',')).join('\r\n');
        U.download(cls.name + '-作业评分-' + U.todayStr().replace(/-/g, '') + '.csv', csv, 'text/csv;charset=utf-8');
        UI.toast('✅ 已导出当前筛选的 ' + records.length + ' 条记录，Excel 可直接打开', 'success');
      });
      U.$$('[data-a="edit"]', el).forEach(btn => {
        btn.addEventListener('click', () => {
          const h = records.find(r => r.id === btn.getAttribute('data-id'));
          if (!h) return;
          const stu = stuMap[h.studentId];
          if (!stu) { UI.toast('该学生已被删除，无法编辑', 'error'); return; }
          Panel.open({ student: stu, cls, tab: 'homework', editRecord: h });
        });
      });
      U.$$('[data-a="del"]', el).forEach(btn => {
        btn.addEventListener('click', async () => {
          const h = records.find(r => r.id === btn.getAttribute('data-id'));
          if (!h) return;
          const ok = await UI.confirmDlg({
            title: '删除作业记录',
            message: '确定删除「' + h.topic + '」的这条作业记录吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('homework', h, '班级「' + cls.name + '」');
            UI.toast('已移入回收站');
            App.refresh();
          }
        });
      });
    }
  };
})();
