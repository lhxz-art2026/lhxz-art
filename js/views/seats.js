/* 座位表：按名单顺序自动排座，可设每排人数、随机打乱；打印在下一批（报表）上线 */
(function () {
  const V = window.V = window.V || {};

  V.seats = {
    async render(el, params) {
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

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<label class="muted">每排人数</label>' +
        '<input type="number" id="selPer" min="2" max="12" value="' + perRow + '" style="width:76px">' +
        '<button class="btn" id="btnShuf">🔀 随机打乱</button>' +
        '<button class="btn" id="btnOrder">↩️ 名单顺序</button>' +
        '<button class="btn btn-primary" id="btnPrint">🖨️ 打印座位表</button>' +
        '</div>' +
        '<div class="stat-line">共 <b>' + students.length + '</b> 个座位 · ' + rows.length + ' 排 · 每排 ' + perRow + ' 人</div>' +
        '</div>' +
        (students.length ?
          '<div class="card" style="margin-top:14px">' +
          '<div class="seat-grid"><div class="podium">讲 台</div>' +
          rows.map((row, ri) =>
            '<div class="seat-row">' +
            row.map(s => '<div class="seat-cell">' + U.escapeHtml(s.name) + '</div>').join('') +
            '<span class="muted" style="align-self:center;font-size:12px">第' + (ri + 1) + '排</span>' +
            '</div>').join('') +
          '</div></div>'
          : '<div class="empty-state">🪑 这个班还没有学生</div>');

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
      U.$('#btnPrint', el).addEventListener('click', () =>
        location.hash = '#/reports/seats?c=' + selId);
    }
  };
})();
