/* 班级管理页：班级卡片列表 + 新建/编辑/删除（删除进回收站） */
(function () {
  const V = window.V = window.V || {};
  let _list = []; // 当前班级列表，供重名校验用

  async function openClassModal(cls) {
    const isEdit = !!cls;
    const m = UI.modal({ title: isEdit ? '编辑班级' : '新建班级' });

    const nameInp = document.createElement('input');
    nameInp.placeholder = '例如：三年级1班';
    nameInp.value = cls ? cls.name : '';
    const fName = UI.field('班级名称 *', nameInp);

    const locInp = document.createElement('input');
    locInp.placeholder = '例如：美术教室2（可不填）';
    locInp.value = cls ? (cls.location || '') : '';
    const fLoc = UI.field('上课地点', locInp);

    const noteInp = document.createElement('textarea');
    noteInp.rows = 2;
    noteInp.placeholder = '备注（可不填）';
    noteInp.value = cls ? (cls.note || '') : '';
    const fNote = UI.field('备注', noteInp);

    m.body.append(fName.el, fLoc.el, fNote.el);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.textContent = '保存';
    btnSave.onclick = async () => {
      const name = nameInp.value.trim();
      if (!name) { fName.setError('请填写班级名称'); return; }
      if (_list.some(c => c.name === name && (!cls || c.id !== cls.id))) {
        fName.setError('已有同名班级，请换一个名称');
        return;
      }
      m.close();
      if (isEdit) {
        await DB.put('classes', Object.assign({}, cls, {
          name, location: locInp.value.trim(), note: noteInp.value.trim()
        }));
        UI.toast('✅ 班级已保存');
      } else {
        await DB.put('classes', {
          id: U.uid('c'), name, location: locInp.value.trim(),
          note: noteInp.value.trim(), createdAt: Date.now()
        });
        UI.toast('✅ 班级已创建');
      }
      App.refresh();
    };
    m.actions.append(btnCancel, btnSave);
  }

  V.classes = {
    openModal: openClassModal,
    async render(el) {
      _list = await DB.all('classes');
      const students = await DB.all('students');
      const cnt = {};
      students.forEach(s => cnt[s.classId] = (cnt[s.classId] || 0) + 1);

      el.innerHTML =
        '<div class="page-actions"><button class="btn btn-primary" id="btnNewClass">＋ 新建班级</button></div>' +
        (_list.length ? '' :
          '<div class="empty-state">👥 还没有班级<br><span class="muted">点右上角「新建班级」创建第一个班级</span></div>') +
        '<div class="card-grid">' + _list.map(c =>
          '<div class="card">' +
          '<div class="class-card-head"><b>' + U.escapeHtml(c.name) + '</b>' +
          '<span class="badge">' + (cnt[c.id] || 0) + ' 名学生</span></div>' +
          (c.location ? '<div class="muted">📍 ' + U.escapeHtml(c.location) + '</div>' : '') +
          (c.note ? '<div class="muted">' + U.escapeHtml(c.note) + '</div>' : '') +
          '<div class="card-actions">' +
          '<button class="btn btn-primary btn-sm" data-act="open" data-id="' + c.id + '">打开名单</button>' +
          '<button class="btn btn-sm" data-act="edit" data-id="' + c.id + '">编辑</button>' +
          '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + c.id + '">删除</button>' +
          '</div></div>').join('') + '</div>';

      U.$('#btnNewClass', el).addEventListener('click', () => openClassModal(null));
      U.$$('[data-act]', el).forEach(btn => {
        const id = btn.getAttribute('data-id');
        const c = _list.find(x => x.id === id);
        btn.addEventListener('click', async () => {
          const act = btn.getAttribute('data-act');
          if (act === 'open') { location.hash = '#/roster/' + id; }
          else if (act === 'edit') { openClassModal(c); }
          else if (act === 'del') {
            const ok = await UI.confirmDlg({
              title: '删除班级',
              message: '确定删除「' + c.name + '」吗？班内学生及其作业、考勤、纪律记录将一起移入回收站，可随时还原。',
              okText: '移入回收站',
              danger: true
            });
            if (ok) {
              await RC.trashClass(c.id);
              UI.toast('已移入回收站，可去回收站还原');
              App.refresh();
            }
          }
        });
      });
    }
  };
})();
