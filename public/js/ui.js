'use strict';

import { t, fmtDT, fmtDate, fmtTime } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  hide: '<path d="M17.9 17.9A10.4 10.4 0 0 1 12 20C5 20 2 12 2 12a18.5 18.5 0 0 1 5.1-5.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  show: '<path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  template: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  import: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  alarm: '<path d="M12 3a6 6 0 0 0-6 6v4l-2 4h16l-2-4V9a6 6 0 0 0-6-6Z"/><path d="M10 21h4"/>',
  report: '<path d="M3 3v18h18"/><path d="m7 15 4-5 4 3 5-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>',
  play: '<path d="m6 3 14 9-14 9Z"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  server: '<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><path d="M6 6.5h.01M6 17.5h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  factory: '<path d="M3 21V9l6 4V9l6 4V4h6v17Z"/><path d="M7 17h.01M12 17h.01M17 17h.01"/>',
  eqp: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v4H8Z"/><path d="M8 16h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
  tree: '<path d="M4 4v16"/><path d="M4 8h7M4 14h7M4 20h7"/><rect x="11" y="5" width="9" height="6" rx="1"/><rect x="11" y="14" width="9" height="6" rx="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  activity: '<path d="M3 12h4l2 7 4-14 2 7h6"/>',
  pending: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};

export function icon(name, size = 16, extra = '') {
  return `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function toast(message, type = 'success', duration = 3200) {
  const root = document.getElementById('toast-root');
  const box = document.createElement('div');
  box.className = `toast toast-${type}`;
  const iconName = type === 'error' ? 'x' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'check';
  box.innerHTML = `<span class="toast-icon">${icon(iconName, 16)}</span><span class="toast-text">${esc(message)}</span><button class="toast-close" aria-label="close">${icon('close', 13)}</button>`;
  root.appendChild(box);
  requestAnimationFrame(() => box.classList.add('show'));
  const remove = () => {
    box.classList.remove('show');
    setTimeout(() => box.remove(), 220);
  };
  box.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, duration);
  return remove;
}

let loadingCount = 0;
export function showLoading(text = t('读取中')) {
  loadingCount += 1;
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="loading-box"><div class="spinner"></div><div class="loading-text"></div></div>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('.loading-text').textContent = text;
  overlay.classList.add('show');
}
export function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => { if (loadingCount === 0) overlay.remove(); }, 200);
    }
  }
}
export async function withLoading(fn, text) {
  showLoading(text);
  try { return await fn(); } finally { hideLoading(); }
}

/* ------------------------------------------------------------------ Modal */
const modalStack = [];

export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (top) top.close();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) closeTopModal();
});

export function openModal({ title, subtitle = '', body = '', footer = '', width = 760, className = '', onMount, closeOnBackdrop = true }) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal ' + className;
  modal.style.setProperty('--modal-width', typeof width === 'number' ? width + 'px' : width);
  modal.innerHTML = `
    <div class="modal-head">
      <div class="modal-title-wrap">
        <div class="modal-title">${esc(title || '')}</div>
        ${subtitle ? `<div class="modal-subtitle">${esc(subtitle)}</div>` : ''}
      </div>
      <button class="modal-close" aria-label="close">${icon('close', 18)}</button>
    </div>
    <div class="modal-body"></div>
    ${footer ? `<div class="modal-foot"></div>` : ''}
  `;
  const bodyEl = modal.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);
  if (footer) {
    const foot = modal.querySelector('.modal-foot');
    if (typeof footer === 'string') foot.innerHTML = footer;
    else foot.appendChild(footer);
  }
  backdrop.appendChild(modal);
  root.appendChild(backdrop);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('show');
    const idx = modalStack.findIndex(m => m.backdrop === backdrop);
    if (idx >= 0) modalStack.splice(idx, 1);
    setTimeout(() => backdrop.remove(), 180);
    if (!modalStack.length) document.body.classList.remove('modal-open');
  };
  modalStack.push({ backdrop, modal, close });
  modal.querySelector('.modal-close').addEventListener('click', close);
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
  }
  requestAnimationFrame(() => backdrop.classList.add('show'));
  setTimeout(() => {
    const first = modal.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (first) first.focus();
  }, 120);
  if (onMount) onMount(modal, close, bodyEl);
  return { el: modal, body: bodyEl, close, backdrop };
}

export function confirmDialog({ title = t('提示'), message, okText = t('确定'), cancelText = t('取消'), danger = false }) {  return new Promise((resolve) => {
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost';
    cancel.textContent = cancelText;
    const ok = document.createElement('button');
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    ok.textContent = okText;
    footer.append(cancel, ok);
    const m = openModal({
      title, width: 460, body: `<div class="confirm-message">${esc(message || '')}</div>`, footer,
      className: 'modal-sm', closeOnBackdrop: false
    });
    cancel.addEventListener('click', () => { m.close(); resolve(false); });
    ok.addEventListener('click', () => { m.close(); resolve(true); });
    m.el.querySelector('.modal-close').addEventListener('click', () => resolve(false));
  });
}

export function alertDialog({ title = t('提示'), message, okText = t('确定') }) {
  return new Promise((resolve) => {
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary';
    ok.textContent = okText;
    footer.append(ok);
    const m = openModal({ title, width: 480, body: `<div class="confirm-message">${message}</div>`, footer, className: 'modal-sm' });
    ok.addEventListener('click', () => { m.close(); resolve(true); });
  });
}

/* ------------------------------------------------------------------ Form */
export function optionLabel(options, optionSet, value) {
  if (value == null || value === '') return '';
  if (!optionSet) return value;
  const list = options && options[optionSet] ? options[optionSet] : [];
  const found = list.find(o => o.value === value);
  return found ? found.label : value;
}

export function fieldControl(field, value, options) {
  const name = field.name;
  const disabled = field.disabled || field.readOnly ? 'disabled' : '';
  const required = field.required ? 'required' : '';
  const val = value == null ? '' : value;
  if (field.type === 'select') {
    let list = field.options ? field.options : (options[field.optionSet] || []);
    if (field.filterOptions) list = field.filterOptions(list);
    return `<select class="input" name="${esc(name)}" ${disabled} ${required} data-option-set="${esc(field.optionSet || '')}">
      ${field.allowEmpty === false ? '' : `<option value="">${esc(t('请选择'))}</option>`}
      ${list.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>`;
  }
  if (field.type === 'textarea') {
    return `<textarea class="input" name="${esc(name)}" rows="${field.rows || 3}" ${disabled} ${required} placeholder="${esc(field.placeholder || '')}">${esc(val)}</textarea>`;
  }
  if (field.type === 'checkbox') {
    return `<label class="switch"><input type="checkbox" name="${esc(name)}" ${val === 'Y' || val === true ? 'checked' : ''} ${disabled}/><span class="switch-track"></span><span class="switch-label">${esc(field.checkboxLabel || '')}</span></label>`;
  }
  if (field.type === 'number') {
    return `<input class="input" type="number" name="${esc(name)}" value="${esc(val)}" ${field.min != null ? `min="${field.min}"` : ''} ${field.max != null ? `max="${field.max}"` : ''} ${disabled} ${required}/>`;
  }
  if (field.type === 'date' || field.type === 'datetime') {
    const type = field.type === 'date' ? 'date' : 'datetime-local';
    const v = field.type === 'datetime' && val ? String(val).slice(0, 16) : (field.type === 'date' && val ? String(val).slice(0, 10) : val);
    return `<input class="input" type="${type}" name="${esc(name)}" value="${esc(v)}" ${disabled} ${required}/>`;
  }
  if (field.type === 'password') {
    return `<input class="input" type="password" autocomplete="new-password" name="${esc(name)}" value="${esc(val)}" ${disabled} placeholder="${esc(field.placeholder || '')}"/>`;
  }
  return `<input class="input" type="text" name="${esc(name)}" value="${esc(val)}" ${disabled} ${required} placeholder="${esc(field.placeholder || '')}" ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}/>`;
}

export function formGrid(fields, values, options, opts = {}) {
  const cols = opts.columns || 2;
  return `<div class="form-grid cols-${cols}">
    ${fields.filter(f => !f.hidden).map(field => `
      <div class="form-field ${field.full ? 'span-full' : ''} ${field.type === 'textarea' ? 'span-full' : ''} ${field.required ? 'is-required' : ''}" data-field-wrap="${esc(field.name)}">
        <label class="form-label" for="f_${esc(field.name)}">${esc(t(field.label))}${field.required ? '<span class="req">*</span>' : ''}</label>
        <div class="form-control">${fieldControl(field, values[field.name], options)}
          ${field.help ? `<div class="form-help">${esc(t(field.help))}</div>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

export function readForm(root, fields) {
  const values = {};
  fields.forEach(f => {
    const input = root.querySelector(`[name="${f.name}"]`);
    if (!input) return;
    if (f.type === 'checkbox') values[f.name] = input.checked ? 'Y' : 'N';
    else values[f.name] = input.value;
  });
  return values;
}

export function bindDependentSelects(root, fields, options) {
  fields.filter(f => f.dependsOn && f.type === 'select').forEach(field => {
    const dep = field.dependsOn;
    const depInput = root.querySelector(`[name="${dep}"]`);
    const input = root.querySelector(`[name="${field.name}"]`);
    if (!depInput || !input) return;
    const fill = () => {
      const depValue = depInput.value;
      let list = [];
      if (field.optionSet === 'subsystem') {
        list = (options.subsystemByFactory && options.subsystemByFactory[depValue]) || [];
      } else {
        list = options[field.optionSet] || [];
      }
      const current = input.value;
      input.innerHTML = `<option value="">${esc(t('请选择'))}</option>` +
        list.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
      if (list.some(o => o.value === current)) input.value = current;
    };
    fill();
    depInput.addEventListener('change', fill);
  });
}

/* -------------------------------------------------------------- DataGrid */
export class DataGrid {
  constructor(host, cfg = {}) {
    this.host = typeof host === 'string' ? document.querySelector(host) : host;
    this.cfg = cfg;
    this.cfg.options = cfg.options || window.__AMS_OPTIONS__ || {};
    this.columns = (cfg.columns || []).filter(c => !c.hidden);
    this.rows = cfg.rows || [];
    this.pageSize = cfg.pageSize || 20;
    this.page = 1;
    this.filters = {};
    this.sort = { field: null, dir: 1 };
    this.selected = new Set();
    this.expanded = new Set();
    this.render();
  }

  keyOf(row) {
    if (typeof this.cfg.rowKey === 'function') return this.cfg.rowKey(row);
    return row[this.cfg.rowKey || 'KEY'] || row.ALARM_KEY || row.USER_KEY || row.DEVICE_KEY || row.REPORT_KEY;
  }

  setRows(rows) {
    this.rows = rows || [];
    const keys = new Set(this.rows.map(r => this.keyOf(r)));
    this.selected = new Set([...this.selected].filter(k => keys.has(k)));
    const maxPage = Math.max(1, Math.ceil(this.filtered().length / this.pageSize));
    if (this.page > maxPage) this.page = maxPage;
    this.render();
  }

  setPageSize(size) {
    this.pageSize = size;
    this.page = 1;
    this.render();
  }

  filtered() {
    let rows = this.rows.slice();
    Object.entries(this.filters).forEach(([field, needle]) => {
      if (!needle) return;
      const q = String(needle).toLowerCase();
      rows = rows.filter(row => String(row[field] == null ? '' : row[field]).toLowerCase().includes(q));
    });
    if (this.sort.field) {
      const f = this.sort.field;
      rows.sort((a, b) => {
        const va = a[f] == null ? '' : a[f];
        const vb = b[f] == null ? '' : b[f];
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '') return (na - nb) * this.sort.dir;
        return String(va).localeCompare(String(vb), 'zh-Hant') * this.sort.dir;
      });
    }
    return rows;
  }

  getSelected() { return [...this.selected]; }
  getSelectedRows() { return this.rows.filter(r => this.selected.has(this.keyOf(r))); }
  clearSelection() { this.selected.clear(); this.render(); }

  formatCell(col, row) {
    const v = row[col.field];
    if (col.render) return col.render(row, col);
    if (v == null || v === '') return '<span class="cell-empty">–</span>';
    if (col.type === 'datetime') return esc(fmtDT(v));
    if (col.type === 'date') return esc(fmtDate(v));
    if (col.type === 'time') return esc(fmtTime(v));
    if (col.type === 'status') return statusChip(v);
    if (col.type === 'yn') return v === 'Y' ? `<span class="badge badge-green">${esc(t('是'))}</span>` : `<span class="badge badge-gray">${esc(t('否'))}</span>`;
    if (col.type === 'priority') return `<span class="priority p-${Number(v) >= 9 ? 'high' : Number(v) >= 7 ? 'mid' : 'low'}">${esc(v)}</span>`;
    if (col.options) {
      const found = col.options.find(o => String(o.value) === String(v));
      return esc(found ? found.label : v);
    }
    if (col.optionSet && this.cfg.options) {
      const found = (this.cfg.options[col.optionSet] || []).find(o => String(o.value) === String(v));
      return esc(found ? found.label : v);
    }
    if (col.type === 'number') return `<span class="num">${esc(Number(v).toLocaleString())}</span>`;
    const text = String(v);
    const short = col.width && text.length > 40 ? text.slice(0, 40) + '…' : text;
    return `<span title="${esc(text)}">${esc(short)}</span>`;
  }

  render() {
    if (!this.host) return;
    const rows = this.filtered();
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.page > totalPages) this.page = totalPages;
    const start = (this.page - 1) * this.pageSize;
    const pageRows = rows.slice(start, start + this.pageSize);
    const selectable = this.cfg.selectable;
    const hasExpand = typeof this.cfg.expandable === 'function';
    const showFilter = this.cfg.showFilter !== false;
    const pageSizes = this.cfg.pageSizes || [20, 25, 50, 100, 200, 500];

    const header = `<thead>
      <tr>
        ${selectable === 'multi' ? `<th class="col-check"><input type="checkbox" class="grid-check-all"/></th>` : ''}
        ${hasExpand ? '<th class="col-expand"></th>' : ''}
        ${this.columns.map(col => `
          <th style="${col.width ? `min-width:${col.width}px;width:${col.width}px;` : ''}${col.align ? `text-align:${col.align};` : ''}" data-sort="${esc(col.field || '')}" class="${this.sort.field === col.field ? 'sorted' : ''}">
            <span class="th-label">${esc(t(col.label))}</span>
            ${col.sortable === false ? '' : `<span class="sort-ind">${this.sort.field === col.field ? (this.sort.dir > 0 ? '▲' : '▼') : ''}</span>`}
          </th>`).join('')}
      </tr>
      ${showFilter ? `<tr class="filter-row">
        ${selectable === 'multi' ? '<th></th>' : ''}
        ${hasExpand ? '<th></th>' : ''}
        ${this.columns.map(col => `<th>${col.filterable === false ? '' : `<div class="col-filter">${icon('search', 12)}<input type="text" data-filter="${esc(col.field || '')}" value="${esc(this.filters[col.field] || '')}" placeholder="${esc(t('过滤'))}"/></div>`}</th>`).join('')}
      </tr>` : ''}
    </thead>`;

    const body = `<tbody>${pageRows.length ? pageRows.map((row, idx) => {
      const key = this.keyOf(row);
      const selected = this.selected.has(key);
      const expanded = this.expanded.has(key);
      const expandContent = hasExpand && expanded ? this.cfg.expandable(row) : null;
      const rc = typeof this.cfg.rowClass === 'function' ? this.cfg.rowClass(row) : '';
      return `
        <tr class="dg-row ${selected ? 'selected' : ''} ${rc}" data-key="${esc(key)}" data-index="${start + idx}">
          ${selectable === 'multi' ? `<td class="col-check"><input type="checkbox" class="grid-check" ${selected ? 'checked' : ''}/></td>` : ''}
          ${hasExpand ? `<td class="col-expand"><button class="row-expand" aria-label="expand">${icon(expanded ? 'chevronDown' : 'chevronRight', 14)}</button></td>` : ''}
          ${this.columns.map(col => `<td style="${col.align ? `text-align:${col.align};` : ''}" class="${col.className || ''}">${this.formatCell(col, row)}</td>`).join('')}
        </tr>
        ${expandContent ? `<tr class="expand-row"><td colspan="${this.columns.length + (selectable === 'multi' ? 1 : 0) + (hasExpand ? 1 : 0)}">${expandContent}</td></tr>` : ''}
      `;
    }).join('') : `<tr class="empty-row"><td colspan="${this.columns.length + (selectable === 'multi' ? 1 : 0) + (hasExpand ? 1 : 0)}"><div class="empty-state"><div class="empty-icon">${icon('search', 26)}</div><div>${esc(t('无资料'))}</div></div></td></tr>`}</tbody>`;

    const pages = [];
    const addPage = (p) => pages.push(`<button class="page-btn ${p === this.page ? 'active' : ''}" data-page="${p}">${p}</button>`);
    if (totalPages <= 7) {
      for (let p = 1; p <= totalPages; p += 1) addPage(p);
    } else if (this.page <= 4) {
      for (let p = 1; p <= 5; p += 1) addPage(p);
      pages.push('<span class="page-ellipsis">…</span>');
      addPage(totalPages);
    } else if (this.page >= totalPages - 3) {
      addPage(1);
      pages.push('<span class="page-ellipsis">…</span>');
      for (let p = totalPages - 4; p <= totalPages; p += 1) addPage(p);
    } else {
      addPage(1);
      pages.push('<span class="page-ellipsis">…</span>');
      for (let p = this.page - 1; p <= this.page + 1; p += 1) addPage(p);
      pages.push('<span class="page-ellipsis">…</span>');
      addPage(totalPages);
    }

    this.host.innerHTML = `
      <div class="dg-scroll">
        <table class="dg ${this.cfg.compact ? 'dg-compact' : ''}">
          ${header}
          ${body}
        </table>
      </div>
      ${this.cfg.hidePager ? '' : `<div class="dg-pager">
        <div class="pager-left">
          <select class="pager-size">${pageSizes.map(s => `<option value="${s}" ${s === this.pageSize ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <span class="pager-total">${esc(t('共'))} ${total} ${esc(t('笔'))}</span>
        </div>
        <div class="pager-right">
          <button class="page-btn" data-page="${this.page - 1}" ${this.page <= 1 ? 'disabled' : ''}>${icon('chevronLeft', 14)}</button>
          ${pages.join('')}
          <button class="page-btn" data-page="${this.page + 1}" ${this.page >= totalPages ? 'disabled' : ''}>${icon('chevronRight', 14)}</button>
        </div>
      </div>`}
    `;

    this.bind();
  }

  bind() {
    const host = this.host;
    host.querySelectorAll('th[data-sort]').forEach(th => {
      if (!th.dataset.sort) return;
      th.addEventListener('click', () => {
        const f = th.dataset.sort;
        if (this.sort.field === f) this.sort.dir *= -1;
        else { this.sort.field = f; this.sort.dir = 1; }
        this.render();
      });
    });
    host.querySelectorAll('[data-filter]').forEach(inp => {
      inp.addEventListener('input', () => {
        this.filters[inp.dataset.filter] = inp.value;
        this.page = 1;
        this.render();
        const next = host.querySelector(`[data-filter="${CSS.escape(inp.dataset.filter)}"]`);
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
    });
    host.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.page);
        if (p >= 1 && p <= Math.ceil(this.filtered().length / this.pageSize)) {
          this.page = p;
          this.render();
        }
      });
    });
    const sizeSel = host.querySelector('.pager-size');
    if (sizeSel) sizeSel.addEventListener('change', () => this.setPageSize(Number(sizeSel.value)));
    host.querySelectorAll('.dg-row').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select, .no-row-click')) return;
        const key = tr.dataset.key;
        if (this.cfg.selectable === 'multi') {
          if (this.selected.has(key)) this.selected.delete(key);
          else this.selected.add(key);
          this.render();
        } else if (this.cfg.selectable === 'single') {
          this.selected.clear();
          this.selected.add(key);
          this.render();
          if (this.cfg.onRowClick) this.cfg.onRowClick(this.rows.find(r => this.keyOf(r) === key), e);
        } else if (this.cfg.onRowClick) {
          this.cfg.onRowClick(this.rows.find(r => this.keyOf(r) === key), e);
        }
      });
    });
    host.querySelectorAll('.grid-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const tr = e.target.closest('.dg-row');
        const key = tr.dataset.key;
        if (e.target.checked) this.selected.add(key);
        else this.selected.delete(key);
        this.render();
      });
    });
    const all = host.querySelector('.grid-check-all');
    if (all) {
      all.addEventListener('change', (e) => {
        const pageRows = this.filtered().slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
        pageRows.forEach(r => {
          if (e.target.checked) this.selected.add(this.keyOf(r));
          else this.selected.delete(this.keyOf(r));
        });
        this.render();
      });
    }
    host.querySelectorAll('.row-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = e.target.closest('.dg-row').dataset.key;
        if (this.expanded.has(key)) this.expanded.delete(key);
        else this.expanded.add(key);
        this.render();
      });
    });
  }
}

/* ------------------------------------------------------------------ misc */
export function statusChip(status) {
  const map = {
    Process: ['blue', '处理中'],
    Notifying: ['cyan', '等待通知'],
    Open: ['gray', 'Open'],
    Completed: ['green', '完成'],
    NoNextLevel: ['red', '失败'],
    Terminated: ['orange', '中断'],
    LogOnly: ['gray', '纯记录'],
    OK: ['green', 'OK'],
    Error: ['red', 'Error'],
    NG: ['orange', 'NG'],
    Close: ['gray', 'Close'],
    Unknown: ['gray', 'Unknown'],
    Success: ['green', '成功'],
    Fail: ['red', '失败'],
    Y: ['green', '启用'],
    N: ['gray', '停用']
  };
  const [tone, label] = map[status] || ['gray', status || '–'];
  return `<span class="status-chip chip-${tone}"><span class="dot"></span>${esc(t(label))}</span>`;
}

export function channelLabel(ch) {
  return t({ Email: '邮件', Sms: '短信', Phone: '语音', Voice: '语音', IM: '飞书' }[ch] || ch);
}

export function trxLabel(type) {
  const map = {
    Create: '警报建立', Modify: '警报发送', UserAck: '使用者确认',
    LevelUpgrade: '层级升级', AlarmComplete: '警报完成',
    AlarmFail: '警报失败', Terminate: '警报中断'
  };
  return t(map[type] || type);
}

export function actionLabel(action) {
  const map = { AddNew: '新增', Modify: '修改', Hide: '隐藏', Show: '取消隐藏', Import: '汇入' };
  return t(map[action] || action);
}

export function tabsHtml(items, active) {
  return `<div class="tabs">${items.map(item => `<button class="tab ${item.key === active ? 'active' : ''}" data-tab="${esc(item.key)}">${esc(t(item.label))}${item.count != null ? `<span class="tab-count">${item.count}</span>` : ''}</button>`).join('')}</div>`;
}

export function bindTabs(root, onChange) {
  root.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
      onChange(btn.dataset.tab);
    });
  });
}

export function toolbar(buttons) {
  return `<div class="toolbar">${buttons.filter(Boolean).map(b => `
    <button class="tool-btn ${b.kind ? 'tool-' + b.kind : ''}" data-action="${esc(b.action || '')}" ${b.disabled ? 'disabled' : ''} title="${esc(t(b.title || b.label || ''))}">
      ${b.icon ? icon(b.icon, 15) : ''}<span>${esc(t(b.label || ''))}</span>
    </button>`).join('')}</div>`;
}

export function bindToolbar(root, handler) {
  root.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handler(btn.dataset.action, btn));
  });
}

export function emptyState(text, iconName = 'info', sub = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName, 30)}</div><div class="empty-title">${esc(t(text))}</div>${sub ? `<div class="empty-sub">${esc(t(sub))}</div>` : ''}</div>`;
}

export function sectionCard(title, content, actions = '') {
  return `<section class="card">
    <div class="card-head"><h3>${esc(t(title))}</h3><div class="card-actions">${actions}</div></div>
    <div class="card-body">${content}</div>
  </section>`;
}

export function multiSelectHtml(name, options, selected = [], placeholder = '请选择') {
  return `<div class="multi-select" data-name="${esc(name)}">
    <div class="ms-control" tabindex="0">
      <div class="ms-tags"></div>
      <span class="ms-placeholder">${esc(t(placeholder))}</span>
      <span class="ms-caret">${icon('chevronDown', 14)}</span>
    </div>
    <div class="ms-menu">
      <div class="ms-search">${icon('search', 13)}<input type="text" placeholder="${esc(t('搜索'))}"/></div>
      <div class="ms-options">
        ${options.map(o => `<label class="ms-option"><input type="checkbox" value="${esc(o.value)}" ${selected.includes(o.value) ? 'checked' : ''}/><span class="ms-option-label">${esc(o.label)}</span><span class="ms-option-meta">${esc(o.code || '')}</span></label>`).join('')}
      </div>
      <div class="ms-foot"><button type="button" class="ms-all">${esc(t('全选'))}</button><button type="button" class="ms-clear">${esc(t('清除'))}</button></div>
    </div>
  </div>`;
}

export function bindMultiSelect(root) {
  const wrap = root && root.classList && root.classList.contains('multi-select')
    ? root
    : (root ? root.querySelector('.multi-select') : null);
  if (!wrap) return null;
  const control = wrap.querySelector('.ms-control');
  const tags = wrap.querySelector('.ms-tags');
  const placeholder = wrap.querySelector('.ms-placeholder');
  const menu = wrap.querySelector('.ms-menu');
  const search = wrap.querySelector('.ms-search input');
  const options = [...wrap.querySelectorAll('.ms-option input')];

  const selected = () => options.filter(o => o.checked);

  const renderTags = () => {
    const sel = selected();
    placeholder.style.display = sel.length ? 'none' : '';
    tags.innerHTML = sel.map(o => {
      const label = o.closest('.ms-option').querySelector('.ms-option-label').textContent;
      return `<span class="ms-tag">${esc(label)}<button type="button" data-value="${esc(o.value)}">${icon('close', 10)}</button></span>`;
    }).join('');
    tags.querySelectorAll('button[data-value]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = options.find(o => o.value === b.dataset.value);
        if (input) input.checked = false;
        renderTags();
      });
    });
  };
  control.addEventListener('click', () => {
    wrap.classList.toggle('open');
    if (wrap.classList.contains('open')) search.focus();
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  });
  options.forEach(o => o.addEventListener('change', renderTags));
  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    options.forEach(o => {
      const label = o.closest('.ms-option').textContent.toLowerCase();
      o.closest('.ms-option').style.display = label.includes(q) ? '' : 'none';
    });
  });
  wrap.querySelector('.ms-all').addEventListener('click', () => {
    options.forEach(o => { if (o.closest('.ms-option').style.display !== 'none') o.checked = true; });
    renderTags();
  });
  wrap.querySelector('.ms-clear').addEventListener('click', () => {
    options.forEach(o => { o.checked = false; });
    renderTags();
  });
  renderTags();
  return {
    get values() { return selected().map(o => o.value); },
    set values(vals) {
      options.forEach(o => { o.checked = vals.includes(o.value); });
      renderTags();
    }
  };
}

export function renderFileImport({ title, onVerify, onImport }) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="import-box">
      <div class="import-drop" id="import-drop">
        ${icon('upload', 28)}
        <div class="import-title">${esc(t('选择档案'))}</div>
        <div class="import-sub">${esc(t('支援 .xlsx'))}</div>
        <input type="file" accept=".xlsx,.xls" hidden/>
      </div>
      <div class="import-result"></div>
    </div>
  `;
  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  const verifyBtn = document.createElement('button');
  verifyBtn.className = 'btn btn-primary';
  verifyBtn.textContent = t('验证');
  verifyBtn.disabled = true;
  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-success';
  importBtn.textContent = t('汇入');
  importBtn.disabled = true;
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = t('取消');
  footer.append(cancelBtn, verifyBtn, importBtn);
  const modal = openModal({ title, width: 900, body, footer, className: 'modal-import' });
  cancelBtn.addEventListener('click', modal.close);
  const fileInput = body.querySelector('input[type=file]');
  const drop = body.querySelector('#import-drop');
  const resultBox = body.querySelector('.import-result');
  let file = null;
  let rows = [];
  const setFile = (f) => {
    if (!f) return;
    file = f;
    drop.classList.add('has-file');
    drop.querySelector('.import-title').textContent = f.name;
    verifyBtn.disabled = false;
    importBtn.disabled = true;
  };
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    setFile(e.dataTransfer.files[0]);
  });
  verifyBtn.addEventListener('click', async () => {
    if (!file) return;
    verifyBtn.disabled = true;
    verifyBtn.textContent = t('读取中');
    try {
      rows = await onVerify(file);
      resultBox.innerHTML = renderVerifyRows(rows);
      importBtn.disabled = !rows.some(r => r.valid);
      const all = resultBox.querySelector('#verify-all');
      const checks = [...resultBox.querySelectorAll('.verify-check')];
      if (all) {
        all.addEventListener('change', () => {
          checks.forEach(c => { if (!c.disabled) c.checked = all.checked; });
        });
      }
      resultBox.querySelectorAll('.verify-check').forEach(c => {
        c.addEventListener('change', () => {
          importBtn.disabled = ![...resultBox.querySelectorAll('.verify-check')].some(x => x.checked);
        });
      });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = t('验证');
    }
  });
  importBtn.addEventListener('click', async () => {
    const selected = [...resultBox.querySelectorAll('.verify-check')].filter(c => c.checked).map(c => Number(c.dataset.row));
    const toImport = rows.filter(r => selected.includes(r.rowNo));
    if (!toImport.length) return;
    importBtn.disabled = true;
    try {
      await onImport(toImport);
      modal.close();
    } catch (err) {
      toast(err.message, 'error');
      importBtn.disabled = false;
    }
  });
  return modal;
}

function renderVerifyRows(rows) {
  const valid = rows.filter(r => r.valid).length;
  return `<div class="verify-summary">${esc(t('汇入验证完成'))}：${valid} ${esc(t('笔有效'))} / ${rows.length - valid} ${esc(t('笔错误'))}</div>
    <div class="verify-table-wrap"><table class="verify-table">
      <thead><tr><th><input type="checkbox" id="verify-all"/></th><th>#</th><th>${esc(t('可汇入'))}</th><th>${esc(t('错误讯息'))}</th><th>${esc(t('资料'))}</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><input type="checkbox" class="verify-check" data-row="${r.rowNo}" ${r.valid ? '' : 'disabled'}/></td>
        <td>${r.rowNo}</td>
        <td>${r.valid ? `<span class="badge badge-green">${esc(t('可汇入'))}</span>` : `<span class="badge badge-red">${esc(t('错误'))}</span>`}</td>
        <td class="verify-error">${esc(r.error || '')}</td>
        <td class="verify-preview">${esc((r.display || []).filter(d => d.value !== '' && d.value != null).slice(0, 5).map(d => `${d.label}: ${d.value}`).join('  |  '))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

export function downloadBlob(filename, base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ------------------------------------------------------------------ Drawer */
let currentDrawer = null;
export function openDrawer({ title, subtitle = '', body = '', footer = '', width = 720, onMount, onClose, small = false }) {
  if (currentDrawer) currentDrawer.close(true);
  const root = document.getElementById('drawer-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  const drawer = document.createElement('div');
  drawer.className = 'drawer' + (small ? ' small' : '');
  drawer.style.width = typeof width === 'number' ? width + 'px' : width;
  drawer.innerHTML = `
    <div class="drawer-head">
      <div>
        <div class="drawer-title">${esc(title || '')}</div>
        ${subtitle ? `<div class="drawer-sub">${esc(subtitle)}</div>` : ''}
      </div>
      <button class="modal-close" aria-label="close">${icon('close', 18)}</button>
    </div>
    <div class="drawer-body"></div>
    ${footer ? '<div class="drawer-foot"></div>' : ''}
  `;
  const bodyEl = drawer.querySelector('.drawer-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);
  if (footer) {
    const foot = drawer.querySelector('.drawer-foot');
    if (typeof footer === 'string') foot.innerHTML = footer;
    else foot.appendChild(footer);
  }
  root.append(backdrop, drawer);
  document.body.classList.add('drawer-open');
  let closed = false;
  const close = (immediate = false) => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('show');
    drawer.classList.remove('show');
    setTimeout(() => { backdrop.remove(); drawer.remove(); }, immediate ? 0 : 220);
    if (currentDrawer && currentDrawer.drawer === drawer) {
      currentDrawer = null;
      document.body.classList.remove('drawer-open');
    }
    if (onClose) onClose();
  };
  const api = { drawer, body: bodyEl, close };
  currentDrawer = api;
  backdrop.addEventListener('click', () => close());
  drawer.querySelector('.modal-close').addEventListener('click', () => close());
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    drawer.classList.add('show');
  });
  if (onMount) onMount(drawer, close, bodyEl);
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentDrawer) {
    currentDrawer.close();
    e.stopPropagation();
  }
}, true);

export function closeAllOverlays() {
  modalStack.slice().reverse().forEach(m => { try { m.close(); } catch (e) { /* ignore */ } });
  if (currentDrawer) {
    try { currentDrawer.close(true); } catch (e) { /* ignore */ }
  }
}

