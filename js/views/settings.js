/* 设置页：报表抬头、备份提醒周期（自动保存）；锁屏密码第三批上线 */
(function () {
  const V = window.V = window.V || {};

  function makeCard(el, title) {
    const card = document.createElement('div');
    card.className = 'card';
    const row = document.createElement('div');
    row.className = 'card-title-row';
    const h = document.createElement('h2');
    h.className = 'sec-title';
    h.textContent = title;
    const hint = document.createElement('span');
    hint.className = 'saved-hint';
    row.append(h, hint);
    const fields = document.createElement('div');
    fields.className = 'fields';
    card.append(row, fields);
    el.append(card);
    return { fields, hint };
  }
  function flash(hint) {
    hint.textContent = '✓ 已自动保存';
    clearTimeout(hint._t);
    hint._t = setTimeout(() => hint.textContent = '', 1600);
  }

  V.settings = {
    async render(el) {
      el.innerHTML = '';
      const st = await DB.getSettings();

      // 我的头像（显示在软件左上角）
      const cA = makeCard(el, '🖼️ 我的头像（显示在软件左上角）');
      const avWrap = document.createElement('div');
      avWrap.className = 'avatar-row';
      const avPreview = document.createElement('div');
      avPreview.className = 'avatar-upload';
      const fileInp = document.createElement('input');
      fileInp.type = 'file';
      fileInp.accept = 'image/*';
      fileInp.hidden = true;
      const btnUp = document.createElement('button');
      btnUp.className = 'btn';
      btnUp.innerHTML = '📷 上传照片';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn';
      btnDel.textContent = '移除头像';
      const avBtns = document.createElement('div');
      avBtns.style.display = 'flex';
      avBtns.style.gap = '8px';
      avBtns.append(btnUp, btnDel);
      avWrap.append(avPreview, avBtns);
      cA.fields.append(avWrap);
      async function renderAv() {
        const cur = await DB.getSettings();
        avPreview.innerHTML = cur.avatar ? '<img src="' + cur.avatar + '" alt="头像">' : '🎨';
      }
      renderAv();
      btnUp.addEventListener('click', () => fileInp.click());
      fileInp.addEventListener('change', async () => {
        const f = fileInp.files[0];
        fileInp.value = '';
        if (!f) return;
        try {
          const dataUrl = await U.compressImage(f, 512, 0.85);
          await DB.saveSettings({ avatar: dataUrl });
          UI.toast('✅ 头像已更新', 'success');
          renderAv();
        } catch (e) {
          UI.toast('❌ 图片读取失败，请换一张试试', 'error');
        }
      });
      btnDel.addEventListener('click', async () => {
        await DB.saveSettings({ avatar: '' });
        UI.toast('已恢复默认头像');
        renderAv();
      });

      // 打印报表抬头
      const c1 = makeCard(el, '🖨️ 打印报表抬头');
      const schoolInp = document.createElement('input');
      schoolInp.placeholder = '例如：阳光小学（打印报表时显示在顶部）';
      schoolInp.value = st.schoolName || '';
      const fSchool = UI.field('学校/机构名称', schoolInp);
      const teacherInp = document.createElement('input');
      teacherInp.placeholder = '例如：刘老师';
      teacherInp.value = st.teacherName || '';
      const fTeacher = UI.field('教师姓名', teacherInp);
      c1.fields.append(fSchool.el, fTeacher.el);
      schoolInp.addEventListener('input', U.debounce(async () => {
        await DB.saveSettings({ schoolName: schoolInp.value });
        flash(c1.hint);
      }, 400));
      teacherInp.addEventListener('input', U.debounce(async () => {
        await DB.saveSettings({ teacherName: teacherInp.value });
        flash(c1.hint);
      }, 400));

      // 备份提醒
      const c2 = makeCard(el, '💾 备份提醒');
      const remindInp = document.createElement('input');
      remindInp.type = 'number';
      remindInp.min = '3';
      remindInp.max = '30';
      remindInp.value = st.remindDays;
      const fRemind = UI.field('超过多少天没备份就醒目提醒（天，3~30）', remindInp);
      const tip = document.createElement('div');
      tip.className = 'muted';
      tip.textContent = '超过这个天数没备份，顶部按钮和备份页横幅会变成红色提醒。';
      c2.fields.append(fRemind.el, tip);
      remindInp.addEventListener('change', async () => {
        const v = parseInt(remindInp.value, 10);
        if (isNaN(v) || v < 3 || v > 30) {
          fRemind.setError('请输入 3~30 之间的天数');
          return;
        }
        fRemind.clearError();
        await DB.saveSettings({ remindDays: v });
        flash(c2.hint);
        App.refreshBackupBadge();
      });

      // 锁屏密码（仅作界面遮挡，不是账号系统）
      const c3 = makeCard(el, '🔒 锁屏密码');
      const lockWrap = document.createElement('div');
      async function openPinModal(existing) {
        const m = UI.modal({ title: existing ? '修改锁屏密码' : '设置锁屏密码' });
        const note = document.createElement('div');
        note.className = 'muted';
        note.textContent = '密码至少 4 位。仅作界面遮挡，不是账号；密码只存本机，备份文件不含密码。';
        const p1 = document.createElement('input');
        p1.type = 'password';
        p1.placeholder = '输入密码（至少4位）';
        const f1 = UI.field('新密码', p1);
        const p2 = document.createElement('input');
        p2.type = 'password';
        p2.placeholder = '再输入一遍';
        const f2 = UI.field('确认密码', p2);
        m.body.append(note, f1.el, f2.el);
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn';
        btnCancel.textContent = '取消';
        btnCancel.onclick = () => m.close();
        const btnOk = document.createElement('button');
        btnOk.className = 'btn btn-primary';
        btnOk.textContent = '保存';
        btnOk.onclick = async () => {
          if (p1.value.length < 4) { f1.setError('密码至少 4 位'); return; }
          if (p1.value !== p2.value) { f2.setError('两次输入不一致'); return; }
          m.close();
          await DB.saveSettings({ lockEnabled: true, lockPinHash: U.hash(p1.value) });
          UI.toast('✅ 锁屏密码已设置（下次打开软件或点顶部 🔒 生效）', 'success');
          renderLock();
        };
        m.actions.append(btnCancel, btnOk);
      }
      async function renderLock() {
        const cur = await DB.getSettings();
        const on = !!(cur.lockEnabled && cur.lockPinHash);
        lockWrap.innerHTML = '';
        const status = document.createElement('div');
        status.className = 'muted';
        status.textContent = '状态：' + (on ? '已开启（打开软件时需输密码，仅遮挡界面）' : '未开启');
        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '8px';
        btns.style.marginTop = '8px';
        const bSet = document.createElement('button');
        bSet.className = 'btn btn-primary';
        bSet.textContent = on ? '修改密码' : '设置密码';
        const bDel = document.createElement('button');
        bDel.className = 'btn btn-danger';
        bDel.textContent = '关闭锁屏';
        bDel.style.display = on ? '' : 'none';
        btns.append(bSet, bDel);
        lockWrap.append(status, btns);
        bSet.addEventListener('click', () => openPinModal(on));
        bDel.addEventListener('click', async () => {
          const ok = await UI.confirmDlg({
            title: '关闭锁屏',
            message: '关闭后打开软件不再需要密码，确定吗？',
            okText: '关闭', danger: true
          });
          if (ok) {
            await DB.saveSettings({ lockEnabled: false, lockPinHash: '' });
            UI.toast('锁屏已关闭');
            renderLock();
          }
        });
      }
      renderLock();
      c3.fields.append(lockWrap);

      // AI 备课助手（预留）
      const cAI = makeCard(el, '🤖 AI 备课助手（预留）');
      const aiNote = document.createElement('div');
      aiNote.className = 'muted';
      aiNote.textContent = '真·AI 备课功能预留中：后续开放时，在此配置 AI 服务商密钥即可启用（按次计费，仅发送备课文字，学生数据不上传）。现在可免费使用「备课编辑页 → 🧩 生成备课框架」模板助手。';
      cAI.fields.append(aiNote);

      // 关于
      const c4 = makeCard(el, 'ℹ️ 关于');
      const about = document.createElement('div');
      about.className = 'muted';
      about.textContent = '刘星灼美术课 · 美术教师本地工作台\n版本 0.6.0（新增作业未交名单：按课题自动对比谁没交 + 累计次数榜 + 标记已交 + 打印）\n数据只保存在本设备浏览器中，不上传任何服务器。';
      about.style.whiteSpace = 'pre-line';
      c4.fields.append(about);
    }
  };
})();
