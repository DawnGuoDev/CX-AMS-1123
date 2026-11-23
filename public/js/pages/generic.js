'use strict';

import {
  esc, icon, DataGrid, toolbar, bindToolbar, openModal, confirmDialog, formGrid, readForm,
  bindDependentSelects, renderFileImport, downloadBlob, toast, showLoading, hideLoading,
  statusChip, actionLabel, emptyState, tabsHtml, bindTabs, fieldControl
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';

const FIELD_OPTION_SET = {
  FACTORY_KEY: 'factory', SUB_SYS_KEY: 'subsystem', EQP_KEY: 'eqp', EQP_GROUP_KEY: 'eqpGroup',
  EQP_TYPE_KEY: 'eqpType', CURRENT_STATUS: 'eqpStatus', EQP_STATUS_KEY: 'eqpStatus',
  USER_KEY: 'user', GROUP_KEY: 'userGroup', EVENT_KEY: 'event', EVENT_GROUP_KEY: 'eventGroup',
  ALARM_INFO_KEY: 'alarmSetting', PROCRSC_KEY: 'chamber', ORGAN_KEY: 'department', SHIFT_KEY: 'shift'
};

const LABELS = {
  FACTORY_ID: '厂别代码', FACTORY_NAME: '厂别名称', FACTORY_DESC: '厂别说明',
  SUB_SYS_ID: '子系统代码', SUB_SYS_NAME: '子系统名称', BYPASS: 'BYPASS',
  EQP_ID: '机台代码', EQP_NAME: '机台名称', EQP_DESC: '机台说明',
  EQP_GROUP_ID: '机台群组代码', EQP_GROUP_NAME: '机台组名', EQP_GROUP_DESC: '机台群组说明',
  EQP_TYPE_ID: '机台型号代码', EQP_TYPE_DESC: '机台型号说明',
  EQP_STATUS_ID: '机台状态代码', EQP_STATUS_DESC: '机台状态说明',
  USER_ID: '使用者代码', USER_NAME: '使用者名称', E_MAIL: 'E-Mail', ORGAN_KEY: '部门',
  GROUP_ID: '使用者群组代码', GROUP_NAME: '使用者群组名称', GROUP_DESC: '使用者群组说明',
  EVENT_ID: '事件通知代码', EVENT_NAME: '事件通知名称', EVENT_DESC: '事件通知说明',
  EVENT_GROUP_ID: '事件通知人员群组代码', EVENT_GROUP_NAME: '事件通知人员群组名称',
  ALARM_INFO_ID: '警报代码', ALARM_ID_DESC: '警报说明',
  PROCRSC_ID: 'PROCRSC_ID', CHAMBER_NAME: '子机台名称',
  ACTIVE: '状态', MTR_DATE: '修改时间', MTR_USER_NAME: '修改人员名称',
  MAP_KEY: '对应键', REGION: '区域', LOCATION: '位置'
};

function labelFor(ctx, field) {
  if (LABELS[field]) return LABELS[field];
  for (const m of Object.values(ctx.meta.masters || {})) {
    const f = (m.fields || []).find(x => x.name === field);
    if (f) return f.label;
  }
  for (const m of Object.values(ctx.meta.masterDetails || {})) {
    const f = (m.fields || []).find(x => x.name === field) || ((m.detail && m.detail.fields) || []).find(x => x.name === field);
    if (f) return f.label;
  }
  return field;
}

function optionSetFor(field) {
  return FIELD_OPTION_SET[field] || null;
}

function buildColumns(ctx, names, extra = {}) {
  return names.map(name => {
    const set = optionSetFor(name);
    return {
      field: name,
      label: labelFor(ctx, name),
      optionSet: set,
      type: /_DT$|DATE/.test(name) ? 'datetime' : name === 'ACTIVE' ? 'yn' : undefined,
      width: extra[name] || 150
    };
  });
}

function auditColumns() {
  return [
    { field: 'MTR_DATE', label: t('修改时间'), type: 'datetime', width: 150 },
    { field: 'MTR_USER_NAME', label: t('修改人员名称'), width: 105 }
  ];
}

/* ================================================================ 一般主档 */
export async function renderMaster(container, ctx) {
  const meta = ctx.meta.masters[ctx.route.code];
  let tab = 'data';
  let showHidden = false;
  let filters = {};
  let selectedKey = null;
  let rows = [];
  let history = [];
  let grid = null;
  let historyGrid = null;

  container.innerHTML = `<div class="card" id="master-card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="master-body"></div>
  </div>`;

  const card = container.querySelector('#master-card');
  bindTabs(card, (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get(`/api/master/${meta.code}?showHidden=${showHidden ? 1 : 0}&filters=${encodeURIComponent(JSON.stringify(filters))}`);
      rows = res.rows;
      history = res.history || [];
      if (selectedKey && !rows.some(r => r[meta.keyField] === selectedKey)) selectedKey = null;
      ctx.setUpdated(new Date().toISOString());
      draw();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (!silent) hideLoading();
    }
  };

  const selectedRow = () => rows.find(r => r[meta.keyField] === selectedKey);

  const draw = () => {
    const body = container.querySelector('#master-body');
    if (tab === 'history') {
      body.innerHTML = `<div class="toolbar">
        <button class="tool-btn" data-action="refresh-history">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="small muted">${history.length} ${esc(t('笔'))}</span></div>
      </div><div id="history-grid"></div>`;
      historyGrid = new DataGrid(body.querySelector('#history-grid'), {
        rows: history,
        rowKey: 'HIST_KEY',
        showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 90 },
          { field: 'ACTION', label: '交易类别', width: 110, render: r => `<span class="badge ${r.ACTION === 'Hide' ? 'badge-red' : r.ACTION === 'AddNew' ? 'badge-blue' : 'badge-green'}">${esc(actionLabel(r.ACTION))}</span>` },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 160 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'IP', label: 'IP', width: 110 },
          { field: 'HOST', label: '电脑名称', width: 130 },
          { field: 'RECORD_LABEL', label: '资料', width: 150 }
        ]
      });
      body.querySelector('[data-action="refresh-history"]').addEventListener('click', () => load(true));
      return;
    }
    const tb = toolbar([
      { action: 'add', label: '新增', icon: 'plus', kind: 'add' },
      { action: 'copy', label: '复制', icon: 'copy' },
      { action: 'edit', label: '修改', icon: 'edit' },
      { action: 'sep1', label: '', icon: '' },
      { action: 'hide', label: '隐藏', icon: 'hide' },
      { action: 'show', label: '取消隐藏', icon: 'show' },
      { action: 'refresh', label: '重新整理', icon: 'refresh' },
      { action: 'filter', label: '过滤', icon: 'filter' },
      { action: 'sep2', label: '', icon: '' },
      { action: 'export', label: '汇出', icon: 'export' },
      { action: 'template', label: '汇出范本', icon: 'template' },
      { action: 'import', label: '汇入', icon: 'import' }
    ]).replace(/<button class="tool-btn[^"]*" data-action="sep[^"]*"[^>]*>[\s\S]*?<\/button>/g, '<span class="tool-sep"></span>');
    body.innerHTML = tb.slice(0, -6) + `<div class="toolbar-right">
        <label class="checkbox-label"><input type="checkbox" id="show-hidden" ${showHidden ? 'checked' : ''}/> ${esc(t('显示已隐藏资料'))}</label>
      </div></div>`;
    const filterChips = Object.entries(filters).filter(([, v]) => v !== '' && v != null);
    body.innerHTML += `<div id="filter-chips" style="padding:8px 12px;border-bottom:1px solid var(--line-2);${filterChips.length ? '' : 'display:none'}">
      <div class="filter-chips">${filterChips.map(([k, v]) => `<span class="filter-chip">${esc(labelFor(ctx, k))}: ${esc(v)}<button data-clear-filter="${esc(k)}">${icon('close', 10)}</button></span>`).join('')}
      <button class="btn btn-sm btn-ghost" id="clear-all-filters">${esc(t('清除'))}</button></div>
    </div>`;
    body.insertAdjacentHTML('beforeend', '<div id="master-grid"></div>');
    const columns = meta.fields.filter(f => f.grid !== false).map(f => ({
      field: f.name,
      label: f.label,
      width: f.width || 140,
      optionSet: f.optionSet,
      type: f.type === 'datetime' ? 'datetime' : f.type === 'checkbox' ? 'yn' : f.type === 'number' ? 'number' : undefined
    }));
    columns.push(...auditColumns());
    grid = new DataGrid(body.querySelector('#master-grid'), {
      rows,
      rowKey: meta.keyField,
      selectable: 'single',
      columns,
      pageSize: 20,
      onRowClick: (row) => { selectedKey = row[meta.keyField]; updateToolbar(); }
    });
    // 恢复选中
    if (selectedKey) {
      grid.selected.add(selectedKey);
      grid.render();
    }
    updateToolbar();
    bindToolbar(body, (action) => {
      if (action.startsWith('sep')) return;
      handleAction(action);
    });
    body.querySelector('#show-hidden').addEventListener('change', (e) => { showHidden = e.target.checked; selectedKey = null; load(); });
    body.querySelectorAll('[data-clear-filter]').forEach(btn => {
      btn.addEventListener('click', () => { delete filters[btn.dataset.clearFilter]; load(true); });
    });
    const clearAll = body.querySelector('#clear-all-filters');
    if (clearAll) clearAll.addEventListener('click', () => { filters = {}; load(true); });
  };

  const updateToolbar = () => {
    const body = container.querySelector('#master-body');
    if (!body) return;
    const row = selectedRow();
    ['copy', 'edit', 'hide'].forEach(a => {
      const btn = body.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
    const showBtn = body.querySelector('[data-action="show"]');
    if (showBtn) showBtn.disabled = !row || row.ACTIVE !== 'N';
  };

  const handleAction = async (action) => {
    const row = selectedRow();
    if (['copy', 'edit', 'hide', 'show'].includes(action) && !row) {
      toast(t('请选择一笔资料'), 'warning');
      return;
    }
    if (action === 'add') openEdit('add', null);
    else if (action === 'copy') openEdit('copy', row);
    else if (action === 'edit') openEdit('edit', row);
    else if (action === 'hide') {
      const ok = await confirmDialog({
        title: t('隐藏'), message: `${t('确定要隐藏')} ${row[meta.idField]} ？${t('隐藏后可由「显示已隐藏资料」恢复')}`,
        okText: t('隐藏'), danger: true
      });
      if (!ok) return;
      try {
        await ctx.api.post(`/api/master/${meta.code}/${encodeURIComponent(row[meta.keyField])}/hide`);
        toast(t('操作成功'));
        await ctx.refreshOptions();
        load(true);
      } catch (err) { toast(err.message, 'error'); }
    } else if (action === 'show') {
      if (!showHidden) { toast(t('请勾选显示已隐藏资料'), 'warning'); return; }
      try {
        await ctx.api.post(`/api/master/${meta.code}/${encodeURIComponent(row[meta.keyField])}/show`);
        toast(t('操作成功'));
        await ctx.refreshOptions();
        load(true);
      } catch (err) { toast(err.message, 'error'); }
    } else if (action === 'refresh') {
      load(true);
      toast(t('资料已更新'), 'info');
    } else if (action === 'filter') {
      openFilterDialog();
    } else if (action === 'export') {
      await exportExcel('data');
    } else if (action === 'template') {
      await exportExcel('template');
    } else if (action === 'import') {
      openImport();
    }
  };

  const exportExcel = async (mode) => {
    try {
      showLoading(t('读取中'));
      const res = await ctx.api.post(`/api/master/${meta.code}/export`, { mode });
      downloadBlob(res.filename, res.base64);
      toast(t('已汇出'));
    } catch (err) {
      toast(err.message, 'error');
    } finally { hideLoading(); }
  };

  const openImport = () => {
    renderFileImport({
      title: `${meta.title} - ${t('汇入')}`,
      onVerify: async (file) => {
        const { readFileAsBase64 } = await import('../api.js');
        const base64 = await readFileAsBase64(file);
        const res = await ctx.api.post(`/api/master/${meta.code}/import/verify`, { base64 });
        return res.rows;
      },
      onImport: async (selectedRows) => {
        const res = await ctx.api.post(`/api/master/${meta.code}/import`, { rows: selectedRows });
        toast(`${t('汇入完成')}：${res.success} ${t('笔资料')}`);
        if (res.errors && res.errors.length) toast(res.errors.slice(0, 2).join('；'), 'warning', 6000);
        await ctx.refreshOptions();
        load(true);
      }
    });
  };

  const openFilterDialog = () => {
    const filterFields = (meta.filters || []).map(name => {
      const f = meta.fields.find(x => x.name === name);
      return f ? { ...f, required: false } : { name, label: labelFor(ctx, name), type: 'text' };
    });
    const body = document.createElement('div');
    body.innerHTML = formGrid(filterFields, filters, ctx.options, { columns: 2 });
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const clear = document.createElement('button');
    clear.className = 'btn btn-ghost'; clear.textContent = t('清除');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const apply = document.createElement('button');
    apply.className = 'btn btn-primary'; apply.textContent = t('查询');
    footer.append(clear, cancel, apply);
    const modal = openModal({ title: `${meta.title} - ${t('过滤')}`, width: 650, body, footer });
    bindDependentSelects(body, filterFields, ctx.options);
    clear.addEventListener('click', () => {
      body.querySelectorAll('.input').forEach(i => { i.value = ''; });
    });
    cancel.addEventListener('click', modal.close);
    apply.addEventListener('click', () => {
      filters = {};
      filterFields.forEach(f => {
        const v = readForm(body, [f])[f.name];
        if (v !== '' && v != null) filters[f.name] = v;
      });
      modal.close();
      selectedKey = null;
      load();
    });
  };

  const openEdit = (mode, row) => {
    const isEdit = mode === 'edit';
    const values = mode === 'add' ? { ...(meta.defaults || {}) } : { ...row };
    if (mode === 'copy') values[meta.idField] = '';
    if (meta.table === 'users') values.PASSWORD = '';
    const fields = meta.fields.map(f => ({
      ...f,
      disabled: isEdit && f.readOnlyOnEdit,
      required: f.required
    }));
    const body = document.createElement('div');
    body.innerHTML = formGrid(fields, values, ctx.options, { columns: 2 });
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = t('储存');
    footer.append(cancel, save);
    const title = `${meta.title} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`;
    const modal = openModal({ title, width: 840, body, footer });
    bindDependentSelects(body, fields, ctx.options);
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      const data = readForm(body, fields);
      const missing = fields.filter(f => f.required && !f.disabled && (data[f.name] === '' || data[f.name] == null));
      if (missing.length) {
        toast(t('请填写必填栏位') + '：' + missing.map(f => t(f.label)).join('、'), 'warning');
        return;
      }
      save.disabled = true;
      try {
        if (isEdit) {
          await ctx.api.put(`/api/master/${meta.code}/${encodeURIComponent(row[meta.keyField])}`, data);
        } else {
          await ctx.api.post(`/api/master/${meta.code}`, data);
        }
        toast(t('储存成功'));
        modal.close();
        if (mode === 'add') selectedKey = null;
        await ctx.refreshOptions();
        load(true);
      } catch (err) {
        toast(err.message, 'error', 5000);
        save.disabled = false;
      }
    });
  };

  await load();
}

/* ================================================================ Mapping */
export async function renderMapping(container, ctx) {
  const meta = ctx.meta.mappings[ctx.route.code];
  let data;
  let currentMasterKey = null;
  let tab = 'data';
  let selectedMasterKey = null;
  let masterGrid = null;
  let itemGrid = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div class="toolbar" id="map-toolbar">
      <button class="tool-btn" data-action="copy">${icon('copy', 15)}<span>${esc(t('复制'))}</span></button>
      <button class="tool-btn" data-action="edit">${icon('edit', 15)}<span>${esc(t('修改'))}</span></button>
      <button class="tool-btn" data-action="refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
      <span class="tool-sep"></span>
      <button class="tool-btn" data-action="export">${icon('export', 15)}<span>${esc(t('汇出'))}</span></button>
      <button class="tool-btn" data-action="template">${icon('template', 15)}<span>${esc(t('汇出范本'))}</span></button>
      <button class="tool-btn" data-action="import">${icon('import', 15)}<span>${esc(t('汇入'))}</span></button>
      <div class="toolbar-right"><span class="inline-note">${icon('info', 13)} ${esc(t('点选左侧主档后，右侧显示对应资料'))}</span></div>
    </div>
    <div id="map-body"></div>
  </div>`;
  const card = container.querySelector('.card');
  bindTabs(card, (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      data = await ctx.api.get(`/api/mapping/${meta.code}`);
      if (!selectedMasterKey && data.masters.length) selectedMasterKey = data.masters[0][meta.master.key];
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) {
      toast(err.message, 'error');
    } finally { if (!silent) hideLoading(); }
  };

  const mappedItems = (masterKey) => {
    const keys = data.mapRows.filter(m => m[meta.mapMasterFk] === masterKey).map(m => m[meta.mapItemFk]);
    return data.items.filter(i => keys.includes(i[meta.item.key]));
  };

  const draw = () => {
    const body = container.querySelector('#map-body');
    if (tab === 'history') {
      body.innerHTML = '<div id="map-history"></div>';
      new DataGrid(body.querySelector('#map-history'), {
        rows: data.history || [], rowKey: 'HIST_KEY', showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 85 },
          { field: 'ACTION', label: '交易类别', width: 100, render: r => esc(actionLabel(r.ACTION)) },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 155 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'RECORD_LABEL', label: '主档', width: 160 }
        ]
      });
      return;
    }
    body.innerHTML = `<div class="split-master-detail" style="padding:14px">
      <div class="split-panel card" style="box-shadow:none">
        <div class="panel-caption"><div class="pc-title">${icon('user', 14)} ${esc(t(meta.master.label))}</div><div class="pc-meta">${data.masters.length} ${esc(t('笔'))}</div></div>
        <div id="map-masters"></div>
      </div>
      <div class="split-panel card" style="box-shadow:none">
        <div class="panel-caption"><div class="pc-title">${icon('eqp', 14)} ${esc(t(meta.item.label))}</div><div class="pc-meta" id="map-item-count"></div></div>
        <div id="map-items"></div>
      </div>
    </div>`;
    const masterCols = buildColumns(ctx, meta.masterColumns);
    masterGrid = new DataGrid(body.querySelector('#map-masters'), {
      rows: data.masters, rowKey: meta.master.key, selectable: 'single', pageSize: 10,
      columns: masterCols,
      onRowClick: (row) => {
        selectedMasterKey = row[meta.master.key];
        refreshItems();
      }
    });
    if (selectedMasterKey) { masterGrid.selected.add(selectedMasterKey); masterGrid.render(); }
    refreshItems();
    updateEnabled();
  };

  const refreshItems = () => {
    const body = container.querySelector('#map-body');
    const itemCols = buildColumns(ctx, meta.itemColumns);
    const items = mappedItems(selectedMasterKey);
    const countEl = body.querySelector('#map-item-count');
    if (countEl) countEl.textContent = `${items.length} ${t('笔')}`;
    itemGrid = new DataGrid(body.querySelector('#map-items'), {
      rows: items, rowKey: meta.item.key, pageSize: 10, columns: itemCols
    });
    updateEnabled();
  };

  const updateEnabled = () => {
    const row = data && data.masters.find(m => m[meta.master.key] === selectedMasterKey);
    ['copy', 'edit'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
  };

  container.querySelectorAll('#map-toolbar [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const master = data.masters.find(m => m[meta.master.key] === selectedMasterKey);
      if (['copy', 'edit'].includes(action) && !master) { toast(t('请选择一笔资料'), 'warning'); return; }
      if (action === 'edit' || action === 'copy') openEdit(action, master);
      else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
      else if (action === 'export' || action === 'template') {
        try {
          showLoading(t('读取中'));
          const res = await ctx.api.post(`/api/mapping/${meta.code}/export`, { mode: action === 'template' ? 'template' : 'data' });
          downloadBlob(res.filename, res.base64);
          toast(t('已汇出'));
        } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
      } else if (action === 'import') {
        renderFileImport({
          title: `${meta.title} - ${t('汇入')}`,
          onVerify: async (file) => {
            const { readFileAsBase64 } = await import('../api.js');
            const base64 = await readFileAsBase64(file);
            const res = await ctx.api.post(`/api/mapping/${meta.code}/import/verify`, { base64 });
            return res.rows.map(r => ({ ...r, display: [{ label: '主档', value: r.masterCode }, { label: '对应', value: r.itemCode }] }));
          },
          onImport: async (rows) => {
            const res = await ctx.api.post(`/api/mapping/${meta.code}/import`, { rows });
            toast(`${t('汇入完成')}：${res.success} ${t('笔')}`);
            load(true);
          }
        });
      }
    });
  });

  const openEdit = (mode, master) => {
    const mapped = mappedItems(master[meta.master.key]).map(i => i[meta.item.key]);
    let currentSelected = mode === 'edit' ? mapped : [];
    let currentMaster = master[meta.master.key];
    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('关闭');
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = t('储存');
    footer.append(cancel, save);
    const modal = openModal({
      title: `${meta.title} - ${t(mode === 'copy' ? '复制' : '修改')}`,
      width: 980, body, footer
    });
    const renderBody = () => {
      body.innerHTML = `
        <div class="form-field mb-16" style="grid-template-columns:110px minmax(0,1fr);max-width:520px">
          <div class="form-label">${esc(t(meta.master.label))}</div>
          <div class="form-control">
            <select class="input" id="mapping-master" ${mode === 'edit' ? 'disabled' : ''}>
              ${data.masters.map(m => `<option value="${esc(m[meta.master.key])}" ${m[meta.master.key] === currentMaster ? 'selected' : ''}>${esc(m[meta.master.display[0]])} ${esc(m[meta.master.display[1]] || '')}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="transfer" id="mapping-transfer">
          <div class="transfer-panel">
            <div class="transfer-head"><span>${esc(t('未选择'))}</span><span class="badge badge-gray" id="left-count">0</span></div>
            <div class="transfer-search"><div class="col-filter">${icon('search', 12)}<input id="left-search" placeholder="${esc(t('搜索'))}"/></div></div>
            <div class="transfer-list" id="left-list"></div>
          </div>
          <div class="transfer-actions">
            <button type="button" class="btn btn-primary btn-sm" id="move-right" title="${esc(t('选择'))}">${icon('arrowRight', 15)}</button>
            <button type="button" class="btn btn-ghost btn-sm" id="move-left" title="${esc(t('移除'))}">${icon('arrowLeft', 15)}</button>
          </div>
          <div class="transfer-panel">
            <div class="transfer-head"><span>${esc(t('已选择'))}</span><span class="badge badge-blue" id="right-count">0</span></div>
            <div class="transfer-search"><div class="col-filter">${icon('search', 12)}<input id="right-search" placeholder="${esc(t('搜索'))}"/></div></div>
            <div class="transfer-list" id="right-list"></div>
          </div>
        </div>
        <div class="hint-bar mt-12">${icon('info', 14)}<div>${esc(t('未选'))} → ${esc(t('已选择'))}：勾选左侧资料后点选箭头；储存后整组替换对应关系。</div></div>
      `;
      const leftList = body.querySelector('#left-list');
      const rightList = body.querySelector('#right-list');
      const renderLists = (leftFilter = '', rightFilter = '') => {
        const left = data.items.filter(i => !currentSelected.includes(i[meta.item.key]))
          .filter(i => !leftFilter || String(i[meta.item.display[0]]).toLowerCase().includes(leftFilter.toLowerCase()) || String(i[meta.item.display[1]] || '').toLowerCase().includes(leftFilter.toLowerCase()));
        const right = data.items.filter(i => currentSelected.includes(i[meta.item.key]))
          .filter(i => !rightFilter || String(i[meta.item.display[0]]).toLowerCase().includes(rightFilter.toLowerCase()) || String(i[meta.item.display[1]] || '').toLowerCase().includes(rightFilter.toLowerCase()));
        leftList.innerHTML = left.length ? left.map(i => itemRow(i, false)).join('') : `<div class="transfer-empty">${esc(t('无资料'))}</div>`;
        rightList.innerHTML = right.length ? right.map(i => itemRow(i, true)).join('') : `<div class="transfer-empty">${esc(t('无资料'))}</div>`;
        body.querySelector('#left-count').textContent = left.length;
        body.querySelector('#right-count').textContent = right.length;
      };
      const itemRow = (item, selected) => `<label class="transfer-item"><input type="checkbox" data-side="${selected ? 'right' : 'left'}" value="${esc(item[meta.item.key])}"/><span><span class="ti-primary">${esc(item[meta.item.display[0]])}</span><br/><span class="ti-sub">${esc(item[meta.item.display[1]] || '')}${meta.item.display[2] ? ' · ' + esc(resolveDisplay(meta.item.display[2], item[meta.item.display[2]])) : ''}</span></span></label>`;
      const move = (fromSide, toRight) => {
        const checked = [...body.querySelectorAll(`input[data-side="${fromSide}"]:checked`)].map(i => i.value);
        if (!checked.length) return;
        if (toRight) currentSelected = [...new Set([...currentSelected, ...checked])];
        else currentSelected = currentSelected.filter(k => !checked.includes(k));
        renderLists(body.querySelector('#left-search').value, body.querySelector('#right-search').value);
      };
      renderLists();
      body.querySelector('#move-right').addEventListener('click', () => move('left', true));
      body.querySelector('#move-left').addEventListener('click', () => move('right', false));
      body.querySelector('#left-search').addEventListener('input', (e) => renderLists(e.target.value, body.querySelector('#right-search').value));
      body.querySelector('#right-search').addEventListener('input', (e) => renderLists(body.querySelector('#left-search').value, e.target.value));
      body.querySelector('#mapping-master').addEventListener('change', (e) => {
        currentMaster = e.target.value;
        currentSelected = mode === 'copy' ? [] : mappedItems(currentMaster).map(i => i[meta.item.key]);
        renderLists();
      });
    };
    renderBody();
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      if (!currentSelected.length) {
        const ok = await confirmDialog({ title: t('提示'), message: '目前没有选择任何对应资料，确定要储存空白对应关系？', okText: t('储存'), danger: true });
        if (!ok) return;
      }
      save.disabled = true;
      try {
        await ctx.api.post(`/api/mapping/${meta.code}/${encodeURIComponent(currentMaster)}`, { itemKeys: currentSelected });
        toast(t('储存成功'));
        modal.close();
        selectedMasterKey = currentMaster;
        load(true);
      } catch (err) {
        toast(err.message, 'error');
        save.disabled = false;
      }
    });
  };

  await load();
}

function resolveDisplay(field, value) {
  if (field === 'ORGAN_KEY') return value;
  return value == null ? '' : value;
}

/* ============================================================ MasterDetail */
export async function renderMasterDetail(container, ctx) {
  const meta = ctx.meta.masterDetails[ctx.route.code];
  let tab = 'data';
  let showHidden = false;
  let data;
  let selectedKey = null;
  let selectedRow = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="md-body"></div>
  </div>`;
  bindTabs(container.querySelector('.card'), (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      data = await ctx.api.get(`/api/masterdetail/${meta.code}?showHidden=${showHidden ? 1 : 0}`);
      if (selectedKey && !data.masters.some(m => m[meta.masterKey] === selectedKey)) selectedKey = null;
      if (!selectedKey && data.masters.length) selectedKey = data.masters[0][meta.masterKey];
      selectedRow = data.masters.find(m => m[meta.masterKey] === selectedKey) || null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const body = container.querySelector('#md-body');
    if (tab === 'history') {
      body.innerHTML = `<div class="toolbar"><button class="tool-btn" data-action="refresh-history">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="small muted">${(data.history || []).length} ${esc(t('笔'))}</span></div></div><div id="md-history"></div>`;
      new DataGrid(body.querySelector('#md-history'), {
        rows: data.history || [], rowKey: 'HIST_KEY', showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 85 },
          { field: 'ACTION', label: '交易类别', width: 100, render: r => esc(actionLabel(r.ACTION)) },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 155 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'IP', label: 'IP', width: 110 },
          { field: 'RECORD_LABEL', label: '资料', width: 150 }
        ]
      });
      body.querySelector('[data-action="refresh-history"]').addEventListener('click', () => load(true));
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
        <div class="toolbar-right">
          <label class="checkbox-label"><input type="checkbox" id="md-show-hidden" ${showHidden ? 'checked' : ''}/> ${esc(t('显示已隐藏资料'))}</label>
        </div>
      </div>
      <div id="md-master-grid"></div>
      <div class="detail-block">
        <div class="detail-caption"><span>${esc(t(meta.detail.title || '明细资料'))}</span><span class="dc-sub" id="md-detail-count"></span></div>
        <div id="md-detail-grid"></div>
      </div>
    `;
    const columns = meta.fields.filter(f => f.grid !== false).map(f => ({
      field: f.name, label: f.label, width: f.width || 150,
      optionSet: f.optionSet,
      type: f.type === 'datetime' ? 'datetime' : f.type === 'checkbox' ? 'yn' : f.type === 'number' ? 'number' : undefined
    }));
    columns.push(...auditColumns());
    const masterGrid = new DataGrid(body.querySelector('#md-master-grid'), {
      rows: data.masters, rowKey: meta.masterKey, selectable: 'single', pageSize: 10, columns,
      onRowClick: (row) => {
        selectedKey = row[meta.masterKey];
        selectedRow = row;
        refreshDetails();
        updateEnabled();
      }
    });
    if (selectedKey) { masterGrid.selected.add(selectedKey); masterGrid.render(); }
    refreshDetails();
    updateEnabled();
    body.querySelector('#md-show-hidden').addEventListener('change', (e) => { showHidden = e.target.checked; selectedKey = null; load(); });
    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  };

  const detailRows = () => {
    if (!selectedRow) return [];
    return (data.details || []).filter(d => d[meta.detail.fk] === selectedRow[meta.masterKey]);
  };

  const refreshDetails = () => {
    const body = container.querySelector('#md-body');
    if (!body) return;
    const rows = detailRows();
    const count = body.querySelector('#md-detail-count');
    if (count) count.textContent = `${rows.length} ${t('笔')}`;
    let columns;
    if (meta.detail.mode === 'transfer') {
      columns = meta.detail.itemDisplay.map((f, i) => ({ field: f, label: labelFor(ctx, f), width: i === 0 ? 130 : 150, optionSet: optionSetFor(f) }));
      const enriched = rows.map(d => {
        const u = (ctx.options.user || []).find(x => x.value === d[meta.detail.itemKey]);
        return {
          ...d,
          USER_ID: u ? u.code : '',
          USER_NAME: u ? u.name : '',
          ORGAN_KEY: u ? u.organ : '',
          E_MAIL: u ? u.mail : ''
        };
      });
      new DataGrid(body.querySelector('#md-detail-grid'), { rows: enriched, rowKey: 'MAP_KEY', pageSize: 10, columns, showFilter: false });
    } else {
      columns = meta.detail.fields.map(f => ({ field: f.name, label: f.label, width: f.width || 140, type: f.type === 'number' ? 'number' : undefined }));
      new DataGrid(body.querySelector('#md-detail-grid'), { rows, rowKey: meta.detail.key, pageSize: 10, columns, showFilter: false });
    }
  };

  const updateEnabled = () => {
    const body = container.querySelector('#md-body');
    if (!body || !selectedRow) {
      ['copy', 'edit', 'hide'].forEach(a => { const b = container.querySelector(`[data-action="${a}"]`); if (b) b.disabled = true; });
      return;
    }
    ['copy', 'edit', 'hide'].forEach(a => { const b = container.querySelector(`[data-action="${a}"]`); if (b) b.disabled = false; });
    const showBtn = container.querySelector('[data-action="show"]');
    if (showBtn) showBtn.disabled = selectedRow.ACTIVE !== 'N';
  };

  const handleAction = async (action) => {
    if (['copy', 'edit', 'hide', 'show'].includes(action) && !selectedRow) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openEdit('add', null);
    else if (action === 'copy') openEdit('copy', selectedRow);
    else if (action === 'edit') openEdit('edit', selectedRow);
    else if (action === 'hide') {
      const ok = await confirmDialog({ title: t('隐藏'), message: `${t('确定要隐藏')} ${selectedRow[meta.masterId]} ？`, okText: t('隐藏'), danger: true });
      if (!ok) return;
      try {
        await ctx.api.post(`/api/masterdetail/${meta.code}/${encodeURIComponent(selectedRow[meta.masterKey])}/hide`);
        toast(t('操作成功')); selectedKey = null; await ctx.refreshOptions(); load(true);
      } catch (err) { toast(err.message, 'error'); }
    } else if (action === 'show') {
      if (!showHidden) { toast(t('请勾选显示已隐藏资料'), 'warning'); return; }
      try {
        await ctx.api.post(`/api/masterdetail/${meta.code}/${encodeURIComponent(selectedRow[meta.masterKey])}/show`);
        toast(t('操作成功')); await ctx.refreshOptions(); load(true);
      } catch (err) { toast(err.message, 'error'); }
    } else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
  };

  const openEdit = (mode, row) => {
    const isEdit = mode === 'edit';
    const draft = mode === 'add' ? {} : { ...row };
    if (mode === 'copy') draft[meta.masterId] = '';
    const sourceDetails = mode === 'add' ? [] : detailRows();
    let localDetails = sourceDetails.map(d => ({ ...d }));
    let transferSelected = meta.detail.mode === 'transfer' ? sourceDetails.map(d => d[meta.detail.itemKey]) : [];
    let activeTab = 'main';
    let editingDetailKey = null;
    const fields = meta.fields.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit }));
    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = t('储存');
    footer.append(cancel, save);
    const modal = openModal({
      title: `${meta.title} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`,
      width: 980, body, footer
    });

    const readCurrent = () => {
      if (activeTab === 'main') {
        Object.assign(draft, readForm(body, fields));
      }
    };

    const drawDetail = (containerEl) => {
      if (meta.detail.mode === 'transfer') {
        const users = (ctx.options.user || []).map(u => ({
          USER_KEY: u.value, USER_ID: u.code, USER_NAME: u.name, ORGAN_KEY: u.organ, E_MAIL: u.mail
        }));
        containerEl.innerHTML = `
          <div class="transfer" id="md-transfer">
            <div class="transfer-panel">
              <div class="transfer-head"><span>${esc(t('未选择'))}</span><span class="badge badge-gray" id="md-left-count"></span></div>
              <div class="transfer-search"><div class="col-filter">${icon('search', 12)}<input id="md-left-search" placeholder="${esc(t('搜索'))}"/></div></div>
              <div class="transfer-list" id="md-left-list"></div>
            </div>
            <div class="transfer-actions">
              <button type="button" class="btn btn-primary btn-sm" id="md-move-right">${icon('arrowRight', 15)}</button>
              <button type="button" class="btn btn-ghost btn-sm" id="md-move-left">${icon('arrowLeft', 15)}</button>
            </div>
            <div class="transfer-panel">
              <div class="transfer-head"><span>${esc(t('已选择'))}</span><span class="badge badge-blue" id="md-right-count"></span></div>
              <div class="transfer-search"><div class="col-filter">${icon('search', 12)}<input id="md-right-search" placeholder="${esc(t('搜索'))}"/></div></div>
              <div class="transfer-list" id="md-right-list"></div>
            </div>
          </div>`;
        const left = containerEl.querySelector('#md-left-list');
        const right = containerEl.querySelector('#md-right-list');
        const itemRow = (u, selected) => `<label class="transfer-item"><input type="checkbox" data-side="${selected ? 'right' : 'left'}" value="${esc(u.USER_KEY)}"/><span><span class="ti-primary">${esc(u.USER_ID)} ${esc(u.USER_NAME)}</span><br/><span class="ti-sub">${esc(u.ORGAN_KEY || '')} · ${esc(u.E_MAIL || '')}</span></span></label>`;
        const renderLists = (lf = '', rf = '') => {
          const leftRows = users.filter(u => !transferSelected.includes(u.USER_KEY)).filter(u => !lf || (u.USER_ID + u.USER_NAME).toLowerCase().includes(lf.toLowerCase()));
          const rightRows = users.filter(u => transferSelected.includes(u.USER_KEY)).filter(u => !rf || (u.USER_ID + u.USER_NAME).toLowerCase().includes(rf.toLowerCase()));
          left.innerHTML = leftRows.length ? leftRows.map(u => itemRow(u, false)).join('') : `<div class="transfer-empty">${esc(t('无资料'))}</div>`;
          right.innerHTML = rightRows.length ? rightRows.map(u => itemRow(u, true)).join('') : `<div class="transfer-empty">${esc(t('无资料'))}</div>`;
          containerEl.querySelector('#md-left-count').textContent = leftRows.length;
          containerEl.querySelector('#md-right-count').textContent = rightRows.length;
        };
        renderLists();
        const move = (rightward) => {
          const checked = [...containerEl.querySelectorAll(`input[data-side="${rightward ? 'left' : 'right'}"]:checked`)].map(i => i.value);
          if (!checked.length) return;
          if (rightward) transferSelected = [...new Set([...transferSelected, ...checked])];
          else transferSelected = transferSelected.filter(k => !checked.includes(k));
          renderLists(containerEl.querySelector('#md-left-search').value, containerEl.querySelector('#md-right-search').value);
        };
        containerEl.querySelector('#md-move-right').addEventListener('click', () => move(true));
        containerEl.querySelector('#md-move-left').addEventListener('click', () => move(false));
        containerEl.querySelector('#md-left-search').addEventListener('input', (e) => renderLists(e.target.value, containerEl.querySelector('#md-right-search').value));
        containerEl.querySelector('#md-right-search').addEventListener('input', (e) => renderLists(containerEl.querySelector('#md-left-search').value, e.target.value));
      } else {
        const detailFields = meta.detail.fields;
        containerEl.innerHTML = `
          <div class="form-section">
            <div class="form-section-head">${icon('edit', 13)} ${esc(t('层级资料'))}</div>
            <div class="form-section-body">
              <div id="md-detail-form">${formGrid(detailFields, {}, ctx.options, { columns: 2 })}</div>
              <div class="row-gap mt-8" style="justify-content:flex-end">
                <button class="btn btn-sm btn-ghost" id="detail-clear">${esc(t('清除'))}</button>
                <button class="btn btn-sm btn-primary" id="detail-confirm">${esc(t('确认'))}</button>
                <button class="btn btn-sm btn-danger" id="detail-delete">${esc(t('删除'))}</button>
              </div>
            </div>
          </div>
          <div id="md-local-details"></div>`;
        const formEl = containerEl.querySelector('#md-detail-form');
        const detailGrid = new DataGrid(containerEl.querySelector('#md-local-details'), {
          rows: localDetails.slice().sort((a, b) => Number(a.EVENT_LEVEL_ID) - Number(b.EVENT_LEVEL_ID)),
          rowKey: meta.detail.key, selectable: 'single', pageSize: 10, showFilter: false,
          columns: detailFields.map(f => ({ field: f.name, label: f.label, width: f.width || 140, type: f.type === 'number' ? 'number' : undefined })),
          onRowClick: (row) => {
            editingDetailKey = row[meta.detail.key];
            detailFields.forEach(f => {
              const input = formEl.querySelector(`[name="${f.name}"]`);
              if (input) input.value = row[f.name] == null ? '' : row[f.name];
            });
          }
        });
        const clearForm = () => {
          editingDetailKey = null;
          detailFields.forEach(f => {
            const input = formEl.querySelector(`[name="${f.name}"]`);
            if (input) input.value = '';
          });
        };
        containerEl.querySelector('#detail-clear').addEventListener('click', clearForm);
        containerEl.querySelector('#detail-delete').addEventListener('click', () => {
          if (!editingDetailKey) { toast(t('请选择一笔资料'), 'warning'); return; }
          localDetails = localDetails.filter(d => d[meta.detail.key] !== editingDetailKey);
          detailGrid.setRows(localDetails);
          clearForm();
        });
        containerEl.querySelector('#detail-confirm').addEventListener('click', () => {
          const values = readForm(formEl, detailFields);
          const lv = Number(values.EVENT_LEVEL_ID);
          if (!values.EVENT_LEVEL_ID || !Number.isFinite(lv) || lv < 1) {
            toast('事件层级代码必须为大于 0 的数字', 'warning');
            return;
          }
          if (localDetails.some(d => Number(d.EVENT_LEVEL_ID) === lv && d[meta.detail.key] !== editingDetailKey)) {
            toast('事件层级代码不可重复', 'warning');
            return;
          }
          const rowData = { ...values, [meta.detail.key]: editingDetailKey || 'tmp_' + Date.now() };
          if (editingDetailKey) {
            const idx = localDetails.findIndex(d => d[meta.detail.key] === editingDetailKey);
            if (idx >= 0) localDetails[idx] = { ...localDetails[idx], ...rowData };
          } else {
            localDetails.push(rowData);
          }
          localDetails.sort((a, b) => Number(a.EVENT_LEVEL_ID) - Number(b.EVENT_LEVEL_ID));
          detailGrid.setRows(localDetails);
          clearForm();
        });
      }
    };

    const renderDialog = () => {
      body.innerHTML = `
        <div class="tabs" id="md-dialog-tabs" style="margin:-18px -18px 16px;padding:0 8px">
          <button class="tab ${activeTab === 'main' ? 'active' : ''}" data-mtab="main">${esc(t('主要资讯'))}</button>
          <button class="tab ${activeTab === 'detail' ? 'active' : ''}" data-mtab="detail">${esc(t('列表信息'))}</button>
        </div>
        <div id="md-tab-content"></div>`;
      const content = body.querySelector('#md-tab-content');
      if (activeTab === 'main') {
        content.innerHTML = formGrid(fields, draft, ctx.options, { columns: 2 });
        bindDependentSelects(content, fields, ctx.options);
      } else {
        drawDetail(content);
      }
      body.querySelectorAll('[data-mtab]').forEach(btn => {
        btn.addEventListener('click', () => {
          readCurrent();
          activeTab = btn.dataset.mtab;
          renderDialog();
        });
      });
    };
    renderDialog();
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      readCurrent();
      const missing = fields.filter(f => f.required && !f.disabled && (draft[f.name] === '' || draft[f.name] == null));
      if (missing.length) {
        toast(t('请填写必填栏位') + '：' + missing.map(f => t(f.label)).join('、'), 'warning');
        activeTab = 'main'; renderDialog();
        return;
      }
      const payload = { ...draft };
      if (isEdit) payload[meta.masterKey] = row[meta.masterKey];
      if (meta.detail.mode === 'transfer') payload.detailKeys = transferSelected;
      else payload.details = localDetails.map(d => ({ ...d, [meta.detail.key]: d[meta.detail.key] && String(d[meta.detail.key]).startsWith('tmp_') ? undefined : d[meta.detail.key] }));
      save.disabled = true;
      try {
        await ctx.api.post(`/api/masterdetail/${meta.code}`, payload);
        toast(t('储存成功'));
        modal.close();
        selectedKey = payload[meta.masterKey] || selectedKey;
        await ctx.refreshOptions();
        load(true);
      } catch (err) {
        toast(err.message, 'error', 5000);
        save.disabled = false;
      }
    });
  };

  await load();
}
