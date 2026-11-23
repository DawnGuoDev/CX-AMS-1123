'use strict';

import {
  esc, icon, DataGrid, openModal, toast, showLoading, hideLoading,
  statusChip, emptyState, trxLabel, downloadBlob
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';
import { openAlarmDrawer } from './alarm-detail.js';

/* ================================================================ 即时汇总 */
export async function renderSummary(container, ctx) {
  let auto = true;
  let countdown = 10;
  let timer = null;
  let tickTimer = null;
  let detail = null;

  container.innerHTML = `<div id="summary-root"><div class="card"><div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><div class="empty-title">${esc(t('读取中'))}</div></div></div></div>`;
  const root = container.querySelector('#summary-root');

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      if (detail) {
        const res = await ctx.api.get(`/api/summary/detail?factory=${encodeURIComponent(detail.FACTORY_KEY)}&subsys=${encodeURIComponent(detail.SUB_SYS_KEY)}`);
        paint(res.rows, true);
      } else {
        const res = await ctx.api.get('/api/summary/master');
        paint(res.rows, false);
      }
      countdown = 10;
      ctx.setUpdated(new Date().toISOString());
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (!silent) hideLoading();
    }
  };

  const paint = (rows, isDetail) => {
    const total = rows.reduce((s, r) => s + Number(r.ALARM_COUNT || 0), 0);
    const groupCount = rows.length;
    root.innerHTML = `
      <div class="summary-hero">
        <div>
          <div class="sh-label">Live Alarm Summary</div>
          <div class="sh-value">${total}</div>
          <div class="sh-sub">${isDetail ? `${esc(detail.FACTORY_ID)} ${esc(detail.FACTORY_NAME)} · ${esc(detail.SUB_SYS_ID)} ${esc(detail.SUB_SYS_NAME)} · ${esc(t('各机台处理中警报'))}` : `${groupCount} ${esc(t('个厂别 × 子系统组合'))} · ${esc(t('处理中警报总数'))}`}</div>
        </div>
        <div class="countdown-box">
          ${icon('clock', 14)} ${esc(t('倒数'))} <span class="count-num" id="summary-count">${countdown}</span> ${esc(t('秒'))}
          <button id="summary-toggle" title="${esc(t('自动刷新'))}">${auto ? icon('refresh', 14) : icon('play', 14)}</button>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          ${isDetail ? `<button class="tool-btn" id="summary-back">${icon('arrowLeft', 15)}<span>${esc(t('回上层'))}</span></button>` : ''}
          <button class="tool-btn" id="summary-refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
          <span class="tool-sep"></span>
          <span class="inline-note">${icon('info', 13)} ${esc(t('自动刷新'))} · 10 ${esc(t('秒'))}</span>
          <div class="toolbar-right"><span class="small muted">${esc(t('资料更新时间'))} ${esc(fmtDT(new Date()))}</span></div>
        </div>
        <div id="summary-grid"></div>
      </div>
    `;
    const columns = isDetail ? [
      { field: 'FACTORY_ID', label: '厂别代码', width: 100 },
      { field: 'FACTORY_NAME', label: '厂别名称', width: 120 },
      { field: 'SUB_SYS_ID', label: '子系统代码', width: 100 },
      { field: 'SUB_SYS_NAME', label: '子系统名称', width: 140 },
      { field: 'EQP_ID', label: '机台代码', width: 110 },
      { field: 'EQP_NAME', label: '机台名称', width: 160 },
      { field: 'ALARM_COUNT', label: '警报数量', width: 100, type: 'number', render: r => `<b style="color:var(--red);font-size:14px">${esc(r.ALARM_COUNT)}</b>` }
    ] : [
      {
        field: '_select', label: '按键', width: 82, sortable: false, filterable: false,        render: r => `<button class="btn btn-sm btn-primary no-row-click" data-select="${esc(r.FACTORY_KEY)}||${esc(r.SUB_SYS_KEY)}">${esc(t('选择'))}</button>`
      },
      { field: 'FACTORY_ID', label: '厂别代码', width: 110 },
      { field: 'FACTORY_NAME', label: '厂别名称', width: 150 },
      { field: 'SUB_SYS_ID', label: '子系统代码', width: 110 },
      { field: 'SUB_SYS_NAME', label: '子系统名称', width: 190 },
      { field: 'ALARM_COUNT', label: '警报数量', width: 120, type: 'number', render: r => `<b style="color:var(--red);font-size:14px">${esc(r.ALARM_COUNT)}</b>` }
    ];
    new DataGrid(root.querySelector('#summary-grid'), {
      rows, rowKey: r => (r.FACTORY_KEY || '') + '||' + (r.SUB_SYS_KEY || '') + '||' + (r.EQP_ID || ''),
      columns, pageSize: 20, showFilter: false
    });
    root.querySelector('#summary-refresh').addEventListener('click', () => { load(); toast(t('资料已更新'), 'info'); });
    root.querySelector('#summary-toggle').addEventListener('click', () => {
      auto = !auto;
      toast(auto ? t('已启用自动更新') : t('已暂停自动更新'), 'info');
      paint(rows, isDetail);
    });
    if (isDetail) {
      root.querySelector('#summary-back').addEventListener('click', () => {
        detail = null;
        load();
      });
    }
    root.querySelectorAll('[data-select]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [fk, sk] = btn.dataset.select.split('||');
        const row = rows.find(r => r.FACTORY_KEY === fk && r.SUB_SYS_KEY === sk);
        detail = row;
        load();
      });
    });
    if (timer) clearInterval(timer);
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (!auto) return;
      countdown -= 1;
      const el = root.querySelector('#summary-count');
      if (el) el.textContent = Math.max(0, countdown);
      if (countdown <= 0) {
        countdown = 10;
        load(true);
      }
    }, 1000);
  };

  await load();
  ctx.registerCleanup(() => {
    if (timer) clearInterval(timer);
    if (tickTimer) clearInterval(tickTimer);
  });
}

/* ================================================================ 通用报表 */
export async function renderReport(container, ctx) {
  const code = ctx.route.code;
  let def;
  try {
    const res = await ctx.api.get('/api/report-defs/' + code);
    def = res.row;
  } catch (err) {
    container.innerHTML = `<div class="card">${emptyState(err.message, 'warning')}</div>`;
    return;
  }
  let conditions = {};
  let rows = null;
  let queried = false;
  let grid = null;
  let searchSummary = '';

  const defaults = {};
  (def.CONDITIONS || []).forEach(c => {
    if (c.type === 'dateRange') {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - (c.defaultDays || 7));
      defaults[c.field] = {
        enabled: c.enabled !== false, from: ymd(from), to: ymd(to)
      };
    } else {
      defaults[c.field] = { enabled: false, value: '' };
    }
  });

  container.innerHTML = `
    <div class="report-shell">
      <div class="card">
        <div class="report-topbar">
          <div class="report-meta">
            <span>${icon('report', 14)} <b>${esc(def.REPORT_ID)}</b></span>
            <span>${esc(t(def.REPORT_DESC || ''))}</span>
            ${def.ATLEAST_ONE_CONDITION === 'Y' ? `<span class="badge badge-blue">${esc(t('至少一个查询条件'))}</span>` : ''}
          </div>
          <div class="report-actions">
            <button class="btn btn-primary" id="report-query">${icon('search', 15)} ${esc(t('查询'))}</button>
            <button class="btn btn-ghost" id="report-export">${icon('export', 15)} ${esc(t('汇出Excel'))}</button>
          </div>
        </div>
        <div class="stat-strip" id="report-cond-summary">
          <div class="ss-item"><b>–</b>${esc(t('查询条件'))}</div>
        </div>
        <div id="report-result"></div>
      </div>
    </div>
  `;
  const resultEl = container.querySelector('#report-result');

  const paintEmpty = () => {
    resultEl.innerHTML = `<div class="query-empty">
      <div class="qe-icon">${icon('search', 30)}</div>
      <h4>${esc(t('查询结果'))}</h4>
      <div>${esc(t('请点击查询'))} ${def.ATLEAST_ONE_CONDITION === 'Y' ? '· ' + esc(t('至少须选择一个查询条件')) : ''}</div>
      <button class="btn btn-primary btn-sm mt-16" id="report-query-empty">${icon('search', 13)} ${esc(t('查询'))}</button>
    </div>`;
    const btn = resultEl.querySelector('#report-query-empty');
    if (btn) btn.addEventListener('click', openQueryDialog);
  };

  const openQueryDialog = () => {
    const body = document.createElement('div');
    body.innerHTML = `<div class="condition-list">${(def.CONDITIONS || []).map(c => {
      const d = defaults[c.field];
      const enabled = d.enabled;
      let control = '';
      if (c.type === 'dateRange') {
        control = `<div class="date-range">
          <input class="input" type="date" data-field="${esc(c.field)}" data-part="from" value="${esc(d.from || '')}" ${enabled ? '' : 'disabled'}/>
          <span class="range-sep">~</span>
          <input class="input" type="date" data-field="${esc(c.field)}" data-part="to" value="${esc(d.to || '')}" ${enabled ? '' : 'disabled'}/>
        </div>`;
      } else if (c.type === 'select') {
        const list = ctx.options[c.optionSet] || [];
        control = `<select class="input" data-field="${esc(c.field)}" data-part="value" ${enabled ? '' : 'disabled'}>
          <option value="">${esc(t('全部'))}</option>
          ${list.map(o => `<option value="${esc(o.value)}" ${d.value === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>`;
      } else {
        control = `<input class="input" data-field="${esc(c.field)}" data-part="value" value="${esc(d.value || '')}" ${enabled ? '' : 'disabled'} placeholder="${esc(t('输入查询条件'))}"/>`;
      }
      return `<div class="condition-row ${enabled ? '' : 'disabled'}">
        <input type="checkbox" class="cr-check" data-field="${esc(c.field)}" ${enabled ? 'checked' : ''}/>
        <div class="cr-label">${esc(t(c.label))}</div>
        <div>${control}</div>
      </div>`;
    }).join('')}</div>
    ${def.ATLEAST_ONE_CONDITION === 'Y' ? `<div class="hint-bar mt-12">${icon('info', 14)}<div>${esc(t('至少须选择一个查询条件'))}</div></div>` : ''}`;
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const search = document.createElement('button');
    search.className = 'btn btn-primary'; search.textContent = t('查询');
    footer.append(cancel, search);
    const modal = openModal({ title: `${t(def.REPORT_NAME)} - ${t('查询条件')}`, width: 700, body, footer });
    body.querySelectorAll('.cr-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const field = chk.dataset.field;
        const rowEl = chk.closest('.condition-row');
        rowEl.classList.toggle('disabled', !chk.checked);
        rowEl.querySelectorAll('[data-field]').forEach(inp => { if (inp !== chk) inp.disabled = !chk.checked; });
      });
    });
    cancel.addEventListener('click', modal.close);
    search.addEventListener('click', async () => {
      const conds = {};
      let count = 0;
      body.querySelectorAll('.cr-check').forEach(chk => {
        if (!chk.checked) return;
        const field = chk.dataset.field;
        const c = (def.CONDITIONS || []).find(x => x.field === field);
        if (c.type === 'dateRange') {
          const from = body.querySelector(`[data-field="${field}"][data-part="from"]`).value;
          const to = body.querySelector(`[data-field="${field}"][data-part="to"]`).value;
          if (!from && !to) return;
          conds[field] = { enabled: true, from, to };
        } else {
          const value = body.querySelector(`[data-field="${field}"][data-part="value"]`).value.trim();
          if (!value) return;
          conds[field] = { enabled: true, value };
        }
        count += 1;
      });
      if (def.ATLEAST_ONE_CONDITION === 'Y' && count === 0) {
        toast(t('至少须选择一个查询条件'), 'warning');
        return;
      }
      modal.close();
      await runQuery(conds);
    });
  };

  const runQuery = async (conds) => {
    conditions = conds || {};
    showLoading(t('查询'));
    try {
      const res = await ctx.api.post(`/api/reports/${code}/query`, { conditions });
      rows = res.rows;
      queried = true;
      searchSummary = summarizeConditions(conditions, def);
      paintResult();
      ctx.setUpdated(res.lastUpdate);
    } catch (err) {
      toast(err.message, 'error');
    } finally { hideLoading(); }
  };

  const summarizeConditions = (conds, definition) => {
    const parts = [];
    Object.entries(conds).forEach(([field, v]) => {
      const c = (definition.CONDITIONS || []).find(x => x.field === field);
      if (!c) return;
      if (c.type === 'dateRange') parts.push(`${t(c.label)}: ${v.from || '...'} ~ ${v.to || '...'}`);
      else {
        let val = v.value;
        if (c.type === 'select' && c.optionSet) {
          const opt = (ctx.options[c.optionSet] || []).find(o => o.value === v.value);
          if (opt) val = opt.label;
        }
        parts.push(`${t(c.label)}: ${val}`);
      }
    });
    return parts.length ? parts.join('　|　') : t('无查询条件');
  };

  const columnType = (field) => {
    if (/_DT$|DATE/.test(field)) return 'datetime';
    if (field === 'STATUS' || field === 'AGENT_STATUS') return 'status';
    if (field === 'PRIORITY') return 'priority';
    if (field === 'SEQ' || field === 'ALARM_COUNT' || field === 'RECEIVED_COUNT' || field === 'SUCCESSFUL_COUNT' || field === 'FAIL_COUNT' || field === 'DEVICE_ERROR_COUNT') return 'number';
    return undefined;
  };
  const widthFor = (field) => ({
    ALARM_ID: 160, INVALID_ID: 145, TITLE: 240, CONTENT: 260, FACTORY_NAME: 100,
    SUB_SYS_NAME: 130, EQP_ID: 95, ALARM_INFO_ID: 130, EVENT_ID: 160, TRX_DT: 155,
    CREATE_DT: 155, FIRST_PROCESS_DT: 155, COMPLETE_DT: 155, RECEIVE_TYPE: 110,
    STATUS: 100, CURRENT_LEVEL: 100, PRIORITY: 85, SEQ: 70, TRX_TYPE: 110,
    INVALID_TYPE: 170, SERVER_ID: 110, AGENT_ID: 110, AGENT_STATUS: 100,
    STATUS_DESC: 220, DEVICE_ERROR_COUNT: 110, ALARM_COUNT: 100
  }[field] || 140);

  const paintResult = () => {
    const columns = (def.COLUMNS || []).map(c => ({
      field: c.field,
      label: c.label,
      width: widthFor(c.field),
      type: columnType(c.field),
      render: c.field === 'TRX_TYPE'
        ? r => `<span class="badge badge-blue">${esc(trxLabel(r.TRX_TYPE))}</span>`
        : c.field === 'INVALID_TYPE'
          ? r => `<span class="badge badge-red">${esc(r.INVALID_TYPE)}</span>`
          : c.field === 'TRX_DT'
            ? r => `<a class="mono" style="font-size:11px">${esc(fmtDT(r.TRX_DT))}</a>`
            : undefined
    }));
    const summaryEl = container.querySelector('#report-cond-summary');
    summaryEl.innerHTML = `<div class="ss-item"><b>${rows.length}</b>${esc(t('查询结果'))}</div>
      <div class="ss-item">${esc(t('查询条件'))}：${esc(searchSummary || t('无查询条件'))}</div>
      <div class="ss-item">${esc(t('资料更新时间'))} ${esc(fmtDT(new Date()))}</div>`;
    resultEl.innerHTML = `<div class="report-result-head">
        <div class="rr-title">${icon('report', 14)} ${esc(t('查询结果'))}</div>
        <div class="rr-count">${rows.length} ${esc(t('笔'))}</div>
      </div>
      <div id="report-grid"></div>`;
    const cfg = {
      rows, rowKey: code === 'AVPA007' ? 'TRX_KEY' : 'ALARM_KEY', columns, pageSize: 20,
      rowClass: row => row.STATUS === 'Process' ? 'row-process' : ''
    };
    if (code === 'AVPA008') {
      cfg.expandable = row => `
        <div style="padding:10px 14px">
          <table class="verify-table">
            <thead><tr><th>${esc(t('装置代码'))}</th><th>${esc(t('装置状态'))}</th><th>${esc(t('状态说明'))}</th><th>${esc(t('启用'))}</th><th>${esc(t('接收命令数量'))}</th><th>${esc(t('成功的数量'))}</th><th>${esc(t('失败的数量'))}</th><th>${esc(t('最后更新时间'))}</th></tr></thead>
            <tbody>${(row.DEVICES || []).map(d => `<tr>
              <td class="device-name">${esc(d.DEVICE_ID)}</td>
              <td>${statusChip(d.DEVICE_STATUS)}</td>
              <td>${esc(d.DEVICE_STATUS_DESC)}</td>
              <td>${d.ENABLE === 'Y' ? `<span class="badge badge-green">${esc(t('启用'))}</span>` : `<span class="badge badge-gray">${esc(t('停用'))}</span>`}</td>
              <td>${esc(d.RECEIVED_COUNT)}</td>
              <td>${esc(d.SUCCESSFUL_COUNT)}</td>
              <td>${esc(d.FAIL_COUNT)}</td>
              <td class="mono">${esc(fmtDT(d.TRX_DATE))}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
      cfg.rowKey = r => r.SERVER_ID + '||' + r.AGENT_ID;
    }
    if (code === 'AVPA004' || code === 'AVPA007') {
      cfg.onRowClick = (row) => {
        if (!row.ALARM_KEY) return;
        openAlarmDrawer(ctx, row.ALARM_KEY);
      };
    }
    if (code === 'AVPA005') {
      cfg.onRowClick = (row) => openInvalidDetail(ctx, row);
    }
    grid = new DataGrid(resultEl.querySelector('#report-grid'), cfg);
    if (code === 'AVPA008') {
      // 展开第一列由 DataGrid caret 控制；自动展开第一笔示意
    }
  };

  container.querySelector('#report-query').addEventListener('click', openQueryDialog);
  container.querySelector('#report-export').addEventListener('click', async () => {
    try {
      showLoading(t('读取中'));
      const res = await ctx.api.post(`/api/reports/${code}/export`, { conditions });
      downloadBlob(res.filename, res.base64);
      toast(t('已汇出'));
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  });

  if ((def.CONDITIONS || []).length === 0) {
    await runQuery({});
  } else {
    paintEmpty();
  }
}

function openInvalidDetail(ctx, row) {
  const body = document.createElement('div');
  body.innerHTML = `<div class="info-grid">
    ${cell('无效警报识别码', row.INVALID_ID)}
    ${cell('产生警报时间', fmtDT(row.CREATE_DT))}
    ${cell('厂别', `${row.FACTORY_ID} ${row.FACTORY_NAME}`)}
    ${cell('子系统', `${row.SUB_SYS_ID} ${row.SUB_SYS_NAME}`)}
    ${cell('机台', `${row.EQP_ID} ${row.EQP_NAME}`)}
    ${cell('警报代码', row.ALARM_INFO_ID)}
    ${cell('资料取得方式', row.RECEIVE_TYPE)}
    ${cell('失效类型', `<span class="badge badge-red">${esc(row.INVALID_TYPE)}</span>`, true)}
    <div class="info-cell span-2"><div class="ic-label">${esc(t('警报标题'))}</div><div class="ic-value">${esc(row.TITLE)}</div></div>
    <div class="info-cell span-2"><div class="ic-label">${esc(t('警报详细内容'))}</div><div class="ic-value">${esc(row.CONTENT)}</div></div>
  </div>`;
  openModal({ title: t('无效警报'), subtitle: row.INVALID_ID, width: 720, body });
}

function cell(label, value, raw = false) {
  return `<div class="info-cell"><div class="ic-label">${esc(t(label))}</div><div class="ic-value">${raw ? value : esc(value || '–')}</div></div>`;
}

function ymd(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
