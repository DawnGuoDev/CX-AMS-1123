'use strict';

const { getDb } = require('./db');
const { enrich, usersOfLevel, eventLevelsOf } = require('./alarm-engine');

function dayKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function condEnabled(conditions, key) {
  const c = conditions[key];
  if (!c) return false;
  if (typeof c === 'object') return c.enabled !== false && (c.from || c.to || c.value || c.values);
  return c !== '' && c != null;
}

function inDateRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from) {
    const f = new Date(from + 'T00:00:00').getTime();
    if (t < f) return false;
  }
  if (to) {
    const e = new Date(to + 'T23:59:59.999').getTime();
    if (t > e) return false;
  }
  return true;
}

function eqpKeysOfGroup(groupKey) {
  const db = getDb();
  return db.eqp_group_eqp.filter(x => x.EQP_GROUP_KEY === groupKey).map(x => x.EQP_KEY);
}

function baseAlarmRow(a) {
  const db = getDb();
  const f = db.factories.find(x => x.FACTORY_KEY === a.FACTORY_KEY);
  const s = db.subsystems.find(x => x.SUB_SYS_KEY === a.SUB_SYS_KEY);
  const e = a.EQP_KEY === '*' ? { EQP_ID: '*', EQP_NAME: '任一机台' } : db.eqps.find(x => x.EQP_KEY === a.EQP_KEY);
  const set = db.alarm_settings.find(x => x.ALARM_INFO_KEY === a.ALARM_INFO_KEY);
  const ev = db.events.find(x => x.EVENT_KEY === a.EVENT_KEY);
  return {
    ...a,
    FACTORY_ID: f ? f.FACTORY_ID : '',
    FACTORY_NAME: f ? f.FACTORY_NAME : '',
    SUB_SYS_ID: s ? s.SUB_SYS_ID : '',
    SUB_SYS_NAME: s ? s.SUB_SYS_NAME : '',
    EQP_ID: e ? e.EQP_ID : '',
    EQP_NAME: e ? e.EQP_NAME : '',
    ALARM_INFO_ID: set ? set.ALARM_INFO_ID : '',
    ALARM_ID_DESC: set ? set.ALARM_ID_DESC : '',
    EVENT_ID: ev ? ev.EVENT_ID : '',
    EVENT_NAME: ev ? ev.EVENT_NAME : ''
  };
}

function filterAlarms(rows, conditions) {
  let out = rows;
  if (conditions.CREATE_DT) {
    const c = conditions.CREATE_DT;
    out = out.filter(r => inDateRange(r.CREATE_DT, c.from, c.to));
  }
  if (condEnabled(conditions, 'EQP_GROUP_KEY')) {
    const keys = eqpKeysOfGroup(conditions.EQP_GROUP_KEY);
    out = out.filter(r => keys.includes(r.EQP_KEY));
  }
  if (condEnabled(conditions, 'EQP_ID')) {
    const q = String(conditions.EQP_ID.value || conditions.EQP_ID).toLowerCase();
    out = out.filter(r => String(r.EQP_ID || '').toLowerCase().includes(q));
  }
  if (condEnabled(conditions, 'SUB_SYS_ID')) {
    const q = String(conditions.SUB_SYS_ID.value || conditions.SUB_SYS_ID).toLowerCase();
    out = out.filter(r => String(r.SUB_SYS_ID || '').toLowerCase().includes(q));
  }
  return out;
}

function queryReport(code, conditions = {}) {
  const db = getDb();
  if (code === 'AVPA004') {
    const rows = db.alarms.map(baseAlarmRow);
    return filterAlarms(rows, conditions).sort((a, b) => new Date(b.CREATE_DT) - new Date(a.CREATE_DT));
  }
  if (code === 'AVPA005') {
    let rows = db.alarm_invalid.slice();
    if (conditions.CREATE_DT) {
      rows = rows.filter(r => inDateRange(r.CREATE_DT, conditions.CREATE_DT.from, conditions.CREATE_DT.to));
    }
    if (condEnabled(conditions, 'SUB_SYS_ID')) {
      const q = String(conditions.SUB_SYS_ID.value || conditions.SUB_SYS_ID).toLowerCase();
      rows = rows.filter(r => String(r.SUB_SYS_ID || '').toLowerCase().includes(q));
    }
    if (condEnabled(conditions, 'EQP_ID')) {
      const q = String(conditions.EQP_ID.value || conditions.EQP_ID).toLowerCase();
      rows = rows.filter(r => String(r.EQP_ID || '').toLowerCase().includes(q));
    }
    if (condEnabled(conditions, 'EQP_GROUP_KEY')) {
      const keys = eqpKeysOfGroup(conditions.EQP_GROUP_KEY);
      const eqpIds = db.eqps.filter(e => keys.includes(e.EQP_KEY)).map(e => e.EQP_ID);
      rows = rows.filter(r => eqpIds.includes(r.EQP_ID));
    }
    return rows.sort((a, b) => new Date(b.CREATE_DT) - new Date(a.CREATE_DT));
  }
  if (code === 'AVPA007') {
    const alarmRows = filterAlarms(db.alarms.map(baseAlarmRow), conditions);
    const alarmMap = Object.fromEntries(alarmRows.map(a => [a.ALARM_KEY, a]));
    const rows = db.alarm_transactions
      .filter(t => alarmMap[t.ALARM_KEY])
      .map(t => {
        const a = alarmMap[t.ALARM_KEY];
        return {
          ...a,
          ALARM_KEY: a.ALARM_KEY,
          TRX_KEY: t.TRX_KEY, TRX_DT: t.TRX_DT, SEQ: t.SEQ,
          TRX_TYPE: t.TRX_TYPE, TRX_NOTE: t.NOTE,
          STATUS: a.STATUS,
          TRX_USER_ID: (db.users.find(u => u.USER_KEY === t.USER_KEY) || {}).USER_ID || 'SYSTEM'
        };
      })
      .sort((a, b) => new Date(b.TRX_DT) - new Date(a.TRX_DT));
    return rows;
  }
  if (code === 'AVPA008') {
    const groups = {};
    db.devices.forEach(d => {
      const key = d.SERVER_ID + '||' + d.AGENT_ID;
      if (!groups[key]) {
        groups[key] = {
          SERVER_ID: d.SERVER_ID, AGENT_ID: d.AGENT_ID,
          RECEIVED_COUNT: 0, SUCCESSFUL_COUNT: 0, FAIL_COUNT: 0,
          DEVICE_ERROR_COUNT: 0, DEVICES: [], STATUS_SET: []
        };
      }
      const g = groups[key];
      g.RECEIVED_COUNT += Number(d.RECEIVED_COUNT || 0);
      g.SUCCESSFUL_COUNT += Number(d.SUCCESSFUL_COUNT || 0);
      g.FAIL_COUNT += Number(d.FAIL_COUNT || 0);
      if (['Error', 'NG', 'Close'].includes(d.DEVICE_STATUS)) g.DEVICE_ERROR_COUNT += 1;
      g.STATUS_SET.push(d.DEVICE_STATUS);
      g.DEVICES.push(d);
    });
    const severity = { Error: 5, NG: 4, Close: 3, Unknown: 2, OK: 1 };
    return Object.values(groups).map(g => {
      const worst = g.STATUS_SET.sort((a, b) => (severity[b] || 0) - (severity[a] || 0))[0] || 'Unknown';
      const desc = {
        OK: '所有装置运作正常', Unknown: '尚有装置未完成首次验证',
        Close: '部分装置已停用', NG: '装置发生轻微错误', Error: '装置发生严重错误'
      }[worst];
      return { ...g, AGENT_STATUS: worst, STATUS_DESC: desc };
    }).sort((a, b) => a.SERVER_ID.localeCompare(b.SERVER_ID) || a.AGENT_ID.localeCompare(b.AGENT_ID));
  }
  return [];
}

function summaryMaster() {
  const db = getDb();
  const counts = {};
  db.alarms.filter(a => a.STATUS === 'Process').forEach(a => {
    const key = a.FACTORY_KEY + '||' + a.SUB_SYS_KEY;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([key, count]) => {
    const [fk, sk] = key.split('||');
    const f = db.factories.find(x => x.FACTORY_KEY === fk);
    const s = db.subsystems.find(x => x.SUB_SYS_KEY === sk);
    return {
      FACTORY_KEY: fk, SUB_SYS_KEY: sk,
      FACTORY_ID: f ? f.FACTORY_ID : '', FACTORY_NAME: f ? f.FACTORY_NAME : '',
      SUB_SYS_ID: s ? s.SUB_SYS_ID : '', SUB_SYS_NAME: s ? s.SUB_SYS_NAME : '',
      ALARM_COUNT: count
    };
  }).sort((a, b) => b.ALARM_COUNT - a.ALARM_COUNT);
}

function summaryDetail(factoryKey, subsysKey) {
  const db = getDb();
  const counts = {};
  db.alarms.filter(a => a.STATUS === 'Process' && a.FACTORY_KEY === factoryKey && a.SUB_SYS_KEY === subsysKey)
    .forEach(a => { counts[a.EQP_KEY] = (counts[a.EQP_KEY] || 0) + 1; });
  const f = db.factories.find(x => x.FACTORY_KEY === factoryKey);
  const s = db.subsystems.find(x => x.SUB_SYS_KEY === subsysKey);
  return Object.entries(counts).map(([ek, count]) => {
    const e = ek === '*' ? { EQP_ID: '*', EQP_NAME: '任一机台' } : db.eqps.find(x => x.EQP_KEY === ek);
    return {
      FACTORY_ID: f ? f.FACTORY_ID : '', FACTORY_NAME: f ? f.FACTORY_NAME : '',
      SUB_SYS_ID: s ? s.SUB_SYS_ID : '', SUB_SYS_NAME: s ? s.SUB_SYS_NAME : '',
      EQP_ID: e ? e.EQP_ID : ek, EQP_NAME: e ? e.EQP_NAME : '',
      ALARM_COUNT: count
    };
  }).sort((a, b) => b.ALARM_COUNT - a.ALARM_COUNT);
}

function dashboard(user) {
  const db = getDb();
  const today = dayKey(new Date().toISOString());
  const todayAlarms = db.alarms.filter(a => dayKey(a.CREATE_DT) === today);
  const process = db.alarms.filter(a => a.STATUS === 'Process');
  const pending = db.alarms.filter(a => {
    if (a.STATUS !== 'Process') return false;
    const level = eventLevelsOf(a.EVENT_KEY).find(l => l.EVENT_LEVEL_ID === a.CURRENT_LEVEL);
    if (!level) return false;
    const users = usersOfLevel(level.EVENT_LEVEL_KEY);
    if (!users.some(u => u.USER_KEY === user.USER_KEY)) return false;
    return !db.alarm_acks.some(x => x.ALARM_KEY === a.ALARM_KEY && x.LEVEL_ID === a.CURRENT_LEVEL && x.USER_KEY === user.USER_KEY);
  });
  const completedToday = todayAlarms.filter(a => a.STATUS === 'Completed').length;
  const invalidToday = db.alarm_invalid.filter(a => dayKey(a.CREATE_DT) === today).length;
  const trend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = startOfDay(i);
    const key = dayKey(d.toISOString());
    trend.push({ date: key, count: db.alarms.filter(a => dayKey(a.CREATE_DT) === key).length });
  }
  const hourly = [];
  for (let i = 11; i >= 0; i -= 1) {
    const end = Date.now() - i * 3600000;
    const start = end - 3600000;
    hourly.push({
      hour: new Date(end).getHours(),
      count: db.alarms.filter(a => {
        const t = new Date(a.CREATE_DT).getTime();
        return t >= start && t < end;
      }).length
    });
  }
  const subsysCounts = {};
  process.forEach(a => {
    const s = db.subsystems.find(x => x.SUB_SYS_KEY === a.SUB_SYS_KEY);
    const key = s ? s.SUB_SYS_ID + ' ' + s.SUB_SYS_NAME : a.SUB_SYS_KEY;
    subsysCounts[key] = (subsysCounts[key] || 0) + 1;
  });
  const topSubsys = Object.entries(subsysCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const devices = db.devices;
  const deviceSummary = {
    total: devices.length,
    ok: devices.filter(d => d.DEVICE_STATUS === 'OK').length,
    abnormal: devices.filter(d => ['Error', 'NG', 'Close'].includes(d.DEVICE_STATUS)).length,
    unknown: devices.filter(d => d.DEVICE_STATUS === 'Unknown').length
  };
  return {
    kpi: {
      today: todayAlarms.length,
      process: process.length,
      pending: pending.length,
      completedToday,
      invalidToday,
      completedRate: todayAlarms.length ? Math.round(completedToday / todayAlarms.length * 100) : 0
    },
    trend,
    hourly,
    topSubsys,
    recent: db.alarms.slice()
      .sort((a, b) => new Date(b.CREATE_DT) - new Date(a.CREATE_DT))
      .slice(0, 8).map(a => enrich(a, user)),
    deviceSummary,
    autoLogs: db.auto_status_logs.slice(0, 4),
    lastUpdate: new Date().toISOString()
  };
}

function pendingAlarms(user) {
  const db = getDb();
  return db.alarms.filter(a => {
    if (a.STATUS !== 'Process') return false;
    const level = eventLevelsOf(a.EVENT_KEY).find(l => l.EVENT_LEVEL_ID === a.CURRENT_LEVEL);
    if (!level) return false;
    const users = usersOfLevel(level.EVENT_LEVEL_KEY);
    if (!users.some(u => u.USER_KEY === user.USER_KEY)) return false;
    return !db.alarm_acks.some(x => x.ALARM_KEY === a.ALARM_KEY && x.LEVEL_ID === a.CURRENT_LEVEL && x.USER_KEY === user.USER_KEY);
  }).map(a => enrich(a, user))
    .sort((a, b) => (b.PRIORITY || 0) - (a.PRIORITY || 0) || new Date(b.CREATE_DT) - new Date(a.CREATE_DT));
}

function processAlarms() {
  return getDb().alarms.filter(a => a.STATUS === 'Process' && a.IS_MANUAL !== 'Y').map(a => enrich(a, null));
}

function inbox(user) {
  const db = getDb();
  const cutoff = Date.now() - 7 * 24 * 3600000;
  const rows = db.alarm_notifications
    .filter(n => n.USER_KEY === user.USER_KEY && new Date(n.SEND_DT).getTime() >= cutoff)
    .sort((a, b) => new Date(b.SEND_DT) - new Date(a.SEND_DT))
    .slice(0, 80)
    .map(n => {
      const alarm = db.alarms.find(a => a.ALARM_KEY === n.ALARM_KEY);
      return {
        ...n,
        ALARM_ID: alarm ? alarm.ALARM_ID : '',
        ALARM_KEY: n.ALARM_KEY,
        TITLE: alarm ? alarm.TITLE : '',
        STATUS: alarm ? alarm.STATUS : '',
        CREATE_DT: alarm ? alarm.CREATE_DT : '',
        FACTORY_ID: alarm ? (db.factories.find(f => f.FACTORY_KEY === alarm.FACTORY_KEY) || {}).FACTORY_ID : '',
        SUB_SYS_ID: alarm ? (db.subsystems.find(s => s.SUB_SYS_KEY === alarm.SUB_SYS_KEY) || {}).SUB_SYS_ID : '',
        EQP_ID: alarm && alarm.EQP_KEY !== '*' ? (db.eqps.find(e => e.EQP_KEY === alarm.EQP_KEY) || {}).EQP_ID : '*',
        CAN_ACK: alarm && alarm.STATUS === 'Process' && !db.alarm_acks.some(x => x.ALARM_KEY === alarm.ALARM_KEY && x.LEVEL_ID === alarm.CURRENT_LEVEL && x.USER_KEY === user.USER_KEY)
      };
    });
  const pending = pendingAlarms(user).length;
  return { rows, pending };
}

module.exports = {
  queryReport,
  summaryMaster,
  summaryDetail,
  dashboard,
  pendingAlarms,
  processAlarms,
  inbox,
  dayKey
};
