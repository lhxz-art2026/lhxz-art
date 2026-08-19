/* 通用小工具 */
(function () {
  const U = {};
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.pad = n => String(n).padStart(2, '0');
  U.todayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  };
  U.fmtDateTime = ms => {
    const d = new Date(ms);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate())
      + ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  };
  // 距离今天多少天（今天=0）；无时间戳返回 null
  U.daysAgo = ts => {
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / 86400000);
  };
  U.escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  // ===== 作业评分体系（见 CLAUDE.md 第 3 章 M6 / 第 5.4 节） =====
  U.GRADES = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C'];
  U.DIMS = [['composition', '构图'], ['line', '线条'], ['color', '色彩'],
    ['form', '造型'], ['creativity', '创意'], ['neatness', '整洁度'], ['attitude', '课堂态度']];
  U.gradeClass = g => (g || '').indexOf('A') === 0 ? 'a' : (g || '').indexOf('B') === 0 ? 'b' : 'c';
  U.dimsText = h => {
    const parts = [];
    U.DIMS.forEach(([k, label]) => {
      const v = (h.dims || {})[k];
      if (v) parts.push(label + v);
    });
    return parts.length ? ('分项：' + parts.join(' · ')) : '（未打维度分）';
  };
  U.avatarColor = name => {
    const COLORS = ['#2f6fed', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2'];
    return COLORS[(name || '?').charCodeAt(0) % COLORS.length];
  };

  // 图片压缩：长边不超过 maxDim，输出 JPEG dataURL（备份文件是纯文字格式，图片必须转成文字编码才能随备份搬家）
  U.compressImage = (file, maxDim, quality) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, (maxDim || 1600) / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', quality == null ? 0.78 : quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片读取失败')); };
    img.src = url;
  });

  // 密码"指纹"：只存这一串计算结果，不存密码原文（锁屏遮挡用，非身份验证）
  U.hash = t => {
    const s = String(t);
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) ^ c) >>> 0;
    }
    return h1.toString(16) + '-' + h2.toString(16);
  };

  // CSV 单元格转义（引号加倍）与文件下载
  U.csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  U.download = (name, content, mime) => {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  window.U = U;
})();
