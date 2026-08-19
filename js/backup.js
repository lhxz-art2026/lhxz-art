/* 数据备份：一键导出完整备份文件 / 一键导入恢复全部数据
 * 备份文件 = 1 个 .json 文件，包含全部数据（不含锁屏密码）。
 * 导入前校验：不是本软件的备份 / 版本过高，都友好提示且不破坏现有数据。 */
(function () {
  const APP_TAG = 'liuxingzhuo-art';
  const FORMAT = 'lxz-backup';
  const DATA_VERSION = 1;
  const STORE_LIST = ['classes', 'students', 'schedules', 'homeworks',
    'attendances', 'disciplines', 'plans', 'works', 'trash'];

  async function exportBackup() {
    const data = {};
    for (const s of STORE_LIST) data[s] = await DB.all(s);
    data.settings = await DB.getSettings();
    const payload = {
      app: APP_TAG,
      format: FORMAT,
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      device: navigator.platform || '未知设备',
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const d = new Date();
    const name = '刘星灼美术课备份-' + d.getFullYear() + U.pad(d.getMonth() + 1) + U.pad(d.getDate())
      + '-' + U.pad(d.getHours()) + U.pad(d.getMinutes()) + '.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    await DB.saveSettings({ lastBackupAt: Date.now() });
    UI.toast('✅ 备份文件已导出，请妥善保存到 U 盘、网盘或微信「文件传输助手」', 'success');
  }

  async function importBackup(file) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (obj.app !== APP_TAG || obj.format !== FORMAT) {
        throw new Error('这不是本软件的备份文件');
      }
      if (typeof obj.version !== 'number' || obj.version > DATA_VERSION) {
        throw new Error('备份文件版本比当前软件新，请先升级软件再导入');
      }
      const ok = await UI.confirmDlg({
        title: '导入备份',
        message: '导入将覆盖当前全部数据，确定继续吗？建议先点「导出备份文件」把当前数据留底。',
        okText: '覆盖并导入',
        danger: true
      });
      if (!ok) return;
      for (const s of STORE_LIST) await DB.clear(s);
      for (const s of STORE_LIST) await DB.putMany(s, obj.data[s] || []);
      await DB.put('meta', Object.assign({ key: 'settings' }, obj.data.settings || {}));
      UI.toast('✅ 导入成功，数据已恢复', 'success');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      UI.toast('❌ 导入失败：' + (e.message || '文件无法读取'), 'error');
    }
  }

  window.Backup = { exportBackup, importBackup };
})();
