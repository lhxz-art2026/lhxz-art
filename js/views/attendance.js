/* 考勤页：按班级+日期查看，一键全勤，逐人点状态（自动保存） */
(function () {
  const V = window.V = window.V || {};
  const STATUSES = ['出勤', '迟到', '早退', '请假', '缺勤'];
  const STATUS_CLS = { '出勤': 'ok', '迟到': 'late', '早退': 'early', '请假': 'leave', '缺勤': 'absent' };

  V.attendance = {
    async render(el, params) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = (params && params.c) || V.attendance._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.attendance._c = selId;
      const cls = classes.find(c => c.id === selId);
      const date = V.attendance._d || U.todayStr();
      V.attendance._d = date;

      const students = (await DB.byIndex('students', 'classId', selId))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      const ats = await DB.byIndex('attendances', 'classId', selId);
      const bySt = {};
      ats.forEach(a => { if (a.date === date) bySt[a.studentId] = a; });

      const counts = { '出勤': 0, '迟到': 0, '早退': 0, '请假': 0, '缺勤': 0, '未登记': 0 };
      students.forEach(s => {
        const rec = bySt[s.id];
        if (rec) counts[rec.status] = (counts[rec.status] || 0) + 1;
        else counts['未登记']++;
      });

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<input type="date" id="selDate" value="' + date + '">' +
        '<button class="btn btn-primary" id="btnAllOk">✅ 一键全勤</button>' +
        '<button class="btn" id="btnPrint">🖨️ 打印考勤表</button>' +
        '</div>' +
        '<div class="stat-line">' +
        STATUSES.map(s => '<b class="chip chip-' + STATUS_CLS[s] + ' on">' + s + ' ' + (counts[s] || 0) + '</b>').join(' ') +
        ' <b class="chip">未登记 ' + counts['未登记'] + '</b>' +
        '</div></div>' +
        '<div class="card" style="margin-top:14px">' +
        '<div class="page-note">💡 点学生姓名右侧的状态即可登记；同一学生同一天再次点选 = 修改当天状态。备注可在学生面板的「考勤」页填写。</div>' +
        (students.length ? students.map(s =>
          '<div class="att-row">' +
          '<div class="att-name"><div class="avatar-sm" style="background:' + U.avatarColor(s.name) + '">' + U.escapeHtml((s.name || '?').charAt(0)) + '</div><b>' + U.escapeHtml(s.name) + '</b></div>' +
          '<div class="chips">' +
          STATUSES.map(st =>
            '<button class="chip chip-' + STATUS_CLS[st] + (bySt[s.id] && bySt[s.id].status === st ? ' on' : '') + '" data-st="' + st + '" data-id="' + s.id + '">' + st + '</button>').join('') +
          '</div></div>').join('')
          : '<div class="empty-state">🎒 这个班还没有学生</div>') +
        '</div>';

      U.$('#selClass', el).addEventListener('change', e => {
        V.attendance._c = e.target.value;
        App.refresh();
      });
      U.$('#selDate', el).addEventListener('change', e => {
        V.attendance._d = e.target.value;
        App.refresh();
      });
      U.$('#btnAllOk', el).addEventListener('click', async () => {
        for (const s of students) {
          const rec = bySt[s.id];
          if (rec) {
            await DB.put('attendances', Object.assign({}, rec, { status: '出勤', updatedAt: Date.now() }));
          } else {
            await DB.put('attendances', {
              id: U.uid('at'), studentId: s.id, classId: selId,
              date, status: '出勤', note: '', updatedAt: Date.now()
            });
          }
        }
        UI.toast('✅ 已全班记为出勤，可再逐个修改', 'success');
        App.refresh();
      });
      U.$('#btnPrint', el).addEventListener('click', () =>
        location.hash = '#/reports/attendance?c=' + selId + '&d=' + date);
      U.$$('[data-st]', el).forEach(btn => {
        btn.addEventListener('click', async () => {
          const sid = btn.getAttribute('data-id');
          const st = btn.getAttribute('data-st');
          const rec = bySt[sid];
          if (rec) {
            await DB.put('attendances', Object.assign({}, rec, { status: st, updatedAt: Date.now() }));
          } else {
            await DB.put('attendances', {
              id: U.uid('at'), studentId: sid, classId: selId,
              date, status: st, note: '', updatedAt: Date.now()
            });
          }
          UI.toast('✅ 已登记：' + st, 'success');
          App.refresh();
        });
      });
    }
  };
})();
