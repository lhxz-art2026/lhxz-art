/* 数据备份页：常驻醒目提醒 + 一键导出 / 一键导入 */
(function () {
  const V = window.V = window.V || {};
  V.backupView = {
    async render(el) {
      const st = await DB.getSettings();
      const last = st.lastBackupAt;
      const statusLine = last
        ? '上次备份：' + U.fmtDateTime(last) + '（' + U.daysAgo(last) + ' 天前）'
        : '⚠️ 您还没有导出过备份';
      const remindLine = '建议每 ' + st.remindDays + ' 天备份一次，超过未备份界面会醒目提示。';

      el.innerHTML =
        '<div class="banner ' + (last ? 'banner-warn' : 'banner-danger') + '"><strong>⚠️ 请定期导出备份！</strong>' +
        '数据保存在这台设备的浏览器里，清理浏览器缓存或更换设备会丢失数据。' +
        '建议每周导出一次备份文件，存到 U 盘、网盘或微信「文件传输助手」。</div>' +
        '<div class="card backup-card">' +
        '<div class="muted">' + U.escapeHtml(statusLine) + '</div>' +
        '<div class="muted">' + U.escapeHtml(remindLine) + '</div>' +
        '<div class="backup-btns">' +
        '<button class="btn btn-primary btn-lg" id="btnExport">📤 导出备份文件</button>' +
        '<button class="btn btn-lg" id="btnImport">📥 导入备份恢复</button>' +
        '<input type="file" id="importFile" accept=".json,application/json" hidden>' +
        '</div></div>' +
        '<div class="card" style="margin-top:14px"><b>📦 备份文件说明</b>' +
        '<ul class="help-list">' +
        '<li>备份文件 = 1 个 .json 文件，包含全部教学数据（不含锁屏密码）</li>' +
        '<li>换设备搬家三步：旧设备「导出」→ 把文件发到新设备（微信/U盘/网盘）→ 新设备「导入」</li>' +
        '<li>导入会覆盖当前全部数据，导入前软件会先弹窗向您确认</li>' +
        '</ul></div>';

      U.$('#btnExport', el).addEventListener('click', () => Backup.exportBackup());
      U.$('#btnImport', el).addEventListener('click', () => U.$('#importFile', el).click());
      U.$('#importFile', el).addEventListener('change', e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) Backup.importBackup(f);
      });
    }
  };
})();
