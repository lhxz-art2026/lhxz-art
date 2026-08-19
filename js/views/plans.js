/* 备课记录：按班级的备课列表 + 大段文字编辑页（全程自动保存） */
(function () {
  const V = window.V = window.V || {};

  // 免费离线备课框架：按美术课通用模板生成结构化教案草稿（真·AI 后续批次接入）
  function buildFramework(topic, clsName) {
    const goal =
      '1. 知识与技能：了解《' + topic + '》的相关知识，掌握基本表现方法，能独立完成一幅作品。\n' +
      '2. 过程与方法：通过观察、欣赏与教师示范，结合「' + clsName + '」学生的年龄特点，在练习中掌握绘画步骤。\n' +
      '3. 情感态度与价值观：感受美术创作的乐趣，敢于表达自己的想法，培养审美意识与耐心细致的习惯。';
    const prepare =
      '教师：范画/课件、示范工具、实物或图片素材。\n' +
      '学生：画纸、画笔（铅笔/橡皮/勾线笔）、上色工具（水彩笔或油画棒）。\n' +
      '（按课题需要补充：手工课准备卡纸、剪刀、胶水；写生课准备写生对象。）';
    const process =
      '① 导入（约3分钟）：出示图片或实物，引出课题《' + topic + '》，激发学生兴趣。\n' +
      '② 新授（约10分钟）：讲解本课要点与作画步骤，教师现场示范关键画法。\n' +
      '③ 练习（约20分钟）：学生开始创作，教师巡回指导，关注构图与进度。\n' +
      '④ 点评（约5分钟）：展示学生作品，自评、互评，教师点评鼓励。\n' +
      '⑤ 小结（约2分钟）：回顾本课重点，收拾工具，布置下次准备事项。';
    const reflect =
      '· 学生掌握情况：本课目标达成度如何，哪些学生需要个别辅导？\n' +
      '· 时间安排：各环节用时是否合理，示范是否清晰？\n' +
      '· 下次改进：素材选择、示范方式或练习难度可以怎样调整？';
    return { goal, prepare, process, reflect };
  }

  // ---------- 备课列表 ----------
  V.plans = {
    async render(el) {
      const classes = await DB.all('classes');
      if (!classes.length) {
        el.innerHTML = '<div class="empty-state">👥 还没有班级<br><span class="muted">请先到「班级」页创建班级</span></div>';
        return;
      }
      let selId = V.plans._c;
      if (!classes.some(c => c.id === selId)) selId = classes[0].id;
      V.plans._c = selId;
      const cls = classes.find(c => c.id === selId);
      const kw = V.plans._kw || '';

      let list = await DB.byIndex('plans', 'classId', selId);
      list.sort((a, b) => b.createdAt - a.createdAt);

      el.innerHTML =
        '<div class="card">' +
        '<div class="filter-bar">' +
        '<select id="selClass">' + classes.map(c =>
          '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>').join('') + '</select>' +
        '<input type="search" id="selKw" placeholder="🔍 搜索课题或内容" value="' + U.escapeHtml(kw) + '" style="flex:1;min-width:160px">' +
        '<button class="btn btn-primary" id="btnNew">＋ 新建备课</button>' +
        '</div></div>' +
        (list.length ?
          '<div style="margin-top:14px">' + list.map(p => {
            const snippet = (p.process || p.goal || p.reflect || '').slice(0, 60);
            return '<div class="card rec-item plan-item" data-kw="' + U.escapeHtml(((p.topic || '') + ' ' + (p.goal || '') + ' ' + (p.process || '')).toLowerCase()) + '">' +
              '<div style="flex:1;min-width:0;cursor:pointer" data-a="open" data-id="' + p.id + '">' +
              '<b>' + U.escapeHtml(p.topic || '（未命名备课）') + '</b>' +
              (p.teachDate ? '<span class="muted"> · 📅 ' + U.escapeHtml(p.teachDate) + '</span>' : '') +
              (snippet ? '<div class="muted">' + U.escapeHtml(snippet) + '…</div>' : '') +
              '</div>' +
              '<div class="rec-actions" style="margin-top:0">' +
              '<button class="btn btn-sm" data-a="del" data-id="' + p.id + '">删除</button></div></div>';
          }).join('') + '</div>'
          : '<div class="empty-state">📝 还没有备课记录<br><span class="muted">点右上角「新建备课」开始写第一篇</span></div>');

      U.$('#selClass', el).addEventListener('change', e => {
        V.plans._c = e.target.value;
        App.refresh();
      });
      U.$('#btnNew', el).addEventListener('click', () => openCreateModal(cls, classes));
      U.$('#selKw', el).addEventListener('input', e => {
        V.plans._kw = e.target.value;
        const k = e.target.value.trim().toLowerCase();
        U.$$('.plan-item', el).forEach(card => {
          card.style.display = !k || card.getAttribute('data-kw').indexOf(k) >= 0 ? '' : 'none';
        });
      });
      U.$$('[data-a="open"]', el).forEach(btn => {
        btn.addEventListener('click', () => location.hash = '#/plans/' + btn.getAttribute('data-id'));
      });
      U.$$('[data-a="del"]', el).forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const p = list.find(x => x.id === btn.getAttribute('data-id'));
          if (!p) return;
          const ok = await UI.confirmDlg({
            title: '删除备课记录',
            message: '确定删除「' + (p.topic || '未命名备课') + '」吗？将移入回收站，可随时还原。',
            okText: '移入回收站', danger: true
          });
          if (ok) {
            await RC.trashRecord('plan', p, '班级「' + cls.name + '」');
            UI.toast('已移入回收站');
            App.refresh();
          }
        });
      });
    },

    // ---------- 备课编辑页（自动保存） ----------
    async renderEditor(el, id) {
      const p = await DB.get('plans', id);
      if (!p) { location.hash = '#/plans'; return; }
      const classes = await DB.all('classes');

      el.innerHTML =
        '<div class="editor-bar">' +
        '<button class="btn" id="btnBack">← 返回备课列表</button>' +
        '<span class="flash-hint" id="saveHint"></span>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-primary" id="btnFrame">🧩 生成备课框架</button>' +
        '<button class="btn btn-danger" id="btnDel">🗑️ 删除</button>' +
        '</div>' +
        '<div class="card">' +
        '<div class="fields" id="fields"></div>' +
        '</div>';

      const flash = () => {
        const h = U.$('#saveHint', el);
        h.textContent = '✓ 已自动保存';
        clearTimeout(flash._t);
        flash._t = setTimeout(() => h.textContent = '', 1400);
      };

      const clsSel = document.createElement('select');
      classes.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        clsSel.appendChild(o);
      });
      clsSel.value = p.classId;
      const fCls = UI.field('班级 *', clsSel);

      const topicInp = document.createElement('input');
      topicInp.placeholder = '课题，如：色彩的冷暖';
      topicInp.value = p.topic || '';
      const fTopic = UI.field('课题', topicInp);
      const topicWarn = document.createElement('div');
      topicWarn.className = 'muted';
      topicWarn.textContent = '课题建议填写，方便以后在列表里查找';

      const dateInp = document.createElement('input');
      dateInp.type = 'date';
      dateInp.value = p.teachDate || '';
      const fDate = UI.field('上课日期（选填）', dateInp);

      function ta(rows, placeholder) {
        const t = document.createElement('textarea');
        t.rows = rows;
        t.placeholder = placeholder;
        t.className = 'ta-lg';
        return t;
      }
      const goalInp = ta(3, '教学目标：这节课要达到什么效果（可直接从 Word/微信粘贴大段文字）');
      goalInp.value = p.goal || '';
      const prepInp = ta(3, '教学准备：需要的材料、工具清单等');
      prepInp.value = p.prepare || '';
      const procInp = ta(9, '教学过程：怎么上这节课（重点，支持大段文字）');
      procInp.value = p.process || '';
      const reflInp = ta(4, '课后反思：上完课之后的总结与改进想法');
      reflInp.value = p.reflect || '';

      U.$('#fields', el).append(
        fCls.el, fTopic.el, topicWarn, fDate.el,
        UI.field('教学目标', goalInp).el,
        UI.field('教学准备', prepInp).el,
        UI.field('教学过程', procInp).el,
        UI.field('课后反思', reflInp).el
      );

      const save = U.debounce(async () => {
        await DB.put('plans', Object.assign({}, p, {
          classId: clsSel.value, topic: topicInp.value,
          teachDate: dateInp.value, goal: goalInp.value,
          prepare: prepInp.value, process: procInp.value, reflect: reflInp.value
        }));
        flash();
      }, 400);
      [clsSel, topicInp, dateInp, goalInp, prepInp, procInp, reflInp].forEach(inp => {
        inp.addEventListener('input', save);
        inp.addEventListener('change', save);
      });
      topicInp.addEventListener('input', () => {
        topicWarn.textContent = topicInp.value.trim() ? '课题建议填写，方便以后在列表里查找' : '课题为空时，列表里会显示「未命名备课」';
      });

      U.$('#btnBack', el).addEventListener('click', () => location.hash = '#/plans');
      U.$('#btnFrame', el).addEventListener('click', async () => {
        const topic = topicInp.value.trim();
        if (!topic) {
          UI.toast('请先填写课题名称，再生成框架', 'error');
          topicInp.focus();
          return;
        }
        const has = goalInp.value || prepInp.value || procInp.value || reflInp.value;
        if (has) {
          const ok = await UI.confirmDlg({
            title: '生成备课框架',
            message: '生成框架会覆盖已填写的教学内容，确定继续吗？',
            okText: '覆盖并生成', danger: true
          });
          if (!ok) return;
        }
        const clsName = ((await DB.get('classes', clsSel.value)) || {}).name || '本班';
        const f = buildFramework(topic, clsName);
        goalInp.value = f.goal;
        prepInp.value = f.prepare;
        procInp.value = f.process;
        reflInp.value = f.reflect;
        save();
        UI.toast('✅ 备课框架已生成，请按需修改（已自动保存）', 'success');
      });
      U.$('#btnDel', el).addEventListener('click', async () => {
        const ok = await UI.confirmDlg({
          title: '删除备课记录',
          message: '确定删除「' + (p.topic || '未命名备课') + '」吗？将移入回收站，可随时还原。',
          okText: '移入回收站', danger: true
        });
        if (ok) {
          await RC.trashRecord('plan', p, '备课');
          UI.toast('已移入回收站');
          location.hash = '#/plans';
        }
      });
    }
  };

  // 新建备课：先填必填项，创建后进入编辑页
  async function openCreateModal(cls, classes) {
    const m = UI.modal({ title: '新建备课' });
    const clsSel = document.createElement('select');
    classes.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      clsSel.appendChild(o);
    });
    clsSel.value = cls.id;
    const fCls = UI.field('班级 *', clsSel);
    const topicInp = document.createElement('input');
    topicInp.placeholder = '课题名称，如：色彩的冷暖';
    const fTopic = UI.field('课题 *', topicInp);
    m.body.append(fCls.el, fTopic.el);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.textContent = '取消';
    btnCancel.onclick = () => m.close();
    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary';
    btnOk.textContent = '创建并开始写';
    btnOk.onclick = async () => {
      const topic = topicInp.value.trim();
      if (!topic) { fTopic.setError('请填写课题名称'); return; }
      m.close();
      const rec = { id: U.uid('pl'), classId: clsSel.value, topic, createdAt: Date.now() };
      await DB.put('plans', rec);
      UI.toast('✅ 已创建，开始写吧（所有改动自动保存）', 'success');
      location.hash = '#/plans/' + rec.id;
    };
    m.actions.append(btnCancel, btnOk);
  }
})();
