'use strict';

const { getDb, save, nextKey, addHistory, hashPassword, nowIso } = require('./db');
const { MASTERS, MAPPINGS, MASTER_DETAILS } = require('./metadata');

const KEY_FORMATS = {
  users: ['U', 3],
  user_groups: ['UG', 2],
  factories: ['F', 2],
  eqps: ['EQP', 2],
  eqp_groups: ['G', 2],
  eqp_types: ['T', 2],
  eqp_status: ['ST', 2],
  subsystems: ['SS', 2],
  alarm_settings: ['AS', 2],
  events: ['EVT', 2],
  event_groups: ['EG', 2],
  alarm_conditions: ['COND', 2],
  devices: ['D', 3],
  brm_defs: ['BRM', 3],
  report_defs: ['RPT', 2],
  auto_status_rules: ['AUTO', 2],
  user_group_users: ['UGU', 3],
  eqp_group_eqp: ['GE', 3],
  eqp_type_status: ['TS', 3],
  chamber_alarm: ['CA', 3],
  factory_subsys: ['FS', 3],
  event_levels: ['LV', 4],
  event_group_users: ['EGU', 3],
  repos: ['RP', 2]
};

function newKeyFor(table) {
  const [prefix, width] = KEY_FORMATS[table] || ['K', 4];
  return nextKey(table, prefix, width);
}

function sanitize(row) {
  if (!row) return row;
  if (Object.prototype.hasOwnProperty.call(row, 'PASSWORD_HASH')) {
    const { PASSWORD_HASH, ...rest } = row;
    return rest;
  }
  return row;
}

function fieldValues(meta, body) {
  const values = {};
  meta.fields.forEach(field => {
    if (field.readOnly) return;
    if (!Object.prototype.hasOwnProperty.call(body, field.name)) return;
    let v = body[field.name];
    if (field.type === 'number') {
      if (v === '' || v == null) v = null;
      else if (!Number.isNaN(Number(v))) v = Number(v);
    } else if (field.type === 'checkbox') {
      v = (v === true || v === 'Y' || v === 'true' || v === 1) ? 'Y' : 'N';
    } else if (typeof v === 'string') {
      v = v.trim();
    }
    values[field.name] = v;
  });
  return values;
}

function validate(meta, values, existing) {
  const errors = [];
  meta.fields.forEach(field => {
    if (!field.required) return;
    const v = values[field.name];
    if (v == null || v === '') errors.push(`${field.label} 为必填`);
  });
  const db = getDb();
  const rows = db[meta.table] || [];
  (meta.uniqueFields || []).forEach(field => {
    const v = values[field];
    if (v == null || v === '') return;
    const dup = rows.find(r => r[field] === v && (!existing || r[meta.keyField] !== existing[meta.keyField]));
    if (dup) errors.push(`${meta.fields.find(f => f.name === field)?.label || field}「${v}」已存在`);
  });
  (meta.uniqueComposite || []).forEach(fields => {
    const dup = rows.find(r => r[meta.keyField] !== (existing && existing[meta.keyField])
      && fields.every(f => String(r[f] == null ? '' : r[f]) === String(values[f] == null ? '' : values[f])));
    if (dup && fields.some(f => values[f])) {
      errors.push(`四要素组合已存在（${fields.map(f => values[f]).join(' / ')}）`);
    }
  });
  if (meta.code === 'AVMA009' && values.EVENT_KEY) {
    const ev = db.events.find(e => e.EVENT_KEY === values.EVENT_KEY);
    if (ev && (ev.FACTORY_KEY !== values.FACTORY_KEY || ev.SUB_SYS_KEY !== values.SUB_SYS_KEY)) {
      errors.push('通知事件不属于所选厂别／子系统');
    }
  }
  return errors;
}

function listMaster(code, query, user) {
  const meta = MASTERS[code];
  if (!meta) return null;
  const db = getDb();
  let rows = (db[meta.table] || []).slice();
  if (query.showHidden !== '1') rows = rows.filter(r => r.ACTIVE !== 'N');
  let filters = {};
  try { filters = query.filters ? JSON.parse(query.filters) : {}; } catch (e) { filters = {}; }
  Object.entries(filters).forEach(([field, value]) => {
    if (value == null || value === '') return;
    const needle = String(value).toLowerCase();
    rows = rows.filter(r => String(r[field] == null ? '' : r[field]).toLowerCase().includes(needle));
  });
  if (query.q) {
    const q = String(query.q).toLowerCase();
    rows = rows.filter(r => meta.fields.some(f => String(r[f.name] == null ? '' : r[f.name]).toLowerCase().includes(q)));
  }
  rows.sort((a, b) => {
    const da = new Date(a.MTR_DATE || 0).getTime();
    const dbt = new Date(b.MTR_DATE || 0).getTime();
    if (da !== dbt) return dbt - da;
    return String(a[meta.idField] || '').localeCompare(String(b[meta.idField] || ''));
  });
  return { meta, rows: rows.map(sanitize), total: rows.length };
}

function createMaster(code, body, user) {
  const meta = MASTERS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const values = fieldValues(meta, body);
  const password = values.PASSWORD;
  delete values.PASSWORD;
  const errors = validate(meta, values, null);
  if (errors.length) return { ok: false, status: 400, message: errors.join('；') };
  const row = { ...values };
  row[meta.keyField] = newKeyFor(meta.table);
  row.ACTIVE = 'Y';
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = user.USER_KEY;
  row.MTR_USER_NAME = user.USER_NAME;
  if (meta.table === 'users') {
    row.PASSWORD_HASH = hashPassword(password || '123456');
  }
  db[meta.table].unshift(row);
  addHistory({
    table: meta.table, recordKey: row[meta.keyField],
    label: row[meta.idField], action: 'AddNew', active: 'Y',
    after: sanitize(row), user
  });
  save();
  return { ok: true, row: sanitize(row) };
}

function updateMaster(code, key, body, user) {
  const meta = MASTERS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const row = db[meta.table].find(r => r[meta.keyField] === key);
  if (!row) return { ok: false, status: 404, message: '资料不存在' };
  const values = fieldValues(meta, body);
  const password = values.PASSWORD;
  delete values.PASSWORD;
  meta.fields.forEach(field => {
    if (field.readOnlyOnEdit) delete values[field.name];
  });
  const merged = { ...row, ...values };
  const errors = validate(meta, merged, row);
  if (errors.length) return { ok: false, status: 400, message: errors.join('；') };
  const before = sanitize(row);
  Object.assign(row, values);
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = user.USER_KEY;
  row.MTR_USER_NAME = user.USER_NAME;
  if (meta.table === 'users' && password) {
    row.PASSWORD_HASH = hashPassword(password);
  }
  addHistory({
    table: meta.table, recordKey: key, label: row[meta.idField],
    action: 'Modify', active: row.ACTIVE, before, after: sanitize(row), user
  });
  save();
  return { ok: true, row: sanitize(row) };
}

function setActive(code, key, active, user) {
  const meta = MASTERS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const row = db[meta.table].find(r => r[meta.keyField] === key);
  if (!row) return { ok: false, status: 404, message: '资料不存在' };
  const before = { ACTIVE: row.ACTIVE };
  row.ACTIVE = active;
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = user.USER_KEY;
  row.MTR_USER_NAME = user.USER_NAME;
  addHistory({
    table: meta.table, recordKey: key, label: row[meta.idField],
    action: active === 'Y' ? 'Show' : 'Hide', active, before,
    after: { ACTIVE: active }, user
  });
  save();
  return { ok: true, row: sanitize(row) };
}

function historyFor(table, recordKey) {
  const db = getDb();
  let rows = db.history.filter(h => h.TABLE_NAME === table);
  if (recordKey) rows = rows.filter(h => h.RECORD_KEY === recordKey);
  return rows.slice(0, 300);
}

/* ------------------------------------------------------------------ Mapping */
function listMapping(code, user) {
  const meta = MAPPINGS[code];
  if (!meta) return null;
  const db = getDb();
  const masters = (db[meta.master.table] || []).filter(x => x.ACTIVE !== 'N');
  const items = (db[meta.item.table] || []).filter(x => x.ACTIVE !== 'N');
  const mapRows = (db[meta.mapTable] || []).slice();
  return { meta, masters, items, mapRows };
}

function saveMapping(code, masterKey, itemKeys, user) {
  const meta = MAPPINGS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const master = db[meta.master.table].find(x => x[meta.master.key] === masterKey);
  if (!master) return { ok: false, status: 400, message: '主档不存在' };
  const validItems = db[meta.item.table].filter(x => itemKeys.includes(x[meta.item.key]));
  const beforeKeys = db[meta.mapTable].filter(x => x[meta.mapMasterFk] === masterKey).map(x => x[meta.mapItemFk]);
  db[meta.mapTable] = db[meta.mapTable].filter(x => x[meta.mapMasterFk] !== masterKey);
  validItems.forEach(item => {
    const row = {};
    row.MAP_KEY = newKeyFor(meta.mapTable);
    row[meta.mapMasterFk] = masterKey;
    row[meta.mapItemFk] = item[meta.item.key];
    db[meta.mapTable].push(row);
  });
  const label = master[meta.master.display[0]] || masterKey;
  addHistory({
    table: meta.mapTable, recordKey: masterKey, label,
    action: 'Modify', active: 'Y',
    before: { items: beforeKeys }, after: { items: validItems.map(x => x[meta.item.key]) }, user
  });
  save();
  return { ok: true, count: validItems.length };
}

/* ------------------------------------------------------------- MasterDetail */
function listMasterDetail(code, query) {
  const meta = MASTER_DETAILS[code];
  if (!meta) return null;
  const db = getDb();
  let masters = (db[meta.masterTable] || []).slice();
  if (query.showHidden !== '1') masters = masters.filter(x => x.ACTIVE !== 'N');
  let filters = {};
  try { filters = query.filters ? JSON.parse(query.filters) : {}; } catch (e) { filters = {}; }
  Object.entries(filters).forEach(([field, value]) => {
    if (value == null || value === '') return;
    const needle = String(value).toLowerCase();
    masters = masters.filter(r => String(r[field] == null ? '' : r[field]).toLowerCase().includes(needle));
  });
  masters.sort((a, b) => new Date(b.MTR_DATE || 0) - new Date(a.MTR_DATE || 0));
  const details = (db[meta.detail.table] || []).filter(d =>
    masters.some(m => m[meta.masterKey] === d[meta.detail.fk]));
  return { meta, masters, details };
}

function validateMasterDetail(meta, values, existing) {
  const db = getDb();
  const errors = [];
  meta.fields.forEach(f => {
    if (f.required && (values[f.name] == null || values[f.name] === '')) errors.push(`${f.label} 为必填`);
  });
  (meta.masterUnique || []).forEach(fields => {
    const dup = db[meta.masterTable].find(r =>
      r[meta.masterKey] !== (existing && existing[meta.masterKey])
      && fields.every(f => String(r[f] == null ? '' : r[f]) === String(values[f] == null ? '' : values[f])));
    if (dup) errors.push(`唯一键组合已存在（${fields.map(f => values[f]).join(' / ')}）`);
  });
  return errors;
}

function saveMasterDetail(code, body, user) {
  const meta = MASTER_DETAILS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const values = fieldValues(meta, body);
  let row = body[meta.masterKey] ? db[meta.masterTable].find(r => r[meta.masterKey] === body[meta.masterKey]) : null;
  const isNew = !row;
  if (isNew) {
    row = {};
    row[meta.masterKey] = newKeyFor(meta.masterTable);
    row.ACTIVE = 'Y';
  }
  const merged = { ...row, ...values };
  const errors = validateMasterDetail(meta, merged, isNew ? null : row);
  if (errors.length) return { ok: false, status: 400, message: errors.join('；') };
  const before = isNew ? null : { ...row };
  Object.assign(row, values);
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = user.USER_KEY;
  row.MTR_USER_NAME = user.USER_NAME;
  if (isNew) db[meta.masterTable].unshift(row);

  const detailTable = meta.detail.table;
  db[detailTable] = db[detailTable].filter(d => d[meta.detail.fk] !== row[meta.masterKey]);

  if (meta.detail.mode === 'grid') {
    const details = Array.isArray(body.details) ? body.details : [];
    if (code === 'AVMA007') {
      const ids = details.map(d => Number(d.EVENT_LEVEL_ID)).sort((a, b) => a - b);
      for (let i = 0; i < ids.length; i += 1) {
        if (ids[i] !== i + 1) {
          return { ok: false, status: 400, message: '事件层级代码必须从 1 开始连续设定' };
        }
      }
    }
    details.forEach(d => {
      const detail = {};
      meta.detail.fields.forEach(f => {
        let v = d[f.name];
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
        if (f.type === 'checkbox') v = (v === true || v === 'Y') ? 'Y' : 'N';
        detail[f.name] = v;
      });
      detail[meta.detail.key] = d[meta.detail.key] || newKeyFor(detailTable);
      detail[meta.detail.fk] = row[meta.masterKey];
      detail.ACTIVE = 'Y';
      db[detailTable].push(detail);
    });
  } else if (meta.detail.mode === 'transfer') {
    const keys = Array.isArray(body.detailKeys) ? body.detailKeys : [];
    const itemTable = meta.detail.itemTable;
    const itemKey = meta.detail.itemKey;
    db[detailTable] = db[detailTable].filter(d => d[meta.detail.fk] !== row[meta.masterKey]);
    keys.filter(k => db[itemTable].some(x => x[itemKey] === k)).forEach(k => {
      db[detailTable].push({
        MAP_KEY: newKeyFor(detailTable),
        [meta.detail.fk]: row[meta.masterKey],
        [itemKey]: k
      });
    });
  }
  addHistory({
    table: meta.masterTable, recordKey: row[meta.masterKey], label: row[meta.masterId],
    action: isNew ? 'AddNew' : 'Modify', active: row.ACTIVE,
    before, after: { ...row, DETAIL_COUNT: (db[detailTable].filter(d => d[meta.detail.fk] === row[meta.masterKey]).length) },
    user
  });
  save();
  return { ok: true, masterKey: row[meta.masterKey] };
}

function setMasterDetailActive(code, key, active, user) {
  const meta = MASTER_DETAILS[code];
  if (!meta) return { ok: false, status: 404, message: '页面不存在' };
  const db = getDb();
  const row = db[meta.masterTable].find(r => r[meta.masterKey] === key);
  if (!row) return { ok: false, status: 404, message: '资料不存在' };
  row.ACTIVE = active;
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = user.USER_KEY;
  row.MTR_USER_NAME = user.USER_NAME;
  addHistory({
    table: meta.masterTable, recordKey: key, label: row[meta.masterId],
    action: active === 'Y' ? 'Show' : 'Hide', active,
    before: { ACTIVE: active === 'Y' ? 'N' : 'Y' }, after: { ACTIVE: active }, user
  });
  save();
  return { ok: true };
}

module.exports = {
  newKeyFor,
  sanitize,
  listMaster,
  createMaster,
  updateMaster,
  setActive,
  historyFor,
  listMapping,
  saveMapping,
  listMasterDetail,
  saveMasterDetail,
  setMasterDetailActive,
  fieldValues,
  validate
};
