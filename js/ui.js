/* 界面小零件：轻提示、确认弹窗、表单弹窗、表单项 */
(function () {
  const UI = {};

  // 底部轻提示。type: info / success / error
  UI.toast = function (msg, type) {
    let wrap = U.$('#toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 2600);
  };

  // 二次确认弹窗，返回 Promise<boolean>。danger=true 时确定按钮为红色
  UI.confirmDlg = function (opts) {
    const o = Object.assign({ title: '确认操作', message: '', okText: '确定', cancelText: '取消', danger: false }, opts);
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML =
        '<div class="modal" role="dialog">' +
        '<div class="modal-head"><h3>' + U.escapeHtml(o.title) + '</h3><button class="icon-btn modal-x" aria-label="关闭">✕</button></div>' +
        '<div class="modal-body"><p class="modal-msg">' + U.escapeHtml(o.message) + '</p></div>' +
        '<div class="modal-actions">' +
        '<button class="btn" data-act="cancel">' + U.escapeHtml(o.cancelText) + '</button>' +
        '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + U.escapeHtml(o.okText) + '</button>' +
        '</div></div>';
      document.body.appendChild(backdrop);
      const close = v => {
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
        resolve(v);
      };
      const onKey = e => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onKey);
      backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
      U.$('[data-act="cancel"]', backdrop).addEventListener('click', () => close(false));
      U.$('[data-act="ok"]', backdrop).addEventListener('click', () => close(true));
      U.$('.modal-x', backdrop).addEventListener('click', () => close(false));
      U.$('[data-act="cancel"]', backdrop).focus(); // 危险操作默认焦点放在"取消"上，防误按回车
    });
  };

  // 表单弹窗骨架，返回 { el, body, actions, close }
  UI.modal = function (opts) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal" role="dialog">' +
      '<div class="modal-head"><h3>' + U.escapeHtml(opts.title || '') + '</h3><button class="icon-btn modal-x" aria-label="关闭">✕</button></div>' +
      '<div class="modal-body"></div>' +
      '<div class="modal-actions"></div></div>';
    document.body.appendChild(backdrop);
    const api = {
      el: backdrop,
      body: U.$('.modal-body', backdrop),
      actions: U.$('.modal-actions', backdrop),
      close() { backdrop.remove(); }
    };
    U.$('.modal-x', backdrop).addEventListener('click', () => api.close());
    backdrop.addEventListener('click', e => { if (e.target === backdrop) api.close(); });
    return api;
  };

  // 表单项：label + 输入框 + 红色中文错误提示行
  UI.field = function (label, input) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const lab = document.createElement('label');
    lab.textContent = label;
    const err = document.createElement('div');
    err.className = 'field-error';
    err.style.display = 'none';
    wrap.append(lab, input, err);
    return {
      el: wrap,
      input,
      setError(m) {
        err.textContent = m;
        err.style.display = m ? '' : 'none';
        input.classList.toggle('input-error', !!m);
      },
      clearError() { this.setError(''); }
    };
  };

  // 五星评分组件：点星星即打分，点当前分值的星可取消（留空）
  UI.stars = function (opts) {
    const o = Object.assign({ max: 5, value: 0, size: '' }, opts);
    const wrap = document.createElement('div');
    wrap.className = 'stars' + (o.size ? ' stars-' + o.size : '');
    const update = v => {
      wrap.value = v;
      U.$$('.star', wrap).forEach((b, i) => {
        const on = i < v;
        b.textContent = on ? '★' : '☆';
        b.classList.toggle('on', on);
      });
    };
    for (let i = 1; i <= o.max; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star';
      b.setAttribute('aria-label', i + ' 星');
      b.addEventListener('click', () => {
        const v = i === wrap.value ? 0 : i;
        update(v);
        if (o.onChange) o.onChange(v);
      });
      wrap.appendChild(b);
    }
    wrap.set = update;
    update(o.value);
    return wrap;
  };

  // 大图浏览：左右翻页、键盘方向键、Esc 关闭
  UI.lightbox = function (images, caption) {
    let idx = 0;
    const box = document.createElement('div');
    box.className = 'lightbox';
    const img = document.createElement('img');
    img.alt = '作品照片';
    const cap = document.createElement('div');
    cap.className = 'lightbox-cap';
    const btnPrev = document.createElement('button');
    btnPrev.className = 'lightbox-nav left';
    btnPrev.innerHTML = '‹';
    const btnNext = document.createElement('button');
    btnNext.className = 'lightbox-nav right';
    btnNext.innerHTML = '›';
    const btnX = document.createElement('button');
    btnX.className = 'lightbox-x';
    btnX.innerHTML = '✕';
    const render = () => {
      img.src = images[idx];
      cap.textContent = (caption ? caption + ' · ' : '') + (idx + 1) + ' / ' + images.length;
    };
    const close = () => {
      box.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') { idx = (idx - 1 + images.length) % images.length; render(); }
      else if (e.key === 'ArrowRight') { idx = (idx + 1) % images.length; render(); }
    };
    document.addEventListener('keydown', onKey);
    btnPrev.onclick = e => { e.stopPropagation(); idx = (idx - 1 + images.length) % images.length; render(); };
    btnNext.onclick = e => { e.stopPropagation(); idx = (idx + 1) % images.length; render(); };
    btnX.onclick = close;
    box.addEventListener('click', e => { if (e.target === box) close(); });
    box.append(img, cap, btnPrev, btnNext, btnX);
    render();
    document.body.appendChild(box);
  };

  window.UI = UI;
})();
