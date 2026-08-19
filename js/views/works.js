/* 优秀作业相册墙：按班级浏览，点开大图，可删除（进回收站） */
(function () {
  const V = window.V = window.V || {};

  V.works = {
    async render(el) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = V.works._c;
      if (selId !== '' && !classes.some(c => c.id === selId)) selId = '';
      V.works._c = selId;

      const works = selId
        ? await DB.byIndex('works', 'classId', selId)
        : await DB.all('works');
      works.sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));

      const students = await DB.all('students');
      const stuMap = {};
      students.forEach(s => stuMap[s.id] = s);

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass"><option value="">全部班级</option>' +
        classes.map(c => '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '</div>' +
        '<div class="stat-line">共 <b>' + works.length + '</b> 件优秀作品</div>' +
        '<div class="page-note">💡 上传入口：到「班级 → 学生名单」点学生卡片，选「优秀作业」标签拍照上传</div>' +
        '</div>' +
        (works.length ?
          '<div class="works-grid">' + works.map(w => {
            const stu = stuMap[w.studentId];
            const name = stu ? stu.name : '（学生已删除）';
            return '<div class="work-card" data-id="' + w.id + '">' +
              '<img src="' + w.images[0] + '" alt="作品照片" loading="lazy">' +
              '<div class="work-cap"><b>' + U.escapeHtml(stu ? stu.name : '（学生已删除）') + '</b>' +
              '<div class="muted">' + U.escapeHtml(w.date) + (w.title ? ' · ' + U.escapeHtml(w.title) : '') + '</div>' +
              '<div class="rec-actions"><button class="btn btn-danger btn-sm" data-a="del" data-id="' + w.id + '">删除</button></div></div></div>';
          }).join('') + '</div>'
          : '<div class="empty-state">📷 还没有优秀作品<br><span class="muted">到班级名单页点学生卡片上传</span></div>');

      U.$('#selClass', el).addEventListener('change', e => {
        V.works._c = e.target.value;
        App.refresh();
      });
      U.$$('.work-card', el).forEach(card => {
        card.addEventListener('click', e => {
          if (e.target.closest('[data-a="del"]')) return;
          const w = works.find(x => x.id === card.getAttribute('data-id'));
          if (!w) return;
          const stu = stuMap[w.studentId];
          UI.lightbox(w.images, (stu ? stu.name : '学生已删除') + ' · ' + w.date + (w.title ? ' · ' + w.title : ''));
        });
      });
      U.$$('[data-a="del"]', el).forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const w = works.find(x => x.id === btn.getAttribute('data-id'));
          if (!w) return;
          const ok = await UI.confirmDlg({
            title: '删除优秀作品',
            message: '确定删除「' + (w.title || w.date) + '」吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('work', w, '优秀作业相册');
            UI.toast('已移入回收站');
            App.refresh();
          }
        });
      });
    }
  };
})();
