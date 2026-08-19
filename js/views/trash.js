/* 回收站页：按类型分栏查看，可一键还原、可彻底清理 */
(function () {
  const V = window.V = window.V || {};
  const ORDER = [
    ['class', '🏫'], ['student', '🎒'], ['schedule', '📅'], ['homework', '✏️'],
    ['attendance', '✅'], ['discipline', '⭐'], ['plan', '📝'], ['work', '📷']
  ];

  V.trash = {
    async render(el) {
      const list = await DB.all('trash');
      list.sort((a, b) => b.deletedAt - a.deletedAt);
      const groups = ORDER.map(([t, icon]) => ({
        icon, type: t, label: RC.TYPE_LABEL[t],
        items: list.filter(x => x.type === t)
      })).filter(g => g.items.length);

      el.innerHTML =
        '<div class="page-actions"><button class="btn btn-danger" id="btnEmptyTrash">🗑️ 彻底清空回收站</button></div>' +
        (list.length ? '' :
          '<div class="empty-state">🗑️ 回收站是空的<br><span class="muted">删除的数据会先来到这里，可随时还原</span></div>') +
        (list.length ?
          '<div class="page-note">💡 删除的班级/学生还原时，它们名下的记录会一起还原；「彻底删除」后不可恢复</div>' : '') +
        groups.map(g =>
          '<h2 class="sec-title">' + g.icon + ' ' + g.label + '（' + g.items.length + '）</h2>' +
          g.items.map(t =>
            '<div class="card trash-item">' +
            '<div class="trash-info"><b>' + U.escapeHtml(t.label) + '</b>' +
            '<div class="muted">' + U.escapeHtml(t.source) + ' · 删除于 ' + U.fmtDateTime(t.deletedAt) + '</div></div>' +
            '<div class="trash-actions">' +
            '<button class="btn btn-primary btn-sm" data-act="restore" data-id="' + t.id + '">♻️ 还原</button>' +
            '<button class="btn btn-danger btn-sm" data-act="purge" data-id="' + t.id + '">彻底删除</button>' +
            '</div></div>').join('')
        ).join('');

      if (!list.length) return;

      U.$('#btnEmptyTrash', el).addEventListener('click', async () => {
        const ok = await UI.confirmDlg({
          title: '彻底清空回收站',
          message: '回收站里所有数据将被彻底删除，之后无法恢复。确定继续吗？',
          okText: '彻底清空',
          danger: true
        });
        if (ok) {
          await RC.emptyTrash();
          UI.toast('回收站已清空');
          App.refresh();
        }
      });
      U.$$('[data-act]', el).forEach(btn => {
        const id = btn.getAttribute('data-id');
        btn.addEventListener('click', async () => {
          if (btn.getAttribute('data-act') === 'restore') {
            const r = await RC.restore(id);
            if (r.ok) {
              UI.toast('✅ 已还原到原位置', 'success');
              App.refresh();
            } else {
              UI.toast('❌ ' + r.msg, 'error');
            }
          } else {
            const ok = await UI.confirmDlg({
              title: '彻底删除',
              message: '彻底删除后不可恢复，确定吗？',
              okText: '彻底删除',
              danger: true
            });
            if (ok) {
              await RC.purgeOne(id);
              UI.toast('已彻底删除');
              App.refresh();
            }
          }
        });
      });
    }
  };
})();
