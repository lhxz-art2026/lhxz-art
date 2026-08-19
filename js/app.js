/* 应用入口：左侧导航 + 顶部工具条 + 页面路由 + PWA 注册 */
(function () {
  const NAV = [
    { hash: '#/dashboard', icon: '🏠', name: '工作台', phase: 3 },
    { hash: '#/schedule', icon: '📅', name: '课表', phase: 1 },
    { hash: '#/classes', icon: '👥', name: '班级', phase: 1 },
    { hash: '#/plans', icon: '📝', name: '备课', phase: 1 },
    { hash: '#/homeworks', icon: '✏️', name: '作业', phase: 1 },
    { hash: '#/attendance', icon: '✅', name: '考勤', phase: 1 },
    { hash: '#/discipline', icon: '⭐', name: '纪律', phase: 1 },
    { hash: '#/works', icon: '📷', name: '优秀作业', phase: 1 },
    { hash: '#/portfolio', icon: '📊', name: '成长档案', phase: 1 },
    { hash: '#/reports', icon: '🖨️', name: '报表', phase: 1 },
    { hash: '#/backup', icon: '💾', name: '备份', phase: 1 },
    { hash: '#/trash', icon: '🗑️', name: '回收站', phase: 1 },
    { hash: '#/settings', icon: '⚙️', name: '设置', phase: 1 }
  ];
  const PHASE_LABEL = { 1: '已上线', 2: '第2批', 3: '第3批' };

  const ROUTES = {
    '#/dashboard': { title: '工作台', view: V.dashboard },
    '#/schedule': { title: '课表', view: V.schedule },
    '#/classes': { title: '班级', view: V.classes },
    '#/plans': { title: '备课', view: V.plans },
    '#/seats': { title: '座位表', view: V.seats },
    '#/homeworks': { title: '作业', view: V.homeworks },
    '#/attendance': { title: '考勤', view: V.attendance },
    '#/discipline': { title: '纪律', view: V.discipline },
    '#/works': { title: '优秀作业', view: V.works },
    '#/portfolio': { title: '成长档案', view: V.portfolio },
    '#/reports': { title: '报表', view: V.reports },
    '#/backup': { title: '备份', view: V.backupView },
    '#/trash': { title: '回收站', view: V.trash },
    '#/settings': { title: '设置', view: V.settings }
  };

  const nav = U.$('#nav');
  const pageTitle = U.$('#pageTitle');
  const content = U.$('#content');
  const sidebar = U.$('#sidebar');
  const backdrop = U.$('#backdrop');
  const menuBtn = U.$('#menuBtn');
  const badge = U.$('#backupBadge');
  const lockBtn = U.$('#lockBtn');

  function buildNav() {
    nav.innerHTML = NAV.map(n =>
      '<a class="nav-item" href="' + n.hash + '">' +
      '<span class="nav-icon">' + n.icon + '</span>' +
      '<span class="nav-name">' + n.name + '</span>' +
      '<span class="phase-tag phase-' + n.phase + '">' + PHASE_LABEL[n.phase] + '</span>' +
      '</a>').join('');
  }

  function setActive(match) {
    U.$$('.nav-item', nav).forEach(a => a.classList.toggle('active', a.getAttribute('href') === match));
  }

  function route() {
    const raw = location.hash || '#/dashboard';
    const qi = raw.indexOf('?');
    const path = qi >= 0 ? raw.slice(0, qi) : raw;
    const query = qi >= 0 ? raw.slice(qi + 1) : '';
    const params = query ? Object.fromEntries(new URLSearchParams(query)) : {};
    let r, match;
    if (path.indexOf('#/roster/') === 0) {
      const id = decodeURIComponent(path.slice(9));
      match = '#/classes';
      r = { title: '学生名单', view: { render: el => V.roster.render(el, id) } };
    } else if (path.indexOf('#/plans/') === 0) {
      const id = decodeURIComponent(path.slice(8));
      match = '#/plans';
      r = { title: '备课编辑', view: { render: el => V.plans.renderEditor(el, id) } };
    } else if (path.indexOf('#/portfolio/') === 0) {
      const id = decodeURIComponent(path.slice(12));
      match = '#/portfolio';
      r = { title: '学生成长档案', view: { render: el => V.portfolio.renderDetail(el, id) } };
    } else if (path.indexOf('#/reports/') === 0) {
      const kind = path.slice(10);
      const TITLES = { schedule: '课表打印', attendance: '点名考勤表', grades: '学生评分表', seats: '座位表打印' };
      const METHODS = { schedule: 'renderSchedule', attendance: 'renderAttendance', grades: 'renderGrades', seats: 'renderSeats' };
      match = '#/reports';
      const method = METHODS[kind];
      r = {
        title: TITLES[kind] || '报表',
        view: { render: el => method ? V.reports[method](el, params) : V.reports.render(el) }
      };
    } else {
      r = ROUTES[path];
      if (!r) { location.hash = '#/dashboard'; return; }
      match = path;
    }
    setActive(match);
    pageTitle.textContent = r.title;
    content.innerHTML = '';
    Promise.resolve(r.view.render(content, params)).catch(err => {
      console.error(err);
      content.innerHTML = '<div class="empty-state">⚠️ 页面加载出错，请刷新重试</div>';
    });
  }

  async function refreshBackupBadge() {
    const st = await DB.getSettings();
    const d = U.daysAgo(st.lastBackupAt);
    if (d === null) {
      badge.className = 'badge-btn badge-danger';
      badge.textContent = '⚠️ 尚未备份';
    } else if (d >= st.remindDays) {
      badge.className = 'badge-btn badge-danger';
      badge.textContent = '⚠️ ' + d + ' 天未备份';
    } else {
      badge.className = 'badge-btn';
      badge.textContent = d === 0 ? '💾 今天已备份' : '💾 ' + d + ' 天前备份';
    }
  }

  async function refreshBrandAvatar() {
    const st = await DB.getSettings();
    const a = U.$('#brandAvatar');
    if (!a) return;
    a.innerHTML = st.avatar ? '<img src="' + st.avatar + '" alt="头像">' : '🎨';
  }

  async function refreshLockBtn() {
    const st = await DB.getSettings();
    lockBtn.style.display = (st.lockEnabled && st.lockPinHash) ? '' : 'none';
  }

  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('.nav-item')) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    }
  });
  badge.addEventListener('click', () => location.hash = '#/backup');
  lockBtn.addEventListener('click', () => Lock.lockNow());
  document.addEventListener('lxz-changed', e => {
    if (e.detail && e.detail.store === 'meta') {
      refreshBackupBadge();
      refreshBrandAvatar();
      refreshLockBtn();
    }
  });

  const App = { refresh: route, refreshBackupBadge };
  window.App = App;

  DB.init().then(() => {
    buildNav();
    window.addEventListener('hashchange', route);
    route();
    refreshBackupBadge();
    refreshBrandAvatar();
    refreshLockBtn();
    Lock.init();
    // PWA 离线缓存：仅在正式网址或本地调试服务器上启用（电脑双击打开时自动跳过，不影响使用）
    if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }).catch(err => {
    alert('软件初始化失败：' + (err && err.message) + '\n请确认使用的是最新版 Edge 或 Chrome 浏览器。');
  });
})();
