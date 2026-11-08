/* 刘星灼美术课 - 离线缓存服务（PWA）
 * 作用：第一次打开后把"软件壳"存进设备，之后断网也能打开软件。
 * 注意：只缓存软件外壳（页面/样式/脚本），不缓存您的数据——数据在浏览器内置数据库里。 */
const CACHE = 'lxz-art-v6';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'js/util.js', 'js/db.js', 'js/ui.js', 'js/lock.js', 'js/recycle.js', 'js/backup.js',
  'js/vendor/echarts.min.js',
  'js/views/dashboard.js', 'js/views/classes.js', 'js/views/roster.js',
  'js/views/panel.js', 'js/views/attendance.js', 'js/views/discipline.js',
  'js/views/homeworks.js', 'js/views/missing.js', 'js/views/works.js',
  'js/views/schedule.js', 'js/views/plans.js', 'js/views/seats.js',
  'js/views/reports.js', 'js/views/portfolio.js',
  'js/views/backupView.js', 'js/views/trash.js', 'js/views/settings.js',
  'js/views/placeholder.js', 'js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
