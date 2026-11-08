/* 数据库层：浏览器内置数据库（IndexedDB）
 * 所有数据的唯一入口。每次写入成功后广播 lxz-changed 事件，
 * 界面靠它刷新显示；自动保存 = 每次改动立刻调这里的 put。 */
(function () {
  const DB_NAME = 'lxz_art_db';
  const DB_VER = 2;

  const STORE_DEFS = [
    { name: 'classes', key: 'id' },
    { name: 'students', key: 'id', indexes: ['classId'] },
    { name: 'schedules', key: 'id', indexes: ['classId'] },
    { name: 'homeworks', key: 'id', indexes: ['classId', 'studentId', 'date'] },
    { name: 'hwMarks', key: 'id', indexes: ['classId', 'studentId'] },
    { name: 'attendances', key: 'id', indexes: ['classId', 'studentId', 'date'] },
    { name: 'disciplines', key: 'id', indexes: ['classId', 'studentId', 'date'] },
    { name: 'plans', key: 'id', indexes: ['classId'] },
    { name: 'works', key: 'id', indexes: ['classId', 'studentId', 'date'] },
    { name: 'trash', key: 'id' },
    { name: 'meta', key: 'key' }
  ];

  const DEFAULT_SETTINGS = {
    schoolName: '',
    teacherName: '',
    remindDays: 7,
    lastBackupAt: null,
    lockEnabled: false,
    lockPin: '',
    avatar: ''
  };

  let _db = null;

  function open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        STORE_DEFS.forEach(def => {
          let st;
          if (db.objectStoreNames.contains(def.name)) {
            st = req.transaction.objectStore(def.name);
          } else {
            st = db.createObjectStore(def.name, { keyPath: def.key });
          }
          (def.indexes || []).forEach(ix => {
            if (!st.indexNames.contains(ix)) st.createIndex(ix, ix, { unique: false });
          });
        });
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror = e => rej(e.target.error);
    });
  }

  function tx(store, mode) { return _db.transaction(store, mode).objectStore(store); }
  function wrap(rq) {
    return new Promise((res, rej) => {
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  function changed(store) {
    document.dispatchEvent(new CustomEvent('lxz-changed', { detail: { store } }));
  }

  const DB = {
    init: open,
    put(store, obj) {
      return wrap(tx(store, 'readwrite').put(obj)).then(r => { changed(store); return r; });
    },
    putMany(store, objs) {
      if (!objs.length) return Promise.resolve();
      return new Promise((res, rej) => {
        const t = _db.transaction(store, 'readwrite');
        const st = t.objectStore(store);
        objs.forEach(o => st.put(o));
        t.oncomplete = () => { changed(store); res(); };
        t.onerror = () => rej(t.error);
      });
    },
    get(store, id) { return wrap(tx(store).get(id)); },
    all(store) { return wrap(tx(store).getAll()); },
    byIndex(store, idx, val) { return wrap(tx(store).index(idx).getAll(val)); },
    del(store, id) {
      return wrap(tx(store, 'readwrite').delete(id)).then(() => { changed(store); });
    },
    clear(store) { return wrap(tx(store, 'readwrite').clear()); },
    async getSettings() {
      const rec = await DB.get('meta', 'settings');
      return Object.assign({}, DEFAULT_SETTINGS, rec || {});
    },
    saveSettings(patch) {
      return DB.getSettings().then(cur => DB.put('meta', Object.assign({ key: 'settings' }, cur, patch)));
    }
  };

  window.DB = DB;
})();
