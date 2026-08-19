/* 报表中心：课表 / 点名考勤表 / 学生评分表 / 座位表
 * 全部走浏览器原生打印：可打印成纸，也可在打印对话框选「另存为 PDF」 */
(function () {
  const V = window.V = window.V || {};
  const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const P_NAMES = ['早读', '上午第一节', '上午第二节', '上午第三节', '下午第一节', '下午第二节', '下午第三节'];
  const ATT_SHORT = { '出勤': '✓', '迟到': '迟', '早退': '早', '请假': '请', '缺勤': '缺' };

  function addDays(s, n) {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  }
  function dateRange(from, to) {
    const out = [];
    let cur = from;
    let guard = 0;
    while (cur <= to && guard < 40) { out.push(cur); cur = addDays(cur, 1); guard++; }
    return out;
  }
  async function reportHeader(title, extra) {
    const st = await DB.getSettings();
    return '<div class="report-head">' +
      (st.schoolName ? '<div class="r-school">' + U.escapeHtml(st.schoolName) + '</div>' : '') +
      '<div class="r-title">' + U.escapeHtml(title) + '</div>' +
      '<div class="r-sub">' + (st.teacherName ? U.escapeHtml(st.teacherName) + ' · ' : '') +
      (extra ? U.escapeHtml(extra) + ' · ' : '') + '生成于 ' + U.todayStr() + '</div></div>';
  }
  function printBar() {
    return '<div class="no-print report-page-actions">' +
      '<button class="btn btn-primary btn-lg" id="btnPrint">🖨️ 打印 / 另存为 PDF</button></div>' +
      '<div class="no-print print-hint">点打印后，浏览器弹出打印窗口：选打印机 = 打成纸；选「另存为 PDF」= 存成电子文件</div>';
  }
  function classSelectHtml(classes, selId) {
    return '<select id="selClass">' + classes.map(c =>
      '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>';
  }
  function bindPrint(el) {
    U.$('#btnPrint', el).addEventListener('click', () => window.print());
  }

  V.reports = {
    // ---------- 报表入口 ----------
    async render(el) {
      el.innerHTML =
        '<div class="card"><div class="page-note">🖨️ 所有报表都用浏览器自带打印：打印对话框里选打印机 = 打成纸；选「另存为 PDF」= 存成电子文件。打印时自动隐藏菜单和按钮，只打印报表本身。</div></div>' +
        '<h2 class="sec-title">选择要打印的报表</h2>' +
        '<div class="card-grid">' +
        '<a class="card quick-card" href="#/reports/schedule"><div class="quick-icon">📅</div><div><b>课表</b><div class="muted">整周课表（周一~周日 × 全部时段）</div></div></a>' +
        '<a class="card quick-card" href="#/reports/attendance"><div class="quick-icon">✅</div><div><b>点名考勤表</b><div class="muted">选班级 + 日期范围，学生 × 日期表格</div></div></a>' +
        '<a class="card quick-card" href="#/reports/grades"><div class="quick-icon">✏️</div><div><b>学生评分表</b><div class="muted">按课题/日期范围列出等级与分项得分</div></div></a>' +
        '<a class="card quick-card" href="#/reports/seats"><div class="quick-icon">🪑</div><div><b>座位表</b><div class="muted">按名单自动排座，可调每排人数</div></div></a>' +
        '</div>';
    },

    // ---------- 课表 ----------
    async renderSchedule(el) {
      const [scheds, classes] = await Promise.all([DB.all('schedules'), DB.all('classes')]);
      const clsMap = {};
      classes.forEach(c => clsMap[c.id] = c);
      const byKey = {};
      scheds.forEach(s => { if (s.period >= 1 && s.period <= 7) byKey[s.week + '-' + s.period] = s; });

      const head = await reportHeader('课表', '周一 ~ 周日');
      let rows = '';
      for (let p = 1; p <= 7; p++) {
        rows += '<tr><th>' + P_NAMES[p - 1] + '</th>';
        for (let d = 1; d <= 7; d++) {
          const rec = byKey[d + '-' + p];
          rows += '<td>' + (rec
            ? '<b>' + U.escapeHtml(clsMap[rec.classId] ? clsMap[rec.classId].name : '') + '</b>' +
              (rec.topic ? '<br><span style="font-size:12px">' + U.escapeHtml(rec.topic) + '</span>' : '')
            : '') + '</td>';
        }
        rows += '</tr>';
      }
      el.innerHTML =
        '<div class="print-preview card">' + head +
        '<div class="report-wrap"><table class="report-table">' +
        '<tr><th></th>' + WEEK_NAMES.map(w => '<th>' + w + '</th>').join('') + '</tr>' + rows +
        '</table></div></div>' + printBar();
      bindPrint(el);
    },

    // ---------- 点名考勤表 ----------
    async renderAttendance(el, params) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = (params && params.c) || V.reports._ac;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.reports._ac = selId;
      const cls = classes.find(c => c.id === selId);
      let from = (params && params.d) || V.reports._af || U.todayStr();
      let to = V.reports._at || U.todayStr();
      if (from > to) from = to;
      const dates = dateRange(from, to);
      if (dates.length > 31) {
        from = addDays(to, -30);
        V.reports._af = from;
        UI.toast('日期范围最长 31 天，已自动缩短', 'error');
      }
      const range = dateRange(from, to);
      V.reports._af = from;
      V.reports._at = to;

      const students = (await DB.byIndex('students', 'classId', selId))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      const ats = await DB.byIndex('attendances', 'classId', selId);
      const bySt = {};
      ats.forEach(a => { bySt[a.studentId + '|' + a.date] = a; });

      const head = await reportHeader('点名考勤表', cls.name + ' · ' + from + ' 至 ' + to);
      let rows = students.map(s =>
        '<tr><td class="l"><b>' + U.escapeHtml(s.name) + '</b></td>' +
        range.map(d => {
          const a = bySt[s.id + '|' + d];
          return '<td>' + (a ? ATT_SHORT[a.status] || '' : '') + '</td>';
        }).join('') + '</tr>').join('');
      if (!students.length) rows = '<tr><td colspan="' + (range.length + 1) + '">这个班还没有学生</td></tr>';

      el.innerHTML =
        '<div class="card no-print"><div class="filter-bar">' +
        classSelectHtml(classes, selId) +
        '<label class="muted">从</label><input type="date" id="selFrom" value="' + from + '">' +
        '<label class="muted">到</label><input type="date" id="selTo" value="' + to + '">' +
        '</div></div>' +
        '<div class="print-preview card">' + head +
        '<div class="report-wrap"><table class="report-table">' +
        '<tr><th style="min-width:64px">姓名</th>' + range.map(d => '<th>' + d.slice(5) + '</th>').join('') + '</tr>' +
        rows + '</table></div>' +
        '<div class="report-legend">图例：✓出勤 · 迟迟到 · 早早退 · 请请假 · 缺缺勤（空白 = 未登记）</div></div>' +
        printBar();

      U.$('#selClass', el).addEventListener('change', e => {
        V.reports._ac = e.target.value;
        App.refresh();
      });
      U.$('#selFrom', el).addEventListener('change', e => {
        V.reports._af = e.target.value;
        App.refresh();
      });
      U.$('#selTo', el).addEventListener('change', e => {
        V.reports._at = e.target.value;
        App.refresh();
      });
      bindPrint(el);
    },

    // ---------- 学生评分表 ----------
    async renderGrades(el, params) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = (params && params.c) || V.reports._gc;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.reports._gc = selId;
      const cls = classes.find(c => c.id === selId);
      const from = V.reports._gf || '';
      const to = V.reports._gt || '';
      const topic = V.reports._gtp || '';

      const students = await DB.byIndex('students', 'classId', selId);
      const stuMap = {};
      students.forEach(s => stuMap[s.id] = s);

      let records = await DB.byIndex('homeworks', 'classId', selId);
      const topics = [];
      records.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(h => {
        if (!topics.includes(h.topic)) topics.push(h.topic);
      });
      if (topic) records = records.filter(h => h.topic === topic);
      if (from) records = records.filter(h => h.date >= from);
      if (to) records = records.filter(h => h.date <= to);

      // 按学生分组（名单顺序），组内按日期正序
      const groups = [];
      const gmap = {};
      records.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .forEach(h => {
          if (!gmap[h.studentId]) { gmap[h.studentId] = []; groups.push(gmap[h.studentId]); }
          gmap[h.studentId].push(h);
        });
      groups.sort((a, b) => {
        const na = stuMap[a[0].studentId] ? stuMap[a[0].studentId].name : 'zzz';
        const nb = stuMap[b[0].studentId] ? stuMap[b[0].studentId].name : 'zzz';
        return na.localeCompare(nb, 'zh');
      });

      const rangeText = (from || to) ? (from || '…') + ' 至 ' + (to || '…') : '全部日期';
      const head = await reportHeader('学生评分表', cls.name + ' · ' + (topic || '全部课题') + ' · ' + rangeText);
      let rows = '';
      groups.forEach(list => {
        const stu = stuMap[list[0].studentId];
        const name = stu ? stu.name : '（学生已删除）';
        rows += list.map((h, i) =>
          '<tr>' +
          (i === 0 ? '<td rowspan="' + list.length + '" class="l"><b>' + U.escapeHtml(name) + '</b></td>' : '') +
          '<td>' + U.escapeHtml(h.date) + '</td>' +
          '<td class="l">' + U.escapeHtml(h.topic) + '</td>' +
          '<td><span class="grade-badge grade-' + U.gradeClass(h.grade) + '">' + U.escapeHtml(h.grade) + '</span></td>' +
          '<td class="l" style="font-size:12px">' + U.escapeHtml(U.dimsText(h)) + '</td>' +
          '<td class="l">' + U.escapeHtml(h.comment || '') + '</td></tr>').join('');
      });
      if (!groups.length) rows = '<tr><td colspan="6">没有符合条件的作业记录</td></tr>';

      el.innerHTML =
        '<div class="card no-print"><div class="filter-bar">' +
        classSelectHtml(classes, selId) +
        '<select id="selTopic"><option value="">全部课题</option>' +
        topics.map(t => '<option value="' + U.escapeHtml(t) + '"' + (t === topic ? ' selected' : '') + '>' + U.escapeHtml(t) + '</option>').join('') + '</select>' +
        '<label class="muted">从</label><input type="date" id="selFrom" value="' + from + '">' +
        '<label class="muted">到</label><input type="date" id="selTo" value="' + to + '">' +
        '<button class="btn" id="btnReset">清空日期</button>' +
        '</div></div>' +
        '<div class="print-preview card">' + head +
        '<div class="report-wrap"><table class="report-table">' +
        '<tr><th>姓名</th><th>日期</th><th>课题</th><th>综合等级</th><th>分项得分</th><th>评语</th></tr>' +
        rows + '</table></div></div>' +
        printBar();

      U.$('#selClass', el).addEventListener('change', e => {
        V.reports._gc = e.target.value;
        V.reports._gtp = '';
        App.refresh();
      });
      U.$('#selTopic', el).addEventListener('change', e => {
        V.reports._gtp = e.target.value;
        App.refresh();
      });
      U.$('#selFrom', el).addEventListener('change', e => {
        V.reports._gf = e.target.value;
        App.refresh();
      });
      U.$('#selTo', el).addEventListener('change', e => {
        V.reports._gt = e.target.value;
        App.refresh();
      });
      U.$('#btnReset', el).addEventListener('click', () => {
        V.reports._gf = '';
        V.reports._gt = '';
        App.refresh();
      });
      bindPrint(el);
    },

    // ---------- 座位表 ----------
    async renderSeats(el, params) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = (params && params.c) || V.seats._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.seats._c = selId;
      const cls = classes.find(c => c.id === selId);
      let perRow = parseInt(V.seats._per, 10);
      if (isNaN(perRow) || perRow < 2 || perRow > 12) perRow = 6;
      const shuffled = !!V.seats._shuf;

      let students = await DB.byIndex('students', 'classId', selId);
      students.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      if (shuffled) {
        const arr = students.slice();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        students = arr;
      }
      const rows = [];
      for (let i = 0; i < students.length; i += perRow) rows.push(students.slice(i, i + perRow));

      const head = await reportHeader('座位表', cls.name + ' · ' + students.length + ' 人 · 每排 ' + perRow + ' 人');
      el.innerHTML =
        '<div class="card no-print"><div class="filter-bar">' +
        classSelectHtml(classes, selId) +
        '<label class="muted">每排人数</label>' +
        '<input type="number" id="selPer" min="2" max="12" value="' + perRow + '" style="width:76px">' +
        '<button class="btn" id="btnShuf">🔀 随机打乱</button>' +
        '<button class="btn" id="btnOrder">↩️ 名单顺序</button>' +
        '</div></div>' +
        '<div class="print-preview card">' + head +
        (students.length ?
          '<div class="seat-grid"><div class="podium">讲 台</div>' +
          rows.map((row, ri) =>
            '<div class="seat-row">' +
            row.map(s => '<div class="seat-cell">' + U.escapeHtml(s.name) + '</div>').join('') +
            '<span class="muted" style="align-self:center;font-size:12px">第' + (ri + 1) + '排</span>' +
            '</div>').join('') + '</div>'
          : '<div class="empty-state">这个班还没有学生</div>') +
        '</div>' + printBar();

      U.$('#selClass', el).addEventListener('change', e => {
        V.seats._c = e.target.value;
        App.refresh();
      });
      U.$('#selPer', el).addEventListener('change', e => {
        const v = parseInt(e.target.value, 10);
        if (isNaN(v) || v < 2 || v > 12) {
          UI.toast('每排人数请输入 2~12 之间的数字', 'error');
          e.target.value = perRow;
          return;
        }
        V.seats._per = String(v);
        App.refresh();
      });
      U.$('#btnShuf', el).addEventListener('click', () => {
        V.seats._shuf = true;
        App.refresh();
      });
      U.$('#btnOrder', el).addEventListener('click', () => {
        V.seats._shuf = false;
        App.refresh();
      });
      bindPrint(el);
    }
  };
})();
