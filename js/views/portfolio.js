/* 学生成长档案：全周期教学数据汇总 + 等级趋势图 + 7 维雷达图（ECharts）
 * 入口：左侧导航「成长档案」选学生；或学生快捷面板里的「📊 档案」按钮 */
(function () {
  const V = window.V = window.V || {};
  let _charts = [];

  function disposeCharts() {
    _charts.forEach(c => { try { c.dispose(); } catch (e) { /* 忽略 */ } });
    _charts = [];
  }
  window.addEventListener('resize', () => {
    _charts.forEach(c => { if (c.resize) c.resize(); });
  });

  function chart(container, option) {
    if (!window.echarts) return null;
    const c = echarts.init(container);
    c.setOption(option);
    _charts.push(c);
    return c;
  }

  function statCard(v, label, color) {
    return '<div class="stat-card"><div class="stat-v" style="color:' + (color || 'var(--text)') + '">' +
      U.escapeHtml(String(v)) + '</div><div class="stat-l">' + U.escapeHtml(label) + '</div></div>';
  }

  V.portfolio = {
    // ---------- 选学生页 ----------
    async render(el) {
      disposeCharts();
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = V.portfolio._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.portfolio._c = selId;
      const cls = classes.find(c => c.id === selId);

      const students = (await DB.byIndex('students', 'classId', selId))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      const [hws, wks] = await Promise.all([
        DB.byIndex('homeworks', 'classId', selId),
        DB.byIndex('works', 'classId', selId)
      ]);
      const hwCnt = {}, wkCnt = {};
      hws.forEach(h => hwCnt[h.studentId] = (hwCnt[h.studentId] || 0) + 1);
      wks.forEach(w => wkCnt[w.studentId] = (wkCnt[w.studentId] || 0) + 1);

      el.innerHTML =
        '<div class="card"><div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '</div>' +
        '<div class="page-note">💡 点学生卡片查看「美术学科学生成长档案」：评分趋势、7 维能力雷达、考勤纪律统计、优秀作品集，可打印</div>' +
        '</div>' +
        (students.length ?
          '<div class="card-grid">' + students.map(s =>
            '<div class="card quick-card" style="cursor:pointer" data-id="' + s.id + '">' +
            '<div class="avatar" style="background:' + U.avatarColor(s.name) + '">' + U.escapeHtml((s.name || '?').charAt(0)) + '</div>' +
            '<div><b>' + U.escapeHtml(s.name) + '</b>' +
            '<div class="muted">作业 ' + (hwCnt[s.id] || 0) + ' 次 · 优秀作品 ' + (wkCnt[s.id] || 0) + ' 件</div></div>' +
            '</div>').join('') + '</div>'
          : '<div class="empty-state">🎒 这个班还没有学生</div>');

      U.$('#selClass', el).addEventListener('change', e => {
        V.portfolio._c = e.target.value;
        App.refresh();
      });
      U.$$('[data-id]', el).forEach(card => {
        card.addEventListener('click', () =>
          location.hash = '#/portfolio/' + card.getAttribute('data-id'));
      });
    },

    // ---------- 档案详情 ----------
    async renderDetail(el, sid) {
      disposeCharts();
      const student = await DB.get('students', sid);
      if (!student) { location.hash = '#/portfolio'; return; }
      const cls = await DB.get('classes', student.classId) || { name: '（班级已删除）' };
      const [hws, ats, dcs, wks] = await Promise.all([
        DB.byIndex('homeworks', 'studentId', sid),
        DB.byIndex('attendances', 'studentId', sid),
        DB.byIndex('disciplines', 'studentId', sid),
        DB.byIndex('works', 'studentId', sid)
      ]);
      hws.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

      // 统计
      const gradeNums = hws.map(h => 8 - U.GRADES.indexOf(h.grade));
      const aCount = hws.filter(h => U.gradeClass(h.grade) === 'a').length;
      const avgGrade = gradeNums.length
        ? gradeNums.reduce((a, b) => a + b, 0) / gradeNums.length : 0;
      const avgLabel = hws.length
        ? U.GRADES[Math.min(7, Math.max(0, 8 - Math.round(avgGrade)))] : '—';
      const attCount = { '出勤': 0, '迟到': 0, '早退': 0, '请假': 0, '缺勤': 0 };
      ats.forEach(a => { if (attCount[a.status] !== undefined) attCount[a.status]++; });
      const attRate = ats.length
        ? Math.round((attCount['出勤'] + attCount['迟到'] + attCount['早退']) / ats.length * 100) + '%'
        : '—';
      const praise = dcs.filter(d => d.type === '表扬').length;
      const remind = dcs.filter(d => d.type === '提醒').length;

      // 维度平均分
      const dimAvgs = U.DIMS.map(([k]) => {
        const vals = hws.map(h => (h.dims || {})[k]).filter(v => v > 0);
        return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
      });

      const dates = hws.map(h => h.date);

      el.innerHTML =
        '<div class="no-print page-actions">' +
        '<button class="btn" id="btnBack">← 返回列表</button>' +
        '<button class="btn btn-primary" id="btnPrint">🖨️ 打印成长档案</button>' +
        '</div>' +
        '<div class="print-preview">' +
        '<div class="card">' +
        '<div class="port-head">' +
        '<div class="port-avatar" style="background:' + U.avatarColor(student.name) + '">' + U.escapeHtml((student.name || '?').charAt(0)) + '</div>' +
        '<div><h2 style="margin:0">' + U.escapeHtml(student.name) + ' · 成长档案</h2>' +
        '<div class="muted">' + U.escapeHtml(cls.name) +
        (student.num ? ' · 学号 ' + U.escapeHtml(student.num) : '') +
        (student.gender ? ' · ' + U.escapeHtml(student.gender) : '') +
        (student.note ? ' · ' + U.escapeHtml(student.note) : '') + '</div>' +
        '<div class="muted">统计范围：全部历史记录（' + (hws.length ? dates[0] + ' 起' : '暂无记录') + '）</div></div>' +
        '</div>' +
        '<div class="stat-cards">' +
        statCard(hws.length, '作业次数') +
        statCard(aCount, 'A 以上', '#16a34a') +
        statCard(avgLabel, '平均等级', '#2f6fed') +
        statCard(attRate, '出勤率(含迟到)', '#16a34a') +
        statCard(praise, '表扬', '#16a34a') +
        statCard(remind, '提醒', '#d97706') +
        statCard(wks.length, '优秀作品') +
        '</div>' +
        '</div>' +
        '<div class="chart-grid">' +
        '<div class="card"><h3 class="sec-title">📈 综合等级趋势</h3>' +
        (hws.length ? '<div id="chartTrend" class="chart-box"></div>'
          : '<div class="muted">登记作业后自动生成趋势图</div>') + '</div>' +
        '<div class="card"><h3 class="sec-title">🕸️ 7 维能力雷达（平均分）</h3>' +
        (hws.length ? '<div id="chartRadar" class="chart-box"></div>'
          : '<div class="muted">作业里打了维度星后自动生成</div>') + '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:14px"><h3 class="sec-title">✅ 考勤统计</h3>' +
        (ats.length ?
          '<div class="stat-line">' +
          ['出勤', '迟到', '早退', '请假', '缺勤'].map(s =>
            '<b class="chip chip-' + ({ '出勤': 'ok', '迟到': 'late', '早退': 'early', '请假': 'leave', '缺勤': 'absent' }[s]) + ' on">' + s + ' ' + attCount[s] + '</b>').join(' ') +
          '</div>' : '<div class="muted">还没有考勤记录</div>') +
        '</div>' +
        '<div class="card" style="margin-top:14px"><h3 class="sec-title">⭐ 纪律记录（最近20条）</h3>' +
        (dcs.length ?
          dcs.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 20).map(d =>
            '<div class="rec-item"><div class="rec-head">' +
            '<span class="type-badge ' + (d.type === '表扬' ? 'praise' : 'remind') + '">' +
            (d.type === '表扬' ? '👍 ' : '⚠️ ') + U.escapeHtml(d.type) + '</span>' +
            '<span class="muted">' + '★'.repeat(d.stars || 1) + ' · ' + U.escapeHtml(d.date) + '</span></div>' +
            (d.desc ? '<div class="muted">💬 ' + U.escapeHtml(d.desc) + '</div>' : '') +
            '</div>').join('')
          : '<div class="muted">还没有纪律记录</div>') +
        '</div>' +
        '<div class="card" style="margin-top:14px"><h3 class="sec-title">📷 优秀作品集（' + wks.length + '）</h3>' +
        (wks.length ?
          '<div class="thumb-grid">' + wks.slice().sort((a, b) => b.date.localeCompare(a.date)).map(w =>
            '<img src="' + w.images[0] + '" alt="作品" title="' + U.escapeHtml(w.date) + '">').join('') + '</div>'
          : '<div class="muted">还没有优秀作品</div>') +
        '</div>' +
        '</div>';

      U.$('#btnBack', el).addEventListener('click', () => location.hash = '#/portfolio');
      U.$('#btnPrint', el).addEventListener('click', () => window.print());
      U.$$('.thumb-grid img', el).forEach(im => {
        im.addEventListener('click', () => {
          const w = wks.find(x => x.images[0] === im.src);
          if (w) UI.lightbox(w.images, student.name + ' · ' + w.date + (w.title ? ' · ' + w.title : ''));
        });
      });

      // 图表（ECharts）
      if (window.echarts && hws.length) {
        chart(U.$('#chartTrend', el), {
          grid: { left: 44, right: 16, top: 16, bottom: 26 },
          tooltip: {
            trigger: 'axis',
            formatter: p => {
              const it = p && p[0];
              return it ? it.axisValue + '<br>' + U.GRADES[8 - it.value] : '';
            }
          },
          xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11, rotate: dates.length > 14 ? 45 : 0 } },
          yAxis: {
            type: 'value', min: 1, max: 8, inverse: true, interval: 1,
            axisLabel: { formatter: v => U.GRADES[8 - v] }
          },
          series: [{
            type: 'line', smooth: true, data: gradeNums,
            lineStyle: { color: '#2f6fed', width: 3 },
            itemStyle: { color: '#2f6fed' },
            areaStyle: { color: 'rgba(47,111,237,.14)' }
          }]
        });
        chart(U.$('#chartRadar', el), {
          tooltip: {},
          radar: {
            indicator: U.DIMS.map(([k, l]) => ({ name: l, max: 5 })),
            radius: '62%',
            axisName: { color: '#6b7280', fontSize: 12 },
            splitArea: { areaStyle: { color: ['#f8fafc', '#eef4fd'] } }
          },
          series: [{
            type: 'radar',
            data: [{
              value: dimAvgs, name: '平均得分',
              areaStyle: { color: 'rgba(47,111,237,.25)' },
              lineStyle: { color: '#2f6fed', width: 2 },
              itemStyle: { color: '#2f6fed' }
            }]
          }]
        });
      }
    }
  };
})();
