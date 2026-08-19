/* 工作台首页（第三批会升级为"今日课表 + 待办提醒"完整版） */
(function () {
  const V = window.V = window.V || {};
  V.dashboard = {
    async render(el) {
      el.innerHTML =
        '<div class="banner banner-warn"><strong>⚠️ 请定期导出备份！</strong>' +
        '数据保存在这台设备的浏览器里，清理浏览器缓存或更换设备会丢失数据。' +
        '建议每周导出一次备份文件，存到 U 盘、网盘或微信「文件传输助手」。</div>' +
        '<h2 class="sec-title">快捷入口</h2>' +
        '<div class="card-grid">' +
        '<a class="card quick-card" href="#/classes"><div class="quick-icon">👥</div><div><b>我的班级</b><div class="muted">学生名单与登记</div></div></a>' +
        '<a class="card quick-card" href="#/backup"><div class="quick-icon">💾</div><div><b>数据备份</b><div class="muted">导出 / 导入备份文件</div></div></a>' +
        '<a class="card quick-card" href="#/trash"><div class="quick-icon">🗑️</div><div><b>回收站</b><div class="muted">还原误删的数据</div></div></a>' +
        '<a class="card quick-card" href="#/settings"><div class="quick-icon">⚙️</div><div><b>设置</b><div class="muted">报表抬头、备份提醒</div></div></a>' +
        '</div>' +
        '<h2 class="sec-title">开发进度</h2>' +
        '<div class="card placeholder-card">✅ <b>全部功能已上线</b>：班级、学生名单、快捷登记（作业评分/考勤/纪律/优秀作业）、课表、备课（含备课框架助手）、座位表、报表打印、Excel 导入导出、学生成长档案、锁屏密码、备份搬家、回收站、设置<br>' +
        '🎉 软件已进入整体验收阶段：请按验收清单逐项试用，发现问题随时反馈</div>';
    }
  };
})();
