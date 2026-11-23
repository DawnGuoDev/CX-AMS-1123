'use strict';

import {
  esc, icon, DataGrid, openModal, toast, confirmDialog, showLoading, hideLoading,
  statusChip, actionLabel, tabsHtml, bindTabs, formGrid, readForm, emptyState
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';

const STEPS = ['警报触发信息', '警报讯息 SQL', '警报标题', '警报详细内容'];

export async function render(container, ctx) {
  let rows = [];
  let history = [];
  let tab = 'data';
  let selectedKey = null;
  let grid = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="cond-body"></div>
  </div>`;
  bindTabs(container.querySelector('.card'), (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/alarm-conditions');
      rows = res.rows;
      history = res.history || [];
      if (selectedKey && !rows.some(r => r.CONDITION_KEY === selectedKey)) selectedKey = null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const body = container.querySelector('#cond-body');
    if (tab === 'history') {
      body.innerHTML = `<div class="toolbar"><button class="tool-btn" id="cond-href">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="small muted">${history.length} ${esc(t('笔'))}</span></div></div><div id="cond-history"></div>`;
      new DataGrid(body.querySelector('#cond-history'), {
        rows: history, rowKey: 'HIST_KEY', showFilter: false,
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
      body.querySelector('#cond-href').addEventListener('click', () => load(true));
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
        <div class="toolbar-right"><span class="inline-note">${icon('info', 13)} Agent 定时依 SQL 扫库，符合条件即建立警报</span></div>
      </div>
      <div id="cond-grid"></div>
    `;
    grid = new DataGrid(body.querySelector('#cond-grid'), {
      rows, rowKey: 'CONDITION_KEY', selectable: 'single', pageSize: 20,
      columns: [
        { field: 'CONDITION_ID', label: '警报触发条件代码', width: 170 },
        { field: 'CONDITION_NAME', label: '警报触发条件名称', width: 190 },
        { field: 'ALARM_INFO_KEY', label: '警报代码', width: 220, optionSet: 'alarmSetting' },
        { field: 'LAST_CHECK_DT', label: '上次检查时间', type: 'datetime', width: 155 },
        { field: 'DELAY_TIME', label: '延迟时间(秒)', width: 105 },
        { field: 'DATE_CONDITION_FIELD', label: '时间条件字段', width: 140 },
        { field: 'ALARM_SUBJECT', label: '警报主旨样板', width: 260 },
        { field: 'ACTIVE', label: '状态', width: 90, render: r => statusChip(r.ACTIVE === 'Y' ? 'Y' : 'N') }
      ],
      onRowClick: (row) => { selectedKey = row.CONDITION_KEY; updateEnabled(); }
    });
    if (selectedKey) { grid.selected.add(selectedKey); grid.render(); }
    updateEnabled();
    body.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action)));
  };

  const updateEnabled = () => {
    const row = rows.find(r => r.CONDITION_KEY === selectedKey);
    ['copy', 'edit', 'hide'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
    const show = container.querySelector('[data-action="show"]');
    if (show) show.disabled = !row || row.ACTIVE !== 'N';
  };

  const handleAction = async (action) => {
    const row = rows.find(r => r.CONDITION_KEY === selectedKey);
    if (['copy', 'edit', 'hide', 'show'].includes(action) && !row) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openWizard('add', null);
    else if (action === 'copy') openWizard('copy', row);
    else if (action === 'edit') openWizard('edit', row);
    else if (action === 'hide') {
      const ok = await confirmDialog({ title: t('隐藏'), message: `确定要隐藏「${row.CONDITION_ID}」？`, okText: t('隐藏'), danger: true });
      if (!ok) return;
      try { await ctx.api.post(`/api/alarm-conditions/${row.CONDITION_KEY}/hide`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'show') {
      try { await ctx.api.post(`/api/alarm-conditions/${row.CONDITION_KEY}/show`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
  };

  const openWizard = (mode, row) => {
    const isEdit = mode === 'edit';
    const draft = mode === 'add' ? {
      CONDITION_ID: '', CONDITION_NAME: '', ALARM_INFO_KEY: '', LAST_CHECK_DT: new Date().toISOString(),
      DELAY_TIME: 5, ALARM_MSG_SQL: '', DATE_CONDITION_FIELD: '', DATE_TIME_TYPE: 'DateTime',
      ALARM_SUBJECT: '', ALARM_CONTENT: ''
    } : { ...row };
    if (mode === 'copy') {
      draft.CONDITION_ID = '';
      delete draft.CONDITION_KEY;
    }
    let step = 0;
    let parsedFields = parseSqlFields(draft.ALARM_MSG_SQL);
    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    footer.append(cancel);
    const modal = openModal({
      title: `${t('警报触发条件设定')} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`,
      width: 1040, body, footer
    });

    const progress = () => {
      const pct = ((step + 1) / STEPS.length) * 100;
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        ${STEPS.map((s, i) => `<div style="flex:1;display:flex;align-items:center;gap:6px;font-size:10.5px;color:${i <= step ? 'var(--brand-2)' : 'var(--muted)'};font-weight:${i === step ? '650' : '400'}">
          <span style="width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:9px;background:${i < step ? 'var(--green-bg)' : i === step ? 'var(--brand)' : '#eef2f7'};color:${i === step ? '#fff' : i < step ? 'var(--green)' : '#7b8a9d'}">${i < step ? '✓' : i + 1}</span>
          <span style="white-space:nowrap">${esc(t(s))}</span>
        </div>`).join('<span style="color:#d5dee8">›</span>')}
      </div>`;
    };

    const fieldOptions = () => parsedFields.map(f => `<option value="${esc(f.name)}" ${draft.DATE_CONDITION_FIELD === f.name ? 'selected' : ''}>${esc(f.name)}</option>`).join('');

    const renderStep = () => {
      let content = '';
      if (step === 0) {
        const f1 = [
          { name: 'CONDITION_ID', label: '警报触发条件代码', type: 'text', required: true, readOnlyOnEdit: isEdit },
          { name: 'CONDITION_NAME', label: '警报触发条件名称', type: 'text', required: true },
          { name: 'ALARM_INFO_KEY', label: '警报代码', type: 'select', optionSet: 'alarmSetting', required: true },
          { name: 'LAST_CHECK_DT', label: '上次检查时间', type: 'datetime', required: true },
          { name: 'DELAY_TIME', label: '延迟时间(秒)', type: 'number', required: true }
        ];
        const fields = f1.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit }));
        content = formGrid(fields, draft, ctx.options, { columns: 2 }) +
          `<div class="hint-bar mt-16">${icon('info', 14)}<div>延迟时间用于补足警报写入资料库的延迟，避免 Agent 在「上次检查时间」区间内漏接警报。预设 5 秒。</div></div>`;
        body.innerHTML = progress() + content;
        body.querySelectorAll('[name]').forEach(inp => {
          inp.addEventListener('input', () => {
            draft[inp.name] = inp.value;
          });
        });
      } else if (step === 1) {
        body.innerHTML = `${progress()}
          <div class="form-field" style="grid-template-columns:1fr;margin-bottom:12px">
            <div class="form-control"><textarea class="input sql-box" id="wiz-sql" placeholder="SELECT ...">${esc(draft.ALARM_MSG_SQL || '')}</textarea></div>
          </div>
          <div class="row-gap mb-16">
            <button class="btn btn-sm btn-subtle" id="wiz-test">${icon('play', 13)} ${esc(t('测试 SQL'))}</button>
            <span class="small muted">Agent 会以此 SQL 主动扫库，符合条件时建立警报。</span>
          </div>
          <div class="form-grid cols-2">
            <div class="form-field"><div class="form-label">${esc(t('时间条件字段'))}</div><div class="form-control">
              <select class="input" id="wiz-datefield"><option value="">${esc(t('请选择'))}</option>${fieldOptions()}</select>
            </div></div>
            <div class="form-field"><div class="form-label">${esc(t('时间条件型态'))}</div><div class="form-control">
              <div class="radio-group" style="height:34px;align-items:center">
                ${['DateTime', 'Date', 'String'].map(v => `<label><input type="radio" name="wiz-timetype" value="${v}" ${draft.DATE_TIME_TYPE === v ? 'checked' : ''}/> ${v}</label>`).join('')}
              </div>
            </div></div>
          </div>
          <div id="wiz-test-result"></div>`;
        body.querySelector('#wiz-sql').addEventListener('input', (e) => {
          draft.ALARM_MSG_SQL = e.target.value;
          parsedFields = parseSqlFields(e.target.value);
          const sel = body.querySelector('#wiz-datefield');
          const cur = sel.value || draft.DATE_CONDITION_FIELD;
          sel.innerHTML = `<option value="">${esc(t('请选择'))}</option>` + fieldOptions();
          if (parsedFields.some(f => f.name === cur)) sel.value = cur;
        });
        body.querySelector('#wiz-datefield').addEventListener('change', (e) => { draft.DATE_CONDITION_FIELD = e.target.value; });
        body.querySelectorAll('input[name="wiz-timetype"]').forEach(r => r.addEventListener('change', () => { draft.DATE_TIME_TYPE = r.value; }));
        body.querySelector('#wiz-test').addEventListener('click', async () => {
          try {
            const res = await ctx.api.post('/api/sql/test', { sql: draft.ALARM_MSG_SQL });
            parsedFields = res.fields;
            draft.DATE_CONDITION_FIELD = draft.DATE_CONDITION_FIELD || parsedFields[0]?.name || '';
            const result = body.querySelector('#wiz-test-result');
            result.innerHTML = `<div class="hint-bar mt-12 mb-8">${icon('check', 14)}<div>${esc(t('SQL 语法检查通过'))} · ${res.fields.length} fields · ${esc(t('执行时间'))} ${esc(res.elapsed)}</div></div>
              <div class="verify-table-wrap"><table class="verify-table"><thead><tr>${res.fields.map(f => `<th>${esc(f.name)}</th>`).join('')}</tr></thead>
              <tbody>${res.rows.map(r => `<tr>${res.fields.map(f => `<td>${esc(r[f.name])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
          } catch (err) { toast(err.message, 'error'); }
        });
      } else if (step === 2 || step === 3) {
        const isSubject = step === 2;
        const key = isSubject ? 'ALARM_SUBJECT' : 'ALARM_CONTENT';
        content = `${progress()}
          <div class="template-grid">
            <div class="form-field" style="grid-template-columns:1fr">
              <div class="form-control">
                <textarea class="input" id="wiz-template" rows="12" placeholder="${esc(t(isSubject ? '警报标题模板' : '警报内容模板'))}">${esc(draft[key] || '')}</textarea>
                <div class="form-help mt-8">点击右侧栏位会把 <span class="mono">{Param.栏位}</span> 插入游标位置；所有栏位必须存在于 SQL 中。</div>
              </div>
            </div>
            <div>
              <div class="small muted mb-8">${esc(t('可用字段'))}</div>
              <div class="field-list">${parsedFields.length ? parsedFields.map(f => `<div class="field-item" data-insert="${esc(f.name)}">{Param.${esc(f.name)}}</div>`).join('') : `<div class="field-item muted">${esc(t('请先在步骤 2 测试 SQL'))}</div>`}</div>
            </div>
          </div>`;
        body.innerHTML = content;
        const ta = body.querySelector('#wiz-template');
        ta.addEventListener('input', () => { draft[key] = ta.value; });
        body.querySelectorAll('[data-insert]').forEach(el => {
          el.addEventListener('click', () => {
            const text = `{Param.${el.dataset.insert}}`;
            const start = ta.selectionStart || 0;
            const end = ta.selectionEnd || 0;
            ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + text.length;
            draft[key] = ta.value;
          });
        });
      }
      footer.innerHTML = '';
      const left = document.createElement('div');
      left.className = 'row-gap';
      const back = document.createElement('button');
      back.className = 'btn btn-ghost'; back.textContent = t('上一步'); back.disabled = step === 0;
      back.addEventListener('click', () => { collect(); if (step > 0) step -= 1; renderStep(); });
      left.append(back);
      const right = document.createElement('div');
      right.className = 'row-gap';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost'; cancelBtn.textContent = t('取消');
      cancelBtn.addEventListener('click', modal.close);
      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = step === STEPS.length - 1 ? t('储存') : t('下一步');
      next.addEventListener('click', async () => {
        collect();
        if (step === 0) {
          if (!draft.CONDITION_ID || !draft.CONDITION_NAME || !draft.ALARM_INFO_KEY) {
            toast(t('请填写必填栏位') + '：' + t('警报触发条件代码') + ' / ' + t('警报触发条件名称') + ' / ' + t('警报代码'), 'warning');
            return;
          }
        }
        if (step === 1 && !draft.ALARM_MSG_SQL) { toast('警报讯息 SQL 为必填', 'warning'); return; }
        if (step < STEPS.length - 1) { step += 1; renderStep(); return; }
        // 储存
        next.disabled = true;
        try {
          const payload = { ...draft };
          if (isEdit) payload.CONDITION_KEY = row.CONDITION_KEY;
          await ctx.api.post('/api/alarm-conditions', payload);
          toast(t('储存成功'));
          modal.close();
          selectedKey = payload.CONDITION_KEY || null;
          load(true);
        } catch (err) { toast(err.message, 'error', 5000); next.disabled = false; }
      });
      right.append(cancelBtn, next);
      footer.append(left, right);
      footer.style.justifyContent = 'space-between';
    };

    const collect = () => {
      if (step === 0) {
        body.querySelectorAll('[name]').forEach(inp => { draft[inp.name] = inp.type === 'number' ? inp.value : inp.value; });
      } else if (step === 1) {
        const sql = body.querySelector('#wiz-sql');
        if (sql) draft.ALARM_MSG_SQL = sql.value;
        const dateField = body.querySelector('#wiz-datefield');
        if (dateField) draft.DATE_CONDITION_FIELD = dateField.value;
        const checked = body.querySelector('input[name="wiz-timetype"]:checked');
        if (checked) draft.DATE_TIME_TYPE = checked.value;
      } else {
        const ta = body.querySelector('#wiz-template');
        if (ta) draft[step === 2 ? 'ALARM_SUBJECT' : 'ALARM_CONTENT'] = ta.value;
      }
    };

    renderStep();
  };

  await load();
}

function parseSqlFields(sql) {
  if (!sql) return [];
  const m = String(sql).match(/select\s+([\s\S]*?)\s+from\s/i);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const alias = s.match(/\s+as\s+([A-Za-z0-9_]+)$/i);
    const name = alias ? alias[1] : (s.split(/\s+/).pop() || s).split('.').pop();
    return { name: name.replace(/[^A-Za-z0-9_]/g, '') };
  }).filter(x => x.name);
}
