/* 班级学生名单页（核心聚合页）
 * 第一批：学生卡片列表 + 添加/编辑/转班/删除
 * 第二批：点学生滑出快捷登记面板（作业/优秀作业/考勤/纪律）、粘贴导入、导出 CSV、打印 */
(function () {
  const V = window.V = window.V || {};
  const COLORS = ['#2f6fed', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2'];

  async function openStudentModal(cls, st, list) {
    const isEdit = !!st;
    const m = UI.modal({ title: isEdit ? '编辑学生' : '添加学生' });

    const nameInp = document.createElement('input');
    nameInp.placeholder = '学生姓名';
    nameInp.value = st ? st.name : '';
    const fName = UI.field('姓名 *', nameInp);

    const numInp = document.createElement('input');
    numInp.placeholder = '可不填';
    numInp.value = st ? (st.num || '') : '';
    const fNum = UI.field('学号', numInp);

    const genderSel = document.createElement('select');
    ['不填', '男', '女'].forEach(g => {
      const o = document.createElement('option');
      o.value = g; o.textContent = g;
      genderSel.appendChild(o);
    });
    genderSel.value = st ? (st.gender || '不填') : '不填';
    const fGen = UI.field('性别', genderSel);

    const noteInp = document.createElement('textarea');
    noteInp.rows = 2;
    noteInp.placeholder = '备注（可不填）';
    noteInp.value = st ? (st.note || '') : '';
    const fNote = UI.field('备注', noteInp);

    m.body.append(fName.el, fNum.el, fGen.el, fNote.el);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.textContent = '保存';
    btnSave.onclick = async () => {
      const name = nameInp.value.trim();
      if (!name) { fName.setError('请填写学生姓名'); return; }
      if (list.some(x => x.name === name && (!st || x.id !== st.id))) {
        fName.setError('该班级已有同名学生，请确认姓名');
        return;
      }
      m.close();
      const gender = genderSel.value === '不填' ? '' : genderSel.value;
      if (isEdit) {
        await DB.put('students', Object.assign({}, st, {
          name, num: numInp.value.trim(), gender, note: noteInp.value.trim()
        }));
        UI.toast('✅ 学生信息已保存');
      } else {
        await DB.put('students', {
          id: U.uid('s'), classId: cls.id, name,
          num: numInp.value.trim(), gender, note: noteInp.value.trim(), createdAt: Date.now()
        });
        UI.toast('✅ 已添加学生「' + name + '」');
      }
      App.refresh();
    };
    m.actions.append(btnCancel, btnSave);
  }

  async function openMoveModal(cls, st) {
    const classes = await DB.all('classes');
    const targets = classes.filter(c => c.id !== cls.id);
    if (!targets.length) {
      UI.toast('还没有其他班级，请先到「班级」页新建一个', 'error');
      return;
    }
    const m = UI.modal({ title: '学生转班' });
    const tip = document.createElement('p');
    tip.className = 'modal-msg';
    tip.textContent = '把「' + st.name + '」移动到哪个班级？转班后历史记录仍按原班级统计。';
    const sel = document.createElement('select');
    targets.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    m.body.append(tip, sel);
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary';
    btnOk.textContent = '移动';
    btnOk.onclick = async () => {
      m.close();
      await DB.put('students', Object.assign({}, st, { classId: sel.value }));
      UI.toast('✅ 已转班');
      App.refresh();
    };
    m.actions.append(btnCancel, btnOk);
  }

  // 从 Excel 复制粘贴批量导入学生名单（见 CLAUDE.md 第 6.7 节）
  async function openPasteModal(cls, list) {
    const m = UI.modal({ title: '从 Excel 粘贴导入学生名单' });
    const tip = document.createElement('div');
    tip.className = 'muted';
    tip.textContent = '在 Excel 里选中学生表（姓名、学号、性别、备注等列）复制，直接粘贴到下面，点「识别预览」：';
    const ta = document.createElement('textarea');
    ta.rows = 7;
    ta.placeholder = '姓名\t学号\t性别\t备注\n王小明\t20230115\t男\t\n李小红\t20230116\t女\t';
    const errBox = document.createElement('div');
    errBox.className = 'field-error';
    const preview = document.createElement('div');
    preview.className = 'muted';
    preview.style.whiteSpace = 'pre-line';
    m.body.append(tip, ta, errBox, preview);

    let parsed = null;
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnPreview = document.createElement('button');
    btnPreview.className = 'btn';
    btnPreview.textContent = '识别预览';
    const btnImport = document.createElement('button');
    btnImport.className = 'btn btn-primary';
    btnImport.textContent = '确认导入';
    btnImport.style.display = 'none';
    m.actions.append(btnCancel, btnPreview, btnImport);

    btnPreview.onclick = () => {
      const text = ta.value.trim();
      if (!text) { errBox.textContent = '请先从 Excel 复制名单粘贴到这里'; return; }
      errBox.textContent = '';
      const rows = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      let lines = rows.map(l => l.split('\t').map(c => c.trim()));
      if (lines.length && lines[0].length === 1 && lines[0][0].indexOf(',') >= 0) {
        lines = lines.map(l => l[0].split(',').map(c => c.trim()));
      }
      let cols = { name: 0, num: 1, gender: 2, note: 3 };
      if (lines[0].some(c => c.replace(/\s/g, '') === '姓名')) {
        const h = lines.shift().map(c => c.replace(/\s/g, ''));
        cols = {
          name: h.indexOf('姓名'),
          num: h.indexOf('学号'),
          gender: h.indexOf('性别'),
          note: h.indexOf('备注')
        };
      }
      parsed = [];
      for (const r of lines) {
        const name = (r[cols.name] || '').trim();
        if (!name) continue;
        const gender = (r[cols.gender] || '').trim();
        parsed.push({
          name,
          num: cols.num >= 0 ? (r[cols.num] || '').trim() : '',
          gender: gender === '男' || gender === '女' ? gender : '',
          note: cols.note >= 0 ? (r[cols.note] || '').trim() : ''
        });
      }
      if (!parsed.length) {
        errBox.textContent = '没有识别到学生姓名，请检查是否从 Excel 复制了表格内容';
        return;
      }
      const dup = parsed.filter(p => list.some(s => s.name === p.name)).length;
      preview.textContent = '✅ 识别到 ' + parsed.length + ' 名学生' +
        (dup ? '，其中 ' + dup + ' 人与现有名单重名（导入时会跳过）' : '，无重名') +
        '\n示例：' + parsed.slice(0, 5).map(p => p.name + (p.num ? '（' + p.num + '）' : '')).join('、') +
        (parsed.length > 5 ? ' …' : '');
      btnImport.style.display = '';
    };
    btnImport.onclick = async () => {
      if (!parsed || !parsed.length) return;
      let added = 0, skip = 0;
      for (const p of parsed) {
        if (list.some(s => s.name === p.name)) { skip++; continue; }
        await DB.put('students', {
          id: U.uid('s'), classId: cls.id, name: p.name,
          num: p.num, gender: p.gender, note: p.note, createdAt: Date.now()
        });
        added++;
      }
      UI.toast('✅ 已导入 ' + added + ' 名学生' + (skip ? '，跳过重名 ' + skip + ' 人' : ''), 'success');
      m.close();
      App.refresh();
    };
  }

  // 导出学生名单 CSV（带中文防乱码标记，Excel 直接打开）
  function exportCsv(cls, list) {
    const rows = [['姓名', '学号', '性别', '备注']]
      .concat(list.map(s => [s.name, s.num || '', s.gender || '', s.note || '']));
    const csv = '﻿' + rows.map(r => r.map(U.csvCell).join(',')).join('\r\n');
    U.download(cls.name + '-学生名单-' + U.todayStr().replace(/-/g, '') + '.csv', csv, 'text/csv;charset=utf-8');
    UI.toast('✅ 已导出，Excel 可直接打开（中文不乱码）', 'success');
  }

  V.roster = {
    async render(el, clsId) {
      const cls = await DB.get('classes', clsId);
      if (!cls) { location.hash = '#/classes'; return; }
      const list = await DB.byIndex('students', 'classId', clsId);
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

      el.innerHTML =
        '<div class="card roster-head">' +
        '<div><h2>' + U.escapeHtml(cls.name) + '</h2>' +
        '<div class="muted">' + list.length + ' 名学生' +
        (cls.location ? ' · 📍 ' + U.escapeHtml(cls.location) : '') + '</div></div>' +
        '<div class="roster-head-actions">' +
        '<button class="btn btn-primary" id="btnAddStudent">＋ 添加学生</button>' +
        '<button class="btn" id="btnTodayAtt">✅ 今日点名</button>' +
        '<button class="btn" id="btnMissing">👀 未交名单</button>' +
        '<button class="btn" id="btnSeats">🪑 座位表</button>' +
        '<button class="btn" id="btnPaste">📋 粘贴导入</button>' +
        '<button class="btn" id="btnCsv">📥 导出CSV</button>' +
        '<button class="btn" id="btnEditClass">编辑班级</button>' +
        '<button class="btn btn-danger" id="btnDelClass">删除班级</button>' +
        '</div></div>' +
        '<div class="page-note">💡 点击学生卡片即可登记作业/考勤/纪律、上传优秀作品；从 Excel 复制名单后可「粘贴导入」批量添加</div>' +
        (list.length ?
          '<div class="card-grid">' + list.map(s =>
            '<div class="card student-card">' +
            '<div class="student-main" data-act="panel" data-id="' + s.id + '">' +
            '<div class="avatar" style="background:' + COLORS[(s.name || '?').charCodeAt(0) % COLORS.length] + '">' + U.escapeHtml((s.name || '?').charAt(0)) + '</div>' +
            '<div class="student-info"><b>' + U.escapeHtml(s.name) + '</b>' +
            (s.num ? '<span class="badge">学号 ' + U.escapeHtml(s.num) + '</span>' : '') +
            (s.gender ? '<span class="badge">' + U.escapeHtml(s.gender) + '</span>' : '') +
            (s.note ? '<div class="muted">' + U.escapeHtml(s.note) + '</div>' : '') +
            '</div></div>' +
            '<div class="card-actions">' +
            '<button class="btn btn-sm" data-act="edit" data-id="' + s.id + '">编辑</button>' +
            '<button class="btn btn-sm" data-act="move" data-id="' + s.id + '">转班</button>' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + s.id + '">删除</button>' +
            '</div></div>').join('') + '</div>'
          : '<div class="empty-state">🎒 还没有学生<br><span class="muted">点「添加学生」录入第一位学生</span></div>');

      U.$('#btnAddStudent', el).addEventListener('click', () => openStudentModal(cls, null, list));
      U.$('#btnTodayAtt', el).addEventListener('click', () => location.hash = '#/attendance?c=' + cls.id);
      U.$('#btnMissing', el).addEventListener('click', () => location.hash = '#/missing?c=' + cls.id);
      U.$('#btnSeats', el).addEventListener('click', () => location.hash = '#/seats?c=' + cls.id);
      U.$('#btnPaste', el).addEventListener('click', () => openPasteModal(cls, list));
      U.$('#btnCsv', el).addEventListener('click', () => exportCsv(cls, list));
      U.$('#btnEditClass', el).addEventListener('click', () => V.classes.openModal(cls));
      U.$('#btnDelClass', el).addEventListener('click', async () => {
        const ok = await UI.confirmDlg({
          title: '删除班级',
          message: '确定删除「' + cls.name + '」吗？班内学生及其记录将一起移入回收站，可随时还原。',
          okText: '移入回收站',
          danger: true
        });
        if (ok) {
          await RC.trashClass(cls.id);
          UI.toast('已移入回收站，可去回收站还原');
          location.hash = '#/classes';
        }
      });
      U.$$('[data-act]', el).forEach(btn => {
        const id = btn.getAttribute('data-id');
        const s = list.find(x => x.id === id);
        btn.addEventListener('click', async () => {
          const act = btn.getAttribute('data-act');
          if (act === 'edit') openStudentModal(cls, s, list);
          else if (act === 'panel') Panel.open({ student: s, cls });
          else if (act === 'move') openMoveModal(cls, s);
          else if (act === 'del') {
            const ok = await UI.confirmDlg({
              title: '删除学生',
              message: '确定删除学生「' + s.name + '」吗？其作业、考勤、纪律、优秀作业记录将一起移入回收站，可随时还原。',
              okText: '移入回收站',
              danger: true
            });
            if (ok) {
              await RC.trashStudent(s.id);
              UI.toast('已移入回收站，可去回收站还原');
              App.refresh();
            }
          }
        });
      });
    }
  };
})();
