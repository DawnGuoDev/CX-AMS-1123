'use strict';

import {
  esc, icon, DataGrid, openModal, toast, confirmDialog, showLoading, hideLoading,
  statusChip, actionLabel, tabsHtml, bindTabs, formGrid, readForm, emptyState
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';

const TYPE_BY_CODE = { MCMS040: 'Normal', MCMS042: 'Mapping', MCMS041: 'MasterDetail' };
const TYPE_LABEL = { Normal: '一般主档', Mapping: 'Mapping 主档', MasterDetail: 'MasterDetail 主档' };

export async function render(container, ctx) {
  const type = TYPE_BY_CODE[ctx.route.code] || 'Normal';
  let rows = [];
  let history = [];
  let tab = 'data';
  let selectedKey = null;
  let grid = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="brm-body"></div>
  </div>`;
  bindTabs(container.querySelector('.card'), (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get(`/api/brm-defs?type=${type}`);
      rows = res.rows;
      history = res.history || [];
      if (selectedKey && !rows.some(r => r.BRM_KEY === selectedKey)) selectedKey = null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const body = container.querySelector('#brm-body');
    if (tab === 'history') {
      body.innerHTML = `<div class="toolbar"><button class="tool-btn" id="brm-href">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="small muted">${history.length} ${esc(t('笔'))}</span></div></div><div id="brm-history"></div>`;
      new DataGrid(body.querySelector('#brm-history'), {
        rows: history, rowKey: 'HIST_KEY', showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 85 },
          { field: 'ACTION', label: '交易类别', width: 100, render: r => esc(actionLabel(r.ACTION)) },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 155 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'RECORD_LABEL', label: '资料', width: 180 }
        ]
      });
      body.querySelector('#brm-href').addEventListener('click', () => load(true));
      return;
    }
    body.innerHTML = `
      <div class="toolbar">
        <button class="tool-btn tool-add" data-action="add">${icon('plus', 15)}<span>${esc(t('新增'))}</span></button>
        <button class="tool-btn" data-action="copy">${icon('copy', 15)}<span>${esc(t('复制'))}</span></button>
        <button class="tool-btn" data-action="edit">${icon('edit', 15)}<span>${esc(t('修改'))}</span></button>
        <span class="tool-sep"></span>
        <button class="tool-btn" data-action="hide">${icon('hide', 15)}<span>${esc(t('隐藏'))}</span></button>
        <button class="tool-btn" data-action="show">${icon('show', 15)}<span>${esc(t('取消隐藏'))}</span></button>
        <button class="tool-btn" data-action="refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="inline-note">${icon('info', 13)} ${esc(t(TYPE_LABEL[type]))} · ${rows.length} ${esc(t('笔'))}</span></div>
      </div>
      <div id="brm-grid"></div>
    `;
    grid = new DataGrid(body.querySelector('#brm-grid'), {
      rows, rowKey: 'BRM_KEY', selectable: 'single', pageSize: 20,
      columns: [
        { field: 'BRM_ID', label: '主档代码', width: 190 },
        { field: 'BRM_NAME', label: '主档名称', width: 190 },
        { field: 'BRM_TYPE', label: '类型', width: 130, render: r => `<span class="badge badge-blue">${esc(r.BRM_TYPE)}</span>` },
        { field: 'MST_TABLE_NAME', label: '主资料表', width: 160, render: r => esc(r.MST_TABLE_NAME || r.MAP_TABLE_NAME || '–') },
        { field: 'BRM_DESC', label: '说明', width: 300 },
        { field: 'MST_LOG_TABLE_NAME', label: '履历资料表', width: 150 },
        { field: 'ACTIVE', label: '状态', width: 85, render: r => statusChip(r.ACTIVE === 'Y' ? 'Y' : 'N') },
        { field: 'MTR_DATE', label: '修改时间', type: 'datetime', width: 155 }
      ],
      onRowClick: (row) => { selectedKey = row.BRM_KEY; updateEnabled(); }
    });
    if (selectedKey) { grid.selected.add(selectedKey); grid.render(); }
    updateEnabled();
    body.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action)));
  };

  const updateEnabled = () => {
    const row = rows.find(r => r.BRM_KEY === selectedKey);
    ['copy', 'edit', 'hide'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
    const show = container.querySelector('[data-action="show"]');
    if (show) show.disabled = !row || row.ACTIVE !== 'N';
  };

  const handleAction = async (action) => {
    const row = rows.find(r => r.BRM_KEY === selectedKey);
    if (['copy', 'edit', 'hide', 'show'].includes(action) && !row) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openEditor('add', null);
    else if (action === 'copy') openEditor('copy', row);
    else if (action === 'edit') openEditor('edit', row);
    else if (action === 'hide') {
      const ok = await confirmDialog({ title: t('隐藏'), message: `确定要隐藏主档定义「${row.BRM_ID}」？`, okText: t('隐藏'), danger: true });
      if (!ok) return;
      try { await ctx.api.post(`/api/brm-defs/${row.BRM_KEY}/hide`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'show') {
      try { await ctx.api.post(`/api/brm-defs/${row.BRM_KEY}/show`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
  };

  const openEditor = (mode, row) => {
    const isEdit = mode === 'edit';
    const draft = mode === 'add' ? {
      BRM_ID: '', BRM_NAME: '', BRM_DESC: '', BRM_TYPE: type,
      MST_TABLE_NAME: '', MST_LOG_TABLE_NAME: 'history', MST_PK: '', MST_UK: '',
      MST_DATA_QUERY_SQL: '', MST_DATA_SQL_CONST: '', MST_HIDE_DATA_QUERY_SQL: '', MST_HIDE_DATA_SQL_CONST: '',
      MST_LOG_QUERY_SQL: 'SELECT * FROM HISTORY', MST_LOG_SQL_CONST: '',
      EDIT_FORM_COLUMN_COUNT: 2, ENABLE_CUSTOM_VALIDATE: 'N', FILTER_BEFORE_LOAD_DATA: 'N', SHOW_HIDEN_DATA: 'N',
      MAP_TABLE_NAME: '', MAP_LOG_TABLE_NAME: 'history', MAP_PK: '', MAP_UK: '',
      MST_COLUMN_NAME: '', MST_COLUMN_CAPTION: '', VALUE_MEMBER: '', DISPLAY_MEMBER: '', IMPORT_CONDITION_COLUMN_NAME: '',
      IS_MULTI_SELECT: 'Y', MAP_SELECTED_QUERY_SQL: '', MAP_SOURCE_QUERY_SQL: '', LOG_QUERY_SQL: 'SELECT * FROM HISTORY',
      DETAIL_TABLE_NAME: '', DETAIL_LOG_TABLE_NAME: 'history', DETAIL_PK: '',
      DETAIL_DATA_QUERY_SQL: '', DETAIL_LOG_QUERY_SQL: 'SELECT * FROM HISTORY',
      COLUMNS_JSON: '[]', DETAIL_COLUMNS_JSON: '[]'
    } : { ...row };
    if (mode === 'copy') { draft.BRM_ID = ''; delete draft.BRM_KEY; }
    let masterCols = parseJson(draft.COLUMNS_JSON, []);
    let detailCols = parseJson(draft.DETAIL_COLUMNS_JSON, []);
    let activeTab = 'main';

    const basicFields = type === 'Mapping' ? [
      { name: 'BRM_ID', label: '主档代码', type: 'text', required: true, readOnlyOnEdit: isEdit },
      { name: 'BRM_NAME', label: '主档名称', type: 'text', required: true },
      { name: 'BRM_DESC', label: '主档描述', type: 'text', full: true },
      { name: 'MAP_TABLE_NAME', label: '资料表名称', type: 'text', required: true },
      { name: 'MAP_LOG_TABLE_NAME', label: '履历资料表名称', type: 'text', required: true },
      { name: 'MAP_PK', label: '资料表主键', type: 'text' },
      { name: 'MAP_UK', label: '资料表唯一键', type: 'text' },
      { name: 'MST_COLUMN_NAME', label: 'Master栏位名称', type: 'text', required: true },
      { name: 'MST_COLUMN_CAPTION', label: 'Master栏位显示代码', type: 'text', required: true },
      { name: 'VALUE_MEMBER', label: '主选项值的栏位', type: 'text' },
      { name: 'DISPLAY_MEMBER', label: 'Master资料显示栏位', type: 'text', required: true },
      { name: 'IMPORT_CONDITION_COLUMN_NAME', label: '汇入关联栏位', type: 'text' },
      { name: 'IS_MULTI_SELECT', label: '多选功能', type: 'checkbox' },
      { name: 'ENABLE_CUSTOM_VALIDATE', label: '启用客制验证', type: 'checkbox' },
      { name: 'MST_DATA_QUERY_SQL', label: '主资料查询语法', type: 'textarea', required: true },
      { name: 'MST_DATA_SQL_CONST', label: '主资料排序语法', type: 'text' },
      { name: 'MAP_SELECTED_QUERY_SQL', label: '已选择资料查询语法', type: 'textarea', required: true },
      { name: 'MAP_SOURCE_QUERY_SQL', label: 'Mapping资料查询语法', type: 'textarea', required: true },
      { name: 'LOG_QUERY_SQL', label: '履历查询语法', type: 'textarea', required: true }
    ] : [
      { name: 'BRM_ID', label: '主档代码', type: 'text', required: true, readOnlyOnEdit: isEdit },
      { name: 'BRM_NAME', label: '主档名称', type: 'text', required: true },
      { name: 'BRM_DESC', label: '主档描述', type: 'text', full: true },
      { name: 'MST_TABLE_NAME', label: '主资料表名称', type: 'text', required: true },
      { name: 'MST_LOG_TABLE_NAME', label: '履历资料表名称', type: 'text', required: true },
      { name: 'MST_PK', label: '主资料表主键', type: 'text', required: true },
      { name: 'MST_UK', label: '主资料表唯一键', type: 'text' },
      { name: 'MST_DATA_QUERY_SQL', label: '主资料查询语法', type: 'textarea', required: true },
      { name: 'MST_DATA_SQL_CONST', label: '主资料排序语法', type: 'text' },
      { name: 'MST_HIDE_DATA_QUERY_SQL', label: '隐藏资料查询语法', type: 'textarea' },
      { name: 'MST_HIDE_DATA_SQL_CONST', label: '隐藏资料排序语法', type: 'text' },
      { name: 'MST_LOG_QUERY_SQL', label: '履历资料查询语法', type: 'textarea', required: true },
      { name: 'MST_LOG_SQL_CONST', label: '履历资料排序语法', type: 'text' },
      { name: 'EDIT_FORM_COLUMN_COUNT', label: '编辑视窗栏数', type: 'number' },
      { name: 'ENABLE_CUSTOM_VALIDATE', label: '启用客制验证', type: 'checkbox' },
      { name: 'FILTER_BEFORE_LOAD_DATA', label: '过滤后再显示主资料', type: 'checkbox' },
      { name: 'SHOW_HIDEN_DATA', label: '显示已隐藏资料', type: 'checkbox' }
    ];
    const detailFields = type === 'MasterDetail' ? [
      { name: 'DETAIL_TABLE_NAME', label: '明细资料表名称', type: 'text', required: true },
      { name: 'DETAIL_LOG_TABLE_NAME', label: '明细履历资料表名称', type: 'text', required: true },
      { name: 'DETAIL_PK', label: '明细资料表主键', type: 'text', required: true },
      { name: 'DETAIL_DATA_QUERY_SQL', label: '明细资料查询语法', type: 'textarea', required: true },
      { name: 'DETAIL_LOG_QUERY_SQL', label: '明细履历查询语法', type: 'textarea', required: true }
    ] : [];

    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = t('储存');
    footer.append(cancel, save);
    const modal = openModal({
      title: `${t(TYPE_LABEL[type])} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`,
      width: 1120, body, footer
    });

    const renderDialog = () => {
      body.innerHTML = `
        <div class="tabs" style="margin:-18px -18px 16px;padding:0 8px">
          <button class="tab ${activeTab === 'main' ? 'active' : ''}" data-brtab="main">${esc(t('主档资讯'))}</button>
          <button class="tab ${activeTab === 'cols' ? 'active' : ''}" data-brtab="cols">${esc(t('栏位设定'))}</button>
        </div>
        <div id="brm-tab-content"></div>`;
      const content = body.querySelector('#brm-tab-content');
      if (activeTab === 'main') {
        content.innerHTML = `<div class="form-section"><div class="form-section-head">${icon('settings', 13)} ${esc(t('主档资讯'))}</div>
          <div class="form-section-body">${formGrid(basicFields.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit })), draft, ctx.options, { columns: 2 })}</div></div>
          ${detailFields.length ? `<div class="form-section"><div class="form-section-head">${icon('tree', 13)} 明细资料表</div>
          <div class="form-section-body">${formGrid(detailFields, draft, ctx.options, { columns: 2 })}</div></div>` : ''}
          ${type === 'Mapping' ? `<div class="hint-bar mt-12">${icon('info', 14)}<div>Mapping 主档会以左表主档＋右表对应资料呈现；栏位设定用于双栏穿梭框与结果表格。</div></div>` : ''}`;
      } else {
        content.innerHTML = `
          <div class="form-section">
            <div class="form-section-head"><span>${esc(t('栏位设定'))}</span><span class="spacer"></span>
              <button class="btn btn-sm btn-subtle" id="gen-master">${icon('play', 12)} ${esc(t('产生主资料栏位'))}</button>
              <button class="btn btn-sm btn-ghost" id="add-master-col">${icon('plus', 12)} ${esc(t('新增'))}</button>
            </div>
            <div class="form-section-body" style="padding:0"><div id="master-cols"></div></div>
          </div>
          ${type === 'MasterDetail' ? `<div class="form-section">
            <div class="form-section-head"><span>明细资料栏位设定</span>
              <button class="btn btn-sm btn-subtle" id="gen-detail">${icon('play', 12)} ${esc(t('产生明细栏位'))}</button>
            </div>
            <div class="form-section-body" style="padding:0"><div id="detail-cols"></div></div>
          </div>` : ''}`;
        renderCols(content.querySelector('#master-cols'), masterCols, 'master');
        if (type === 'MasterDetail') renderCols(content.querySelector('#detail-cols'), detailCols, 'detail');
        content.querySelector('#add-master-col').addEventListener('click', () => {
          masterCols.push(newCol(masterCols.length + 1));
          renderCols(content.querySelector('#master-cols'), masterCols, 'master');
        });
        content.querySelector('#gen-master').addEventListener('click', () => generate(masterCols, 'master', type === 'Mapping' ? draft.MST_DATA_QUERY_SQL : draft.MST_DATA_QUERY_SQL, content));
        if (type === 'MasterDetail') {
          content.querySelector('#gen-detail').addEventListener('click', () => generate(detailCols, 'detail', draft.DETAIL_DATA_QUERY_SQL, content));
        }
      }
      body.querySelectorAll('[data-brtab]').forEach(btn => {
        btn.addEventListener('click', () => {
          collect();
          activeTab = btn.dataset.brtab;
          renderDialog();
        });
      });
    };

    const newCol = (seq) => ({
      COLUMN_NAME: '', INPUT_TYPE: 'TextBox', COLUMN_DATA_TYPE: 'VARCHAR', IS_FILTER_CONDITION: 'Y',
      DISPLAY: 'Y', DISPLAY_SEQ: seq, CAPTION: '', WIDTH: '160', IS_REQUIRED: 'N', MODIFY_READONLY: 'N'
    });

    const renderCols = (host, cols, kind) => {
      host.innerHTML = `<div class="dg-scroll"><table class="sub-grid">
        <thead><tr><th>${esc(t('域名'))}</th><th>${esc(t('输入类型'))}</th><th>${esc(t('栏位显示代码'))}</th><th>${esc(t('显示'))}</th><th>${esc(t('显示顺序'))}</th><th>${esc(t('宽度'))}</th><th>${esc(t('必填'))}</th><th>${esc(t('修改唯读'))}</th><th>${esc(t('过滤'))}</th><th></th></tr></thead>
        <tbody>${cols.map((c, i) => `<tr data-i="${i}">
          <td><input class="input" data-prop="COLUMN_NAME" value="${esc(c.COLUMN_NAME)}"/></td>
          <td><select class="input" data-prop="INPUT_TYPE">${(ctx.options.inputType || []).map(o => `<option value="${esc(o.value)}" ${c.INPUT_TYPE === o.value ? 'selected' : ''}>${esc(o.value)}</option>`).join('')}</select></td>
          <td><input class="input" data-prop="CAPTION" value="${esc(c.CAPTION)}"/></td>
          <td style="text-align:center"><input type="checkbox" data-prop="DISPLAY" ${c.DISPLAY === 'Y' ? 'checked' : ''}/></td>
          <td><input class="input" type="number" data-prop="DISPLAY_SEQ" value="${esc(c.DISPLAY_SEQ)}" style="width:60px"/></td>
          <td><input class="input" data-prop="WIDTH" value="${esc(c.WIDTH || '')}" style="width:70px"/></td>
          <td style="text-align:center"><input type="checkbox" data-prop="IS_REQUIRED" ${c.IS_REQUIRED === 'Y' ? 'checked' : ''}/></td>
          <td style="text-align:center"><input type="checkbox" data-prop="MODIFY_READONLY" ${c.MODIFY_READONLY === 'Y' ? 'checked' : ''}/></td>
          <td style="text-align:center"><input type="checkbox" data-prop="IS_FILTER_CONDITION" ${c.IS_FILTER_CONDITION === 'Y' ? 'checked' : ''}/></td>
          <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
      host.querySelectorAll('[data-prop]').forEach(inp => {
        inp.addEventListener('change', () => {
          const tr = inp.closest('tr');
          const col = cols[Number(tr.dataset.i)];
          const p = inp.dataset.prop;
          col[p] = inp.type === 'checkbox' ? (inp.checked ? 'Y' : 'N') : inp.value;
        });
      });
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
        cols.splice(Number(btn.dataset.del), 1);
        renderCols(host, cols, kind);
      }));
    };

    const generate = async (cols, kind, sql, content) => {
      if (!sql) { toast('请先填写查询语法', 'warning'); return; }
      try {
        const res = await ctx.api.post('/api/sql/parse', { sql });
        if (!res.ok) { toast(res.message, 'error'); return; }
        res.fields.forEach((f, i) => {
          if (cols.some(c => c.COLUMN_NAME === f.name)) return;
          cols.push({ ...newCol(cols.length + 1), COLUMN_NAME: f.name, CAPTION: f.name, DISPLAY_SEQ: cols.length + 1 });
        });
        renderCols(content.querySelector(kind === 'master' ? '#master-cols' : '#detail-cols'), cols, kind);
        toast(`${res.fields.length} fields parsed`);
      } catch (err) { toast(err.message, 'error'); }
    };

    const collect = () => {
      const content = body.querySelector('#brm-tab-content');
      if (activeTab === 'main') {
        Object.assign(draft, readForm(content, basicFields.concat(detailFields)));
      } else {
        masterCols.forEach(c => { c.DISPLAY_SEQ = Number(c.DISPLAY_SEQ) || 0; });
        detailCols.forEach(c => { c.DISPLAY_SEQ = Number(c.DISPLAY_SEQ) || 0; });
      }
    };

    renderDialog();
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      collect();
      const content = body.querySelector('#brm-tab-content');
      if (activeTab === 'main') {
        const required = basicFields.concat(detailFields).filter(f => f.required && !f.disabled);
        const missing = required.filter(f => !draft[f.name]);
        if (missing.length) { toast(t('请填写必填栏位') + '：' + missing.map(f => t(f.label)).join('、'), 'warning'); return; }
      } else if (!draft.BRM_ID) { toast('主档代码为必填', 'warning'); activeTab = 'main'; renderDialog(); return; }
      const payload = {
        ...draft,
        COLUMNS_JSON: JSON.stringify(masterCols),
        DETAIL_COLUMNS_JSON: JSON.stringify(detailCols)
      };
      if (isEdit) payload.BRM_KEY = row.BRM_KEY;
      if (mode === 'copy' || mode === 'add') delete payload.BRM_KEY;
      save.disabled = true;
      try {
        await ctx.api.post('/api/brm-defs', payload);
        toast(t('储存成功'));
        modal.close();
        selectedKey = null;
        load(true);
      } catch (err) {
        toast(err.message, 'error', 5000);
        save.disabled = false;
      }
    });
  };

  await load();
}

function parseJson(v, fallback) {
  try { return JSON.parse(v || '[]'); } catch (e) { return fallback; }
}
