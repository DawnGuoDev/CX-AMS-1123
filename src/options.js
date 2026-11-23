'use strict';

const { getDb } = require('./db');

const opt = (value, label, extra = {}) => ({ value, label, ...extra });

function buildOptions() {
  const db = getDb();
  const active = (rows) => rows.filter(x => x.ACTIVE !== 'N');
  const factories = active(db.factories).map(x => opt(x.FACTORY_KEY, `${x.FACTORY_ID} ${x.FACTORY_NAME}`, { code: x.FACTORY_ID, name: x.FACTORY_NAME }));
  const subsystems = active(db.subsystems).map(x => opt(x.SUB_SYS_KEY, `${x.SUB_SYS_ID} ${x.SUB_SYS_NAME}`, { code: x.SUB_SYS_ID, name: x.SUB_SYS_NAME, bypass: x.BYPASS }));
  const eqps = active(db.eqps).map(x => {
    const type = db.eqp_types.find(t => t.EQP_TYPE_KEY === x.EQP_TYPE_KEY);
    const status = db.eqp_status.find(s => s.EQP_STATUS_KEY === x.CURRENT_STATUS);
    return opt(x.EQP_KEY, `${x.EQP_ID} ${x.EQP_NAME}`, {
      code: x.EQP_ID, name: x.EQP_NAME,
      type: type ? type.EQP_TYPE_ID : '', typeKey: x.EQP_TYPE_KEY,
      status: status ? status.EQP_STATUS_ID : '', statusKey: x.CURRENT_STATUS
    });
  });
  const eqpsWithAny = [opt('*', '* 任一机台', { code: '*', name: '任一机台' }), ...eqps];
  const eqpGroups = active(db.eqp_groups).map(x => opt(x.EQP_GROUP_KEY, `${x.EQP_GROUP_ID} ${x.EQP_GROUP_NAME}`, { code: x.EQP_GROUP_ID, name: x.EQP_GROUP_NAME }));
  const eqpTypes = active(db.eqp_types).map(x => opt(x.EQP_TYPE_KEY, `${x.EQP_TYPE_ID} ${x.EQP_TYPE_DESC}`, { code: x.EQP_TYPE_ID, name: x.EQP_TYPE_DESC }));
  const eqpStatus = active(db.eqp_status).map(x => opt(x.EQP_STATUS_KEY, `${x.EQP_STATUS_ID} ${x.EQP_STATUS_DESC}`, { code: x.EQP_STATUS_ID, name: x.EQP_STATUS_DESC }));
  const users = active(db.users).map(x => opt(x.USER_KEY, `${x.USER_ID} ${x.USER_NAME}`, {
    code: x.USER_ID, name: x.USER_NAME, organ: x.ORGAN_KEY, mail: x.E_MAIL
  }));
  const userGroups = active(db.user_groups).map(x => opt(x.GROUP_KEY, `${x.GROUP_ID} ${x.GROUP_NAME}`, { code: x.GROUP_ID, name: x.GROUP_NAME }));
  const events = active(db.events).map(x => {
    const f = db.factories.find(y => y.FACTORY_KEY === x.FACTORY_KEY);
    const s = db.subsystems.find(y => y.SUB_SYS_KEY === x.SUB_SYS_KEY);
    return opt(x.EVENT_KEY, `${x.EVENT_ID} ${x.EVENT_NAME}`, {
      code: x.EVENT_ID, name: x.EVENT_NAME,
      factoryKey: x.FACTORY_KEY, subsysKey: x.SUB_SYS_KEY,
      factory: f ? f.FACTORY_ID : '', subsys: s ? s.SUB_SYS_ID : '',
      priority: x.EVENT_PRIORITY_ID
    });
  });
  const eventGroups = active(db.event_groups).map(x => {
    const f = db.factories.find(y => y.FACTORY_KEY === x.FACTORY_KEY);
    const s = db.subsystems.find(y => y.SUB_SYS_KEY === x.SUB_SYS_KEY);
    const memberCount = db.event_group_users.filter(y => y.EVENT_GROUP_KEY === x.EVENT_GROUP_KEY).length;
    return opt(x.EVENT_GROUP_KEY, `${x.EVENT_GROUP_ID} ${x.EVENT_GROUP_NAME}`, {
      code: x.EVENT_GROUP_ID, name: x.EVENT_GROUP_NAME,
      factoryKey: x.FACTORY_KEY, subsysKey: x.SUB_SYS_KEY,
      factory: f ? f.FACTORY_ID : '', subsys: s ? s.SUB_SYS_ID : '',
      memberCount
    });
  });
  const alarmSettings = active(db.alarm_settings).map(x => opt(x.ALARM_INFO_KEY, `${x.ALARM_INFO_ID} ${x.ALARM_ID_DESC}`, {
    code: x.ALARM_INFO_ID, name: x.ALARM_ID_DESC, factoryKey: x.FACTORY_KEY, subsysKey: x.SUB_SYS_KEY
  }));
  const chambers = active(db.chambers).map(x => {
    const e = db.eqps.find(y => y.EQP_KEY === x.EQP_KEY);
    return opt(x.PROCRSC_KEY, `${x.PROCRSC_ID} ${x.CHAMBER_NAME}`, { code: x.PROCRSC_ID, name: x.CHAMBER_NAME, eqp: e ? e.EQP_ID : '', eqpKey: x.EQP_KEY });
  });

  const subsystemByFactory = {};
  db.factory_subsys.forEach(fs => {
    const s = db.subsystems.find(x => x.SUB_SYS_KEY === fs.SUB_SYS_KEY);
    if (!s || s.ACTIVE === 'N') return;
    (subsystemByFactory[fs.FACTORY_KEY] = subsystemByFactory[fs.FACTORY_KEY] || []).push(
      opt(s.SUB_SYS_KEY, `${s.SUB_SYS_ID} ${s.SUB_SYS_NAME}`, { code: s.SUB_SYS_ID, name: s.SUB_SYS_NAME })
    );
  });
  const eventByFactorySubsys = {};
  events.forEach(e => {
    const key = e.factoryKey + '||' + e.subsysKey;
    (eventByFactorySubsys[key] = eventByFactorySubsys[key] || []).push(e);
  });
  const groupByFactorySubsys = {};
  eventGroups.forEach(g => {
    const key = g.factoryKey + '||' + g.subsysKey;
    (groupByFactorySubsys[key] = groupByFactorySubsys[key] || []).push(g);
  });

  const departments = [...new Set(db.users.map(u => u.ORGAN_KEY).filter(Boolean))]
    .map(d => opt(d, d));

  return {
    factory: factories,
    subsystem: subsystems,
    subsystemByFactory,
    eqp: eqps,
    eqpWithAny: eqpsWithAny,
    eqpGroup: eqpGroups,
    eqpType: eqpTypes,
    eqpStatus,
    user: users,
    userGroup: userGroups,
    event: events,
    eventByFactorySubsys,
    eventGroup: eventGroups,
    groupByFactorySubsys,
    alarmSetting: alarmSettings,
    chamber: chambers,
    shift: [opt('A', 'A 班'), opt('B', 'B 班'), opt('C', 'C 班'), opt('D', 'D 班')],
    department: departments,
    gender: [opt('M', '男'), opt('F', '女')],
    yesno: [opt('Y', '是'), opt('N', '否')],
    channel: [opt('Email', '电子邮件'), opt('Sms', '手机短信'), opt('Phone', '网络语音电话'), opt('IM', 'IM（飞书）')],
    sendChannel: [opt('Email', '电子邮件'), opt('Sms', '手机短信'), opt('Phone', '电话语音'), opt('Voice', 'IPPhone 语音'), opt('IM', 'IM（飞书）')],
    alarmStatus: [
      opt('Open', 'Open'), opt('Notifying', 'Notifying'), opt('Process', 'Process'),
      opt('Completed', 'Completed'), opt('NoNextLevel', 'NoNextLevel'),
      opt('Terminated', 'Terminated'), opt('LogOnly', 'LogOnly')
    ],
    receiveType: [
      opt('FTP', 'FTP'), opt('Socket', 'Socket'), opt('HSMS', 'HSMS'),
      opt('WebPage', 'WebPage'), opt('WebService', 'WebService'), opt('BModule', 'BModule')
    ],
    invalidType: [
      '未设定厂别', '未设定子系统', '未设定机台', '找不到事件', '未设定发送方式',
      '未设定层级1', '未设定发送人员', '警报设定未启用', '忽略相同警报', '在某机况下无需发送'
    ].map(x => opt(x, x)),
    deviceStatus: [
      opt('OK', 'OK'), opt('Unknown', 'Unknown'), opt('Close', 'Close'),
      opt('Error', 'Error'), opt('NG', 'NG')
    ],
    trxType: [
      opt('Create', 'Create 警报建立'), opt('Modify', 'Modify 警报发送'),
      opt('UserAck', 'UserAck 使用者确认'), opt('LevelUpgrade', 'LevelUpgrade 警报升级'),
      opt('AlarmComplete', 'AlarmComplete 警报完成'), opt('AlarmFail', 'AlarmFail 警报失败'),
      opt('Terminate', 'Terminate 警报中断')
    ],
    activeStatus: [opt('Y', 'Y（显示）'), opt('N', 'N（隐藏）')],
    imGroupType: [
      opt('ByEventGroup', 'ByEventGroup（依事件建群）'),
      opt('ByNotifyGroup', 'ByNotifyGroup（依通知群组建群）'),
      opt('ByTool', 'ByTool（依机台建群）')
    ],
    inputType: [
      'TextBox', 'ComboBox', 'CheckBox', 'RadioButton', 'Number', 'ColorSelector',
      'RichTextBox', 'DateTimeBox', 'DateBox', 'TimeBox', 'Password', 'SysKey',
      'SerialKey', 'Active', 'SysDateTime', 'TrxUserKey', 'TrxUserSerialKey', 'HostIP',
      'HostName', 'TrxMode', 'ComboGrid'
    ].map(x => opt(x, x)),
    operator: ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'BETWEEN'].map(x => opt(x, x)),
    displayType: ['Grid', 'Chart', 'GridAndChart', 'TextBox'].map(x => opt(x, x)),
    reportDataSourceType: ['SQL', 'Procedure'].map(x => opt(x, x)),
    dataAfterQueryAction: ['None', 'DrillDown', 'Popup'].map(x => opt(x, x)),
    exportType: ['Excel', 'CSV', 'PDF'].map(x => opt(x, x)),
    pivotAxis: ['Column', 'Row', 'Value'].map(x => opt(x, x))
  };
}

function labelsOf(options, set) {
  const map = {};
  (options[set] || []).forEach(o => { map[o.value] = o.label; });
  return map;
}

module.exports = { buildOptions, labelsOf };
