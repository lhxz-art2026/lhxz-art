/* 未上线模块的占位页：说明功能与上线批次 */
(function () {
  const V = window.V = window.V || {};
  V.placeholder = function (name, desc) {
    return {
      render(el) {
        el.innerHTML =
          '<div class="card"><div class="empty-state">🚧 ' + U.escapeHtml(name) + ' 正在建设中<br>' +
          '<span class="muted">' + U.escapeHtml(desc) + '</span></div></div>';
      }
    };
  };
})();
