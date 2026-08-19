/* 纪律页：按班级查看表扬/提醒记录，可按日期筛选 */
(function () {
  const V = window.V = window.V || {};

  V.discipline = {
    async render(el) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = V.discipline._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.discipline._c = selId;
      const cls = classes.find(c => c.id === selId);
      const date = V.discipline._d || '';

      const students = await DB.byIndex('students', 'classId', selId);
      const stuMap = {};
      students.forEach(s => stuMap[s.id] = s);

      let records = await DB.byIndex('disciplines', 'classId', selId);
      if (date) records = records.filter(r => r.date === date);
      records.sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));

      // 按学生分组
      const groups = [];
      const gmap = {};
      records.forEach(r => {
        if (!gmap[r.studentId]) {
          gmap[r.studentId] = { student: stuMap[r.studentId] || { id: r.studentId, name: '（学生已删除）' }, items: [] };
          groups.push(gmap[r.studentId]);
        }
        gmap[r.studentId].items.push(r);
      });

      const praise = records.filter(r => r.type === '表扬').length;
      const remind = records.filter(r => r.type === '提醒').length;

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<input type="date" id="selDate" value="' + date + '">' +
        '<button class="btn" id="btnClearDate">查看全部日期</button>' +
        '</div>' +
        '<div class="stat-line">' + (date ? '📅 ' + date + '：' : '全部记录：') +
        '共 <b>' + records.length + '</b> 条 · 表扬 <b style="color:#16a34a">' + praise + '</b> · 提醒 <b style="color:#d97706">' + remind + '</b></div>' +
        '<div class="page-note">💡 登记入口：到「班级 → 学生名单」点学生卡片，选「纪律」标签；或点下方学生的「登记」按钮</div>' +
        '</div>' +
        (groups.length ? groups.map(g =>
          '<div class="card" style="margin-top:14px">' +
          '<div class="rec-head">' +
          '<div class="att-name"><div class="avatar-sm" style="background:' + U.avatarColor(g.student.name) + '">' + U.escapeHtml((g.student.name || '?').charAt(0)) + '</div><b>' + U.escapeHtml(g.student.name) + '</b>' +
          '<span class="muted">（' + g.items.length + ' 条）</span></div>' +
          '<button class="btn btn-sm btn-primary" data-a="add" data-id="' + g.student.id + '">＋ 登记</button>' +
          '</div>' +
          g.items.map(d =>
            '<div class="rec-item" style="margin-top:10px">' +
            '<div class="rec-head">' +
            '<span class="type-badge ' + (d.type === '表扬' ? 'praise' : 'remind') + '">' +
            (d.type === '表扬' ? '👍 ' : '⚠️ ') + U.escapeHtml(d.type) + '</span>' +
            '<span class="muted">' + '★'.repeat(d.stars || 1) + ' · ' + U.escapeHtml(d.date) + '</span></div>' +
            (d.desc ? '<div class="muted">💬 ' + U.escapeHtml(d.desc) + '</div>' : '') +
            '<div class="rec-actions"><button class="btn btn-danger btn-sm" data-a="del" data-id="' + d.id + '">删除</button></div>' +
            '</div>').join('') +
          '</div>').join('')
          : '<div class="empty-state">⭐ 这个' + (date ? '日期' : '班') + '还没有纪律记录</div>');

      U.$('#selClass', el).addEventListener('change', e => {
        V.discipline._c = e.target.value;
        App.refresh();
      });
      U.$('#selDate', el).addEventListener('change', e => {
        V.discipline._d = e.target.value;
        App.refresh();
      });
      U.$('#btnClearDate', el).addEventListener('click', () => {
        V.discipline._d = '';
        App.refresh();
      });
      U.$$('[data-a="add"]', el).forEach(btn => {
        btn.addEventListener('click', () => {
          const stu = stuMap[btn.getAttribute('data-id')];
          if (!stu) { UI.toast('该学生已被删除', 'error'); return; }
          Panel.open({ student: stu, cls, tab: 'discipline' });
        });
      });
      U.$$('[data-a="del"]', el).forEach(btn => {
        btn.addEventListener('click', async () => {
          const rec = records.find(r => r.id === btn.getAttribute('data-id'));
          if (!rec) return;
          const stu = stuMap[rec.studentId] || { name: '已删除学生' };
          const ok = await UI.confirmDlg({
            title: '删除纪律记录',
            message: '确定删除这条' + rec.type + '记录吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('discipline', rec, '班级「' + cls.name + '」· 学生「' + stu.name + '」');
            UI.toast('已移入回收站');
            App.refresh();
          }
        });
      });
    }
  };
})();
