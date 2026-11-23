'use strict';

const express = require('express');
const { getDb, save, nextKey, addHistory, nowIso } = require('./db');
const { login, logout, authMiddleware } = require('./auth');
const { buildOptions } = require('./options');
const {
  MASTERS, MAPPINGS, MASTER_DETAILS, PAGE_TITLES
} = require('./metadata');
const ms = require('./master-service');
const engine = require('./alarm-engine');
const reports = require('./reports');
const excel = require('./excel');

const router = express.Router();

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/* ------------------------------------------------------------------ 登入 */
router.post('/login', wrap((req, res) => {
  const { userId, password } = req.body || {};
  const result = login(userId, password, req);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
}));

router.use(authMiddleware);

router.get('/me', (req, res) => {
  res.json({
    ok: true,
    user: req.user,
    loginAt: req.session.loginAt,
    settings: getDb().settings,
    serverTime: nowIso()
  });
});

router.post('/logout', (req, res) => {
  logout(req.token);
  res.json({ ok: true });
});

/* --------------------------------------------------------------- 初始化 */
function buildNav() {
  const db = getDb();
  const fns = db.functions.filter(f => f.ACTIVE !== 'N' && f.VISIBLE !== 'N');
  const make = (parent) => fns
    .filter(f => (f.PARENT_KEY || null) === parent)
    .sort((a, b) => (a.SORT || 0) - (b.SORT || 0))
    .map(f => ({
      key: f.FUNCTION_KEY, id: f.FUNCTION_ID, name: f.FUNCTION_NAME,
      type: f.FUNC_TYPE, path: f.PATH, children: make(f.FUNCTION_KEY)
    }));
  return make(null);
}

router.get('/bootstrap', (req, res) => {
  const db = getDb();
  res.json({
    ok: true,
    user: req.user,
    loginAt: req.session.loginAt,
    nav: buildNav(),
    options: buildOptions(),
    meta: {
      masters: MASTERS,
      mappings: MAPPINGS,
      masterDetails: MASTER_DETAILS,
      pageTitles: PAGE_TITLES
    },
    settings: db.settings,
    serverTime: nowIso()
  });
});

router.get('/nav', (req, res) => res.json({ ok: true, nav: buildNav() }));

router.get('/options', (req, res) => res.json({ ok: true, options: buildOptions() }));

/* ------------------------------------------------------------------ 主档 */
router.get('/master/:code', (req, res) => {
  const result = ms.listMaster(req.params.code, req.query, req.user);
  if (!result) return res.status(404).json({ ok: false, message: '页面不存在' });
  const history = ms.historyFor(result.meta.table);
  res.json({ ok: true, ...result, history });
});

router.post('/master/:code', (req, res) => {
  const result = ms.createMaster(req.params.code, req.body || {}, req.user);
  res.status(result.status || (result.ok ? 200 : 400)).json(result);
});

router.put('/master/:code/:key', (req, res) => {
  const result = ms.updateMaster(req.params.code, req.params.key, req.body || {}, req.user);
  res.status(result.status || (result.ok ? 200 : 400)).json(result);
});

router.post('/master/:code/:key/hide', (req, res) => {
  const result = ms.setActive(req.params.code, req.params.key, 'N', req.user);
  res.status(result.status || 200).json(result);
});

router.post('/master/:code/:key/show', (req, res) => {
  const result = ms.setActive(req.params.code, req.params.key, 'Y', req.user);
  res.status(result.status || 200).json(result);
});

router.get('/master/:code/history', (req, res) => {
  const meta = MASTERS[req.params.code];
  if (!meta) return res.status(404).json({ ok: false, message: '页面不存在' });
  res.json({ ok: true, rows: ms.historyFor(meta.table, req.query.key) });
});

router.post('/master/:code/export', wrap(async (req, res) => {
  const { mode } = req.body || {};
  const out = await excel.masterWorkbook(req.params.code, mode === 'template' ? 'template' : 'data');
  res.json({ ok: true, filename: out.filename, base64: Buffer.from(out.buffer).toString('base64') });
}));

router.post('/master/:code/import/verify', wrap(async (req, res) => {
  const result = await excel.verifyMasterImport(req.params.code, req.body.base64);
  res.json({ ok: true, meta: result.meta, rows: result.rows });
}));

router.post('/master/:code/import', (req, res) => {
  const { rows = [] } = req.body || {};
  let success = 0;
  const errors = [];
  rows.forEach(r => {
    if (!r.valid) return;
    const result = ms.createMaster(req.params.code, r.values, req.user);
    if (result.ok) success += 1;
    else errors.push(`第 ${r.rowNo} 列：${result.message}`);
  });
  res.json({ ok: true, success, errors });
});

/* ---------------------------------------------------------------- Mapping */
router.get('/mapping/:code', (req, res) => {
  const result = ms.listMapping(req.params.code, req.user);
  if (!result) return res.status(404).json({ ok: false, message: '页面不存在' });
  res.json({ ok: true, ...result, history: ms.historyFor(result.meta.mapTable) });
});

router.post('/mapping/:code/export', wrap(async (req, res) => {
  const out = await excel.mappingWorkbook(req.params.code, req.body.mode === 'template' ? 'template' : 'data');
  res.json({ ok: true, filename: out.filename, base64: Buffer.from(out.buffer).toString('base64') });
}));

router.post('/mapping/:code/import/verify', wrap(async (req, res) => {
  const result = await excel.verifyMappingImport(req.params.code, req.body.base64);
  res.json({ ok: true, meta: result.meta, rows: result.rows });
}));

router.post('/mapping/:code/import', (req, res) => {
  const meta = MAPPINGS[req.params.code];
  if (!meta) return res.status(404).json({ ok: false, message: '页面不存在' });
  const db = getDb();
  let success = 0;
  (req.body.rows || []).forEach(r => {
    if (!r.valid || !r.masterKey || !r.itemKey) return;
    const exists = db[meta.mapTable].some(x => x[meta.mapMasterFk] === r.masterKey && x[meta.mapItemFk] === r.itemKey);
    if (exists) return;
    const row = {};
    row.MAP_KEY = ms.newKeyFor(meta.mapTable);
    row[meta.mapMasterFk] = r.masterKey;
    row[meta.mapItemFk] = r.itemKey;
    db[meta.mapTable].push(row);
    success += 1;
  });
  addHistory({ table: meta.mapTable, recordKey: '*', label: '批次汇入', action: 'Import', active: 'Y', user: req.user });
  save();
  res.json({ ok: true, success });
});

router.post('/mapping/:code/:masterKey', (req, res) => {
  const result = ms.saveMapping(req.params.code, req.params.masterKey, req.body.itemKeys || [], req.user);
  res.status(result.status || (result.ok ? 200 : 400)).json(result);
});

/* ----------------------------------------------------------- MasterDetail */
router.get('/masterdetail/:code', (req, res) => {
  const result = ms.listMasterDetail(req.params.code, req.query);
  if (!result) return res.status(404).json({ ok: false, message: '页面不存在' });
  res.json({ ok: true, ...result, history: ms.historyFor(result.meta.masterTable) });
});

router.post('/masterdetail/:code', (req, res) => {
  const result = ms.saveMasterDetail(req.params.code, req.body || {}, req.user);
  res.status(result.status || (result.ok ? 200 : 400)).json(result);
});

router.post('/masterdetail/:code/:key/hide', (req, res) => {
  const result = ms.setMasterDetailActive(req.params.code, req.params.key, 'N', req.user);
  res.status(result.status || 200).json(result);
});

router.post('/masterdetail/:code/:key/show', (req, res) => {
  const result = ms.setMasterDetailActive(req.params.code, req.params.key, 'Y', req.user);
  res.status(result.status || 200).json(result);
});

router.get('/masterdetail/:code/history', (req, res) => {
  const meta = MASTER_DETAILS[req.params.code];
  if (!meta) return res.status(404).json({ ok: false, message: '页面不存在' });
  res.json({ ok: true, rows: ms.historyFor(meta.masterTable, req.query.key) });
});

/* ------------------------------------------------------------ 事件层级树 */
router.get('/event-tree', (req, res) => {
  const db = getDb();
  const factoryKey = req.query.factory;
  const subsysKey = req.query.subsys;
  if (!factoryKey || !subsysKey) return res.status(400).json({ ok: false, message: '请选择厂别与子系统' });
  const events = db.events.filter(e => e.FACTORY_KEY === factoryKey && e.SUB_SYS_KEY === subsysKey && e.ACTIVE !== 'N');
  const tree = events.map(e => {
    const levels = db.event_levels.filter(l => l.EVENT_KEY === e.EVENT_KEY && l.ACTIVE !== 'N')
      .sort((a, b) => a.EVENT_LEVEL_ID - b.EVENT_LEVEL_ID)
      .map(l => ({
        ...l,
        GROUPS: db.event_level_groups.filter(g => g.EVENT_LEVEL_KEY === l.EVENT_LEVEL_KEY)
          .sort((a, b) => (a.GROUP_SEQ || 0) - (b.GROUP_SEQ || 0))
          .map(g => {
            const group = db.event_groups.find(x => x.EVENT_GROUP_KEY === g.EVENT_GROUP_KEY);
            const members = db.event_group_users.filter(x => x.EVENT_GROUP_KEY === g.EVENT_GROUP_KEY);
            return {
              ...g,
              EVENT_GROUP_ID: group ? group.EVENT_GROUP_ID : '',
              EVENT_GROUP_NAME: group ? group.EVENT_GROUP_NAME : '',
              MEMBER_COUNT: members.length
            };
          })
      }));
    return { ...e, LEVELS: levels };
  });
  res.json({
    ok: true,
    tree,
    groups: buildOptions().groupByFactorySubsys[factoryKey + '||' + subsysKey] || [],
    channels: buildOptions().sendChannel,
    imGroupTypes: buildOptions().imGroupType
  });
});

router.post('/event-tree/save', (req, res) => {
  const db = getDb();
  const { factoryKey, subsysKey, levels = [] } = req.body || {};
  if (!factoryKey || !subsysKey) return res.status(400).json({ ok: false, message: '缺少厂别或子系统' });
  const eventKeys = db.events.filter(e => e.FACTORY_KEY === factoryKey && e.SUB_SYS_KEY === subsysKey).map(e => e.EVENT_KEY);
  const levelKeys = db.event_levels.filter(l => eventKeys.includes(l.EVENT_KEY)).map(l => l.EVENT_LEVEL_KEY);
  db.event_level_groups = db.event_level_groups.filter(g => !levelKeys.includes(g.EVENT_LEVEL_KEY));
  levels.forEach(l => {
    if (!levelKeys.includes(l.levelKey)) return;
    (l.groups || []).forEach((g, idx) => {
      if (!g.groupKey) return;
      db.event_level_groups.push({
        ELG_KEY: nextKey('event_level_groups', 'ELG', 3),
        EVENT_LEVEL_KEY: l.levelKey,
        EVENT_GROUP_KEY: g.groupKey,
        ENABLE_SEND_DEVICES: Array.isArray(g.devices) ? g.devices.join(';') : (g.devices || ''),
        E_IM_GROUP_TYPE: g.imType || '',
        GROUP_SEQ: idx + 1,
        ACTIVE: 'Y'
      });
    });
  });
  addHistory({ table: 'event_level_groups', recordKey: factoryKey + '||' + subsysKey, label: '事件层级群组对应', action: 'Modify', user: req.user });
  save();
  res.json({ ok: true });
});

/* --------------------------------------------------------------- 功能选单 */
router.get('/functions', (req, res) => {
  const db = getDb();
  res.json({ ok: true, rows: db.functions.slice().sort((a, b) => (a.SORT || 0) - (b.SORT || 0)) });
});

router.post('/functions', (req, res) => {
  const db = getDb();
  const nodes = req.body.nodes;
  if (!Array.isArray(nodes)) return res.status(400).json({ ok: false, message: '资料格式错误' });
  const ids = new Set();
  const keyMap = {};
  nodes.forEach(n => {
    if (n.FUNCTION_KEY) keyMap[n.FUNCTION_KEY] = n.FUNCTION_KEY;
  });
  const out = [];
  for (const n of nodes) {
    const id = String(n.FUNCTION_ID || '').trim();
    if (!id) return res.status(400).json({ ok: false, message: '功能代码不可为空' });
    if (ids.has(id)) return res.status(400).json({ ok: false, message: `功能代码重复：${id}` });
    ids.add(id);
    const key = n.FUNCTION_KEY || nextKey('functions', 'FN', 3);
    out.push({
      FUNCTION_KEY: key,
      FUNCTION_ID: id,
      FUNCTION_NAME: n.FUNCTION_NAME || id,
      PARENT_KEY: n.PARENT_KEY || null,
      FUNC_TYPE: n.FUNC_TYPE || 'PAGE',
      PATH: n.PATH || null,
      SORT: Number(n.SORT) || 0,
      VISIBLE: n.VISIBLE || 'Y',
      LOAD_VISIBLE: n.LOAD_VISIBLE || 'Y',
      OBJ_NAME: n.OBJ_NAME || '',
      HYPERLINK: n.HYPERLINK || '',
      ACTIONS_JSON: typeof n.ACTIONS_JSON === 'string' ? n.ACTIONS_JSON : JSON.stringify(n.ACTIONS || []),
      PROPERTIES_JSON: typeof n.PROPERTIES_JSON === 'string' ? n.PROPERTIES_JSON : JSON.stringify(n.PROPERTIES || {}),
      ACTIVE: n.ACTIVE || 'Y'
    });
  }
  db.functions = out;
  addHistory({ table: 'functions', recordKey: '*', label: '系统功能选单', action: 'Modify', user: req.user });
  save();
  res.json({ ok: true, nav: buildNav() });
});

/* --------------------------------------------------------------- BRM 定义 */
router.get('/brm-defs', (req, res) => {
  const db = getDb();
  const type = req.query.type;
  let rows = db.brm_defs.slice();
  if (type) rows = rows.filter(r => r.BRM_TYPE === type);
  if (req.query.showHidden !== '1') rows = rows.filter(r => r.ACTIVE !== 'N');
  res.json({ ok: true, rows, history: ms.historyFor('brm_defs') });
});

router.post('/brm-defs', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.BRM_ID) return res.status(400).json({ ok: false, message: '主档代码为必填' });
  const dup = db.brm_defs.find(r => r.BRM_ID === body.BRM_ID && r.BRM_KEY !== body.BRM_KEY);
  if (dup) return res.status(400).json({ ok: false, message: '主档代码已存在' });
  if (body.BRM_KEY) {
    const row = db.brm_defs.find(r => r.BRM_KEY === body.BRM_KEY);
    if (!row) return res.status(404).json({ ok: false, message: '定义不存在' });
    const before = { ...row };
    Object.assign(row, body, { MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME });
    addHistory({ table: 'brm_defs', recordKey: row.BRM_KEY, label: row.BRM_ID, action: 'Modify', active: row.ACTIVE, before, after: row, user: req.user });
    save();
    return res.json({ ok: true, row });
  }
  const row = {
    ...body, BRM_KEY: nextKey('brm_defs', 'BRM', 3), ACTIVE: 'Y',
    MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME
  };
  db.brm_defs.unshift(row);
  addHistory({ table: 'brm_defs', recordKey: row.BRM_KEY, label: row.BRM_ID, action: 'AddNew', active: 'Y', user: req.user });
  save();
  res.json({ ok: true, row });
});

router.post('/brm-defs/:key/:action', (req, res) => {
  const db = getDb();
  const row = db.brm_defs.find(r => r.BRM_KEY === req.params.key);
  if (!row) return res.status(404).json({ ok: false, message: '定义不存在' });
  const active = req.params.action === 'show' ? 'Y' : 'N';
  row.ACTIVE = active;
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = req.user.USER_KEY;
  row.MTR_USER_NAME = req.user.USER_NAME;
  addHistory({ table: 'brm_defs', recordKey: row.BRM_KEY, label: row.BRM_ID, action: active === 'Y' ? 'Show' : 'Hide', active, user: req.user });
  save();
  res.json({ ok: true });
});

/* ------------------------------------------------------------- 批次状态设定 */
router.get('/batch-defs', (req, res) => {
  const db = getDb();
  res.json({ ok: true, rows: db.batch_defs, history: ms.historyFor('batch_defs') });
});

router.post('/batch-defs', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.BATCH_ID || !body.BATCH_NAME) return res.status(400).json({ ok: false, message: '代码与名称为必填' });
  const dup = db.batch_defs.find(r => r.BATCH_ID === body.BATCH_ID && r.BATCH_KEY !== body.BATCH_KEY);
  if (dup) return res.status(400).json({ ok: false, message: '批次状态变更代码已存在' });
  if (body.BATCH_KEY) {
    const row = db.batch_defs.find(r => r.BATCH_KEY === body.BATCH_KEY);
    if (!row) return res.status(404).json({ ok: false, message: '定义不存在' });
    const before = { ...row };
    Object.assign(row, body, { MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME });
    addHistory({ table: 'batch_defs', recordKey: row.BATCH_KEY, label: row.BATCH_ID, action: 'Modify', before, after: row, user: req.user });
    save();
    return res.json({ ok: true, row });
  }
  const row = {
    ...body, BATCH_KEY: nextKey('batch_defs', 'BAT', 2), ACTIVE: 'Y',
    MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME
  };
  db.batch_defs.unshift(row);
  addHistory({ table: 'batch_defs', recordKey: row.BATCH_KEY, label: row.BATCH_ID, action: 'AddNew', user: req.user });
  save();
  res.json({ ok: true, row });
});

/* --------------------------------------------------------- 警报触发条件 */
router.get('/alarm-conditions', (req, res) => {
  const db = getDb();
  let rows = db.alarm_conditions.slice();
  if (req.query.showHidden !== '1') rows = rows.filter(r => r.ACTIVE !== 'N');
  res.json({ ok: true, rows, history: ms.historyFor('alarm_conditions') });
});

router.post('/alarm-conditions', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.CONDITION_ID || !body.CONDITION_NAME) return res.status(400).json({ ok: false, message: '代码与名称为必填' });
  const dup = db.alarm_conditions.find(r => r.CONDITION_ID === body.CONDITION_ID && r.CONDITION_KEY !== body.CONDITION_KEY);
  if (dup) return res.status(400).json({ ok: false, message: '触发条件代码已存在' });
  if (body.CONDITION_KEY) {
    const row = db.alarm_conditions.find(r => r.CONDITION_KEY === body.CONDITION_KEY);
    if (!row) return res.status(404).json({ ok: false, message: '资料不存在' });
    const before = { ...row };
    Object.assign(row, body, { MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME });
    addHistory({ table: 'alarm_conditions', recordKey: row.CONDITION_KEY, label: row.CONDITION_ID, action: 'Modify', before, after: row, user: req.user });
    save();
    return res.json({ ok: true, row });
  }
  const row = {
    ...body, CONDITION_KEY: nextKey('alarm_conditions', 'COND', 2), ACTIVE: 'Y',
    MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME
  };
  db.alarm_conditions.unshift(row);
  addHistory({ table: 'alarm_conditions', recordKey: row.CONDITION_KEY, label: row.CONDITION_ID, action: 'AddNew', user: req.user });
  save();
  res.json({ ok: true, row });
});

router.post('/alarm-conditions/:key/:action', (req, res) => {
  const db = getDb();
  const row = db.alarm_conditions.find(r => r.CONDITION_KEY === req.params.key);
  if (!row) return res.status(404).json({ ok: false, message: '资料不存在' });
  const active = req.params.action === 'show' ? 'Y' : 'N';
  row.ACTIVE = active;
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = req.user.USER_KEY;
  row.MTR_USER_NAME = req.user.USER_NAME;
  addHistory({ table: 'alarm_conditions', recordKey: row.CONDITION_KEY, label: row.CONDITION_ID, action: active === 'Y' ? 'Show' : 'Hide', active, user: req.user });
  save();
  res.json({ ok: true });
});

/* ------------------------------------------------------------- 自动切机况 */
router.get('/auto-status', (req, res) => {
  const db = getDb();
  res.json({ ok: true, rows: db.auto_status_rules, logs: db.auto_status_logs.slice(0, 30), history: ms.historyFor('auto_status_rules') });
});

router.post('/auto-status', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.SUB_SYS_KEY || !body.EQP_KEY || !body.ALARM_INFO_KEY) {
    return res.status(400).json({ ok: false, message: '子系统、机台、警报代码为必填' });
  }
  if (body.AUTO_KEY) {
    const row = db.auto_status_rules.find(r => r.AUTO_KEY === body.AUTO_KEY);
    if (!row) return res.status(404).json({ ok: false, message: '规则不存在' });
    const before = { ...row };
    Object.assign(row, body, { MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME });
    addHistory({ table: 'auto_status_rules', recordKey: row.AUTO_KEY, label: row.AUTO_ID, action: 'Modify', before, after: row, user: req.user });
    save();
    return res.json({ ok: true, row });
  }
  const row = {
    ...body, AUTO_KEY: nextKey('auto_status_rules', 'AUTO', 2), ACTIVE: 'Y',
    MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME
  };
  db.auto_status_rules.unshift(row);
  addHistory({ table: 'auto_status_rules', recordKey: row.AUTO_KEY, label: row.AUTO_ID, action: 'AddNew', user: req.user });
  save();
  res.json({ ok: true, row });
});

router.post('/auto-status/:key/:action', (req, res) => {
  const db = getDb();
  const row = db.auto_status_rules.find(r => r.AUTO_KEY === req.params.key);
  if (!row) return res.status(404).json({ ok: false, message: '规则不存在' });
  if (req.params.action === 'delete') {
    row.ACTIVE = 'N';
    addHistory({ table: 'auto_status_rules', recordKey: row.AUTO_KEY, label: row.AUTO_ID, action: 'Hide', active: 'N', user: req.user });
  } else {
    row.ACTIVE = req.params.action === 'show' ? 'Y' : 'N';
    addHistory({ table: 'auto_status_rules', recordKey: row.AUTO_KEY, label: row.AUTO_ID, action: row.ACTIVE === 'Y' ? 'Show' : 'Hide', active: row.ACTIVE, user: req.user });
  }
  save();
  res.json({ ok: true });
});

router.post('/auto-status/scan', (req, res) => {
  const logs = engine.scanAutoStatus(req.user);
  res.json({ ok: true, logs });
});

/* ------------------------------------------------------------------ 装置 */
router.get('/devices', (req, res) => {
  const db = getDb();
  res.json({ ok: true, rows: db.devices, history: ms.historyFor('devices') });
});

router.post('/devices/save', (req, res) => {
  const db = getDb();
  const items = req.body.items || [];
  let changed = 0;
  items.forEach(item => {
    const row = db.devices.find(d => d.DEVICE_KEY === item.DEVICE_KEY);
    if (!row) return;
    if (row.ENABLE !== item.ENABLE) {
      row.ENABLE = item.ENABLE === 'Y' ? 'Y' : 'N';
      changed += 1;
    }
  });
  if (changed) addHistory({ table: 'devices', recordKey: '*', label: '装置启用状态', action: 'Modify', user: req.user });
  save();
  res.json({ ok: true, changed });
});

/* ------------------------------------------------------- 批次隐藏警报设定 */
router.get('/batch-alarm/query', (req, res) => {
  const db = getDb();
  const c = req.query;
  let rows = db.alarm_settings.slice();
  if (c.active && c.active !== '') rows = rows.filter(r => r.ACTIVE === c.active);
  if (c.alarmCode) rows = rows.filter(r => String(r.ALARM_INFO_ID).toLowerCase().includes(String(c.alarmCode).toLowerCase()));
  if (c.factoryKey) rows = rows.filter(r => r.FACTORY_KEY === c.factoryKey);
  if (c.subsysKey) rows = rows.filter(r => r.SUB_SYS_KEY === c.subsysKey);
  if (c.eqpKey) rows = rows.filter(r => r.EQP_KEY === c.eqpKey);
  if (c.groupKey) {
    const eqpKeys = db.eqp_group_eqp.filter(x => x.EQP_GROUP_KEY === c.groupKey).map(x => x.EQP_KEY);
    rows = rows.filter(r => eqpKeys.includes(r.EQP_KEY) || r.EQP_KEY === '*');
  }
  const fmap = Object.fromEntries(db.factories.map(f => [f.FACTORY_KEY, f]));
  const smap = Object.fromEntries(db.subsystems.map(s => [s.SUB_SYS_KEY, s]));
  const emap = Object.fromEntries(db.eqps.map(e => [e.EQP_KEY, e]));
  const vmap = Object.fromEntries(db.events.map(e => [e.EVENT_KEY, e]));
  rows = rows.map(r => ({
    ...r,
    FACTORY_ID: fmap[r.FACTORY_KEY] ? fmap[r.FACTORY_KEY].FACTORY_ID : '',
    FACTORY_NAME: fmap[r.FACTORY_KEY] ? fmap[r.FACTORY_KEY].FACTORY_NAME : '',
    SUB_SYS_ID: smap[r.SUB_SYS_KEY] ? smap[r.SUB_SYS_KEY].SUB_SYS_ID : '',
    SUB_SYS_NAME: smap[r.SUB_SYS_KEY] ? smap[r.SUB_SYS_KEY].SUB_SYS_NAME : '',
    EQP_ID: r.EQP_KEY === '*' ? '*' : (emap[r.EQP_KEY] ? emap[r.EQP_KEY].EQP_ID : ''),
    EQP_NAME: r.EQP_KEY === '*' ? '任一机台' : (emap[r.EQP_KEY] ? emap[r.EQP_KEY].EQP_NAME : ''),
    EVENT_ID: vmap[r.EVENT_KEY] ? vmap[r.EVENT_KEY].EVENT_ID : ''
  }));
  res.json({ ok: true, rows });
});

router.post('/batch-alarm/change', (req, res) => {
  const db = getDb();
  const { keys = [], active } = req.body || {};
  if (!['Y', 'N'].includes(active)) return res.status(400).json({ ok: false, message: '状态错误' });
  let changed = 0;
  keys.forEach(k => {
    const row = db.alarm_settings.find(x => x.ALARM_INFO_KEY === k);
    if (row && row.ACTIVE !== active) {
      row.ACTIVE = active;
      row.MTR_DATE = nowIso();
      row.MTR_USER_KEY = req.user.USER_KEY;
      row.MTR_USER_NAME = req.user.USER_NAME;
      addHistory({
        table: 'alarm_settings', recordKey: k, label: row.ALARM_INFO_ID,
        action: active === 'Y' ? 'Show' : 'Hide', active, user: req.user
      });
      changed += 1;
    }
  });
  save();
  res.json({ ok: true, changed });
});

/* --------------------------------------------------------------- 报表定义 */
router.get('/report-defs', (req, res) => {
  const db = getDb();
  res.json({ ok: true, rows: db.report_defs, history: ms.historyFor('report_defs') });
});

router.post('/report-defs', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.REPORT_ID || !body.REPORT_NAME) return res.status(400).json({ ok: false, message: '报表代码与名称为必填' });
  const dup = db.report_defs.find(r => r.REPORT_ID === body.REPORT_ID && r.REPORT_KEY !== body.REPORT_KEY);
  if (dup) return res.status(400).json({ ok: false, message: '报表代码已存在' });
  const normalize = (b) => ({
    ...b,
    CONDITIONS_JSON: typeof b.CONDITIONS_JSON === 'string' ? b.CONDITIONS_JSON : JSON.stringify(b.CONDITIONS || []),
    COLUMNS_JSON: typeof b.COLUMNS_JSON === 'string' ? b.COLUMNS_JSON : JSON.stringify(b.COLUMNS || []),
    DISPLAY_JSON: typeof b.DISPLAY_JSON === 'string' ? b.DISPLAY_JSON : JSON.stringify(b.DISPLAY || {}),
    ADVANCED_JSON: typeof b.ADVANCED_JSON === 'string' ? b.ADVANCED_JSON : JSON.stringify(b.ADVANCED || {})
  });
  const data = normalize(body);
  if (body.REPORT_KEY) {
    const row = db.report_defs.find(r => r.REPORT_KEY === body.REPORT_KEY);
    if (!row) return res.status(404).json({ ok: false, message: '报表定义不存在' });
    const before = { ...row };
    Object.assign(row, data, { MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME });
    addHistory({ table: 'report_defs', recordKey: row.REPORT_KEY, label: row.REPORT_ID, action: 'Modify', before, after: row, user: req.user });
    save();
    return res.json({ ok: true, row });
  }
  const row = {
    ...data, REPORT_KEY: nextKey('report_defs', 'RPT', 2), ACTIVE: 'Y',
    MTR_DATE: nowIso(), MTR_USER_KEY: req.user.USER_KEY, MTR_USER_NAME: req.user.USER_NAME
  };
  db.report_defs.unshift(row);
  addHistory({ table: 'report_defs', recordKey: row.REPORT_KEY, label: row.REPORT_ID, action: 'AddNew', user: req.user });
  save();
  res.json({ ok: true, row });
});

router.post('/report-defs/:key/:action', (req, res) => {
  const db = getDb();
  const row = db.report_defs.find(r => r.REPORT_KEY === req.params.key);
  if (!row) return res.status(404).json({ ok: false, message: '报表定义不存在' });
  row.ACTIVE = req.params.action === 'show' ? 'Y' : 'N';
  row.MTR_DATE = nowIso();
  row.MTR_USER_KEY = req.user.USER_KEY;
  row.MTR_USER_NAME = req.user.USER_NAME;
  addHistory({ table: 'report_defs', recordKey: row.REPORT_KEY, label: row.REPORT_ID, action: row.ACTIVE === 'Y' ? 'Show' : 'Hide', active: row.ACTIVE, user: req.user });
  save();
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- 报表查询 */
router.get('/report-defs/:reportId', (req, res) => {
  const row = getDb().report_defs.find(r => r.REPORT_ID === req.params.reportId);
  if (!row) return res.status(404).json({ ok: false, message: '报表不存在' });
  res.json({
    ok: true,
    row: {
      ...row,
      CONDITIONS: JSON.parse(row.CONDITIONS_JSON || '[]'),
      COLUMNS: JSON.parse(row.COLUMNS_JSON || '[]'),
      DISPLAY: JSON.parse(row.DISPLAY_JSON || '{}'),
      ADVANCED: JSON.parse(row.ADVANCED_JSON || '{}')
    }
  });
});

router.post('/reports/:code/query', (req, res) => {
  const rows = reports.queryReport(req.params.code, req.body.conditions || {});
  const def = getDb().report_defs.find(r => r.REPORT_ID === req.params.code);
  res.json({
    ok: true, rows, total: rows.length,
    columns: def ? JSON.parse(def.COLUMNS_JSON || '[]') : [],
    lastUpdate: nowIso()
  });
});

router.post('/reports/:code/export', wrap(async (req, res) => {
  const code = req.params.code;
  const def = getDb().report_defs.find(r => r.REPORT_ID === code);
  const rows = reports.queryReport(code, req.body.conditions || {});
  const columns = def ? JSON.parse(def.COLUMNS_JSON || '[]') : [];
  const out = await excel.reportWorkbook(code, columns, rows, def ? def.REPORT_NAME : code);
  res.json({ ok: true, filename: out.filename, base64: Buffer.from(out.buffer).toString('base64') });
}));

router.get('/summary/master', (req, res) => res.json({ ok: true, rows: reports.summaryMaster() }));
router.get('/summary/detail', (req, res) => {
  res.json({ ok: true, rows: reports.summaryDetail(req.query.factory, req.query.subsys) });
});

/* ------------------------------------------------------------------ 仪表板 */
router.get('/dashboard', (req, res) => res.json({ ok: true, ...reports.dashboard(req.user) }));

/* --------------------------------------------------------------- 警报作业 */
router.get('/alarms/pending', (req, res) => res.json({ ok: true, rows: reports.pendingAlarms(req.user) }));
router.get('/alarms/process', (req, res) => res.json({ ok: true, rows: reports.processAlarms() }));
router.get('/inbox', (req, res) => res.json({ ok: true, ...reports.inbox(req.user) }));

router.get('/alarms/backfill/options', (req, res) => {
  const db = getDb();
  const factoryKey = req.query.factoryKey;
  const subsysKey = req.query.subsysKey;
  const eqpKey = req.query.eqpKey;
  const factories = buildOptions().factory;
  const subsystems = factoryKey
    ? (buildOptions().subsystemByFactory[factoryKey] || [])
    : buildOptions().subsystem;
  const eqps = buildOptions().eqp;
  let alarmCodes = [];
  if (factoryKey && subsysKey) {
    const settings = db.alarm_settings.filter(s =>
      s.FACTORY_KEY === factoryKey && s.SUB_SYS_KEY === subsysKey && s.ACTIVE !== 'N');
    const groupKeys = eqpKey ? db.eqp_group_eqp.filter(x => x.EQP_KEY === eqpKey).map(x => x.EQP_GROUP_KEY) : [];
    const peers = groupKeys.length ? db.eqp_group_eqp.filter(x => groupKeys.includes(x.EQP_GROUP_KEY)).map(x => x.EQP_KEY) : [];
    const map = {};
    settings.forEach(s => {
      let match = 'none';
      if (s.EQP_KEY === '*') match = 'exact';
      if (eqpKey && s.EQP_KEY === eqpKey) match = 'exact';
      if (eqpKey && s.EQP_KEY !== '*' && s.EQP_KEY !== eqpKey && peers.includes(s.EQP_KEY)) {
        match = match === 'exact' ? 'exact' : 'fallback';
      }
      if (!map[s.ALARM_INFO_ID] || match === 'exact') {
        map[s.ALARM_INFO_ID] = {
          value: s.ALARM_INFO_ID, label: `${s.ALARM_INFO_ID} ${s.ALARM_ID_DESC}`,
          match, settingKey: s.ALARM_INFO_KEY, eqp: s.EQP_KEY
        };
      }
    });
    alarmCodes = Object.values(map);
  }
  res.json({ ok: true, factories, subsystems, eqps, alarmCodes });
});

router.get('/alarms/manual/options', (req, res) => {
  const db = getDb();
  const options = buildOptions();
  res.json({
    ok: true,
    factories: options.factory,
    subsystems: options.subsystem,
    users: db.users.filter(u => u.ACTIVE !== 'N').map(u => ({
      value: u.USER_KEY, label: `${u.USER_ID} ${u.USER_NAME}`,
      mail: u.E_MAIL, sms: u.ALARM_SMS_TEL, ext: u.EXTENSION, im: u.IM_ID, organ: u.ORGAN_KEY
    })),
    channels: options.channel
  });
});

router.post('/alarms/backfill', (req, res) => {
  const b = req.body || {};
  const result = engine.createBackfill({
    user: req.user, factoryKey: b.factoryKey, subsysKey: b.subsysKey,
    eqpKey: b.eqpKey, alarmCode: b.alarmCode, title: b.title,
    content: b.content, receiveType: 'WebPage'
  });
  if (result.ok && result.alarm) rememberSubject(result.alarm.TITLE);
  res.status(result.ok ? 200 : 422).json(result);
});

router.post('/alarms/manual', (req, res) => {
  const b = req.body || {};
  const result = engine.createManual({
    user: req.user, factoryKey: b.factoryKey, subsysKey: b.subsysKey,
    userKeys: b.userKeys || [], channels: b.channels || [],
    title: b.title, content: b.content, requiredAck: b.requiredAck
  });
  if (result.ok && result.alarm) rememberSubject(result.alarm.TITLE);
  res.status(result.ok ? 200 : 422).json(result);
});

function rememberSubject(subject) {
  if (!subject) return;
  const db = getDb();
  const row = db.alarm_subjects.find(s => s.SUBJECT === subject);
  if (row) {
    row.USE_COUNT = (row.USE_COUNT || 0) + 1;
    row.LAST_USED_DT = nowIso();
  } else {
    db.alarm_subjects.unshift({
      SUBJECT_KEY: nextKey('alarm_subjects', 'SUB', 2),
      SUBJECT: subject, LAST_USED_DT: nowIso(), USE_COUNT: 1
    });
  }
  save();
}

router.get('/alarm-subjects', (req, res) => {
  const db = getDb();
  res.json({
    ok: true,
    rows: db.alarm_subjects.slice().sort((a, b) => new Date(b.LAST_USED_DT) - new Date(a.LAST_USED_DT))
  });
});

router.get('/alarms/:key', (req, res) => {
  const detail = engine.getAlarmDetail(req.params.key, req.user);
  if (!detail) return res.status(404).json({ ok: false, message: '警报不存在' });
  res.json({ ok: true, alarm: detail });
});

router.post('/alarms/:key/ack', (req, res) => {
  const result = engine.ackAlarm({ user: req.user, alarmKey: req.params.key, cmt: (req.body || {}).cmt });
  res.status(result.ok ? 200 : 422).json(result);
});

router.post('/alarms/:key/terminate', (req, res) => {
  const result = engine.terminateAlarm({ user: req.user, alarmKey: req.params.key, cmt: (req.body || {}).cmt });
  res.status(result.ok ? 200 : 422).json(result);
});

/* --------------------------------------------------------------- SQL 工具 */
router.post('/sql/parse', (req, res) => {
  const sql = String((req.body || {}).sql || '');
  const m = sql.match(/select\s+([\s\S]*?)\s+from\s/i);
  if (!m) return res.json({ ok: false, message: '无法解析 SQL，请确认包含 SELECT … FROM …', fields: [] });
  const fields = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const alias = s.match(/\s+as\s+([A-Za-z0-9_]+)$/i);
    const name = alias ? alias[1] : (s.split(/\s+/).pop() || s).split('.').pop();
    return { name: name.replace(/[^A-Za-z0-9_]/g, ''), raw: s, label: name };
  }).filter(x => x.name);
  res.json({ ok: true, fields });
});

router.post('/sql/test', (req, res) => {
  const sql = String((req.body || {}).sql || '');
  const m = sql.match(/select\s+([\s\S]*?)\s+from\s/i);
  if (!m) return res.status(400).json({ ok: false, message: 'SQL 语法错误：缺少 SELECT 或 FROM' });
  const fields = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const alias = s.match(/\s+as\s+([A-Za-z0-9_]+)$/i);
    const name = alias ? alias[1] : (s.split(/\s+/).pop() || s).split('.').pop();
    return name.replace(/[^A-Za-z0-9_]/g, '');
  }).filter(Boolean);
  const now = new Date();
  const rows = [0, 1, 2].map(i => {
    const row = {};
    fields.forEach(f => {
      if (/DATE|TIME/i.test(f)) row[f] = new Date(now.getTime() - i * 3600000).toLocaleString('zh-CN', { hour12: false });
      else if (/STATUS/i.test(f)) row[f] = ['NG', 'Error', 'NG'][i];
      else if (/ID/i.test(f)) row[f] = `EQP${i + 1}`;
      else if (/TEMP/i.test(f)) row[f] = 180 + i * 7;
      else row[f] = `VALUE-${i + 1}`;
    });
    return row;
  });
  res.json({ ok: true, fields: fields.map(f => ({ name: f, label: f })), rows, elapsed: '0.017 秒' });
});

/* --------------------------------------------------------------- 系统设定 */
router.post('/settings', (req, res) => {
  const db = getDb();
  const speed = Number((req.body || {}).demoSpeed);
  if (Number.isFinite(speed) && speed >= 1 && speed <= 120) {
    db.settings.demoSpeed = speed;
    save();
  }
  res.json({ ok: true, settings: db.settings });
});

router.get('/health', (req, res) => {
  res.json({ ok: true, version: getDb().meta.version, time: nowIso() });
});

/* 错误处理 */
router.use((err, req, res, next) => {
  console.error('[AMS] API error', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, message: '系统错误：' + err.message });
});

module.exports = router;
