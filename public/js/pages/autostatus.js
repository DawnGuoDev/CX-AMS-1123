'use strict';

import {
  esc, icon, DataGrid, toolbar, bindToolbar, toast, openModal, confirmDialog,
  formGrid, readForm, showLoading, hideLoading, statusChip, emptyState
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';

export async function render(container, ctx) {
  let rows = [];
  let logs = [];
  let selectedKey = null;
  let grid = null;

  const fields = [
    { name: 'AUTO_ID', label: '规则代码', type: 'text', required: true, readOnlyOnEdit: true, width: 150 },
    { name: 'AUTO_NAME', label: '规则名称', type: 'text', required: true, width: 190 },
    { name: 'SUB_SYS_KEY', label: '子系统', type: 'select', optionSet: 'subsystem', required: true, width: 150 },
    { name: 'EQP_KEY', label: '机台', type: 'select', optionSet: 'eqpWithAny', required: true, width: 160 },
    { name: 'CHAMBER', label: 'Chamber', type: 'select', optionSet: 'chamber', width: 160 },
    { name: 'ALARM_INFO_KEY', label: '警报代码', type: 'select', optionSet: 'alarmSetting', required: true, width: 180 },
    { name: 'INITIAL_STATUS', label: '初始机况', type: 'select', optionSet: 'eqpStatus', required: true, width: 120 },
    { name: 'TARGET_STATUS', label: '目标机况', type: 'select', optionSet: 'eqpStatus', required: true, width: 120 },
    { name: 'TARGET_STATUS2', label: '目标机况2', type: 'select', optionSet: 'eqpStatus', width: 120 },
    { name: 'RELATED_CHAMBER', label: 'Related Chamber', type: 'checkbox', width: 120 }
  ];

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/auto-status');
      rows = res.rows.filter(r => r.ACTIVE !== 'N');
      logs = res.logs || [];
      if (selectedKey && !rows.some(r => r.AUTO_KEY === selectedKey)) selectedKey = null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    container.innerHTML = `
      <div class="hint-bar mb-16">${icon('info', 15)}<div>系统每 5 分钟扫描一次与规则匹配的警报，符合条件时自动切换机台（可联动 Chamber）机况。可单笔新增、批量汇入或立即扫描验证。目标机况2为可选的两段式切换。</div></div>
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn tool-add" data-action="add">${icon('plus', 15)}<span>${esc(t('新增'))}</span></button>
          <button class="tool-btn" data-action="copy">${icon('copy', 15)}<span>${esc(t('复制'))}</span></button>
          <button class="tool-btn" data-action="edit">${icon('edit', 15)}<span>${esc(t('修改'))}</span></button>
          <button class="tool-btn" data-action="hide">${icon('hide', 15)}<span>${esc(t('删除'))}</span></button>
          <button class="tool-btn" data-action="refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
          <span class="tool-sep"></span>
          <button class="tool-btn" data-action="export">${icon('export', 15)}<span>${esc(t('汇出'))}</span></button>
          <button class="tool-btn" data-action="template">${icon('template', 15)}<span>${esc(t('汇出范本'))}</span></button>
          <button class="tool-btn" data-action="import">${icon('import', 15)}<span>${esc(t('批量汇入'))}</span></button>
          <div class="toolbar-right">
            <button class="btn btn-sm btn-subtle" id="auto-scan">${icon('play', 13)} ${esc(t('立即扫描'))}</button>
          </div>
        </div>
        <div id="auto-grid"></div>
      </div>
      <div class="card mt-16">
        <div class="card-head"><h3>${icon('clock', 15)} ${esc(t('扫描纪录'))}</h3><span class="small muted">${logs.length} ${esc(t('笔'))}</span></div>
        <div id="auto-logs"></div>
      </div>
      <input type="file" id="auto-file" accept=".csv" hidden/>
    `;
    grid = new DataGrid(container.querySelector('#auto-grid'), {
      rows, rowKey: 'AUTO_KEY', selectable: 'single', pageSize: 15,
      columns: [
        { field: 'AUTO_ID', label: '规则代码', width: 140 },
        { field: 'AUTO_NAME', label: '规则名称', width: 190 },
        { field: 'SUB_SYS_KEY', label: '子系统', width: 160, optionSet: 'subsystem' },
        { field: 'EQP_KEY', label: '机台', width: 160, optionSet: 'eqpWithAny' },
        { field: 'CHAMBER', label: 'Chamber', width: 160, optionSet: 'chamber' },
        { field: 'ALARM_INFO_KEY', label: '警报代码', width: 200, optionSet: 'alarmSetting' },
        { field: 'INITIAL_STATUS', label: '初始机况', width: 105, optionSet: 'eqpStatus' },
        { field: 'TARGET_STATUS', label: '目标机况', width: 105, optionSet: 'eqpStatus' },
        { field: 'TARGET_STATUS2', label: '目标机况2', width: 110, optionSet: 'eqpStatus' },
        { field: 'RELATED_CHAMBER', label: '联动 Chamber', width: 105, type: 'yn' },
        { field: 'MTR_DATE', label: '修改时间', type: 'datetime', width: 150 }
      ],
      onRowClick: (row) => { selectedKey = row.AUTO_KEY; updateEnabled(); }
    });
    if (selectedKey) { grid.selected.add(selectedKey); grid.render(); }
    updateEnabled();

    const logRows = logs.map(l => {
      const rule = rows.find(r => r.AUTO_KEY === l.AUTO_KEY);
      return { ...l, AUTO_ID: rule ? rule.AUTO_ID : (l.AUTO_KEY || '') };
    });
    new DataGrid(container.querySelector('#auto-logs'), {
      rows: logRows, rowKey: 'ALOG_KEY', pageSize: 10, showFilter: false,
      columns: [
        { field: 'TRX_DT', label: '执行时间', type: 'datetime', width: 155 },
        { field: 'AUTO_ID', label: '规则代码', width: 130 },
        { field: 'EQP_ID', label: '机台', width: 100 },
        { field: 'ALARM_ID', label: '警报识别码', width: 155 },
        { field: 'FROM_STATUS', label: '原机况', width: 100, optionSet: 'eqpStatus' },
        { field: 'TO_STATUS', label: '目标机况', width: 100, optionSet: 'eqpStatus' },
        { field: 'RESULT', label: '结果', width: 90, render: r => statusChip(r.RESULT === 'Success' ? 'Success' : 'Fail') },
        { field: 'MESSAGE', label: '讯息', width: 260 }
      ]
    });

    bindToolbar(container, handleAction);
    container.querySelector('#auto-scan').addEventListener('click', doScan);
    container.querySelector('#auto-file').addEventListener('change', importFile);
    container.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
    }));
  };

  const updateEnabled = () => {
    ['copy', 'edit', 'hide'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !selectedKey;
    });
  };

  const selectedRow = () => rows.find(r => r.AUTO_KEY === selectedKey);

  const handleAction = (action) => {
    if (['copy', 'edit', 'hide'].includes(action) && !selectedKey) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openEdit('add', null);
    else if (action === 'copy') openEdit('copy', selectedRow());
    else if (action === 'edit') openEdit('edit', selectedRow());
    else if (action === 'hide') {
      confirmDialog({ title: t('删除'), message: `确定要删除规则「${selectedRow().AUTO_ID}」？`, okText: t('删除'), danger: true }).then(async (ok) => {
        if (!ok) return;
        try {
          await ctx.api.post(`/api/auto-status/${selectedRow().AUTO_KEY}/delete`);
          toast(t('删除成功')); selectedKey = null; load(true);
        } catch (err) { toast(err.message, 'error'); }
      });
    } else if (action === 'refresh') { load(); toast(t('资料已更新'), 'info'); }
    else if (action === 'export') exportCsv(false);
    else if (action === 'template') exportCsv(true);
    else if (action === 'import') container.querySelector('#auto-file').click();
  };

  const openEdit = (mode, row) => {
    const isEdit = mode === 'edit';
    const values = mode === 'add' ? { INITIAL_STATUS: '', RELATED_CHAMBER: 'N' } : { ...row };
    if (mode === 'copy') values.AUTO_ID = '';
    const formFields = fields.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit }));
    const body = document.createElement('div');
    body.innerHTML = formGrid(formFields, values, ctx.options, { columns: 2 });
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const save = document.createElement('button');
    save.className = 'btn btn-primary'; save.textContent = t('储存');
    footer.append(cancel, save);
    const modal = openModal({ title: `${t('自动切机况')} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`, width: 760, body, footer });
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      const data = readForm(body, formFields);
      const missing = formFields.filter(f => f.required && !f.disabled && !data[f.name]);
      if (missing.length) { toast(t('请填写必填栏位') + '：' + missing.map(f => t(f.label)).join('、'), 'warning'); return; }
      save.disabled = true;
      try {
        await ctx.api.post('/api/auto-status', isEdit ? { ...data, AUTO_KEY: row.AUTO_KEY } : data);
        toast(t('储存成功')); modal.close(); selectedKey = isEdit ? row.AUTO_KEY : null; load(true);
      } catch (err) { toast(err.message, 'error'); save.disabled = false; }
    });
  };

  const doScan = async () => {
    showLoading(t('立即扫描'));
    try {
      const res = await ctx.api.post('/api/auto-status/scan');
      const body = document.createElement('div');
      body.innerHTML = res.logs.length ? `<div class="verify-table-wrap"><table class="verify-table">
        <thead><tr><th>${esc(t('执行时间'))}</th><th>${esc(t('机台'))}</th><th>${esc(t('原机况'))}</th><th>${esc(t('目标机况'))}</th><th>${esc(t('讯息'))}</th></tr></thead>
        <tbody>${res.logs.map(l => `<tr><td class="mono">${esc(fmtDT(l.TRX_DT))}</td><td>${esc(l.EQP_ID)}</td><td>${esc(l.FROM_STATUS)}</td><td>${esc(l.TO_STATUS)}</td><td>${esc(l.MESSAGE)}</td></tr>`).join('')}</tbody>
      </table></div>` : `<div class="hint-bar">${icon('info', 14)}<div>${esc(t('暂无执行纪录'))}</div></div>`;
      openModal({ title: t('扫描纪录'), width: 720, body });
      await load(true);
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  };

  const exportCsv = (template) => {
    const header = ['AUTO_ID', 'AUTO_NAME', 'SUBSYSTEM', 'EQP', 'CHAMBER', 'ALARM_CODE', 'INITIAL_STATUS', 'TARGET_STATUS', 'TARGET_STATUS2', 'RELATED_CHAMBER'];
    const data = template ? [] : rows.map(r => {
      const ss = (ctx.options.subsystem.find(o => o.value === r.SUB_SYS_KEY) || {}).code || '';
      const eqp = (ctx.options.eqpWithAny.find(o => o.value === r.EQP_KEY) || {}).code || (r.EQP_KEY === '*' ? '*' : '');
      const alarm = (ctx.options.alarmSetting.find(o => o.value === r.ALARM_INFO_KEY) || {}).code || '';
      const init = (ctx.options.eqpStatus.find(o => o.value === r.INITIAL_STATUS) || {}).code || '';
      const target = (ctx.options.eqpStatus.find(o => o.value === r.TARGET_STATUS) || {}).code || '';
      const target2 = (ctx.options.eqpStatus.find(o => o.value === r.TARGET_STATUS2) || {}).code || '';
      return [r.AUTO_ID, r.AUTO_NAME, ss, eqp, r.CHAMBER || '', alarm, init, target, target2, r.RELATED_CHAMBER || 'N'];
    });
    const csv = '\ufeff' + [header, ...data].map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = template ? '自动切机况范本.csv' : '自动切机况.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('已汇出'));
  };

  const importFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = parseCsv(String(reader.result || '').replace(/^\ufeff/, ''));
      if (lines.length < 2) { toast('CSV 没有资料', 'warning'); return; }
      const header = lines[0].map(h => h.trim());
      const idx = (n) => header.indexOf(n);
      let success = 0;
      let failed = 0;
      showLoading(t('批量汇入'));
      for (const cols of lines.slice(1)) {
        const get = (n) => cols[idx(n)]?.trim() || '';
        const ss = ctx.options.subsystem.find(o => o.code === get('SUBSYSTEM') || o.label.startsWith(get('SUBSYSTEM') + ' '));
        const eqp = get('EQP') === '*' ? { value: '*' } : ctx.options.eqp.find(o => o.code === get('EQP'));
        const alarm = ctx.options.alarmSetting.find(o => o.code === get('ALARM_CODE'));
        const init = ctx.options.eqpStatus.find(o => o.code === get('INITIAL_STATUS'));
        const target = ctx.options.eqpStatus.find(o => o.code === get('TARGET_STATUS'));
        const target2 = ctx.options.eqpStatus.find(o => o.code === get('TARGET_STATUS2'));
        if (!ss || !eqp || !alarm || !init || !target) { failed += 1; continue; }
        try {
          await ctx.api.post('/api/auto-status', {
            AUTO_ID: get('AUTO_ID'), AUTO_NAME: get('AUTO_NAME'),
            SUB_SYS_KEY: ss.value, EQP_KEY: eqp.value, CHAMBER: get('CHAMBER'),
            ALARM_INFO_KEY: alarm.value, INITIAL_STATUS: init.value, TARGET_STATUS: target.value,
            TARGET_STATUS2: target2 ? target2.value : '', RELATED_CHAMBER: get('RELATED_CHAMBER') || 'N'
          });
          success += 1;
        } catch (err) { failed += 1; }
      }
      hideLoading();
      toast(`${t('汇入完成')}：${success} ${t('笔')}${failed ? `，${failed} ${t('笔错误')}` : ''}`);
      load(true);
    };
    reader.readAsText(file, 'utf-8');
  };

  await load();
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quote = false;
      else cur += ch;
    } else if (ch === '"') quote = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
