/* 锁屏密码：仅作界面遮挡保护隐私，不是账号系统、不做身份校验
 * 密码只存"指纹"（哈希值）在本机，备份文件不含密码。
 * 忘记密码 → 清除本机全部数据（二次确认）→ 用备份文件恢复。 */
(function () {
  const ALL_STORES = ['classes', 'students', 'schedules', 'homeworks',
    'attendances', 'disciplines', 'plans', 'works', 'trash', 'meta'];

  const Lock = {
    async isEnabled() {
      const st = await DB.getSettings();
      return !!(st.lockEnabled && st.lockPinHash);
    },

    verify(pin) {
      return U.hash(pin) === Lock._currentHash;
    },

    // 显示全屏遮挡层
    async show() {
      const st = await DB.getSettings();
      if (!(st.lockEnabled && st.lockPinHash)) return;
      Lock._currentHash = st.lockPinHash;
      if (U.$('#lockOverlay')) return;
      const ov = document.createElement('div');
      ov.id = 'lockOverlay';
      ov.className = 'lock-overlay';
      ov.innerHTML =
        '<div class="lock-card">' +
        '<div class="lock-icon">🔒</div>' +
        '<h2>刘星灼美术课</h2>' +
        '<div class="muted">已锁定（仅遮挡界面，保护隐私）</div>' +
        '<div class="lock-err"></div>' +
        '<input type="password" id="lockPin" placeholder="请输入锁屏密码" autocomplete="off">' +
        '<button class="btn btn-primary btn-lg" id="lockGo">解锁</button>' +
        '<button class="lock-forget" id="lockForget">忘记密码？清除本机数据（需二次确认）</button>' +
        '</div>';
      document.body.appendChild(ov);
      const inp = U.$('#lockPin', ov);
      const go = () => {
        if (Lock.verify(inp.value)) {
          ov.remove();
          UI.toast('👋 欢迎回来');
        } else {
          U.$('.lock-err', ov).textContent = '密码不正确，请重试';
          inp.value = '';
          inp.focus();
        }
      };
      U.$('#lockGo', ov).addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      U.$('#lockForget', ov).addEventListener('click', async () => {
        const ok = await UI.confirmDlg({
          title: '清除本机所有数据',
          message: '将清空这台设备上的全部数据（彻底删除，不可恢复）。清除后请用备份文件导入恢复。确定吗？',
          okText: '清除全部数据',
          danger: true
        });
        if (ok) {
          for (const s of ALL_STORES) await DB.clear(s);
          location.reload();
        }
      });
      inp.focus();
    },

    async init() { if (await Lock.isEnabled()) Lock.show(); },
    async lockNow() { await Lock.show(); }
  };

  window.Lock = Lock;
})();
