/* 未交名单页（按课题自动对比，见 CLAUDE.md M6 / 变更 #23）
 * 规则：班里某个课题，谁没有作业评分记录（也没被「标记已交」），谁就是未交。
 * 累计次数 = 该生在这个班里缺交的课题数。
 * 入口：班级名单页 / 作业页的「👀 未交名单」按钮；路由 #/missing?c=班级编号 */
(function () {
  const V = window.V = window.V || {};

  // 本页显示期间，作业评分 / "标记已交" / 学生名单一变，就自动重新对比刷新（保持滚动位置不跳）
  document.addEventListener('lxz-changed', e => {
    const s = e.detail && e.detail.store;
    if ((s === 'homeworks' || s === 'hwMarks' || s === 'students') &&
      location.hash.indexOf('#/missing') === 0 && V.missing._params) {
      const y = window.scrollY;
      V.missing.render(U.$('#content'), V.missing._params).then(() => window.scrollTo(0, y));
    }
  });

  V.missing = {
    async render(el, params) {
      V.missing._params = params;
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = params && params.c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      const cls = classes.find(c => c.id === selId);

      const students = (await DB.byIndex('students', 'classId', selId))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      const stuMap = {};
      students.forEach(s => stuMap[s.id] = s);

      const records = await DB.byIndex('homeworks', 'classId', selId);
      const marks = await DB.byIndex('hwMarks', 'classId', selId);

      // ---- 按课题分组：谁交了 / 谁没交 ----
      const topics = [];
      const tmap = {};
      records.forEach(h => {
        if (!tmap[h.topic]) { tmap[h.topic] = { topic: h.topic, dates: [] }; topics.push(tmap[h.topic]); }
        tmap[h.topic].dates.push(h.date);
      });
      topics.forEach(t => {
        t.dates.sort();
        t.first = t.dates[0];
        t.last = t.dates[t.dates.length - 1];
        const done = new Set();
        records.forEach(h => { if (h.topic === t.topic) done.add(h.studentId); });
        marks.forEach(m => { if (m.topic === t.topic) done.add(m.studentId); });
        t.doneList = students.filter(s => done.has(s.id));
        t.missList = students.filter(s => !done.has(s.id));
        // 「标记已交」但没有评分记录的学生（点名字可取消标记）
        const hasRec = new Set(records.filter(h => h.topic === t.topic).map(h => h.studentId));
        t.markedList = marks.filter(m => m.topic === t.topic && !hasRec.has(m.studentId))
          .map(m => { const s = stuMap[m.studentId]; return s ? { s, markId: m.id } : null; })
          .filter(x => x);
      });
      topics.sort((a, b) => b.last.localeCompare(a.last));

      // ---- 累计未交次数榜 ----
      const missCount = {};
      students.forEach(s => missCount[s.id] = 0);
      topics.forEach(t => t.missList.forEach(s => missCount[s.id]++));
      const rank = students.slice().sort((a, b) =>
        (missCount[b.id] - missCount[a.id]) || a.name.localeCompare(b.name, 'zh'));
      const totalMiss = rank.reduce((n, s) => n + missCount[s.id], 0);
      const missPeople = rank.filter(s => missCount[s.id] > 0).length;

      const st = await DB.getSettings();

      el.innerHTML =
        // 打印时才会显示的报告抬头（平时隐藏）
        '<div class="print-only report-head">' +
        (st.schoolName ? '<div class="r-school">' + U.escapeHtml(st.schoolName) + '</div>' : '') +
        '<div class="r-title">作业未交名单</div>' +
        '<div class="r-sub">' + U.escapeHtml(cls.name) + ' · 生成日期 ' + U.todayStr() +
        (st.teacherName ? ' · 教师 ' + U.escapeHtml(st.teacherName) : '') + '</div></div>' +

        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<span class="flex1"></span>' +
        '<button class="btn no-print" id="btnPrint">🖨️ 打印未交名单</button>' +
        '</div>' +
        '<div class="stat-line">' +
        '共出现 <b>' + topics.length + '</b> 个课题 · 未交 <b style="color:#b91c1c">' + totalMiss + '</b> 人次' +
        (missPeople ? '（' + missPeople + ' 人）' : '') + '</div>' +
        '<div class="page-note">💡 规则：班里每个课题，谁没有作业评分记录，谁就是未交。补登记评分后自动从未交名单消失；特殊情况（补交没评分、转班来晚等）可「标记已交」。</div>' +
        '</div>' +

        '<h2 class="sec-title">📊 累计未交次数榜</h2>' +
        '<div class="card">' +
        (students.length ?
          '<div class="rank-list">' + rank.map((s, i) =>
            '<div class="rank-row" data-sid="' + s.id + '">' +
            '<span class="rank-no">' + (i + 1) + '</span>' +
            '<span class="avatar-sm" style="background:' + U.avatarColor(s.name) + '">' + U.escapeHtml((s.name || '?').charAt(0)) + '</span>' +
            '<span class="rank-name">' + U.escapeHtml(s.name) + '</span>' +
            (missCount[s.id] > 0
              ? '<span class="miss-badge">未交 ' + missCount[s.id] + ' 次</span>'
              : '<span class="ok-badge">✓ 全交齐</span>') +
            '</div>').join('') + '</div>'
          : '<div class="empty-state">🎒 还没有学生</div>') +
        '</div>' +

        '<h2 class="sec-title">📌 按课题看未交名单</h2>' +
        (topics.length ? topics.map((t, i) =>
          '<details class="card miss-topic"' + (i === 0 ? ' open' : '') + '>' +
          '<summary>' +
          '<span class="miss-topic-name">' + U.escapeHtml(t.topic) + '</span>' +
          '<span class="miss-topic-meta">' + U.escapeHtml(t.first) + (t.last !== t.first ? ' ~ ' + U.escapeHtml(t.last) : '') +
          ' · 已交 ' + t.doneList.length + '</span>' +
          (t.missList.length
            ? '<span class="miss-badge">未交 ' + t.missList.length + '</span>'
            : '<span class="ok-badge">✓ 全交齐</span>') +
          '</summary>' +
          '<div class="miss-body">' +
          (t.missList.length ? t.missList.map(s =>
            '<div class="miss-row">' +
            '<span class="avatar-sm" style="background:' + U.avatarColor(s.name) + '">' + U.escapeHtml((s.name || '?').charAt(0)) + '</span>' +
            '<span class="miss-row-name">' + U.escapeHtml(s.name) + '</span>' +
            '<div class="miss-row-actions no-print">' +
            '<button class="btn btn-sm btn-primary" data-a="reg" data-sid="' + s.id + '" data-topic="' + U.escapeHtml(t.topic) + '">✏️ 补登记</button>' +
            '<button class="btn btn-sm" data-a="mark" data-sid="' + s.id + '" data-topic="' + U.escapeHtml(t.topic) + '">✓ 标记已交</button>' +
            '</div></div>').join('')
            : '<div class="muted" style="padding:6px 0">🎉 全班都交齐了</div>') +
          (t.markedList.length
            ? '<div class="miss-marked-sec">已标记已交（点「取消」恢复为未交）：' +
              t.markedList.map(x =>
                '<div class="miss-row miss-marked">' +
                '<span class="miss-row-name">' + U.escapeHtml(x.s.name) + '</span>' +
                '<div class="miss-row-actions no-print">' +
                '<button class="btn btn-sm" data-a="unmark" data-mark="' + x.markId + '">↩️ 取消</button>' +
                '</div></div>').join('') + '</div>'
            : '') +
          '</div></details>').join('')
          : '<div class="empty-state">✏️ 还没有作业评分记录<br><span class="muted">在名单页给学生的作业登记评分后，这里会自动对比出谁没交</span></div>');

      U.$('#selClass', el).addEventListener('change', e => {
        location.hash = '#/missing?c=' + e.target.value;
      });
      U.$('#btnPrint', el).addEventListener('click', () => {
        U.$$('details.miss-topic', el).forEach(d => d.open = true); // 打印前展开全部课题
        window.print();
      });

      // 点累计榜某学生 → 打开登记面板
      U.$$('.rank-row', el).forEach(row => {
        row.addEventListener('click', () => {
          const s = stuMap[row.getAttribute('data-sid')];
          if (s) Panel.open({ student: s, cls, tab: 'homework' });
        });
      });

      // 补登记：打开面板并把课题名预填好，登记完自动从未交名单消失
      U.$$('[data-a="reg"]', el).forEach(btn => {
        btn.addEventListener('click', () => {
          const s = stuMap[btn.getAttribute('data-sid')];
          if (s) Panel.open({ student: s, cls, tab: 'homework', topic: btn.getAttribute('data-topic') });
        });
      });

      // 标记已交（特殊情况豁免）：再点「取消」可恢复为未交
      U.$$('[data-a="mark"]', el).forEach(btn => {
        btn.addEventListener('click', async () => {
          const s = stuMap[btn.getAttribute('data-sid')];
          if (!s) return;
          await DB.put('hwMarks', {
            id: U.uid('mk'), classId: cls.id, studentId: s.id,
            topic: btn.getAttribute('data-topic'), createdAt: Date.now()
          });
          UI.toast('✅ 已标记「' + s.name + '」为已交，不再计入未交', 'success');
        });
      });
      U.$$('[data-a="unmark"]', el).forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await UI.confirmDlg({
            title: '取消已交标记',
            message: '取消后该生将恢复为「未交」，确定吗？',
            okText: '取消标记', danger: true
          });
          if (ok) {
            await DB.del('hwMarks', btn.getAttribute('data-mark'));
            UI.toast('已恢复为未交');
          }
        });
      });
    }
  };
})();
