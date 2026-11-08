/* 学生快捷登记面板（核心交互，见 CLAUDE.md 第 6.4 节）
 * 在班级名单页点学生卡片滑出，不离开页面，内含 4 个标签页：
 *   作业（等级 + 7 维五星）/ 优秀作业（拍照上传）/ 考勤 / 纪律
 * 所有改动即时自动保存；删除一律进回收站。
 * 用法：Panel.open({ student, cls, tab, editRecord }) */
(function () {
  const V = window.V = window.V || {};
  const STATUSES = ['出勤', '迟到', '早退', '请假', '缺勤'];
  const STATUS_CLS = { '出勤': 'ok', '迟到': 'late', '早退': 'early', '请假': 'leave', '缺勤': 'absent' };
  const TAB_DEFS = [['homework', '✏️ 作业'], ['work', '📷 优秀作业'], ['attendance', '✅ 考勤'], ['discipline', '⭐ 纪律']];

  function sourceLabel(cls, student) {
    return '班级「' + cls.name + '」· 学生「' + student.name + '」';
  }

  /* ---------- 作业登记 ---------- */
  async function buildHomeworkTab(box, o) {
    const student = o.student, cls = o.cls;
    const wrap = document.createElement('div');
    const state = { editId: null, grade: null, dims: {} };
    const starsEls = {};
    const hint = document.createElement('span');
    hint.className = 'flash-hint';
    function flash() {
      hint.textContent = '✓ 已自动保存';
      clearTimeout(flash._t);
      flash._t = setTimeout(() => hint.textContent = '', 1400);
    }

    // 最近课题快捷选择（本班历史记录里取）
    const hwsAll = await DB.byIndex('homeworks', 'classId', cls.id);
    hwsAll.sort((a, b) => b.createdAt - a.createdAt);
    const topics = [];
    hwsAll.forEach(h => { if (!topics.includes(h.topic)) topics.push(h.topic); });

    const topicInp = document.createElement('input');
    topicInp.placeholder = '课题名称，如：静物素描·苹果';
    if (o.topic) topicInp.value = o.topic; // 未交名单"补登记"时预填课题，保证名称一致
    const dl = document.createElement('datalist');
    dl.id = 'dl-topics-' + Date.now();
    topics.forEach(t => { const op = document.createElement('option'); op.value = t; dl.appendChild(op); });
    topicInp.setAttribute('list', dl.id);
    const fTopic = UI.field('课题名称 *', topicInp);

    const chipBox = document.createElement('div');
    topics.slice(0, 5).forEach(t => {
      const c = document.createElement('span');
      c.className = 'topic-chip';
      c.textContent = t;
      c.onclick = () => topicInp.value = t;
      chipBox.appendChild(c);
    });

    const dateInp = document.createElement('input');
    dateInp.type = 'date';
    dateInp.value = U.todayStr();
    const fDate = UI.field('日期', dateInp);

    const gradeRow = document.createElement('div');
    gradeRow.className = 'grade-row';
    const fGrade = UI.field('综合等级 *', gradeRow);
    U.GRADES.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'grade-btn grade-' + U.gradeClass(g);
      b.textContent = g;
      b.addEventListener('click', () => {
        state.grade = g;
        U.$$('.grade-btn', gradeRow).forEach(x => x.classList.toggle('on', x === b));
        if (state.editId) { saveEdit(); flash(); }
      });
      gradeRow.appendChild(b);
    });

    const dimWrap = document.createElement('div');
    dimWrap.className = 'dim-list';
    U.DIMS.forEach(([k, label]) => {
      const row = document.createElement('div');
      row.className = 'dim-row';
      const lab = document.createElement('span');
      lab.className = 'dim-label';
      lab.textContent = label;
      starsEls[k] = UI.stars({
        max: 5, value: 0, size: 'sm',
        onChange: v => {
          state.dims[k] = v;
          if (state.editId) { saveEdit(); flash(); }
        }
      });
      row.append(lab, starsEls[k]);
      dimWrap.appendChild(row);
    });

    const commentInp = document.createElement('textarea');
    commentInp.rows = 2;
    commentInp.placeholder = '评语（可不填）';
    const fComment = UI.field('评语', commentInp);

    const errBox = document.createElement('div');
    errBox.className = 'field-error';

    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    actions.append(hint);
    const btnSubmit = document.createElement('button');
    btnSubmit.className = 'btn btn-primary';
    btnSubmit.textContent = '✓ 登记本次作业';
    const btnCancelEdit = document.createElement('button');
    btnCancelEdit.className = 'btn';
    btnCancelEdit.textContent = '✕ 取消编辑';
    btnCancelEdit.style.display = 'none';
    actions.append(btnSubmit, btnCancelEdit);

    const editHint = document.createElement('div');
    editHint.className = 'muted';
    editHint.style.display = 'none';
    editHint.textContent = '✏️ 正在编辑：改动即时自动保存，无需点保存';

    const listSec = document.createElement('div');
    listSec.className = 'panel-sec';
    listSec.innerHTML = '<span>该生作业记录（最近10条）</span>';
    const listBox = document.createElement('div');
    listBox.className = 'rec-list';

    wrap.append(fTopic.el, chipBox, fDate.el, fGrade.el, dimWrap, fComment.el, errBox, editHint, actions, listSec, listBox, dl);

    function collect() {
      return {
        topic: topicInp.value.trim(), date: dateInp.value, grade: state.grade,
        dims: Object.assign({}, state.dims), comment: commentInp.value.trim()
      };
    }
    async function saveEdit() {
      if (!state.editId) return;
      const rec = await DB.get('homeworks', state.editId);
      if (!rec) return;
      await DB.put('homeworks', Object.assign({}, rec, collect()));
    }
    function setEditMode(on) {
      btnSubmit.style.display = on ? 'none' : '';
      btnCancelEdit.style.display = on ? '' : 'none';
      editHint.style.display = on ? '' : 'none';
      if (!on) state.editId = null;
    }
    function loadInto(rec) {
      state.editId = rec.id;
      state.grade = rec.grade || null;
      state.dims = Object.assign({}, rec.dims || {});
      topicInp.value = rec.topic || '';
      dateInp.value = rec.date || U.todayStr();
      commentInp.value = rec.comment || '';
      U.$$('.grade-btn', gradeRow).forEach(x => x.classList.toggle('on', x.textContent === rec.grade));
      U.DIMS.forEach(([k]) => starsEls[k].set((rec.dims || {})[k] || 0));
    }
    function resetForm() {
      state.grade = null;
      state.dims = {};
      commentInp.value = '';
      U.$$('.grade-btn', gradeRow).forEach(x => x.classList.remove('on'));
      Object.keys(starsEls).forEach(k => starsEls[k].set(0));
    }
    async function refreshList() {
      const list = (await DB.byIndex('homeworks', 'studentId', student.id))
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      listBox.innerHTML = '';
      if (!list.length) {
        listBox.innerHTML = '<div class="muted">还没有作业记录</div>';
        return;
      }
      list.forEach(h => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML =
          '<div class="rec-head">' +
          '<span class="grade-badge grade-' + U.gradeClass(h.grade) + '">' + U.escapeHtml(h.grade) + '</span>' +
          '<span style="flex:1;text-align:right"><b>' + U.escapeHtml(h.topic) + '</b>' +
          '<span class="muted"> · ' + U.escapeHtml(h.date) + '</span></span></div>' +
          '<div class="muted">' + U.escapeHtml(U.dimsText(h)) + '</div>' +
          (h.comment ? '<div class="muted">💬 ' + U.escapeHtml(h.comment) + '</div>' : '') +
          '<div class="rec-actions">' +
          '<button class="btn btn-sm" data-a="edit">编辑</button>' +
          '<button class="btn btn-danger btn-sm" data-a="del">删除</button></div>';
        item.querySelector('[data-a="edit"]').onclick = () => { loadInto(h); setEditMode(true); };
        item.querySelector('[data-a="del"]').onclick = async () => {
          const ok = await UI.confirmDlg({
            title: '删除作业记录',
            message: '确定删除「' + h.topic + '」的这条作业记录吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('homework', h, sourceLabel(cls, student));
            UI.toast('已移入回收站');
            refreshList();
          }
        };
        listBox.appendChild(item);
      });
    }

    btnSubmit.onclick = async () => {
      const topic = topicInp.value.trim();
      if (!topic) { fTopic.setError('请填写课题名称'); errBox.textContent = ''; return; }
      fTopic.clearError();
      if (!state.grade) { errBox.textContent = '请选择综合等级（A++ ~ C）'; return; }
      errBox.textContent = '';
      const rec = Object.assign({ id: U.uid('hw'), studentId: student.id, classId: cls.id, createdAt: Date.now() }, collect());
      await DB.put('homeworks', rec);
      UI.toast('✅ 已登记「' + topic + '」', 'success');
      resetForm();
      refreshList();
    };
    btnCancelEdit.onclick = () => { setEditMode(false); resetForm(); };
    topicInp.addEventListener('input', U.debounce(() => { if (state.editId) { saveEdit(); flash(); } }, 400));
    dateInp.addEventListener('change', () => { if (state.editId) { saveEdit(); flash(); } });
    commentInp.addEventListener('input', U.debounce(() => { if (state.editId) { saveEdit(); flash(); } }, 400));

    if (o.editRecord) { loadInto(o.editRecord); setEditMode(true); }
    refreshList();
    return wrap;
  }

  /* ---------- 优秀作业上传 ---------- */
  async function buildWorkTab(box, o) {
    const student = o.student, cls = o.cls;
    const wrap = document.createElement('div');
    const picked = [];

    const titleInp = document.createElement('input');
    titleInp.placeholder = '作品名称（可不填，默认显示日期）';
    const fTitle = UI.field('作品名称', titleInp);

    const dateInp = document.createElement('input');
    dateInp.type = 'date';
    dateInp.value = U.todayStr();
    const fDate = UI.field('日期', dateInp);

    const fileInp = document.createElement('input');
    fileInp.type = 'file';
    fileInp.accept = 'image/*';
    fileInp.multiple = true;
    fileInp.hidden = true;
    const pickBtn = document.createElement('button');
    pickBtn.className = 'btn';
    pickBtn.innerHTML = '📷 拍照 / 选图（最多9张）';
    pickBtn.onclick = () => fileInp.click();
    const strip = document.createElement('div');
    strip.className = 'preview-strip';
    const fPick = UI.field('照片 *', pickBtn);
    fPick.el.append(strip);

    function renderStrip() {
      strip.innerHTML = '';
      picked.forEach((src, i) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        const im = document.createElement('img');
        im.src = src;
        const x = document.createElement('button');
        x.className = 'preview-x';
        x.innerHTML = '✕';
        x.onclick = () => { picked.splice(i, 1); renderStrip(); };
        item.append(im, x);
        strip.appendChild(item);
      });
    }
    fileInp.onchange = async () => {
      const files = Array.from(fileInp.files || []);
      fileInp.value = '';
      const room = 9 - picked.length;
      if (files.length > room) {
        UI.toast('每件作品最多9张照片，已保留前 ' + room + ' 张');
        files.splice(room);
      }
      for (const f of files) {
        try {
          picked.push(await U.compressImage(f, 1600, 0.78));
        } catch (e) {
          UI.toast('有张图片读取失败，已跳过', 'error');
        }
      }
      renderStrip();
    };

    const commentInp = document.createElement('textarea');
    commentInp.rows = 2;
    commentInp.placeholder = '点评（可不填）';
    const fComment = UI.field('点评', commentInp);

    const errBox = document.createElement('div');
    errBox.className = 'field-error';

    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.textContent = '💾 保存作品';
    actions.append(btnSave);

    const listSec = document.createElement('div');
    listSec.className = 'panel-sec';
    listSec.innerHTML = '<span>该生优秀作品</span>';
    const listBox = document.createElement('div');
    listBox.className = 'rec-list';

    wrap.append(fTitle.el, fDate.el, fPick.el, fComment.el, errBox, actions, listSec, listBox);

    async function refreshList() {
      const list = (await DB.byIndex('works', 'studentId', student.id))
        .sort((a, b) => b.createdAt - a.createdAt);
      listBox.innerHTML = '';
      if (!list.length) {
        listBox.innerHTML = '<div class="muted">还没有优秀作品</div>';
        return;
      }
      list.forEach(w => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML =
          '<div class="work-thumb-row">' +
          '<img src="' + w.images[0] + '" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px">' +
          '<div style="flex:1;min-width:0"><b>' + U.escapeHtml(w.title || '未命名作品') + '</b>' +
          '<div class="muted">' + U.escapeHtml(w.date) + ' · ' + w.images.length + ' 张照片</div></div></div>' +
          (w.comment ? '<div class="muted">💬 ' + U.escapeHtml(w.comment) + '</div>' : '') +
          '<div class="rec-actions">' +
          '<button class="btn btn-sm" data-a="view">查看</button>' +
          '<button class="btn btn-danger btn-sm" data-a="del">删除</button></div>';
        item.querySelector('[data-a="view"]').onclick = () =>
          UI.lightbox(w.images, student.name + ' · ' + w.date + (w.title ? ' · ' + w.title : ''));
        item.querySelector('[data-a="del"]').onclick = async () => {
          const ok = await UI.confirmDlg({
            title: '删除优秀作品',
            message: '确定删除「' + (w.title || w.date) + '」吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('work', w, sourceLabel(cls, student));
            UI.toast('已移入回收站');
            refreshList();
          }
        };
        listBox.appendChild(item);
      });
    }

    btnSave.onclick = async () => {
      if (!picked.length) { errBox.textContent = '请先拍照或选择照片'; return; }
      errBox.textContent = '';
      const rec = {
        id: U.uid('wk'), studentId: student.id, classId: cls.id,
        title: titleInp.value.trim(), date: dateInp.value,
        images: picked.slice(), comment: commentInp.value.trim(), createdAt: Date.now()
      };
      await DB.put('works', rec);
      UI.toast('✅ 优秀作品已保存', 'success');
      picked.length = 0;
      titleInp.value = '';
      commentInp.value = '';
      renderStrip();
      refreshList();
    };

    refreshList();
    return wrap;
  }

  /* ---------- 考勤登记 ---------- */
  async function buildAttendanceTab(box, o) {
    const student = o.student, cls = o.cls;
    const wrap = document.createElement('div');

    const dateInp = document.createElement('input');
    dateInp.type = 'date';
    dateInp.value = U.todayStr();
    const fDate = UI.field('日期（同一天再次点选 = 修改当天状态）', dateInp);

    const chipRow = document.createElement('div');
    chipRow.className = 'chip-row';
    const chipEls = {};
    STATUSES.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-' + STATUS_CLS[s];
      b.textContent = s;
      chipEls[s] = b;
      chipRow.appendChild(b);
    });

    const noteInp = document.createElement('textarea');
    noteInp.rows = 1;
    noteInp.placeholder = '备注，如：家长请假、感冒（可不填）';
    const fNote = UI.field('备注', noteInp);

    const listSec = document.createElement('div');
    listSec.className = 'panel-sec';
    listSec.innerHTML = '<span>考勤记录（最近10条）</span>';
    const listBox = document.createElement('div');
    listBox.className = 'rec-list';

    wrap.append(fDate.el, chipRow, fNote.el, listSec, listBox);

    async function getRec(date) {
      const list = await DB.byIndex('attendances', 'studentId', student.id);
      return list.find(x => x.date === date) || null;
    }
    async function upsert(date, status, note) {
      const rec = await getRec(date);
      if (rec) {
        await DB.put('attendances', Object.assign({}, rec, { status, note: note || '', updatedAt: Date.now() }));
      } else {
        await DB.put('attendances', {
          id: U.uid('at'), studentId: student.id, classId: cls.id,
          date, status, note: note || '', updatedAt: Date.now()
        });
      }
    }
    async function refresh() {
      const rec = await getRec(dateInp.value);
      STATUSES.forEach(s => chipEls[s].classList.toggle('on', !!rec && rec.status === s));
      if (!noteInp._editing) noteInp.value = rec ? (rec.note || '') : '';
      const list = (await DB.byIndex('attendances', 'studentId', student.id))
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
      listBox.innerHTML = '';
      if (!list.length) {
        listBox.innerHTML = '<div class="muted">还没有考勤记录</div>';
        return;
      }
      list.forEach(a => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML =
          '<div class="rec-head">' +
          '<span class="chip chip-' + STATUS_CLS[a.status] + ' on">' + U.escapeHtml(a.status) + '</span>' +
          '<span class="muted">' + U.escapeHtml(a.date) + '</span></div>' +
          (a.note ? '<div class="muted">💬 ' + U.escapeHtml(a.note) + '</div>' : '');
        listBox.appendChild(item);
      });
    }

    STATUSES.forEach(s => {
      chipEls[s].addEventListener('click', async () => {
        await upsert(dateInp.value, s, noteInp.value);
        UI.toast('✅ 已登记：' + s + '（' + dateInp.value + '）', 'success');
        refresh();
      });
    });
    noteInp.addEventListener('focus', () => noteInp._editing = true);
    noteInp.addEventListener('input', U.debounce(async () => {
      const rec = await getRec(dateInp.value);
      if (rec) await DB.put('attendances', Object.assign({}, rec, { note: noteInp.value }));
    }, 400));
    dateInp.addEventListener('change', refresh);

    refresh();
    return wrap;
  }

  /* ---------- 课堂纪律登记 ---------- */
  async function buildDisciplineTab(box, o) {
    const student = o.student, cls = o.cls;
    const wrap = document.createElement('div');
    const state = { type: '表扬' };

    const typeRow = document.createElement('div');
    typeRow.className = 'chip-row';
    const typeEls = {};
    ['表扬', '提醒'].forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'type-btn' + (t === '表扬' ? ' praise' : ' remind') + (t === '表扬' ? ' on' : '');
      b.textContent = t === '表扬' ? '👍 表扬' : '⚠️ 提醒';
      typeEls[t] = b;
      typeRow.appendChild(b);
    });

    const stars = UI.stars({ max: 3, value: 1 });
    const fStars = UI.field('程度（1~3 星）', stars);

    const descInp = document.createElement('textarea');
    descInp.rows = 2;
    descInp.placeholder = '具体表现，如：主动帮同学收画具（可不填）';
    const fDesc = UI.field('描述', descInp);

    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    const btnSubmit = document.createElement('button');
    btnSubmit.className = 'btn btn-primary';
    btnSubmit.textContent = '✓ 登记';
    actions.append(btnSubmit);

    const listSec = document.createElement('div');
    listSec.className = 'panel-sec';
    listSec.innerHTML = '<span>纪律记录（最近10条）</span>';
    const listBox = document.createElement('div');
    listBox.className = 'rec-list';

    wrap.append(typeRow, fStars.el, fDesc.el, actions, listSec, listBox);

    Object.keys(typeEls).forEach(t => {
      typeEls[t].addEventListener('click', () => {
        state.type = t;
        Object.keys(typeEls).forEach(k => typeEls[k].classList.toggle('on', k === t));
      });
    });

    async function refreshList() {
      const list = (await DB.byIndex('disciplines', 'studentId', student.id))
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      listBox.innerHTML = '';
      if (!list.length) {
        listBox.innerHTML = '<div class="muted">还没有纪律记录</div>';
        return;
      }
      list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML =
          '<div class="rec-head">' +
          '<span class="type-badge ' + (d.type === '表扬' ? 'praise' : 'remind') + '">' +
          (d.type === '表扬' ? '👍 ' : '⚠️ ') + U.escapeHtml(d.type) + '</span>' +
          '<span class="muted">' + '★'.repeat(d.stars || 1) + ' · ' + U.escapeHtml(d.date) + '</span></div>' +
          (d.desc ? '<div class="muted">💬 ' + U.escapeHtml(d.desc) + '</div>' : '') +
          '<div class="rec-actions"><button class="btn btn-danger btn-sm" data-a="del">删除</button></div>';
        item.querySelector('[data-a="del"]').onclick = async () => {
          const ok = await UI.confirmDlg({
            title: '删除纪律记录',
            message: '确定删除这条' + d.type + '记录吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('discipline', d, sourceLabel(cls, student));
            UI.toast('已移入回收站');
            refreshList();
          }
        };
        listBox.appendChild(item);
      });
    }

    btnSubmit.onclick = async () => {
      const rec = {
        id: U.uid('dc'), studentId: student.id, classId: cls.id,
        date: U.todayStr(), type: state.type, stars: stars.value || 1,
        desc: descInp.value.trim(), createdAt: Date.now()
      };
      await DB.put('disciplines', rec);
      UI.toast('✅ 已登记' + state.type, 'success');
      descInp.value = '';
      stars.set(1);
      refreshList();
    };

    refreshList();
    return wrap;
  }

  /* ---------- 面板本体 ---------- */
  const Panel = {
    open(o) {
      const student = o.student, cls = o.cls;
      const backdrop = document.createElement('div');
      backdrop.className = 'panel-backdrop';
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML =
        '<div class="panel-head">' +
        '<div class="avatar" style="background:' + U.avatarColor(student.name) + '">' + U.escapeHtml((student.name || '?').charAt(0)) + '</div>' +
        '<div class="panel-head-info"><b>' + U.escapeHtml(student.name) + '</b>' +
        '<div class="muted">' + U.escapeHtml(cls.name) + '</div></div>' +
        '<button class="btn btn-sm" id="btnPortfolio">📊 档案</button>' +
        '<button class="icon-btn panel-x" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="panel-tabs">' +
        TAB_DEFS.map(t => '<button class="panel-tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') +
        '</div>' +
        '<div class="panel-body"></div>';
      backdrop.appendChild(panel);
      document.body.appendChild(backdrop);

      const body = U.$('.panel-body', panel);
      const builders = { homework: buildHomeworkTab, work: buildWorkTab, attendance: buildAttendanceTab, discipline: buildDisciplineTab };
      const boxes = {};
      ['homework', 'work', 'attendance', 'discipline'].forEach(name => {
        const box = document.createElement('div');
        box.style.display = 'none';
        boxes[name] = box;
        body.appendChild(box);
      });

      let current = null;
      function showTab(name) {
        current = name;
        U.$$('.panel-tab', panel).forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === name));
        Object.keys(boxes).forEach(k => boxes[k].style.display = k === name ? '' : 'none');
        if (!boxes[name].children.length) {
          builders[name](boxes[name], o).then(el => boxes[name].appendChild(el));
        }
      }
      showTab(o.tab || 'homework');

      U.$$('.panel-tab', panel).forEach(b =>
        b.addEventListener('click', () => showTab(b.getAttribute('data-tab'))));
      U.$('#btnPortfolio', panel).addEventListener('click', () => {
        close();
        location.hash = '#/portfolio/' + student.id;
      });

      const close = () => {
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
      };
      const onKey = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      U.$('.panel-x', panel).addEventListener('click', close);
      backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    }
  };

  V.Panel = Panel;
  window.Panel = Panel; // 供名单页、作业页、纪律页直接调用
})();
