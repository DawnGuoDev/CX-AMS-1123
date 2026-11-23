'use strict';

const { getDb, save, nextKey, nextAlarmId, nowIso, addHistory } = require('./db');

const CHANNEL_TO_DEVICE = {
  Email: 'Email01', Sms: 'Sms01', Phone: 'Phone01', Voice: 'Phone01', IM: 'Im01',
  WeChat: 'Im01', LINE: 'Im01', IPPhoneExt: 'Phone01', IPPhoneIM: 'Im01'
};
const CHANNEL_CONTACT = (u, ch) => {
  if (ch === 'Email') return u.E_MAIL;
  if (ch === 'Sms') return u.ALARM_SMS_TEL;
  if (ch === 'Phone' || ch === 'Voice' || ch === 'IPPhoneExt') return u.EXTENSION;
  if (ch === 'IM' || ch === 'WeChat' || ch === 'LINE' || ch === 'IPPhoneIM') return u.IM_ID;
  return '';
};

const demoFactor = () => Math.max(1, Number(getDb().settings.demoSpeed) || 1);

function findOne(table, predicate) {
  return getDb()[table].find(predicate);
}
function byKey(table, key) {
  const db = getDb();
  return db[table].find(x => x[Object.keys(x)[0]] === key);
}
function userById(id) {
  return getDb().users.find(u => u.USER_ID === id);
}
function usersOfLevel(levelKey) {
  const db = getDb();
  const groupKeys = db.event_level_groups.filter(x => x.EVENT_LEVEL_KEY === levelKey).map(x => x.EVENT_GROUP_KEY);
  const userKeys = [...new Set(db.event_group_users.filter(x => groupKeys.includes(x.EVENT_GROUP_KEY)).map(x => x.USER_KEY))];
  return db.users.filter(u => userKeys.includes(u.USER_KEY) && u.ACTIVE !== 'N');
}
function groupsOfLevel(levelKey) {
  const db = getDb();
  return db.event_level_groups
    .filter(x => x.EVENT_LEVEL_KEY === levelKey)
    .sort((a, b) => (a.GROUP_SEQ || 0) - (b.GROUP_SEQ || 0));
}
function channelsOfLevel(levelKey) {
  const list = groupsOfLevel(levelKey)
    .flatMap(x => String(x.ENABLE_SEND_DEVICES || '').split(';').filter(Boolean));
  return [...new Set(list)];
}
function eventLevelsOf(eventKey) {
  return getDb().event_levels
    .filter(x => x.EVENT_KEY === eventKey && x.ACTIVE !== 'N')
    .sort((a, b) => a.EVENT_LEVEL_ID - b.EVENT_LEVEL_ID);
}
function levelOf(alarm) {
  const levels = eventLevelsOf(alarm.EVENT_KEY);
  return levels.find(l => l.EVENT_LEVEL_ID === alarm.CURRENT_LEVEL) || null;
}
function requiredCount(level, users) {
  if (!level) return 1;
  const v = String(level.NUMBER_OF_ACK_USERS == null ? '1' : level.NUMBER_OF_ACK_USERS);
  if (v === '*') return users.length;
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
}

function labelOfFactory(key) {
  return getDb().factories.find(x => x.FACTORY_KEY === key);
}
function labelOfSubsys(key) {
  return getDb().subsystems.find(x => x.SUB_SYS_KEY === key);
}
function labelOfEqp(key) {
  if (key === '*') return { EQP_ID: '*', EQP_NAME: '任一机台' };
  return getDb().eqps.find(x => x.EQP_KEY === key);
}
function labelOfAlarmSetting(key) {
  return getDb().alarm_settings.find(x => x.ALARM_INFO_KEY === key);
}
function labelOfEvent(key) {
  return getDb().events.find(x => x.EVENT_KEY === key);
}

function enrich(a, currentUser) {
  if (!a) return null;
  const db = getDb();
  const f = labelOfFactory(a.FACTORY_KEY);
  const s = labelOfSubsys(a.SUB_SYS_KEY);
  const e = labelOfEqp(a.EQP_KEY);
  const set = labelOfAlarmSetting(a.ALARM_INFO_KEY);
  const ev = labelOfEvent(a.EVENT_KEY);
  const level = levelOf(a);
  const run = db.alarm_levels.filter(x => x.ALARM_KEY === a.ALARM_KEY).sort((x, y) => y.LEVEL_ID - x.LEVEL_ID)[0];
  const levels = eventLevelsOf(a.EVENT_KEY);
  const next = levels.find(l => l.EVENT_LEVEL_ID === a.CURRENT_LEVEL + 1);
  const ackUsers = db.alarm_acks.filter(x => x.ALARM_KEY === a.ALARM_KEY && x.LEVEL_ID === a.CURRENT_LEVEL)
    .map(x => db.users.find(u => u.USER_KEY === x.USER_KEY))
    .filter(Boolean)
    .map(u => ({ USER_ID: u.USER_ID, USER_NAME: u.USER_NAME }));
  const notified = db.alarm_notifications
    .filter(x => x.ALARM_KEY === a.ALARM_KEY && x.LEVEL_ID === a.CURRENT_LEVEL)
    .map(x => x.USER_KEY);
  const canAckBase = a.STATUS === 'Process'
    && notified.includes(currentUser && currentUser.USER_KEY)
    && !ackUsers.some(u => currentUser && u.USER_ID === currentUser.USER_ID);
  const intervalSec = level ? Number(level.LEVEL_INTERVAL || 0) * 60 / demoFactor() : 1800 / demoFactor();
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
    EVENT_NAME: ev ? ev.EVENT_NAME : '',
    LEVEL_DESC: level ? level.EVENT_LEVEL_DESC : '',
    LEVEL_START: run ? run.START_DT : a.LEVEL_PROCESS_DT,
    LEVEL_REQUIRED: run ? run.REQUIRED_ACK : a.ACK_REQUIRED,
    LEVEL_ACK_COUNT: run ? run.ACK_COUNT : 0,
    LEVEL_RESEND_COUNT: run ? run.RESEND_COUNT : 0,
    LEVEL_INTERVAL_SEC: intervalSec,
    HAS_NEXT_LEVEL: !!next,
    ACK_USERS: ackUsers,
    CAN_ACK: !!canAckBase,
    CAN_TERMINATE: a.STATUS === 'Process' && a.IS_MANUAL !== 'Y',
    NOTIFY_COUNT: db.alarm_notifications.filter(x => x.ALARM_KEY === a.ALARM_KEY).length,
    INVALID: false
  };
}

function addTransaction(alarm, type, before, after, user, note) {
  const db = getDb();
  const seq = db.alarm_transactions.filter(x => x.ALARM_KEY === alarm.ALARM_KEY).length + 1;
  db.alarm_transactions.push({
    TRX_KEY: nextKey('alarm_transactions', 'TRX', 4),
    ALARM_KEY: alarm.ALARM_KEY, SEQ: seq, TRX_TYPE: type,
    STATUS_BEFORE: before, STATUS_AFTER: after,
    USER_KEY: user ? user.USER_KEY : null, TRX_DT: nowIso(), NOTE: note || null
  });
}

function createInvalid({ title, content, factoryKey, subsysKey, eqpKey, alarmCode, receiveType, invalidType, user, raw }) {
  const db = getDb();
  const f = labelOfFactory(factoryKey);
  const s = labelOfSubsys(subsysKey);
  const e = labelOfEqp(eqpKey);
  const row = {
    INVALID_KEY: nextKey('alarm_invalid', 'IV', 3),
    INVALID_ID: 'INV' + String(Date.now()).slice(-8),
    CREATE_DT: nowIso(),
    TITLE: title || '无效警报',
    CONTENT: content || '',
    FACTORY_ID: f ? f.FACTORY_ID : (raw && raw.factoryId) || '',
    FACTORY_NAME: f ? f.FACTORY_NAME : '',
    SUB_SYS_ID: s ? s.SUB_SYS_ID : (raw && raw.subsysId) || '',
    SUB_SYS_NAME: s ? s.SUB_SYS_NAME : '',
    EQP_ID: e ? e.EQP_ID : (raw && raw.eqpId) || '',
    EQP_NAME: e ? e.EQP_NAME : '',
    ALARM_INFO_ID: alarmCode || '',
    RECEIVE_TYPE: receiveType || 'WebService',
    INVALID_TYPE: invalidType,
    RAW_JSON: JSON.stringify(raw || {})
  };
  db.alarm_invalid.unshift(row);
  save();
  return row;
}

function notifyUsers(alarm, level, users, channels, note) {
  const db = getDb();
  const created = [];
  users.forEach(u => {
    channels.forEach(ch => {
      const deviceId = CHANNEL_TO_DEVICE[ch];
      const device = db.devices.find(d => d.DEVICE_ID === deviceId);
      const target = CHANNEL_CONTACT(u, ch);
      let result = 'Success';
      let message = `已透过 ${ch} 装置派发`;
      if (!target) {
        result = 'Fail';
        message = `发送失败：${u.USER_ID} 未设定 ${ch} 联络资料`;
      } else if (!device) {
        result = 'Fail';
        message = `发送失败：找不到 ${ch} 装置`;
      } else if (device.ENABLE !== 'Y') {
        result = 'Fail';
        message = `发送失败：${device.DEVICE_ID} 装置未启用`;
      } else if (['NG', 'Error', 'Close'].includes(device.DEVICE_STATUS)) {
        result = 'Fail';
        message = `发送失败：${device.DEVICE_ID} 装置状态 ${device.DEVICE_STATUS}`;
      }
      const row = {
        NOTIFY_KEY: nextKey('alarm_notifications', 'NTF', 4),
        ALARM_KEY: alarm.ALARM_KEY, USER_KEY: u.USER_KEY, LEVEL_ID: alarm.CURRENT_LEVEL,
        CHANNEL: ch, TARGET: target || '（未设定联络资料）', SEND_DT: nowIso(),
        RESULT: result, MESSAGE: message + (note ? `（${note}）` : ''), RETRY: note ? 1 : 0
      };
      db.alarm_notifications.push(row);
      created.push(row);
      if (device) {
        device.RECEIVED_COUNT = (device.RECEIVED_COUNT || 0) + 1;
        if (result === 'Success') device.SUCCESSFUL_COUNT = (device.SUCCESSFUL_COUNT || 0) + 1;
        else device.FAIL_COUNT = (device.FAIL_COUNT || 0) + 1;
        device.TRX_DATE = nowIso();
        if (device.DEVICE_STATUS === 'Unknown' && result === 'Success') {
          device.DEVICE_STATUS = 'OK';
          device.DEVICE_STATUS_DESC = '首次发送成功，装置运作正常';
        }
        if (device.DEVICE_STATUS === 'Unknown' && result === 'Fail') {
          device.DEVICE_STATUS = 'Error';
          device.DEVICE_STATUS_DESC = '首次发送失败';
        }
      }
    });
  });
  return created;
}

function startLevel(alarm, levelId, user) {
  const db = getDb();
  const levels = eventLevelsOf(alarm.EVENT_KEY);
  const level = levels.find(l => l.EVENT_LEVEL_ID === levelId);
  if (!level) return { ok: false, reason: 'no-level' };
  const groups = groupsOfLevel(level.EVENT_LEVEL_KEY);
  const channels = channelsOfLevel(level.EVENT_LEVEL_KEY);
  const users = usersOfLevel(level.EVENT_LEVEL_KEY);
  const required = requiredCount(level, users);
  const now = nowIso();
  alarm.CURRENT_LEVEL = levelId;
  alarm.LEVEL_PROCESS_DT = now;
  alarm.SEND_DT = now;
  alarm.ACK_REQUIRED = required;
  db.alarm_levels.push({
    LEVEL_RUN_KEY: nextKey('alarm_levels', 'ALV', 4),
    ALARM_KEY: alarm.ALARM_KEY, LEVEL_ID: levelId, START_DT: now,
    REQUIRED_ACK: required, ACK_COUNT: 0, RESEND_COUNT: 0,
    NEXT_RESEND_DT: Number(level.FAIL_RETRY_TIMES) > 0
      ? new Date(Date.now() + Number(level.FAIL_RETRY_INTERVAL || 60) * 1000).toISOString()
      : null,
    STATUS: 'Active', LEVEL_DESC: level.EVENT_LEVEL_DESC
  });
  addTransaction(alarm, 'Modify', 'Process', 'Process', user, `LEVEL-${levelId} 警报发送`);
  if (channels.length && users.length) {
    notifyUsers(alarm, level, users, channels);
  }
  save();
  return { ok: true, level, groups, channels, users, required };
}

function completeAlarm(alarm, user, note) {
  if (alarm.STATUS !== 'Process') return alarm;
  alarm.STATUS = 'Completed';
  alarm.COMPLETE_DT = nowIso();
  alarm.LAST_ACK_DT = alarm.LAST_ACK_DT || alarm.COMPLETE_DT;
  getDb().alarm_levels
    .filter(x => x.ALARM_KEY === alarm.ALARM_KEY && x.STATUS === 'Active')
    .forEach(x => { x.STATUS = 'Closed'; });
  addTransaction(alarm, 'AlarmComplete', 'Process', 'Completed', user, note || '回应人数达标，警报完成');
  save();
  return alarm;
}

function failAlarm(alarm, note) {
  if (alarm.STATUS !== 'Process') return alarm;
  alarm.STATUS = 'NoNextLevel';
  alarm.COMPLETE_DT = nowIso();
  getDb().alarm_levels
    .filter(x => x.ALARM_KEY === alarm.ALARM_KEY && x.STATUS === 'Active')
    .forEach(x => { x.STATUS = 'Closed'; });
  addTransaction(alarm, 'AlarmFail', 'Process', 'NoNextLevel', null, note || '已无下一层级可通知，警报失败');
  save();
  return alarm;
}

function createAlarmRecord({
  factoryKey, subsysKey, eqpKey, alarmSetting, event, title, content,
  receiveType, sourceType, isManual, priority
}) {
  const db = getDb();
  const alarm = {
    ALARM_KEY: nextKey('alarms', 'AL', 4),
    ALARM_ID: nextAlarmId(),
    TITLE: title, CONTENT: content, STATUS: 'Process',
    FACTORY_KEY: factoryKey, SUB_SYS_KEY: subsysKey, EQP_KEY: eqpKey || '*',
    ALARM_INFO_KEY: alarmSetting ? alarmSetting.ALARM_INFO_KEY : null,
    EVENT_KEY: event ? event.EVENT_KEY : null,
    CURRENT_LEVEL: 1, PRIORITY: priority || (alarmSetting && alarmSetting.EVENT_PTY_ID) || 5,
    CREATE_DT: nowIso(), FIRST_PROCESS_DT: nowIso(),
    LEVEL_PROCESS_DT: nowIso(), SEND_DT: nowIso(),
    LAST_ACK_DT: null, COMPLETE_DT: null,
    RECEIVE_TYPE: receiveType || 'WebService', ACK_CMT: null, TERMINATE_CMT: null,
    ACK_REQUIRED: null, IS_MANUAL: isManual ? 'Y' : 'N', SOURCE_TYPE: sourceType || 'Backfill'
  };
  db.alarms.unshift(alarm);
  addTransaction(alarm, 'Create', 'Open', 'Process', null,
    isManual ? '手动发送警报建立' : '警报建立');
  return alarm;
}

/* -------------------------------------------------------------- 对外：补登 */
function createBackfill({ user, factoryKey, subsysKey, eqpKey, alarmCode, title, content, receiveType }) {
  const db = getDb();
  const factory = db.factories.find(x => x.FACTORY_KEY === factoryKey && x.ACTIVE !== 'N');
  if (!factory) return { ok: false, invalidType: '未设定厂别', message: '厂别不存在或未启用' };
  const subsys = db.subsystems.find(x => x.SUB_SYS_KEY === subsysKey && x.ACTIVE !== 'N');
  if (!subsys) return { ok: false, invalidType: '未设定子系统', message: '子系统不存在或未启用' };
  const eqp = db.eqps.find(x => x.EQP_KEY === eqpKey && x.ACTIVE !== 'N');
  if (!eqp) return { ok: false, invalidType: '未设定机台', message: '机台不存在或未启用' };

  // 1) 精确匹配（含任一机台），2) 机台群组回退匹配
  let setting = db.alarm_settings.find(x =>
    x.ALARM_INFO_ID === alarmCode && x.FACTORY_KEY === factoryKey && x.SUB_SYS_KEY === subsysKey
    && (x.EQP_KEY === eqpKey || x.EQP_KEY === '*'));
  let matchedBy = 'exact';
  if (!setting) {
    const groupKeys = db.eqp_group_eqp.filter(x => x.EQP_KEY === eqpKey).map(x => x.EQP_GROUP_KEY);
    const peerKeys = db.eqp_group_eqp.filter(x => groupKeys.includes(x.EQP_GROUP_KEY)).map(x => x.EQP_KEY);
    setting = db.alarm_settings.find(x =>
      x.ALARM_INFO_ID === alarmCode && x.FACTORY_KEY === factoryKey && x.SUB_SYS_KEY === subsysKey
      && peerKeys.includes(x.EQP_KEY));
    matchedBy = 'group-fallback';
  }
  if (!setting) {
    const invalid = createInvalid({
      title: title || alarmCode, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '找不到事件', user,
      raw: { factoryId: factory.FACTORY_ID, subsysId: subsys.SUB_SYS_ID, eqpId: eqp.EQP_ID }
    });
    return { ok: false, invalid, invalidType: '找不到事件', message: '找不到对应的警报通知设定' };
  }
  if (setting.ACTIVE === 'N') {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '警报设定未启用', user,
      raw: { setting: setting.ALARM_INFO_ID }
    });
    return { ok: false, invalidType: '警报设定未启用', message: '警报通知设定已停用' };
  }
  const event = db.events.find(x => x.EVENT_KEY === setting.EVENT_KEY && x.ACTIVE !== 'N');
  if (!event) {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '找不到事件', user, raw: { setting: setting.ALARM_INFO_ID }
    });
    return { ok: false, invalidType: '找不到事件', message: '警报设定绑定的通知事件不存在' };
  }
  const levels = eventLevelsOf(event.EVENT_KEY);
  if (!levels.find(l => l.EVENT_LEVEL_ID === 1)) {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '未设定层级1', user, raw: { event: event.EVENT_ID }
    });
    return { ok: false, invalidType: '未设定层级1', message: '事件层级必须从 LEVEL-1 开始设定' };
  }
  const channels = channelsOfLevel(levels[0].EVENT_LEVEL_KEY);
  if (!channels.length) {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '未设定发送方式', user, raw: { event: event.EVENT_ID }
    });
    return { ok: false, invalidType: '未设定发送方式', message: 'LEVEL-1 未设定任何发送渠道' };
  }
  const users = usersOfLevel(levels[0].EVENT_LEVEL_KEY);
  if (!users.length) {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '未设定发送人员', user, raw: { event: event.EVENT_ID }
    });
    return { ok: false, invalidType: '未设定发送人员', message: 'LEVEL-1 对应群组内没有人员' };
  }

  // 忽略相同警报（依演示时钟换算）
  const ignoreSec = Number(setting.IGNORE_PERIOD || 900);
  const last = db.alarms
    .filter(x => x.FACTORY_KEY === factoryKey && x.SUB_SYS_KEY === subsysKey && x.EQP_KEY === eqpKey && x.ALARM_INFO_KEY === setting.ALARM_INFO_KEY)
    .sort((a, b) => new Date(b.CREATE_DT) - new Date(a.CREATE_DT))[0];
  if (last) {
    const elapsedDemo = (Date.now() - new Date(last.CREATE_DT).getTime()) / 1000 * demoFactor();
    if (elapsedDemo < ignoreSec) {
      createInvalid({
        title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
        alarmCode, receiveType, invalidType: '忽略相同警报', user,
        raw: { lastAlarm: last.ALARM_ID, elapsedDemo: Math.round(elapsedDemo), ignoreSec }
      });
      return { ok: false, invalidType: '忽略相同警报', message: `距离上次相同警报仅 ${Math.round(elapsedDemo)} 秒（忽略间隔 ${ignoreSec} 秒）` };
    }
  }

  // 子系统 BYPASS → 只记录
  if (subsys.BYPASS === 'Y') {
    const alarm = createAlarmRecord({
      factoryKey, subsysKey, eqpKey, alarmSetting: setting, event,
      title: title || 'Empty Subject', content: content || 'Empty Content',
      receiveType, sourceType: 'Backfill', isManual: false
    });
    alarm.STATUS = 'LogOnly';
    addTransaction(alarm, 'Modify', 'Process', 'LogOnly', user, `子系统 ${subsys.SUB_SYS_ID} BYPASS=Y，仅记录不发送`);
    save();
    return { ok: true, alarm: enrich(alarm, user), logOnly: true, matchedBy, message: '子系统 BYPASS=Y，警报仅记录不发送' };
  }

  // 机台型号 + 机况抑制
  const suppressed = db.eqp_type_status.find(x => x.EQP_TYPE_KEY === eqp.EQP_TYPE_KEY && x.EQP_STATUS_KEY === eqp.CURRENT_STATUS);
  if (suppressed) {
    createInvalid({
      title: title || setting.ALARM_ID_DESC, content, factoryKey, subsysKey, eqpKey,
      alarmCode, receiveType, invalidType: '在某机况下无需发送', user,
      raw: { eqpType: eqp.EQP_TYPE_KEY, status: eqp.CURRENT_STATUS }
    });
    return { ok: false, invalidType: '在某机况下无需发送', message: '该机台型号目前机况设定为不发警报' };
  }

  const alarm = createAlarmRecord({
    factoryKey, subsysKey, eqpKey, alarmSetting: setting, event,
    title: title || 'Empty Subject', content: content || 'Empty Content',
    receiveType, sourceType: 'Backfill', isManual: false,
    priority: Number(setting.EVENT_PTY_ID) || event.EVENT_PRIORITY_ID
  });
  const started = startLevel(alarm, 1, user);
  if (!started.ok) {
    alarm.STATUS = 'NoNextLevel';
    alarm.COMPLETE_DT = nowIso();
    addTransaction(alarm, 'AlarmFail', 'Process', 'NoNextLevel', user, 'LEVEL-1 无法发送');
    save();
    return { ok: true, alarm: enrich(alarm, user), warning: '警报已建立但 LEVEL-1 无法发送' };
  }
  save();
  applyAutoStatusForAlarm(alarm, user);
  return { ok: true, alarm: enrich(alarm, user), matchedBy, logOnly: false };
}

/* -------------------------------------------------------------- 对外：手动发送 */
function createManual({ user, factoryKey, subsysKey, userKeys, channels, title, content, requiredAck }) {
  const db = getDb();
  const factory = db.factories.find(x => x.FACTORY_KEY === factoryKey);
  if (!factory) return { ok: false, message: '请选择厂别' };
  const subsys = db.subsystems.find(x => x.SUB_SYS_KEY === subsysKey);
  if (!subsys) return { ok: false, message: '请选择子系统' };
  const recipients = db.users.filter(u => userKeys.includes(u.USER_KEY));
  if (!recipients.length) return { ok: false, message: '请选择至少一位接收人员' };
  if (!channels.length) return { ok: false, message: '请选择至少一种发送方式' };
  const alarm = createAlarmRecord({
    factoryKey, subsysKey, eqpKey: '*', alarmSetting: null, event: null,
    title: title || '手动发送警报', content: content || 'Empty Content',
    receiveType: 'WebPage', sourceType: 'Manual', isManual: true, priority: 9
  });
  const req = requiredAck === '*' ? recipients.length : Math.max(1, Number(requiredAck) || 1);
  alarm.ACK_REQUIRED = req;
  alarm.EVENT_KEY = null;
  db.alarm_levels.push({
    LEVEL_RUN_KEY: nextKey('alarm_levels', 'ALV', 4), ALARM_KEY: alarm.ALARM_KEY,
    LEVEL_ID: 1, START_DT: nowIso(), REQUIRED_ACK: req, ACK_COUNT: 0,
    RESEND_COUNT: 0, NEXT_RESEND_DT: null, STATUS: 'Active', LEVEL_DESC: '手动发送'
  });
  const fakeLevel = { EVENT_LEVEL_KEY: null, EVENT_LEVEL_ID: 1 };
  addTransaction(alarm, 'Modify', 'Process', 'Process', user, '手动警报发送');
  notifyUsers(alarm, fakeLevel, recipients, channels);
  save();
  return { ok: true, alarm: enrich(alarm, user) };
}

/* -------------------------------------------------------------- 对外：确认 / 中断 */
function ackAlarm({ user, alarmKey, cmt }) {
  const db = getDb();
  const alarm = db.alarms.find(x => x.ALARM_KEY === alarmKey);
  if (!alarm) return { ok: false, message: '警报不存在' };
  if (alarm.STATUS !== 'Process') return { ok: false, message: '该警报已非处理中状态' };
  const notified = db.alarm_notifications.some(x => x.ALARM_KEY === alarmKey && x.LEVEL_ID === alarm.CURRENT_LEVEL && x.USER_KEY === user.USER_KEY);
  if (!notified) return { ok: false, message: '您不是本层级被通知的人员，无法确认' };
  if (db.alarm_acks.some(x => x.ALARM_KEY === alarmKey && x.LEVEL_ID === alarm.CURRENT_LEVEL && x.USER_KEY === user.USER_KEY)) {
    return { ok: false, message: '您已确认过此警报' };
  }
  db.alarm_acks.push({
    ACK_KEY: nextKey('alarm_acks', 'ACK', 4), ALARM_KEY: alarmKey, USER_KEY: user.USER_KEY,
    LEVEL_ID: alarm.CURRENT_LEVEL, ACK_DT: nowIso(), ACK_CMT: cmt || null
  });
  alarm.LAST_ACK_DT = nowIso();
  alarm.ACK_CMT = cmt || alarm.ACK_CMT;
  const run = db.alarm_levels.find(x => x.ALARM_KEY === alarmKey && x.STATUS === 'Active');
  if (run) run.ACK_COUNT = (run.ACK_COUNT || 0) + 1;
  addTransaction(alarm, 'UserAck', 'Process', 'Process', user, `${user.USER_ID} 确认警报${cmt ? '：' + cmt : ''}`);
  const required = run ? run.REQUIRED_ACK : alarm.ACK_REQUIRED;
  let completed = false;
  if (required != null && run && run.ACK_COUNT >= required) {
    completeAlarm(alarm, user);
    completed = true;
  }
  save();
  return { ok: true, alarm: enrich(alarm, user), completed };
}

function terminateAlarm({ user, alarmKey, cmt }) {
  const db = getDb();
  const alarm = db.alarms.find(x => x.ALARM_KEY === alarmKey);
  if (!alarm) return { ok: false, message: '警报不存在' };
  if (alarm.STATUS !== 'Process') return { ok: false, message: '只有处理中的警报可以中断' };
  if (alarm.IS_MANUAL === 'Y') return { ok: false, message: '手动发送的警报不支援中断作业' };
  alarm.STATUS = 'Terminated';
  alarm.TERMINATE_CMT = cmt || null;
  alarm.COMPLETE_DT = nowIso();
  db.alarm_levels.filter(x => x.ALARM_KEY === alarmKey && x.STATUS === 'Active').forEach(x => { x.STATUS = 'Closed'; });
  addTransaction(alarm, 'Terminate', 'Process', 'Terminated', user, cmt || '人工强制中断');
  save();
  return { ok: true, alarm: enrich(alarm, user) };
}

/* -------------------------------------------------------------- 自动切机况 */
function applyAutoStatusForAlarm(alarm, user) {
  const db = getDb();
  const rules = db.auto_status_rules.filter(r => r.ACTIVE !== 'N' && r.ALARM_INFO_KEY === alarm.ALARM_INFO_KEY);
  rules.forEach(rule => {
    const eqpMatch = rule.EQP_KEY === '*' || rule.EQP_KEY === alarm.EQP_KEY;
    if (!eqpMatch) return;
    if (rule.CHAMBER) {
      const ch = db.chambers.find(c => c.PROCRSC_ID === rule.CHAMBER || c.PROCRSC_KEY === rule.CHAMBER);
      if (ch && ch.EQP_KEY !== alarm.EQP_KEY) return;
    }
    if (db.auto_status_logs.some(l => l.AUTO_KEY === rule.AUTO_KEY && l.ALARM_ID === alarm.ALARM_ID)) return;
    const eqp = db.eqps.find(e => e.EQP_KEY === alarm.EQP_KEY);
    if (!eqp) return;
    if (rule.INITIAL_STATUS && eqp.CURRENT_STATUS !== rule.INITIAL_STATUS) return;
    const target = db.eqp_status.find(s => s.EQP_STATUS_KEY === rule.TARGET_STATUS);
    if (!target) return;
    const from = db.eqp_status.find(s => s.EQP_STATUS_KEY === eqp.CURRENT_STATUS);
    eqp.CURRENT_STATUS = rule.TARGET_STATUS;
    eqp.MTR_DATE = nowIso();
    eqp.MTR_USER_NAME = 'AUTO';
    db.auto_status_logs.unshift({
      ALOG_KEY: nextKey('auto_status_logs', 'ALOG', 3), AUTO_KEY: rule.AUTO_KEY,
      EQP_ID: eqp.EQP_ID, ALARM_ID: alarm.ALARM_ID,
      FROM_STATUS: from ? from.EQP_STATUS_ID : '', TO_STATUS: target.EQP_STATUS_ID,
      TRX_DT: nowIso(), RESULT: 'Success',
      MESSAGE: `依规则 ${rule.AUTO_ID} 自动切换${rule.RELATED_CHAMBER === 'Y' && rule.CHAMBER ? '，联动 Chamber ' + rule.CHAMBER : ''}`
    });
    if (db.auto_status_logs.length > 500) db.auto_status_logs.length = 500;
    addHistory({
      table: 'eqps', recordKey: eqp.EQP_KEY, label: eqp.EQP_ID, action: 'Modify',
      before: { CURRENT_STATUS: from ? from.EQP_STATUS_ID : '' },
      after: { CURRENT_STATUS: target.EQP_STATUS_ID },
      user: user || { USER_KEY: null, USER_ID: 'AUTO', USER_NAME: '自动切机况' }
    });
  });
  save();
}

function scanAutoStatus(user) {
  const db = getDb();
  const recent = db.alarms.filter(a => ['Process', 'Completed'].includes(a.STATUS)
    && Date.now() - new Date(a.CREATE_DT).getTime() < 30 * 60000);
  recent.forEach(a => applyAutoStatusForAlarm(a, user));
  return db.auto_status_logs.slice(0, 20);
}

/* -------------------------------------------------------------- 定时器 */
function tick() {
  const db = getDb();
  const factor = demoFactor();
  let changed = false;
  const now = Date.now();
  db.alarms.filter(a => a.STATUS === 'Process').forEach(alarm => {
    const run = db.alarm_levels.find(x => x.ALARM_KEY === alarm.ALARM_KEY && x.STATUS === 'Active');
    if (!run) return;
    const required = run.REQUIRED_ACK;
    if (required != null && run.ACK_COUNT >= required && required > 0) {
      completeAlarm(alarm, null, '回应人数达标，系统自动完成');
      changed = true;
      return;
    }
    const level = alarm.EVENT_KEY ? eventLevelsOf(alarm.EVENT_KEY).find(l => l.EVENT_LEVEL_ID === alarm.CURRENT_LEVEL) : null;
    const elapsed = now - new Date(run.START_DT).getTime();
    const intervalMs = alarm.IS_MANUAL === 'Y'
      ? 30 * 60000 / factor
      : (Number(level && level.LEVEL_INTERVAL) || 10) * 60000 / factor;
    if (elapsed >= intervalMs) {
      if (alarm.IS_MANUAL === 'Y') {
        failAlarm(alarm, '手动警报逾时未达回应人数（预设 30 分钟）');
        changed = true;
        return;
      }
      const levels = eventLevelsOf(alarm.EVENT_KEY);
      const next = levels.find(l => l.EVENT_LEVEL_ID === alarm.CURRENT_LEVEL + 1);
      if (next) {
        run.STATUS = 'Closed';
        addTransaction(alarm, 'LevelUpgrade', 'Process', 'Process', null, `LEVEL-${alarm.CURRENT_LEVEL} 逾时未达回应人数，升级至 LEVEL-${next.EVENT_LEVEL_ID}`);
        const res = startLevel(alarm, next.EVENT_LEVEL_ID, null);
        if (!res.ok) failAlarm(alarm, '下一层级无法发送');
        changed = true;
        return;
      }
      failAlarm(alarm, '已通知至最高层级且未达回应人数');
      changed = true;
      return;
    }
    if (level && Number(level.FAIL_RETRY_TIMES) > 0 && run.NEXT_RESEND_DT && now >= new Date(run.NEXT_RESEND_DT).getTime()) {
      if (run.RESEND_COUNT < Number(level.FAIL_RETRY_TIMES)) {
        const groups = groupsOfLevel(level.EVENT_LEVEL_KEY);
        const channels = channelsOfLevel(level.EVENT_LEVEL_KEY);
        const users = usersOfLevel(level.EVENT_LEVEL_KEY);
        const ackedKeys = db.alarm_acks
          .filter(x => x.ALARM_KEY === alarm.ALARM_KEY && x.LEVEL_ID === alarm.CURRENT_LEVEL)
          .map(x => x.USER_KEY);
        const pending = users.filter(u => !ackedKeys.includes(u.USER_KEY));
        if (pending.length && channels.length) {
          notifyUsers(alarm, level, pending, channels, `第 ${run.RESEND_COUNT + 1} 次重送`);
          addTransaction(alarm, 'Modify', 'Process', 'Process', null,
            `LEVEL-${alarm.CURRENT_LEVEL} 失败重送第 ${run.RESEND_COUNT + 1} 次`);
        }
        run.RESEND_COUNT = (run.RESEND_COUNT || 0) + 1;
        run.NEXT_RESEND_DT = new Date(now + Number(level.FAIL_RETRY_INTERVAL || 60) * 1000).toISOString();
        changed = true;
      }
    }
  });
  if (changed) save();
}

let tickTimer = null;
let autoTimer = null;
function startEngine() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    try { tick(); } catch (err) { console.error('[AMS] 警报引擎错误', err); }
  }, 2000);
  autoTimer = setInterval(() => {
    try { scanAutoStatus(null); } catch (err) { console.error('[AMS] 自动切机况错误', err); }
  }, 5 * 60000);
  // 启动后先跑一次，让种子中的处理中警报进入时序
  setTimeout(() => { try { tick(); } catch (e) { /* ignore */ } }, 3000);
}

function getAlarmDetail(key, user) {
  const db = getDb();
  const alarm = db.alarms.find(x => x.ALARM_KEY === key || x.ALARM_ID === key);
  if (!alarm) return null;
  const base = enrich(alarm, user);
  return {
    ...base,
    LEVELS: db.alarm_levels.filter(x => x.ALARM_KEY === alarm.ALARM_KEY).sort((a, b) => a.LEVEL_ID - b.LEVEL_ID),
    NOTIFICATIONS: db.alarm_notifications.filter(x => x.ALARM_KEY === alarm.ALARM_KEY)
      .sort((a, b) => new Date(b.SEND_DT) - new Date(a.SEND_DT))
      .map(n => {
        const u = db.users.find(x => x.USER_KEY === n.USER_KEY);
        return { ...n, USER_ID: u ? u.USER_ID : '', USER_NAME: u ? u.USER_NAME : '' };
      }),
    ACKS: db.alarm_acks.filter(x => x.ALARM_KEY === alarm.ALARM_KEY)
      .sort((a, b) => new Date(b.ACK_DT) - new Date(a.ACK_DT))
      .map(n => {
        const u = db.users.find(x => x.USER_KEY === n.USER_KEY);
        return { ...n, USER_ID: u ? u.USER_ID : '', USER_NAME: u ? u.USER_NAME : '' };
      }),
    TRANSACTIONS: db.alarm_transactions.filter(x => x.ALARM_KEY === alarm.ALARM_KEY)
      .sort((a, b) => a.SEQ - b.SEQ)
      .map(t => {
        const u = db.users.find(x => x.USER_KEY === t.USER_KEY);
        return { ...t, USER_ID: u ? u.USER_ID : 'SYSTEM', USER_NAME: u ? u.USER_NAME : '系统' };
      })
  };
}

module.exports = {
  enrich,
  createBackfill,
  createManual,
  ackAlarm,
  terminateAlarm,
  tick,
  startEngine,
  scanAutoStatus,
  getAlarmDetail,
  usersOfLevel,
  channelsOfLevel,
  eventLevelsOf,
  applyAutoStatusForAlarm
};
