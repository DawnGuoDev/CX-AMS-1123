'use strict';

import {
  esc, icon, DataGrid, openModal, toast, showLoading, hideLoading,
  statusChip, actionLabel, tabsHtml, bindTabs, formGrid, readForm
} from '../ui.js';
import { t } from '../i18n.js';

const STEPS = ['批次状态变更资讯', '显示资讯', '条件设定', '资料表关联'];

export async function render(container, ctx) {
  let rows = [];
  let history = [];
  let tab = 'data';
  let selectedKey = null;
  let grid = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="batch-body"></div>
  </div>`;
  bindTabs(container.querySelector('.card'), (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/batch-defs');
      rows = res.rows;
      history = res.history || [];
      if (selectedKey && !rows.some(r => r.BATCH_KEY === selectedKey)) selectedKey = null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const body = container.querySelector('#batch-body');
    if (tab === 'history') {
      body.innerHTML = '<div id="batch-history"></div>';
      new DataGrid(body.querySelector('#batch-history'), {
        rows: history, rowKey: 'HIST_KEY', showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 85 },
          { field: 'ACTION', label: '交易类别', width: 100, render: r => esc(actionLabel(r.ACTION)) },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 155 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'RECORD_LABEL', label: '资料', width: 150 }
        ]
      });
      return;
    }
    body.innerHTML = `
      <div class="toolbar">
        <button class="tool-btn tool-add" data-action="add">${icon('plus', 15)}<span>${esc(t('新增'))}</span></button>
        <button class="tool-btn" data-action="copy">${icon('copy', 15)}<span>${esc(t('复制'))}</span></button>
        <button class="tool-btn" data-action="edit">${icon('edit', 15)}<span>${esc(t('修改'))}</span></button>
        <button class="tool-btn" data-action="refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="inline-note">${icon('info', 13)} 以四步向导定义批次状态变更作业</span></div>
      </div>
      <div id="batch-grid"></div>
    `;
    grid = new DataGrid(body.querySelector('#batch-grid'), {
      rows, rowKey: 'BATCH_KEY', selectable: 'single', pageSize: 20,
      columns: [
        { field: 'BATCH_ID', label: '批次状态变更代码', width: 200 },
        { field: 'BATCH_NAME', label: '批次状态变更名称', width: 240 },
        { field: 'BATCH_DESC', label: '说明', width: 340 },
        { field: 'MASTER_TABLE_NAME', label: '主资料表', width: 180 },
        { field: 'ACTIVE_COLUMN_NAME', label: '状态栏位', width: 130 },
        { field: 'ACTIVE', label: '状态', width: 90, render: r => statusChip(r.ACTIVE === 'Y' ? 'Y' : 'N') },
        { field: 'MTR_DATE', label: '修改时间', type: 'datetime', width: 155 }
      ],
      onRowClick: (row) => { selectedKey = row.BATCH_KEY; updateEnabled(); }
    });
    if (selectedKey) { grid.selected.add(selectedKey); grid.render(); }
    updateEnabled();
    body.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action)));
  };

  const updateEnabled = () => {
    const row = rows.find(r => r.BATCH_KEY === selectedKey);
    ['copy', 'edit'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
  };

  const handleAction = (action) => {
    const row = rows.find(r => r.BATCH_KEY === selectedKey);
    if (['copy', 'edit'].includes(action) && !row) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openWizard('add', null);
    else if (action === 'copy') openWizard('copy', row);
    else if (action === 'edit') openWizard('edit', row);
    else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
  };

  const openWizard = (mode, row) => {
    const isEdit = mode === 'edit';
    const draft = mode === 'add' ? {
      BATCH_ID: '', BATCH_NAME: '', BATCH_DESC: '', MASTER_TABLE_NAME: 'alarm_settings',
      MASTER_LOG_TABLE_NAME: 'history', MASTER_PK: 'ALARM_INFO_KEY', SERIAL_KEY_COLUMN_NAME: 'ALARM_INFO_KEY',
      ACTIVE_COLUMN_NAME: 'ACTIVE', DATA_SOURCE_SQL: 'SELECT * FROM SALM_ALARM_SETTING WHERE 1=1',
      DATA_SOURCE_CONST_SQL: ''
    } : { ...row };
    if (mode === 'copy') { draft.BATCH_ID = ''; delete draft.BATCH_KEY; }
    let display = parseJson(draft.DISPLAY_COLUMNS_JSON, []);
    let conditions = parseJson(draft.CONDITIONS_JSON, []);
    let relations = parseJson(draft.RELATIONS_JSON, []);
    let step = 0;
    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const modal = openModal({
      title: `${t('批次状态变更设定')} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`,
      width: 1080, body, footer
    });

    const stepBar = () => `<div class="wizard-steps" style="display:flex;border:0;padding:0;margin-bottom:18px;gap:6px;overflow:auto">
      ${STEPS.map((s, i) => `<div class="wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}" data-step="${i}" style="flex:1;min-width:150px">
        <span class="ws-num">${i < step ? '✓' : i + 1}</span><span>${esc(t(s))}</span>
      </div>`).join('')}
    </div>`;

    const field1 = [
      { name: 'BATCH_ID', label: '批次状态变更代码', type: 'text', required: true, readOnlyOnEdit: isEdit },
      { name: 'BATCH_NAME', label: '批次状态变更名称', type: 'text', required: true },
      { name: 'BATCH_DESC', label: '批次状态变更说明', type: 'text', full: true },
      { name: 'MASTER_TABLE_NAME', label: '主资料表名称', type: 'text', required: true },
      { name: 'MASTER_LOG_TABLE_NAME', label: '履历资料表名称', type: 'text', required: true },
      { name: 'MASTER_PK', label: '主资料表主键', type: 'text', required: true },
      { name: 'SERIAL_KEY_COLUMN_NAME', label: '主资料版本栏位', type: 'text', required: true },
      { name: 'ACTIVE_COLUMN_NAME', label: '主资料状态栏位', type: 'text', required: true },
      { name: 'DATA_SOURCE_SQL', label: '资料来源语法', type: 'textarea', required: true },
      { name: 'DATA_SOURCE_CONST_SQL', label: '资料来源排序语法', type: 'text' }
    ];

    const renderDisplay = (host) => {
      host.innerHTML = `<div class="form-section"><div class="form-section-head"><span>${esc(t('显示资讯'))}</span>
        <button class="btn btn-sm btn-subtle" id="add-display">${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr><th>${esc(t('栏位'))}</th><th>${esc(t('显示顺序'))}</th><th>${esc(t('栏位宽度'))}</th><th>${esc(t('隐藏'))}</th><th></th></tr></thead>
          <tbody>${display.map((d, i) => `<tr data-i="${i}">
            <td><input class="input" data-d="field" value="${esc(d.field || d)}"/></td>
            <td><input class="input" type="number" data-d="seq" value="${esc(d.seq || i + 1)}" style="width:70px"/></td>
            <td><input class="input" type="number" data-d="width" value="${esc(d.width || 140)}" style="width:80px"/></td>
            <td style="text-align:center"><input type="checkbox" data-d="hidden" ${d.hidden ? 'checked' : ''}/></td>
            <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div></div>`;
      host.querySelectorAll('[data-d]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        if (typeof display[i] === 'string') display[i] = { field: display[i], seq: i + 1, width: 140, hidden: false };
        const k = inp.dataset.d;
        display[i][k] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
      }));
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { display.splice(Number(btn.dataset.del), 1); renderDisplay(host); }));
      host.querySelector('#add-display').addEventListener('click', () => { display.push({ field: '', seq: display.length + 1, width: 140, hidden: false }); renderDisplay(host); });
    };

    const renderConditions = (host) => {
      host.innerHTML = `<div class="form-section"><div class="form-section-head"><span>${esc(t('条件设定'))}</span>
        <button class="btn btn-sm btn-subtle" id="add-cond">${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr><th>${esc(t('域名'))}</th><th>${esc(t('栏位显示代码'))}</th><th>${esc(t('输入类型'))}</th><th>${esc(t('运算子'))}</th><th>${esc(t('必填'))}</th><th></th></tr></thead>
          <tbody>${conditions.map((c, i) => `<tr data-i="${i}">
            <td><input class="input" data-c="field" value="${esc(c.field || '')}"/></td>
            <td><input class="input" data-c="label" value="${esc(c.label || '')}"/></td>
            <td><select class="input" data-c="inputType">${(ctx.options.inputType || []).map(o => `<option value="${esc(o.value)}" ${c.inputType === o.value ? 'selected' : ''}>${esc(o.value)}</option>`).join('')}</select></td>
            <td><select class="input" data-c="operator">${(ctx.options.operator || []).map(o => `<option value="${esc(o.value)}" ${c.operator === o.value ? 'selected' : ''}>${esc(o.value)}</option>`).join('')}</select></td>
            <td style="text-align:center"><input type="checkbox" data-c="required" ${c.required ? 'checked' : ''}/></td>
            <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div></div>`;
      host.querySelectorAll('[data-c]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        const k = inp.dataset.c;
        conditions[i][k] = inp.type === 'checkbox' ? inp.checked : inp.value;
      }));
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { conditions.splice(Number(btn.dataset.del), 1); renderConditions(host); }));
      host.querySelector('#add-cond').addEventListener('click', () => { conditions.push({ field: '', label: '', inputType: 'TextBox', operator: '=', required: false }); renderConditions(host); });
    };

    const renderRelations = (host) => {
      if (!relations.length) relations.push({ table: draft.MASTER_TABLE_NAME, log: draft.MASTER_LOG_TABLE_NAME, pk: draft.MASTER_PK, active: draft.ACTIVE_COLUMN_NAME, children: [] });
      const root = relations[0];
      host.innerHTML = `<div class="form-section"><div class="form-section-head">${icon('tree', 13)} ${esc(t('资料表关联'))}</div>
        <div class="form-section-body">
          <div class="form-grid cols-2">
            <div class="form-field"><div class="form-label">${esc(t('资料表名称'))}</div><div class="form-control"><input class="input" id="rel-table" value="${esc(root.table || '')}"/></div></div>
            <div class="form-field"><div class="form-label">${esc(t('履历表名称'))}</div><div class="form-control"><input class="input" id="rel-log" value="${esc(root.log || '')}"/></div></div>
            <div class="form-field"><div class="form-label">${esc(t('版本栏位'))}</div><div class="form-control"><input class="input" id="rel-pk" value="${esc(root.pk || '')}"/></div></div>
            <div class="form-field"><div class="form-label">${esc(t('状态栏位'))}</div><div class="form-control"><input class="input" id="rel-active" value="${esc(root.active || '')}"/></div></div>
          </div>
        </div>
      </div>
      <div class="form-section"><div class="form-section-head">${esc(t('栏位关联'))}
        <button class="btn btn-sm btn-subtle" id="add-rel-col">${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr><th>${esc(t('主表'))}</th><th>${esc(t('关联表'))}</th><th></th></tr></thead>
          <tbody>${(root.columns || []).map((c, i) => `<tr data-i="${i}">
            <td><input class="input" data-rel="from" value="${esc(c.from || '')}"/></td>
            <td><input class="input" data-rel="to" value="${esc(c.to || '')}"/></td>
            <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </div>`;
      host.querySelectorAll('[data-rel]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        if (!root.columns) root.columns = [];
        root.columns[i] = root.columns[i] || {};
        root.columns[i][inp.dataset.rel] = inp.value;
      }));
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
        if (!root.columns) root.columns = [];
        root.columns.splice(Number(btn.dataset.del), 1);
        renderRelations(host);
      }));
      host.querySelector('#add-rel-col').addEventListener('click', () => {
        if (!root.columns) root.columns = [];
        root.columns.push({ from: '', to: '' });
        renderRelations(host);
      });
      ['#rel-table', '#rel-log', '#rel-pk', '#rel-active'].forEach((sel, idx) => {
        host.querySelector(sel).addEventListener('input', (e) => {
          root[['table', 'log', 'pk', 'active'][idx]] = e.target.value;
        });
      });
    };

    const collect = () => {
      const content = body.querySelector('#batch-content');
      if (step === 0) Object.assign(draft, readForm(content, field1));
    };

    const renderStep = () => {
      body.innerHTML = `<div style="padding:18px">${stepBar()}<div id="batch-content"></div></div>`;
      const content = body.querySelector('#batch-content');
      if (step === 0) content.innerHTML = formGrid(field1.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit })), draft, ctx.options, { columns: 2 });
      if (step === 1) renderDisplay(content);
      if (step === 2) renderConditions(content);
      if (step === 3) renderRelations(content);
      body.querySelectorAll('[data-step]').forEach(el => el.addEventListener('click', () => {
        collect();
        step = Number(el.dataset.step);
        renderStep();
      }));
      footer.innerHTML = '';
      const left = document.createElement('div'); left.className = 'row-gap';
      const back = document.createElement('button');
      back.className = 'btn btn-ghost'; back.textContent = t('上一步'); back.disabled = step === 0;
      back.addEventListener('click', () => { collect(); step -= 1; renderStep(); });
      left.append(back);
      const right = document.createElement('div'); right.className = 'row-gap';
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
      cancel.addEventListener('click', modal.close);
      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = step === STEPS.length - 1 ? t('储存') : t('下一步');
      next.addEventListener('click', async () => {
        collect();
        if (step === 0 && (!draft.BATCH_ID || !draft.BATCH_NAME)) { toast(t('请填写必填栏位') + '：批次状态变更代码 / 名称', 'warning'); return; }
        if (step < STEPS.length - 1) { step += 1; renderStep(); return; }
        next.disabled = true;
        const payload = {
          ...draft,
          DISPLAY_COLUMNS_JSON: JSON.stringify(display),
          CONDITIONS_JSON: JSON.stringify(conditions),
          RELATIONS_JSON: JSON.stringify(relations)
        };
        if (isEdit) payload.BATCH_KEY = row.BATCH_KEY;
        try {
          await ctx.api.post('/api/batch-defs', payload);
          toast(t('储存成功')); modal.close(); selectedKey = payload.BATCH_KEY || null; load(true);
        } catch (err) { toast(err.message, 'error'); next.disabled = false; }
      });
      right.append(cancel, next);
      footer.append(left, right);
      footer.style.justifyContent = 'space-between';
    };
    renderStep();
  };

  await load();
}

function parseJson(v, fallback) {
  try { return JSON.parse(v || '[]'); } catch (e) { return fallback; }
}
