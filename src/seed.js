'use strict';

const crypto = require('crypto');
const { MASTERS, MAPPINGS, MASTER_DETAILS, REPORT_SEEDS } = require('./metadata');

const hash = (pw) => crypto.createHash('sha256').update('ams::' + String(pw)).digest('hex');

function buildSeed() {
  const now = Date.now();
  const iso = (minsAgo = 0) => new Date(now - minsAgo * 60000).toISOString();
  const counters = {};
  const K = (table, prefix, width = 3) => {
    counters[table] = (counters[table] || 0) + 1;
    return prefix + String(counters[table]).padStart(width, '0');
  };

  const users = [];
  const factories = [];
  const subsystems = [];
  const eqpTypes = [];
  const eqpStatus = [];
  const eqps = [];
  const eqpGroups = [];
  const chambers = [];
  const eventGroups = [];
  const events = [];
  const eventLevels = [];
  const eventLevelGroups = [];
  const alarmSettings = [];
  const devices = [];
  const alarms = [];
  const alarmLevels = [];
  const alarmNotifications = [];
  const alarmAcks = [];
  const alarmTransactions = [];
  const invalidAlarms = [];
  const subjects = [];

  // ---------------------------------------------------------------- 使用者
  const userSpecs = [
    ['E0043258', 'BROCK', '陈柏睿', 'brock.chen@ams-fab.com', '13800003258', 'brock.chen', '3258', '设备工程部', 'A', '设备工程师', 'M'],
    ['E0043260', 'ALBERT', '林彦廷', 'albert.lin@ams-fab.com', '13800003260', 'albert.lin', '3260', '设备工程部', 'A', '资深设备工程师', 'M'],
    ['E0043271', 'AMY', '许雅婷', 'amy.hsu@ams-fab.com', '13800003271', 'amy.hsu', '3271', '制程工程部', 'B', '制程工程师', 'F'],
    ['E0043288', 'KEVIN', '王凯文', 'kevin.wang@ams-fab.com', '13800003288', 'kevin.wang', '3288', '制造部', 'A', '值班主管', 'M'],
    ['E0043295', 'GRACE', '刘佳颖', 'grace.liu@ams-fab.com', '13800003295', 'grace.liu', '3295', '厂务部', 'B', '厂务工程师', 'F'],
    ['E0043302', 'PETER', '吴柏翰', 'peter.wu@ams-fab.com', '13800003302', 'peter.wu', '3302', '设备工程部', 'C', '设备工程师', 'M'],
    ['E0043310', 'IVY', '蔡宜芳', 'ivy.tsai@ams-fab.com', '13800003310', 'ivy.tsai', '3310', '制程工程部', 'A', '制程工程师', 'F'],
    ['E0043325', 'MARK', '何孟勋', 'mark.ho@ams-fab.com', '13800003325', 'mark.ho', '3325', '制造部', 'B', '部门主管', 'M'],
    ['E0043333', 'NINA', '陈妮娜', 'nina.chen@ams-fab.com', '13800003333', 'nina.chen', '3333', 'CIM', 'A', '系统工程师', 'F'],
    ['E0043341', 'RAY', '张睿', 'ray.chang@ams-fab.com', '13800003341', 'ray.chang', '3341', '设备工程部', 'C', '设备副理', 'M'],
    ['E0043350', 'ZOE', '黄若薇', 'zoe.huang@ams-fab.com', '13800003350', 'zoe.huang', '3350', '品保部', 'A', '品保工程师', 'F'],
    ['E0043362', 'LEO', '林育贤', 'leo.lin@ams-fab.com', '13800003362', 'leo.lin', '3362', '制造部', 'C', '值班组长', 'M']
  ];
  userSpecs.forEach(([id, name, cn, mail, sms, im, ext, organ, shift, title, gender], i) => {
    users.push({
      USER_KEY: K('users', 'U'),
      USER_ID: id,
      USER_NAME: cn,
      ENGLISH_NAME: name,
      LAST_NAME: cn.slice(0, 1),
      FIRST_NAME: cn.slice(1),
      GENDER: gender,
      PASSWORD_HASH: hash('123456'),
      E_MAIL: mail,
      ALARM_SMS_TEL: sms,
      IM_ID: im,
      EXTENSION: ext,
      IPPHONE_IM: 'sip:' + id.toLowerCase(),
      PHONE: '03-5678' + String(100 + i).slice(-3),
      MOBILE: sms,
      TITLE: title,
      SHIFT_KEY: shift,
      ORGAN_KEY: organ,
      ACTIVE: 'Y',
      MTR_DATE: iso(60 * 24 * (7 + i)),
      MTR_USER_KEY: 'U001',
      MTR_USER_NAME: '陈柏睿'
    });
  });
  const U = Object.fromEntries(users.map(u => [u.USER_ID, u.USER_KEY]));

  // ---------------------------------------------------------------- 群组
  const groupSpecs = [
    ['EQP_PRINTER', '印刷设备组', '负责印刷机组日常维护与警报处理'],
    ['EQP_CVD', 'CVD 设备组', '负责 CVD 机组维护'],
    ['FDC_ENG', 'FDC 工程组', 'FDC 异常分析与制程改善'],
    ['SHIFT_SUP', '值班主管组', '各厂值班主管'],
    ['MES_OP', 'MES 值班组', 'MES 系统值班人员'],
    ['QA', '品保组', '品质异常与 SPC 管制']
  ];
  const userGroups = groupSpecs.map(([id, name, desc]) => ({
    GROUP_KEY: K('user_groups', 'UG', 2),
    GROUP_ID: id,
    GROUP_NAME: name,
    GROUP_DESC: desc,
    ACTIVE: 'Y',
    MTR_DATE: iso(60 * 24 * 12),
    MTR_USER_KEY: 'U001',
    MTR_USER_NAME: '陈柏睿'
  }));
  const G = Object.fromEntries(userGroups.map(g => [g.GROUP_ID, g.GROUP_KEY]));
  const userGroupUsers = [];
  const membership = {
    EQP_PRINTER: ['E0043258', 'E0043260', 'E0043302'],
    EQP_CVD: ['E0043302', 'E0043341', 'E0043258'],
    FDC_ENG: ['E0043260', 'E0043271', 'E0043310'],
    SHIFT_SUP: ['E0043288', 'E0043325', 'E0043362'],
    MES_OP: ['E0043333', 'E0043362', 'E0043288'],
    QA: ['E0043350', 'E0043271']
  };
  Object.entries(membership).forEach(([gid, ids]) => {
    ids.forEach(uid => userGroupUsers.push({
      MAP_KEY: K('user_group_users', 'UGU', 3),
      GROUP_KEY: G[gid],
      USER_KEY: U[uid]
    }));
  });

  // ---------------------------------------------------------------- 厂别
  [
    ['Fab01', '一厂', '桃园厂区 12 英寸晶圆厂'],
    ['Fab02', '二厂', '台中厂区 12 英寸晶圆厂'],
    ['Fab03', '三厂', '台南厂区 8 英寸晶圆厂']
  ].forEach(([id, name, desc]) => {
    factories.push({
      FACTORY_KEY: K('factories', 'F', 2), FACTORY_ID: id, FACTORY_NAME: name, FACTORY_DESC: desc,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 20), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const F = Object.fromEntries(factories.map(x => [x.FACTORY_ID, x.FACTORY_KEY]));

  // ---------------------------------------------------------------- 子系统
  [
    ['EAP', '设备自动化', 'N'],
    ['FDC', '故障检测与分类', 'N'],
    ['MES', '制造执行系统', 'N'],
    ['SPC', '统计制程管制', 'N'],
    ['EDC', '设备数据采集', 'Y']
  ].forEach(([id, name, bypass]) => {
    subsystems.push({
      SUB_SYS_KEY: K('subsystems', 'SS', 2), SUB_SYS_ID: id, SUB_SYS_NAME: name, BYPASS: bypass,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 18), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const SS = Object.fromEntries(subsystems.map(x => [x.SUB_SYS_ID, x.SUB_SYS_KEY]));

  const factorySubsys = [];
  const fsMap = { Fab01: ['EAP', 'FDC', 'MES', 'SPC', 'EDC'], Fab02: ['EAP', 'FDC', 'MES'], Fab03: ['MES', 'SPC', 'EDC'] };
  Object.entries(fsMap).forEach(([fid, sids]) => sids.forEach(sid => factorySubsys.push({
    MAP_KEY: K('factory_subsys', 'FS', 3), FACTORY_KEY: F[fid], SUB_SYS_KEY: SS[sid]
  })));

  // ---------------------------------------------------------------- 机台类型 / 状态
  [
    ['PRINTER', '印刷机'],
    ['CVD', '化学气相沉积机台'],
    ['ETCH', '蚀刻机'],
    ['CMP', '研磨机'],
    ['WET', '清洗机'],
    ['AOI', '光学检测机'],
    ['PVD', '物理气相沉积机台']
  ].forEach(([id, desc]) => {
    eqpTypes.push({
      EQP_TYPE_KEY: K('eqp_types', 'T', 2), EQP_TYPE_ID: id, EQP_TYPE_DESC: desc,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 25), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const T = Object.fromEntries(eqpTypes.map(x => [x.EQP_TYPE_ID, x.EQP_TYPE_KEY]));

  [
    ['RUN', '运行中'], ['IDLE', '待机'], ['MAINT', '保养中'],
    ['PM', '预防保养'], ['DOWN', '停机'], ['ENG', '工程模式']
  ].forEach(([id, desc]) => {
    eqpStatus.push({
      EQP_STATUS_KEY: K('eqp_status', 'ST', 2), EQP_STATUS_ID: id, EQP_STATUS_DESC: desc,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 25), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const ST = Object.fromEntries(eqpStatus.map(x => [x.EQP_STATUS_ID, x.EQP_STATUS_KEY]));

  [
    ['PRT01', '印刷机 A', 'A 线印刷机', 'PRINTER', 'RUN'],
    ['PRT02', '印刷机 B', 'B 线印刷机', 'PRINTER', 'RUN'],
    ['PRT03', '印刷机 C', 'C 线印刷机', 'PRINTER', 'RUN'],
    ['CVD01', 'CVD 机台 1', '薄膜沉积一机', 'CVD', 'RUN'],
    ['CVD02', 'CVD 机台 2', '薄膜沉积二机', 'CVD', 'RUN'],
    ['ETCH01', '蚀刻机 1', '蚀刻一机', 'ETCH', 'RUN'],
    ['ETCH02', '蚀刻机 2', '蚀刻二机', 'ETCH', 'RUN'],
    ['CMP01', '研磨机 1', 'CMP 一机', 'CMP', 'PM'],
    ['CMP02', '研磨机 2', 'CMP 二机', 'CMP', 'RUN'],
    ['WET01', '清洗机 1', '湿式清洗一机', 'WET', 'MAINT'],
    ['AOI01', '光学检测机 1', 'AOI 一机', 'AOI', 'RUN'],
    ['MTL01', '金属镀膜机 1', 'PVD 一机', 'PVD', 'RUN']
  ].forEach(([id, name, desc, type, status], i) => {
    eqps.push({
      EQP_KEY: K('eqps', 'EQP', 2), EQP_ID: id, EQP_NAME: name, EQP_DESC: desc,
      EQP_TYPE_KEY: T[type], CURRENT_STATUS: ST[status], ACTIVE: 'Y',
      MTR_DATE: iso(60 * 24 * (3 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const E = Object.fromEntries(eqps.map(x => [x.EQP_ID, x.EQP_KEY]));

  const groupSeeds = [
    ['$PRT', '印刷机组', '印刷机群组（回退匹配示范）', ['PRT01', 'PRT02', 'PRT03']],
    ['$CVD', 'CVD 机组', 'CVD 机台群组', ['CVD01', 'CVD02']],
    ['$ETCH', '蚀刻机组', '蚀刻机台群组', ['ETCH01', 'ETCH02']],
    ['$CMP', '研磨机组', 'CMP 机台群组', ['CMP01', 'CMP02']],
    ['LINE-A', 'A 线', 'A 线全机台群组', ['PRT01', 'CVD01', 'ETCH01', 'AOI01']]
  ];
  const eqpGroupEqp = [];
  groupSeeds.forEach(([id, name, desc, machines]) => {
    const gk = K('eqp_groups', 'G', 2);
    eqpGroups.push({
      EQP_GROUP_KEY: gk, EQP_GROUP_ID: id, EQP_GROUP_NAME: name, EQP_GROUP_DESC: desc,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 15), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
    machines.forEach(m => eqpGroupEqp.push({
      MAP_KEY: K('eqp_group_eqp', 'GE', 3), EQP_GROUP_KEY: gk, EQP_KEY: E[m]
    }));
  });
  const EG = Object.fromEntries(eqpGroups.map(x => [x.EQP_GROUP_ID, x.EQP_GROUP_KEY]));

  const eqpTypeStatus = [];
  [['CMP', 'PM'], ['WET', 'MAINT'], ['AOI', 'ENG']].forEach(([type, status]) => {
    eqpTypeStatus.push({
      MAP_KEY: K('eqp_type_status', 'TS', 3), EQP_TYPE_KEY: T[type], EQP_STATUS_KEY: ST[status]
    });
  });

  [
    ['PRT01-CH1', '印刷腔体 1', 'PRT01'],
    ['CVD01-CH1', '反应腔体 1', 'CVD01'],
    ['CVD01-CH2', '反应腔体 2', 'CVD01'],
    ['ETCH01-CH1', '蚀刻腔体 1', 'ETCH01'],
    ['ETCH01-CH2', '蚀刻腔体 2', 'ETCH01'],
    ['WET01-CH1', '清洗槽 1', 'WET01']
  ].forEach(([id, name, eqp]) => {
    chambers.push({
      PROCRSC_KEY: K('chambers', 'C', 2), PROCRSC_ID: id, CHAMBER_NAME: name, EQP_KEY: E[eqp],
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 10), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const CH = Object.fromEntries(chambers.map(x => [x.PROCRSC_ID, x.PROCRSC_KEY]));

  // ---------------------------------------------------------------- 事件群组
  const eventGroupUsers = [];
  const egSpecs = [
    ['EG_PRINTER_EQP', '印刷机设备人员', 'Fab01', 'MES', ['E0043258', 'E0043260', 'E0043302']],
    ['EG_PRINTER_SUP', '印刷机主管', 'Fab01', 'MES', ['E0043288', 'E0043325']],
    ['EG_FDC_ENG', 'FDC 设备工程师', 'Fab01', 'FDC', ['E0043260', 'E0043271', 'E0043310']],
    ['EG_FDC_SUP', 'FDC 值班主管', 'Fab01', 'FDC', ['E0043288', 'E0043325']],
    ['EG_EAP_ENG', 'EAP 设备工程师', 'Fab01', 'EAP', ['E0043258', 'E0043333', 'E0043341']],
    ['EG_EAP_SUP', 'EAP 值班主管', 'Fab01', 'EAP', ['E0043288', 'E0043362']],
    ['EG_MES_DUTY', 'MES 值班人员', 'Fab02', 'MES', ['E0043333', 'E0043362', 'E0043288']],
    ['EG_MES_SUP', 'MES 主管', 'Fab02', 'MES', ['E0043325', 'E0043288']],
    ['EG_SPC_ENG', 'SPC 制程工程师', 'Fab03', 'SPC', ['E0043271', 'E0043310', 'E0043350']],
    ['EG_SPC_SUP', 'SPC 主管', 'Fab03', 'SPC', ['E0043325', 'E0043288']],
    ['EG_EDC_ENG', 'EDC 设备工程师', 'Fab03', 'EDC', ['E0043295', 'E0043302', 'E0043341']],
    ['EG_EDC_SUP', 'EDC 值班主管', 'Fab03', 'EDC', ['E0043362', 'E0043325']]
  ];
  egSpecs.forEach(([id, name, fac, ss, members], i) => {
    const key = K('event_groups', 'EG', 2);
    eventGroups.push({
      EVENT_GROUP_KEY: key, EVENT_GROUP_ID: id, EVENT_GROUP_NAME: name,
      FACTORY_KEY: F[fac], SUB_SYS_KEY: SS[ss], EVENT_GROUP_DESC: name + ' 通知群组',
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * (4 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
    members.forEach(uid => {
      eventGroupUsers.push({
        MAP_KEY: K('event_group_users', 'EGU', 3), EVENT_GROUP_KEY: key, USER_KEY: U[uid]
      });
    });
  });
  const EGK = Object.fromEntries(eventGroups.map(x => [x.EVENT_GROUP_ID, x.EVENT_GROUP_KEY]));

  // ---------------------------------------------------------------- 事件与层级
  const eventSpecs = [
    {
      id: 'EVT_PRINTER_NODYE', name: '印刷机缺染料', fac: 'Fab01', ss: 'MES', priority: 9,
      desc: '印刷机染料不足，需设备人员补充',
      levels: [
        { desc: '设备人员', ack: '2', interval: 10, retry: 2, retryInterval: 30, groups: [['EG_PRINTER_EQP', 'Email;Sms;IM', 'ByEventGroup']] },
        { desc: '主管', ack: '1', interval: 20, retry: 1, retryInterval: 60, groups: [['EG_PRINTER_SUP', 'Email;Phone', '']] }
      ]
    },
    {
      id: 'EVT_EQP_OVERHEAT', name: '机台过热', fac: 'Fab01', ss: 'EAP', priority: 8,
      desc: '机台温度超过上限，需立即检查冷却系统',
      levels: [
        { desc: '设备人员', ack: '1', interval: 5, retry: 2, retryInterval: 20, groups: [['EG_EAP_ENG', 'Email;Sms;IM', 'ByEventGroup']] },
        { desc: '主管', ack: '1', interval: 10, retry: 1, retryInterval: 45, groups: [['EG_EAP_SUP', 'Email;Phone', '']] }
      ]
    },
    {
      id: 'EVT_FDC_GAS', name: '气体流量异常', fac: 'Fab01', ss: 'FDC', priority: 10,
      desc: 'FDC 侦测气体流量偏离管制范围',
      levels: [
        { desc: 'FDC 工程师', ack: '2', interval: 8, retry: 3, retryInterval: 30, groups: [['EG_FDC_ENG', 'Email;Sms;IM', 'ByEventGroup']] },
        { desc: '值班主管', ack: '1', interval: 15, retry: 1, retryInterval: 60, groups: [['EG_FDC_SUP', 'Email;Phone', '']] }
      ]
    },
    {
      id: 'EVT_MES_DOWN', name: 'MES 服务中断', fac: 'Fab02', ss: 'MES', priority: 9,
      desc: 'MES 服务无回应，产线可能停线',
      levels: [
        { desc: 'MES 值班', ack: '1', interval: 5, retry: 2, retryInterval: 30, groups: [['EG_MES_DUTY', 'Email;Sms;IM', 'ByEventGroup']] },
        { desc: 'MES 主管', ack: '1', interval: 15, retry: 1, retryInterval: 60, groups: [['EG_MES_SUP', 'Email;Phone', '']] }
      ]
    },
    {
      id: 'EVT_SPC_OOC', name: 'SPC 管制图异常', fac: 'Fab03', ss: 'SPC', priority: 7,
      desc: '制程管制图出现连续三点超出管制界限',
      levels: [
        { desc: '制程工程师', ack: '1', interval: 12, retry: 2, retryInterval: 40, groups: [['EG_SPC_ENG', 'Email;Sms', '']] },
        { desc: '主管', ack: '1', interval: 30, retry: 1, retryInterval: 90, groups: [['EG_SPC_SUP', 'Email;Phone', '']] }
      ]
    },
    {
      id: 'EVT_EDC_TIMEOUT', name: 'EDC 数据超时', fac: 'Fab03', ss: 'EDC', priority: 6,
      desc: '设备数据超过采集周期未回传',
      levels: [
        { desc: '设备人员', ack: '1', interval: 15, retry: 2, retryInterval: 60, groups: [['EG_EDC_ENG', 'Email;Sms;IM', 'ByTool']] }
      ]
    }
  ];

  eventSpecs.forEach(spec => {
    const eventKey = K('events', 'EVT', 2);
    events.push({
      EVENT_KEY: eventKey, EVENT_ID: spec.id, EVENT_NAME: spec.name,
      FACTORY_KEY: F[spec.fac], SUB_SYS_KEY: SS[spec.ss],
      EVENT_DESC: spec.desc, EVENT_PRIORITY_ID: spec.priority,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 9), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
    spec.levels.forEach((lv, idx) => {
      const levelKey = K('event_levels', 'LV', 4);
      eventLevels.push({
        EVENT_LEVEL_KEY: levelKey, EVENT_KEY: eventKey, EVENT_LEVEL_ID: idx + 1,
        EVENT_LEVEL_DESC: lv.desc, NUMBER_OF_ACK_USERS: lv.ack, LEVEL_INTERVAL: lv.interval,
        FAIL_RETRY_TIMES: lv.retry, FAIL_RETRY_INTERVAL: lv.retryInterval,
        ACTIVE: 'Y'
      });
      lv.groups.forEach(([gid, channels, imType], gi) => {
        eventLevelGroups.push({
          ELG_KEY: K('event_level_groups', 'ELG', 3),
          EVENT_LEVEL_KEY: levelKey, EVENT_GROUP_KEY: EGK[gid],
          ENABLE_SEND_DEVICES: channels, E_IM_GROUP_TYPE: imType || '', GROUP_SEQ: gi + 1,
          ACTIVE: 'Y'
        });
      });
    });
  });
  const EV = Object.fromEntries(events.map(x => [x.EVENT_ID, x.EVENT_KEY]));

  // ---------------------------------------------------------------- 警报通知设定
  const alarmSettingSpecs = [
    ['PRT_NODYE', '印刷机缺染料', 'Fab01', 'MES', 'PRT01', 'EVT_PRINTER_NODYE', 9, 900, '印刷机染料不足时通知设备补充'],
    ['PRT_MOTOR_ERR', '印刷机马达异常', 'Fab01', 'MES', 'PRT01', 'EVT_PRINTER_NODYE', 9, 600, '印刷机马达过载或异常'],
    ['EQP_OVERHEAT', '机台过热', 'Fab01', 'EAP', 'CVD01', 'EVT_EQP_OVERHEAT', 8, 600, '腔体温度超过 180°C'],
    ['FDC_GASFLOW', '气体流量异常', 'Fab01', 'FDC', 'ETCH01', 'EVT_FDC_GAS', 10, 300, '气体流量偏离 FDC 管制范围'],
    ['MES_SERVICE_DOWN', 'MES 服务中断', 'Fab02', 'MES', '*', 'EVT_MES_DOWN', 9, 900, 'MES 服务心跳丢失'],
    ['SPC_OOC', 'SPC 管制图异常', 'Fab03', 'SPC', 'AOI01', 'EVT_SPC_OOC', 7, 1200, '管制图连续三点异常'],
    ['EDC_TIMEOUT', 'EDC 数据超时', 'Fab03', 'EDC', 'WET01', 'EVT_EDC_TIMEOUT', 6, 1800, '设备数据超过 10 分钟未回传'],
    ['CMP_PAD_LIFE', '研磨垫寿命到期', 'Fab01', 'EAP', 'CMP01', 'EVT_EQP_OVERHEAT', 7, 1200, '研磨垫使用次数达到上限']
  ];
  alarmSettingSpecs.forEach(([id, desc, fac, ss, eqp, evt, pty, ignore, cmt]) => {
    alarmSettings.push({
      ALARM_INFO_KEY: K('alarm_settings', 'AS', 2),
      ALARM_INFO_ID: id, ALARM_ID_DESC: desc,
      FACTORY_KEY: F[fac], SUB_SYS_KEY: SS[ss], EQP_KEY: eqp === '*' ? '*' : E[eqp],
      EVENT_KEY: EV[evt], EVENT_PTY_ID: pty, IGNORE_PERIOD: ignore, ALARM_CMT: cmt,
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 6), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  const AS = Object.fromEntries(alarmSettings.map(x => [x.ALARM_INFO_ID, x.ALARM_INFO_KEY]));

  const chamberAlarm = [];
  [
    ['CVD01-CH1', 'EQP_OVERHEAT'],
    ['ETCH01-CH1', 'FDC_GASFLOW'],
    ['ETCH01-CH2', 'FDC_GASFLOW'],
    ['WET01-CH1', 'EDC_TIMEOUT']
  ].forEach(([ch, alarm]) => chamberAlarm.push({
    MAP_KEY: K('chamber_alarm', 'CA', 3), PROCRSC_KEY: CH[ch], ALARM_INFO_KEY: AS[alarm]
  }));

  // ---------------------------------------------------------------- 触发条件
  const alarmConditions = [
    {
      CONDITION_KEY: K('alarm_conditions', 'COND', 2),
      CONDITION_ID: 'AGC_DEVICE_NG',
      CONDITION_NAME: '设备状态 NG 告警',
      ALARM_INFO_KEY: AS.EQP_OVERHEAT,
      LAST_CHECK_DT: iso(6), DELAY_TIME: 5,
      ALARM_MSG_SQL: "SELECT DEVICE_ID, DEVICE_STATUS, TRX_DATE FROM SALM_AGENT_DEVICE WHERE DEVICE_STATUS IN ('NG','Error')",
      DATE_CONDITION_FIELD: 'TRX_DATE', DATE_TIME_TYPE: 'DateTime',
      ALARM_SUBJECT: '设备 {Param.DEVICE_ID} 状态异常：{Param.DEVICE_STATUS}',
      ALARM_CONTENT: '设备 {Param.DEVICE_ID} 于 {Param.TRX_DATE} 回报状态 {Param.DEVICE_STATUS}，请尽速检查。',
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 4), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    },
    {
      CONDITION_KEY: K('alarm_conditions', 'COND', 2),
      CONDITION_ID: 'AGC_TEMP_OVER',
      CONDITION_NAME: '腔体温度连续超限',
      ALARM_INFO_KEY: AS.EQP_OVERHEAT,
      LAST_CHECK_DT: iso(12), DELAY_TIME: 10,
      ALARM_MSG_SQL: 'SELECT EQP_ID, CHAMBER_ID, TEMP, LIMIT_VALUE, TRX_DATE FROM SALM_CHAMBER_TEMP WHERE TEMP > LIMIT_VALUE',
      DATE_CONDITION_FIELD: 'TRX_DATE', DATE_TIME_TYPE: 'DateTime',
      ALARM_SUBJECT: '腔体 {Param.CHAMBER_ID} 温度超限（{Param.TEMP}°C）',
      ALARM_CONTENT: '机台 {Param.EQP_ID} 的腔体 {Param.CHAMBER_ID} 温度 {Param.TEMP}°C 超过上限 {Param.LIMIT_VALUE}°C。',
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 3), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    }
  ];

  // ---------------------------------------------------------------- 装置
  const deviceSpecs = [
    ['ServerMain01', 'RTAgent01', 'Email01', 'OK', '邮件装置运作正常', 'Y', 18422, 18390, 32],
    ['ServerMain01', 'RTAgent01', 'Sms01', 'OK', '短信网关运作正常', 'Y', 9231, 9204, 27],
    ['ServerMain01', 'RTAgent01', 'Phone01', 'NG', '基础连接已断开：传送时发生未预期的错误', 'N', 1870, 1532, 338],
    ['ServerMain01', 'RTAgent01', 'Im01', 'OK', '飞书 IM 装置运作正常', 'Y', 7721, 7710, 11],
    ['ServerMain01', 'RTAgent01', 'TeamPlus01', 'Unknown', '尚未进行首次验证发送', 'Y', 0, 0, 0],
    ['ServerMain01', 'RTAgent02', 'Email02', 'OK', '备援邮件装置运作正常', 'Y', 6055, 6051, 4],
    ['ServerMain01', 'RTAgent02', 'Sms02', 'OK', '备援短信装置运作正常', 'Y', 3022, 3019, 3],
    ['ServerMain02', 'RTAgent03', 'Email11', 'OK', '邮件装置运作正常', 'Y', 4210, 4201, 9],
    ['ServerMain02', 'RTAgent03', 'Phone11', 'Unknown', '尚未进行首次验证发送', 'Y', 0, 0, 0],
    ['ServerMain02', 'RTAgent03', 'Sms11', 'OK', '短信装置运作正常', 'Y', 2104, 2100, 4],
    ['ServerMain02', 'BackupAgent01', 'Fax01', 'Close', '装置已停用', 'N', 120, 118, 2]
  ];
  deviceSpecs.forEach(([server, agent, id, status, desc, enable, recv, ok, fail], i) => {
    devices.push({
      DEVICE_KEY: K('devices', 'D', 3), SERVER_ID: server, AGENT_ID: agent, DEVICE_ID: id,
      DEVICE_STATUS: status, DEVICE_STATUS_DESC: desc, ENABLE: enable, PRIORITY: i + 1,
      RECEIVED_COUNT: recv, SUCCESSFUL_COUNT: ok, FAIL_COUNT: fail,
      TRX_DATE: iso(2 + i * 3)
    });
  });

  // ---------------------------------------------------------------- 历史警报
  const alarmIdBase = 1000;
  let alarmIdSeq = alarmIdBase;
  const nextAlarmId = () => '0000000000' + (++alarmIdSeq).toString(16).toUpperCase().padStart(5, '0');

  function usersOfLevel(levelKey) {
    const groupKeys = eventLevelGroups.filter(x => x.EVENT_LEVEL_KEY === levelKey).map(x => x.EVENT_GROUP_KEY);
    const uKeys = [...new Set(eventGroupUsers.filter(x => groupKeys.includes(x.EVENT_GROUP_KEY)).map(x => x.USER_KEY))];
    return uKeys.map(k => users.find(u => u.USER_KEY === k)).filter(Boolean);
  }
  function channelsOfLevel(levelKey) {
    const list = eventLevelGroups.filter(x => x.EVENT_LEVEL_KEY === levelKey)
      .flatMap(x => String(x.ENABLE_SEND_DEVICES || '').split(';').filter(Boolean));
    return [...new Set(list)];
  }
  const channelTarget = (u, ch) => {
    if (ch === 'Email') return u.E_MAIL;
    if (ch === 'Sms') return u.ALARM_SMS_TEL;
    if (ch === 'Phone' || ch === 'Voice') return u.EXTENSION;
    if (ch === 'IM') return u.IM_ID;
    return '';
  };
  const channelDevice = (ch) => ({
    Email: 'Email01', Sms: 'Sms01', Phone: 'Phone01', Voice: 'Phone01', IM: 'Im01'
  }[ch] || 'Email01');

  function makeAlarm(spec) {
    const setting = alarmSettings.find(x => x.ALARM_INFO_ID === spec.alarmCode);
    const event = spec.eventCode ? events.find(x => x.EVENT_ID === spec.eventCode) : setting && events.find(x => x.EVENT_KEY === setting.EVENT_KEY);
    const alarmKey = K('alarms', 'AL', 4);
    const alarmId = nextAlarmId();
    const createDt = iso(spec.createdMinAgo);
    const levels = event ? eventLevels.filter(x => x.EVENT_KEY === event.EVENT_KEY).sort((a, b) => a.EVENT_LEVEL_ID - b.EVENT_LEVEL_ID) : [];
    const currentLevel = spec.currentLevel || 1;
    const status = spec.status;
    let firstProcess = spec.status === 'LogOnly' ? null : new Date(new Date(createDt).getTime() + 4000).toISOString();
    let levelProcessDt = firstProcess;
    let sendDt = firstProcess;
    let lastAck = null;
    let completeDt = null;
    if (status === 'Completed' || status === 'NoNextLevel' || status === 'Terminated') {
      completeDt = new Date(new Date(createDt).getTime() + (spec.durationMin || 18) * 60000).toISOString();
    }
    const alarm = {
      ALARM_KEY: alarmKey, ALARM_ID: alarmId, TITLE: spec.title, CONTENT: spec.content,
      STATUS: status, FACTORY_KEY: F[spec.fac], SUB_SYS_KEY: SS[spec.ss],
      EQP_KEY: spec.eqp === '*' ? '*' : E[spec.eqp], ALARM_INFO_KEY: setting ? setting.ALARM_INFO_KEY : null,
      EVENT_KEY: event ? event.EVENT_KEY : null, CURRENT_LEVEL: currentLevel,
      PRIORITY: spec.priority || (setting && setting.EVENT_PTY_ID) || 5,
      CREATE_DT: createDt, FIRST_PROCESS_DT: firstProcess,
      LEVEL_PROCESS_DT: levelProcessDt, SEND_DT: sendDt,
      LAST_ACK_DT: null, COMPLETE_DT: completeDt,
      RECEIVE_TYPE: spec.receiveType || 'WebService', ACK_CMT: spec.ackCmt || null,
      TERMINATE_CMT: spec.terminateCmt || null, ACK_REQUIRED: null,
      IS_MANUAL: spec.isManual ? 'Y' : 'N', SOURCE_TYPE: spec.sourceType || 'Backfill',
      CHANNEL_LIST: null
    };
    alarms.push(alarm);

    let trxSeq = 0;
    const addTrx = (type, before, after, dt, note, userKey) => {
      alarmTransactions.push({
        TRX_KEY: K('alarm_transactions', 'TRX', 4), ALARM_KEY: alarmKey, SEQ: ++trxSeq,
        TRX_TYPE: type, STATUS_BEFORE: before, STATUS_AFTER: after,
        USER_KEY: userKey || null, TRX_DT: dt, NOTE: note || null
      });
    };
    addTrx('Create', 'Open', status === 'LogOnly' ? 'LogOnly' : 'Process', createDt,
      status === 'LogOnly' ? '子系统 BYPASS=Y，仅记录不发送' : '警报建立');

    if (status === 'LogOnly') {
      return alarm;
    }

    const levelCount = status === 'Completed' ? Math.max(currentLevel, spec.ackLevel || currentLevel)
      : status === 'NoNextLevel' ? Math.max(currentLevel, levels.length)
        : status === 'Terminated' ? currentLevel : currentLevel;
    let lastLevelUsers = [];
    for (let i = 1; i <= levelCount; i += 1) {
      const lv = levels[i - 1];
      if (!lv) break;
      const isCurrent = i === currentLevel && status === 'Process';
      const startMin = status === 'Process' ? (isCurrent ? spec.levelStartSecAgo / 60 : spec.createdMinAgo - (i - 1) * 5) : spec.createdMinAgo - (i - 1) * (lv.LEVEL_INTERVAL || 5);
      const startDt = status === 'Process' && isCurrent
        ? new Date(now - (spec.levelStartSecAgo || 25) * 1000).toISOString()
        : new Date(new Date(createDt).getTime() + (i - 1) * (lv.LEVEL_INTERVAL || 5) * 60000).toISOString();
      const lvUsers = usersOfLevel(lv.EVENT_LEVEL_KEY);
      lastLevelUsers = lvUsers;
      const required = lv.NUMBER_OF_ACK_USERS === '*' ? lvUsers.length : Number(lv.NUMBER_OF_ACK_USERS) || 0;
      let ackCount = 0;
      if (status === 'Completed') ackCount = required;
      else if (spec.partialAck && i === currentLevel) ackCount = spec.partialAck;
      else if (status === 'Process' && i < currentLevel) ackCount = 0;
      else if (status === 'Terminated' && i === currentLevel) ackCount = spec.partialAck || 0;
      alarmLevels.push({
        LEVEL_RUN_KEY: K('alarm_levels', 'ALV', 4), ALARM_KEY: alarmKey, LEVEL_ID: i,
        START_DT: startDt, REQUIRED_ACK: required, ACK_COUNT: ackCount,
        RESEND_COUNT: spec.resendCount || 0, NEXT_RESEND_DT: null,
        STATUS: status === 'Process' ? (i < currentLevel ? 'Closed' : 'Active') : 'Closed',
        LEVEL_DESC: lv.EVENT_LEVEL_DESC
      });
      if (i === currentLevel) {
        alarm.ACK_REQUIRED = required;
        alarm.LEVEL_PROCESS_DT = startDt;
        alarm.SEND_DT = startDt;
        levelProcessDt = startDt;
        sendDt = startDt;
      }
      if (i > 1) addTrx('LevelUpgrade', 'Process', 'Process', startDt, `升级至 LEVEL-${i}`);
      addTrx('Modify', 'Process', 'Process', startDt, `LEVEL-${i} 警报发送`);
      const chs = channelsOfLevel(lv.EVENT_LEVEL_KEY);
      lvUsers.forEach((u, ui) => {
        chs.forEach(ch => {
          const target = channelTarget(u, ch);
          let result = target ? 'Success' : 'Fail';
          if (status === 'Terminated' && i === currentLevel) result = target ? 'Success' : 'Fail';
          if (spec.failChannel && ch === spec.failChannel) result = 'Fail';
          alarmNotifications.push({
            NOTIFY_KEY: K('alarm_notifications', 'NTF', 4), ALARM_KEY: alarmKey, USER_KEY: u.USER_KEY,
            LEVEL_ID: i, CHANNEL: ch, TARGET: target || '（未设定联络资料）',
            SEND_DT: startDt, RESULT: result,
            MESSAGE: result === 'Success' ? '已派发至 ' + ch + ' 装置' : '发送失败：使用者未设定 ' + ch + ' 联络资料',
            RETRY: 0
          });
        });
      });
      const ackUsers = spec.ackUsers && spec.ackUsers.length ? spec.ackUsers : lvUsers.slice(0, ackCount).map(u => u.USER_ID);
      for (let ai = 0; ai < ackCount; ai += 1) {
        const uid = ackUsers[ai] || lvUsers[ai] && lvUsers[ai].USER_ID;
        const u = users.find(x => x.USER_ID === uid);
        if (!u) continue;
        const ackDt = new Date(new Date(startDt).getTime() + 45000).toISOString();
        alarmAcks.push({
          ACK_KEY: K('alarm_acks', 'ACK', 4), ALARM_KEY: alarmKey, USER_KEY: u.USER_KEY,
          LEVEL_ID: i, ACK_DT: ackDt, ACK_CMT: '已至现场确认并处理'
        });
        addTrx('UserAck', 'Process', 'Process', ackDt, u.USER_ID + ' 确认警报', u.USER_KEY);
        lastAck = ackDt;
      }
    }

    if (status === 'Completed') {
      alarm.COMPLETE_DT = completeDt;
      alarm.LAST_ACK_DT = lastAck || completeDt;
      addTrx('AlarmComplete', 'Process', 'Completed', completeDt, '回应人数达标，警报完成');
    } else if (status === 'NoNextLevel') {
      addTrx('AlarmFail', 'Process', 'NoNextLevel', completeDt, '已无下一层级可通知，警报失败');
    } else if (status === 'Terminated') {
      addTrx('Terminate', 'Process', 'Terminated', completeDt, spec.terminateCmt || '人工强制中断');
    }
    alarm.LAST_ACK_DT = lastAck;
    return alarm;
  }

  const baseAlarmSpecs = [
    // 处理中
    { status: 'Process', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 印刷机缺染料', content: '一厂 MES 印刷机 A 染料液位低于 5%，请设备人员补充染料。', createdMinAgo: 2, currentLevel: 1, levelStartSecAgo: 20, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'PRT_MOTOR_ERR', fac: 'Fab01', ss: 'MES', eqp: 'PRT02', title: 'PRT02 印刷机马达过载', content: '印刷机 B 主传动马达电流异常，已自动停机保护。', createdMinAgo: 3, currentLevel: 1, levelStartSecAgo: 30, receiveType: 'BModule' },
    { status: 'Process', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH01', title: 'ETCH01 气体流量异常', content: 'Cl2 气体流量低于管制下限 12 sccm，FDC 判定异常。', createdMinAgo: 4, currentLevel: 1, levelStartSecAgo: 35, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD01', title: 'CVD01 腔体温度过高', content: 'CVD 反应腔体温度 198°C，超过上限 180°C。', createdMinAgo: 5, currentLevel: 1, levelStartSecAgo: 25, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH02', title: 'ETCH02 气体流量异常（已升级）', content: '蚀刻二机 SF6 流量连续 3 次低于下限，LEVEL-1 未回应。', createdMinAgo: 26, currentLevel: 2, levelStartSecAgo: 40, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'SPC_OOC', fac: 'Fab03', ss: 'SPC', eqp: 'AOI01', title: 'AOI01 关键尺寸管制图异常', content: 'CD 量测值连续三点超出 3σ 管制界限。', createdMinAgo: 6, currentLevel: 1, levelStartSecAgo: 50, receiveType: 'BModule' },
    { status: 'Process', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT03', title: 'PRT03 印刷机缺染料（群组回退）', content: '印刷机 C 染料不足，依 $PRT 群组回退匹配通知印刷设备人员。', createdMinAgo: 7, currentLevel: 1, levelStartSecAgo: 18, receiveType: 'WebService', partialAck: 1, ackUsers: ['E0043260'] },
    { status: 'Process', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD02', title: 'CVD02 腔体温度过高（群组回退）', content: 'CVD 二机腔体温度 192°C，依 $CVD 群组回退匹配。', createdMinAgo: 8, currentLevel: 1, levelStartSecAgo: 22, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'CMP_PAD_LIFE', fac: 'Fab01', ss: 'EAP', eqp: 'CMP01', title: 'CMP01 研磨垫寿命到期', content: '研磨垫已使用 48,120 次，达到寿命上限。', createdMinAgo: 9, currentLevel: 1, levelStartSecAgo: 28, receiveType: 'BModule' },
    { status: 'Process', alarmCode: 'MES_SERVICE_DOWN', fac: 'Fab02', ss: 'MES', eqp: '*', title: 'Fab02 MES 服务心跳丢失', content: '二厂 MES 主节点连续 30 秒无心跳，产线可能受影响。', createdMinAgo: 10, currentLevel: 1, levelStartSecAgo: 32, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH02', title: 'ETCH02 气体流量异常（LEVEL-2）', content: 'SF6 流量异常持续，已升级至值班主管。', createdMinAgo: 30, currentLevel: 2, levelStartSecAgo: 15, receiveType: 'WebService' },
    { status: 'Process', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 印刷机缺染料（重复发生）', content: '染料液位再次低于警戒值，已重新发送通知。', createdMinAgo: 70, currentLevel: 1, levelStartSecAgo: 12, receiveType: 'BModule', partialAck: 1, ackUsers: ['E0043302'] },
    // 已完成（近 12 小时，用于趋势与今日统计）
    { status: 'Completed', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 印刷机缺染料', content: '染料补充完成，设备恢复生产。', createdMinAgo: 45, currentLevel: 1, durationMin: 18, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD01', title: 'CVD01 腔体温度过高', content: '冷却水阀调整后温度恢复正常。', createdMinAgo: 95, currentLevel: 1, durationMin: 14, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH01', title: 'ETCH01 气体流量异常', content: 'MFC 校正完成，流量回到管制范围。', createdMinAgo: 160, currentLevel: 2, durationMin: 55, ackLevel: 2, receiveType: 'WebService' },
    { status: 'Terminated', alarmCode: 'SPC_OOC', fac: 'Fab03', ss: 'SPC', eqp: 'AOI01', title: 'AOI01 管制图异常（误报中断）', content: '量测机台校正中，确认误报后中断。', createdMinAgo: 230, currentLevel: 1, durationMin: 12, terminateCmt: '量测机台校正中', receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'MES_SERVICE_DOWN', fac: 'Fab02', ss: 'MES', eqp: '*', title: 'Fab02 MES 服务心跳丢失', content: 'MES 服务重启完成，产线恢复。', createdMinAgo: 310, currentLevel: 2, durationMin: 44, ackLevel: 2, receiveType: 'WebService' },
    { status: 'NoNextLevel', alarmCode: 'CMP_PAD_LIFE', fac: 'Fab01', ss: 'EAP', eqp: 'CMP01', title: 'CMP01 研磨垫寿命到期（未回应）', content: '通知两层后仍无人回应。', createdMinAgo: 390, currentLevel: 2, durationMin: 50, receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'PRT_MOTOR_ERR', fac: 'Fab01', ss: 'MES', eqp: 'PRT02', title: 'PRT02 印刷机马达过载', content: '更换马达驱动器后测试正常。', createdMinAgo: 470, currentLevel: 1, durationMin: 25, receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH02', title: 'ETCH02 气体流量异常', content: '气体管路泄漏点已修复。', createdMinAgo: 560, currentLevel: 2, durationMin: 62, ackLevel: 2, receiveType: 'WebService' },
    // 已完成（历史）
    { status: 'Completed', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 印刷机缺染料', content: '染料补充完成，设备恢复生产。', createdMinAgo: 60 * 26, currentLevel: 1, durationMin: 22, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD01', title: 'CVD01 腔体温度过高', content: '冷却水阀调整后温度恢复正常。', createdMinAgo: 60 * 49, currentLevel: 1, durationMin: 16, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH01', title: 'ETCH01 气体流量异常', content: 'MFC 校正完成，流量回到管制范围。', createdMinAgo: 60 * 74, currentLevel: 2, durationMin: 42, ackLevel: 2, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'SPC_OOC', fac: 'Fab03', ss: 'SPC', eqp: 'AOI01', title: 'AOI01 关键尺寸管制图异常', content: '制程参数调整后管制图回到中心线。', createdMinAgo: 60 * 97, currentLevel: 1, durationMin: 35, receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'PRT_MOTOR_ERR', fac: 'Fab01', ss: 'MES', eqp: 'PRT02', title: 'PRT02 印刷机马达过载', content: '更换马达驱动器后测试正常。', createdMinAgo: 60 * 120, currentLevel: 1, durationMin: 55, receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'CMP_PAD_LIFE', fac: 'Fab01', ss: 'EAP', eqp: 'CMP01', title: 'CMP01 研磨垫寿命到期', content: '研磨垫已更换并重新量测。', createdMinAgo: 60 * 28, currentLevel: 1, durationMin: 44, receiveType: 'BModule' },
    { status: 'Completed', alarmCode: 'MES_SERVICE_DOWN', fac: 'Fab02', ss: 'MES', eqp: '*', title: 'Fab02 MES 服务心跳丢失', content: 'MES 服务重启完成，产线恢复。', createdMinAgo: 60 * 53, currentLevel: 2, durationMin: 38, ackLevel: 2, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD02', title: 'CVD02 腔体温度过高', content: '温控模块更换完成。', createdMinAgo: 60 * 78, currentLevel: 1, durationMin: 25, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH02', title: 'ETCH02 气体流量异常', content: '气体管路泄漏点已修复。', createdMinAgo: 60 * 102, currentLevel: 2, durationMin: 61, ackLevel: 2, receiveType: 'WebService' },
    { status: 'Completed', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT03', title: 'PRT03 印刷机缺染料', content: '补充染料后恢复。', createdMinAgo: 60 * 140, currentLevel: 1, durationMin: 19, receiveType: 'WebService' },
    // 无下一层级
    { status: 'NoNextLevel', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH01', title: 'ETCH01 气体流量异常（未回应）', content: '两层通知均未达回应人数，警报失败。', createdMinAgo: 60 * 24, currentLevel: 2, durationMin: 55, receiveType: 'WebService' },
    { status: 'NoNextLevel', alarmCode: 'SPC_OOC', fac: 'Fab03', ss: 'SPC', eqp: 'AOI01', title: 'AOI01 管制图异常（未回应）', content: '值班主管未于时限内确认，警报失败。', createdMinAgo: 60 * 47, currentLevel: 2, durationMin: 62, receiveType: 'BModule' },
    { status: 'NoNextLevel', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 缺染料（未回应）', content: '所有层级发送完成，无人回应。', createdMinAgo: 60 * 71, currentLevel: 2, durationMin: 48, receiveType: 'WebService' },
    { status: 'NoNextLevel', alarmCode: 'MES_SERVICE_DOWN', fac: 'Fab02', ss: 'MES', eqp: '*', title: 'Fab02 MES 服务中断（未回应）', content: 'MES 服务中断警报未获回应。', createdMinAgo: 60 * 95, currentLevel: 2, durationMin: 40, receiveType: 'WebService' },
    { status: 'NoNextLevel', alarmCode: 'CMP_PAD_LIFE', fac: 'Fab01', ss: 'EAP', eqp: 'CMP01', title: 'CMP01 研磨垫寿命到期（未回应）', content: '通知两层后仍无人回应。', createdMinAgo: 60 * 118, currentLevel: 2, durationMin: 52, receiveType: 'BModule' },
    { status: 'NoNextLevel', alarmCode: 'FDC_GASFLOW', fac: 'Fab01', ss: 'FDC', eqp: 'ETCH02', title: 'ETCH02 气体流量异常（未回应）', content: '警报已达最高层级，无人员回应。', createdMinAgo: 60 * 142, currentLevel: 2, durationMin: 66, receiveType: 'WebService' },
    // 已中断
    { status: 'Terminated', alarmCode: 'PRT_NODYE', fac: 'Fab01', ss: 'MES', eqp: 'PRT01', title: 'PRT01 缺染料（误报中断）', content: '确认液位计误报，人工中断。', createdMinAgo: 60 * 20, currentLevel: 1, durationMin: 12, terminateCmt: '液位计校正，误报中断', receiveType: 'WebService' },
    { status: 'Terminated', alarmCode: 'EQP_OVERHEAT', fac: 'Fab01', ss: 'EAP', eqp: 'CVD01', title: 'CVD01 温度过高（已处理中断）', content: '现场已处理完毕，剩余人员未确认，强制中断。', createdMinAgo: 60 * 43, currentLevel: 1, durationMin: 18, terminateCmt: '事件已处理完毕', receiveType: 'WebService' },
    { status: 'Terminated', alarmCode: 'SPC_OOC', fac: 'Fab03', ss: 'SPC', eqp: 'AOI01', title: 'AOI01 管制图异常（已中断）', content: '量测机台校正中，警报先行中断。', createdMinAgo: 60 * 68, currentLevel: 2, durationMin: 37, terminateCmt: '量测机台校正中', receiveType: 'BModule' },
    { status: 'Terminated', alarmCode: 'MES_SERVICE_DOWN', fac: 'Fab02', ss: 'MES', eqp: '*', title: 'Fab02 MES 心跳丢失（已中断）', content: '网路瞬断导致误报，已中断。', createdMinAgo: 60 * 91, currentLevel: 1, durationMin: 9, terminateCmt: '网路瞬断误报', receiveType: 'WebService' },
    // 纯记录
    { status: 'LogOnly', alarmCode: 'EDC_TIMEOUT', fac: 'Fab03', ss: 'EDC', eqp: 'WET01', title: 'WET01 EDC 数据超时（BYPASS）', content: 'EDC 子系统设定 BYPASS，仅记录不发送。', createdMinAgo: 60 * 15, currentLevel: 1, receiveType: 'BModule' },
    { status: 'LogOnly', alarmCode: 'EDC_TIMEOUT', fac: 'Fab03', ss: 'EDC', eqp: 'WET01', title: 'WET01 EDC 数据超时（BYPASS）', content: '资料采集延迟 12 分钟，因 BYPASS 仅记录。', createdMinAgo: 60 * 39, currentLevel: 1, receiveType: 'BModule' }
  ];

  baseAlarmSpecs.forEach(spec => {
    const setting = alarmSettings.find(x => x.ALARM_INFO_ID === spec.alarmCode);
    const event = setting ? events.find(x => x.EVENT_KEY === setting.EVENT_KEY) : null;
    makeAlarm({ ...spec, eventCode: event ? event.EVENT_ID : null, priority: setting ? setting.EVENT_PTY_ID : 5 });
  });

  // ---------------------------------------------------------------- 无效警报
  const invalidSpecs = [
    ['未设定厂别', 'FAB99', 'MES', 'PRT01', 'PRT_NODYE', 'Fab99 厂别未建立', 60 * 2],
    ['未设定子系统', 'Fab01', 'XYZ', 'PRT01', 'PRT_NODYE', '子系统 XYZ 未建立', 60 * 5],
    ['未设定机台', 'Fab01', 'MES', 'EQP99', 'PRT_NODYE', '机台 EQP99 未建立', 60 * 8],
    ['找不到事件', 'Fab01', 'MES', 'PRT01', 'UNKNOWN_ALARM', '警报代码未设定通知事件', 60 * 11],
    ['未设定发送方式', 'Fab01', 'MES', 'PRT02', 'PRT_NODYE', '事件层级未设定发送渠道', 60 * 16],
    ['未设定层级1', 'Fab02', 'MES', '*', 'MES_SERVICE_DOWN', '事件层级未从 1 开始设定', 60 * 22],
    ['未设定发送人员', 'Fab03', 'SPC', 'AOI01', 'SPC_OOC', '事件通知群组内无人员', 60 * 27],
    ['警报设定未启用', 'Fab01', 'FDC', 'ETCH02', 'FDC_GASFLOW', '警报通知设定已被隐藏', 60 * 33],
    ['忽略相同警报', 'Fab01', 'MES', 'PRT01', 'PRT_NODYE', '900 秒内重复发生相同警报', 60 * 38],
    ['在某机况下无需发送', 'Fab01', 'EAP', 'CMP01', 'CMP_PAD_LIFE', 'CMP 型号于 PM 机况下不发送警报', 60 * 45]
  ];
  invalidSpecs.forEach(([type, fac, ss, eqp, alarm, content, mins], i) => {
    const fObj = factories.find(x => x.FACTORY_ID === fac);
    const sObj = subsystems.find(x => x.SUB_SYS_ID === ss);
    const eObj = eqps.find(x => x.EQP_ID === eqp);
    invalidAlarms.push({
      INVALID_KEY: K('alarm_invalid', 'IV', 3),
      INVALID_ID: 'INV' + String(i + 1).padStart(6, '0'),
      CREATE_DT: iso(mins),
      TITLE: `${alarm} 无效警报`,
      CONTENT: content,
      FACTORY_ID: fac, FACTORY_NAME: fObj ? fObj.FACTORY_NAME : '',
      SUB_SYS_ID: ss, SUB_SYS_NAME: sObj ? sObj.SUB_SYS_NAME : '',
      EQP_ID: eqp, EQP_NAME: eObj ? eObj.EQP_NAME : '',
      ALARM_INFO_ID: alarm, RECEIVE_TYPE: i % 2 ? 'BModule' : 'WebService',
      INVALID_TYPE: type,
      RAW_JSON: JSON.stringify({ factory: fac, subsystem: ss, eqp, alarm })
    });
  });

  // ---------------------------------------------------------------- 标题历史
  [
    'PRT01 印刷机缺染料', 'CVD01 腔体温度过高', 'ETCH01 气体流量异常',
    'Fab02 MES 服务心跳丢失', 'AOI01 关键尺寸管制图异常', '机台 A 当机',
    'WET01 EDC 数据回传超时', 'CMP01 研磨垫寿命到期'
  ].forEach((s, i) => subjects.push({
    SUBJECT_KEY: K('alarm_subjects', 'SUB', 2), SUBJECT: s,
    LAST_USED_DT: iso(60 * (i + 1)), USE_COUNT: 8 - i
  }));

  // ---------------------------------------------------------------- 报表定义
  const reportDefs = REPORT_SEEDS.map((r, i) => ({
    REPORT_KEY: K('report_defs', 'RPT', 2),
    REPORT_ID: r.REPORT_ID, REPORT_NAME: r.REPORT_NAME, REPORT_DESC: r.REPORT_DESC,
    CONNECTION_STRING_NAME: r.CONNECTION_STRING_NAME,
    ATLEAST_ONE_CONDITION: r.ATLEAST_ONE_CONDITION,
    DATASOURCE_TYPE: r.DATASOURCE_TYPE, QUERY_SQL: r.QUERY_SQL,
    CONDITIONS_JSON: JSON.stringify(r.CONDITIONS),
    COLUMNS_JSON: JSON.stringify(r.COLUMNS),
    DISPLAY_JSON: JSON.stringify(r.DISPLAY),
    ADVANCED_JSON: JSON.stringify(r.ADVANCED || {}),
    ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * (2 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
  }));

  // ---------------------------------------------------------------- 自动切机况
  const autoRules = [
    ['AGC_RF', 'SS2', 'ETCH01', CH['ETCH01-CH1'], 'AS3', 'RUN', 'DOWN', 'MAINT', 'Y'],
    ['AGC_TEMP', 'SS1', 'CVD01', '', 'AS2', 'RUN', 'MAINT', '', 'N'],
    ['AGC_MES', 'SS3', '*', '', 'AS5', 'RUN', 'IDLE', '', 'N']
  ].map(([id, ss, eqp, chamber, alarm, init, target, target2, related], i) => ({
    AUTO_KEY: K('auto_status_rules', 'AUTO', 2), AUTO_ID: id,
    AUTO_NAME: id === 'AGC_RF' ? '蚀刻射频异常自动切机' : id === 'AGC_TEMP' ? 'CVD 过热自动保养' : 'MES 中断自动待机',
    SUB_SYS_KEY: ss, EQP_KEY: eqp === '*' ? '*' : E[eqp], CHAMBER: chamber,
    ALARM_INFO_KEY: alarm, INITIAL_STATUS: init, TARGET_STATUS: target,
    TARGET_STATUS2: target2, RELATED_CHAMBER: related, ACTIVE: 'Y',
    MTR_DATE: iso(60 * 24 * (2 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
  }));

  const autoLogs = [
    { AUTO_KEY: autoRules[0].AUTO_KEY, EQP_ID: 'ETCH01', ALARM_ID: '00000000001010', FROM_STATUS: 'RUN', TO_STATUS: 'DOWN', TRX_DT: iso(60 * 30), RESULT: 'Success', MESSAGE: '依规则 AGC_RF 切换，联动 Chamber ETCH01-CH1' },
    { AUTO_KEY: autoRules[1].AUTO_KEY, EQP_ID: 'CVD01', ALARM_ID: '00000000001004', FROM_STATUS: 'RUN', TO_STATUS: 'MAINT', TRX_DT: iso(60 * 20), RESULT: 'Success', MESSAGE: '依规则 AGC_TEMP 切换' }
  ].map((x, i) => ({ ALOG_KEY: K('auto_status_logs', 'ALOG', 3), ...x }));

  // ---------------------------------------------------------------- 功能选单
  const functions = [];
  const fn = (id, name, parent, type, path, sort, extra = {}) => {
    const item = {
      FUNCTION_KEY: K('functions', 'FN', 3), FUNCTION_ID: id, FUNCTION_NAME: name,
      PARENT_KEY: parent, FUNC_TYPE: type, PATH: path, SORT: sort,
      VISIBLE: 'Y', LOAD_VISIBLE: 'Y', OBJ_NAME: extra.obj || '', HYPERLINK: '',
      ACTIONS_JSON: JSON.stringify(extra.actions || []),
      PROPERTIES_JSON: JSON.stringify(extra.properties || {}),
      ACTIVE: 'Y'
    };
    functions.push(item);
    return item.FUNCTION_KEY;
  };
  fn('HOME', '首页', null, 'PAGE', '#/home', 0);
  const sys = fn('SYS', '系统设定', null, 'GROUP', null, 1);
  fn('MCMS038', '系统功能选单设定', sys, 'PAGE', '#/page/MCMS038', 1);
  const basic = fn('BASIC', '基本设定', null, 'GROUP', null, 2);
  [
    ['MCMS040', '一般主档设定'], ['MCMS042', 'Mapping主档设定'], ['MCMS041', 'MasterDetail主档设定'],
    ['SBRM_USER', '使用者设定'], ['SBRM_USER_GROUP', '使用者群组设定'], ['SBRM_USER_GROUP_USER', '群组使用者对应设定'],
    ['SBRM_FACTORY', '厂别设定'], ['SBRM_EQP', '机台设定'], ['SBRM_EQP_GROUP', '机台群组设定'],
    ['SBRM_EQP_GROUP_EQP', '机台群组与机台对应设定'], ['CVMA012', '机台类型设定'],
    ['MCMS051', '批次状态变更设定'], ['CVMA013', '机台状态清单'],
    ['CVMA011', '特定机台区域特定机况不发警报设定'], ['CBRM_CHAMBER_ALARM_MAPPING', '子机台与警报对应设定'],
    ['CVMA015', '自动切机况设定']
  ].forEach(([code, name], i) => fn(code, name, basic, 'PAGE', '#/page/' + code, i + 1));
  const alm = fn('ALM', 'ALM', null, 'GROUP', null, 3);
  const almSet = fn('ALM_SET', '警报管理设定', alm, 'GROUP', null, 1);
  [
    ['AVMA003', '子系统设定'], ['AVMA004', '厂别子系统对应设定'], ['AVMA006', '事件通知人员群组设定'],
    ['AVMA007', '事件通知设定'], ['AVMA008', '事件层级与事件通知群组对应设定'],
    ['AVMA009', '警报通知设定'], ['AVMA010', '警报触发条件设定'],
    ['AVPA015', '警报装置参数设定'], ['CVMA014', '警报通知设定批次隐藏']
  ].forEach(([code, name], i) => fn(code, name, almSet, 'PAGE', '#/page/' + code, i + 1));
  const almOp = fn('ALM_OP', '警报作业', alm, 'GROUP', null, 2);
  [
    ['AVPA002', '警报手动发送作业'], ['AVPA009', '警报补登作业'],
    ['AVPA003', '警报确认回报作业'], ['AVPA006', '警报强制中断作业']
  ].forEach(([code, name], i) => fn(code, name, almOp, 'PAGE', '#/page/' + code, i + 1));
  const rpt = fn('RPT', '报表', null, 'GROUP', null, 4);
  [
    ['AVPA013', '即时警报彙整'], ['AVPA004', '警报处理查询'], ['AVPA007', '历史纪录查询'],
    ['AVPA005', '无效警报查询'], ['AVPA008', '系统装置状态查询'], ['RPTSET001', '报表设定']
  ].forEach(([code, name], i) => fn(code, name, rpt, 'PAGE', '#/page/' + code, i + 1));

  // ---------------------------------------------------------------- BRM 定义
  const brmDefs = [];
  const inputType = (field) => {
    if (field.type === 'select') return 'ComboBox';
    if (field.type === 'checkbox') return 'CheckBox';
    if (field.type === 'number') return 'Number';
    if (field.type === 'datetime') return 'DateTimeBox';
    if (field.type === 'date') return 'DateBox';
    if (field.type === 'password') return 'Password';
    if (field.type === 'textarea') return 'RichTextBox';
    return 'TextBox';
  };
  const columnsOf = (fields) => fields.map((field, i) => ({
    COLUMN_NAME: field.name, INPUT_TYPE: inputType(field), COLUMN_DATA_TYPE: field.type === 'number' ? 'NUMBER' : 'VARCHAR',
    IS_FILTER_CONDITION: field.filter ? 'Y' : 'N', DISPLAY: field.grid === false ? 'N' : 'Y',
    DISPLAY_SEQ: i + 1, CAPTION: field.label, WIDTH: field.width || 160,
    USE_LOCAL_DATA: field.optionSet ? 'Y' : 'N', SOURCE_SQL: '', SOURCE_SQL_CONST: '',
    ADD_DEFAULT: 'N', VALUE_MEMBER: 'KEY', DISPLAY_MEMBER: 'NAME', SEQUENCE: i + 1,
    REFERENCE_COLUMN: field.dependsOn || '', IS_REQUIRED: field.required ? 'Y' : 'N',
    MODIFY_READONLY: field.readOnlyOnEdit ? 'Y' : 'N', IMPORT_CONDITION_COLUMN_NAME: '',
    DEFAULT_VALUE: '', RADIO_SELECTION: '', MIN_VALUE: '', MAX_VALUE: '', VALIDATION: '', VALIDATION_FAIL_CODE: ''
  }));
  const normalBrmCodes = ['SBRM_USER', 'SBRM_FACTORY', 'SBRM_EQP', 'AVMA003', 'AVMA009'];
  normalBrmCodes.forEach((code, i) => {
    const m = MASTERS[code];
    brmDefs.push({
      BRM_KEY: K('brm_defs', 'BRM', 3), BRM_ID: m.code, BRM_NAME: m.title, BRM_TYPE: 'Normal',
      BRM_DESC: m.desc, MST_TABLE_NAME: m.table, MST_LOG_TABLE_NAME: 'history',
      MST_PK: m.keyField, MST_UK: m.idField, MST_DATA_QUERY_SQL: `SELECT * FROM ${m.table.toUpperCase()}`,
      MST_DATA_SQL_CONST: '', MST_HIDE_DATA_QUERY_SQL: `SELECT * FROM ${m.table.toUpperCase()} WHERE ACTIVE = 'N'`,
      MST_HIDE_DATA_SQL_CONST: '', MST_LOG_QUERY_SQL: 'SELECT * FROM HISTORY', MST_LOG_SQL_CONST: '',
      EDIT_FORM_COLUMN_COUNT: 2, ENABLE_CUSTOM_VALIDATE: 'N', VALIDATE_CLASS_NAME: '',
      FILTER_BEFORE_LOAD_DATA: 'N', SHOW_HIDEN_DATA: 'N',
      COLUMNS_JSON: JSON.stringify(columnsOf(m.fields)),
      DETAIL_TABLE_NAME: '', DETAIL_LOG_TABLE_NAME: '', DETAIL_COLUMNS_JSON: '[]',
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * (5 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  ['SBRM_EQP_GROUP_EQP', 'AVMA004'].forEach((code, i) => {
    const m = MAPPINGS[code];
    brmDefs.push({
      BRM_KEY: K('brm_defs', 'BRM', 3), BRM_ID: m.code, BRM_NAME: m.title, BRM_TYPE: 'Mapping',
      BRM_DESC: m.desc, MAP_TABLE_NAME: m.mapTable, MAP_LOG_TABLE_NAME: 'history',
      MAP_PK: 'MAP_KEY', MAP_UK: m.item.key, MST_COLUMN_NAME: m.master.key,
      MST_COLUMN_CAPTION: m.master.label, VALUE_MEMBER: m.master.key, DISPLAY_MEMBER: m.master.display.join('/'),
      IMPORT_CONDITION_COLUMN_NAME: m.master.display[0], IS_MULTI_SELECT: 'Y',
      ENABLE_CUSTOM_VALIDATE: 'N', VALIDATE_CLASS_NAME: '',
      MST_DATA_QUERY_SQL: `SELECT * FROM ${m.master.table.toUpperCase()}`,
      MAP_SELECTED_QUERY_SQL: `SELECT * FROM ${m.mapTable.toUpperCase()}`,
      MAP_SOURCE_QUERY_SQL: `SELECT * FROM ${m.item.table.toUpperCase()}`,
      LOG_QUERY_SQL: 'SELECT * FROM HISTORY', COLUMNS_JSON: JSON.stringify(columnsOf([
        { name: m.master.display[0], label: m.master.label + '代码', type: 'text' },
        { name: m.master.display[1], label: m.master.label + '名称', type: 'text' },
        { name: m.item.display[0], label: m.item.label + '代码', type: 'text' },
        { name: m.item.display[1], label: m.item.label + '名称', type: 'text' }
      ])),
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * (4 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });
  ['AVMA006', 'AVMA007'].forEach((code, i) => {
    const m = MASTER_DETAILS[code];
    brmDefs.push({
      BRM_KEY: K('brm_defs', 'BRM', 3), BRM_ID: m.code, BRM_NAME: m.title, BRM_TYPE: 'MasterDetail',
      BRM_DESC: m.desc, MST_TABLE_NAME: m.masterTable, MST_LOG_TABLE_NAME: 'history',
      MST_PK: m.masterKey, MST_UK: m.masterId,
      MST_DATA_QUERY_SQL: `SELECT * FROM ${m.masterTable.toUpperCase()}`,
      MST_HIDE_DATA_QUERY_SQL: `SELECT * FROM ${m.masterTable.toUpperCase()} WHERE ACTIVE = 'N'`,
      MST_LOG_QUERY_SQL: 'SELECT * FROM HISTORY',
      DETAIL_TABLE_NAME: m.detail.table, DETAIL_LOG_TABLE_NAME: 'history',
      DETAIL_PK: m.detail.key || 'MAP_KEY', DETAIL_UK: '',
      DETAIL_DATA_QUERY_SQL: `SELECT * FROM ${m.detail.table.toUpperCase()}`,
      DETAIL_LOG_QUERY_SQL: 'SELECT * FROM HISTORY',
      COLUMNS_JSON: JSON.stringify(columnsOf(m.fields)),
      DETAIL_COLUMNS_JSON: JSON.stringify(columnsOf(m.detail.fields || [])),
      EDIT_FORM_COLUMN_COUNT: 2, ENABLE_CUSTOM_VALIDATE: 'N', FILTER_BEFORE_LOAD_DATA: 'N',
      ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * (3 + i)), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
    });
  });

  const batchDefs = [{
    BATCH_KEY: K('batch_defs', 'BAT', 2), BATCH_ID: 'CVMA014',
    BATCH_NAME: '警报通知设定批次隐藏', BATCH_DESC: '依条件批量查询警报通知设定并批次启用／停用。',
    MASTER_TABLE_NAME: 'alarm_settings', MASTER_LOG_TABLE_NAME: 'history',
    MASTER_PK: 'ALARM_INFO_KEY', SERIAL_KEY_COLUMN_NAME: 'ALARM_INFO_KEY',
    ACTIVE_COLUMN_NAME: 'ACTIVE',
    DATA_SOURCE_SQL: 'SELECT * FROM SALM_ALARM_SETTING WHERE 1=1',
    DISPLAY_COLUMNS_JSON: JSON.stringify(['ALARM_INFO_ID', 'ALARM_ID_DESC', 'FACTORY_ID', 'SUB_SYS_ID', 'EQP_ID', 'EVENT_ID', 'ACTIVE']),
    CONDITIONS_JSON: JSON.stringify([
      { field: 'ACTIVE', label: '启用状态', inputType: 'ComboBox', operator: '=', required: false },
      { field: 'ALARM_INFO_ID', label: '警报代码', inputType: 'TextBox', operator: 'LIKE', required: false },
      { field: 'EQP_GROUP_KEY', label: '机台群组代码', inputType: 'ComboBox', operator: '=', required: false },
      { field: 'FACTORY_KEY', label: '厂别', inputType: 'ComboBox', operator: '=', required: false },
      { field: 'EQP_KEY', label: '机台代码', inputType: 'ComboBox', operator: '=', required: false },
      { field: 'SUB_SYS_KEY', label: '子系统代码', inputType: 'ComboBox', operator: '=', required: false }
    ]),
    RELATIONS_JSON: JSON.stringify([{ table: 'alarm_settings', log: 'history', pk: 'ALARM_INFO_KEY', active: 'ACTIVE', children: [] }]),
    ACTIVE: 'Y', MTR_DATE: iso(60 * 24 * 6), MTR_USER_KEY: 'U001', MTR_USER_NAME: '陈柏睿'
  }];

  // ---------------------------------------------------------------- 履历
  const history = [];
  const addHist = (table, key, label, action, active, before, after, mins, user = users[0]) => {
    history.push({
      HIST_KEY: K('history', 'H', 6), TABLE_NAME: table, RECORD_KEY: key, RECORD_LABEL: label,
      ACTION: action, ACTIVE: active,
      BEFORE_JSON: before ? JSON.stringify(before) : null, AFTER_JSON: after ? JSON.stringify(after) : null,
      TRX_DT: iso(mins), USER_KEY: user.USER_KEY, USER_ID: user.USER_ID, USER_NAME: user.USER_NAME,
      IP: '10.20.31.' + (20 + (mins % 60)), HOST: 'AMS-CLIENT-' + String(10 + (mins % 20))
    });
  };
  addHist('factories', F.Fab01, 'Fab01', 'Modify', 'Y',
    { FACTORY_NAME: '台达一厂' }, { FACTORY_NAME: '一厂' }, 60 * 24 * 18);
  addHist('users', U.E0043258, 'E0043258', 'Modify', 'Y',
    { E_MAIL: 'brock@old-mail.com' }, { E_MAIL: 'brock.chen@ams-fab.com' }, 60 * 24 * 12);
  addHist('alarm_settings', AS.FDC_GASFLOW, 'FDC_GASFLOW', 'Modify', 'Y',
    { IGNORE_PERIOD: 600 }, { IGNORE_PERIOD: 300 }, 60 * 24 * 9);
  addHist('alarm_settings', AS.EDC_TIMEOUT, 'EDC_TIMEOUT', 'Hide', 'N',
    { ACTIVE: 'Y' }, { ACTIVE: 'N' }, 60 * 24 * 7);
  addHist('alarm_settings', AS.EDC_TIMEOUT, 'EDC_TIMEOUT', 'Show', 'Y',
    { ACTIVE: 'N' }, { ACTIVE: 'Y' }, 60 * 24 * 6);
  addHist('events', EV.EVT_FDC_GAS, 'EVT_FDC_GAS', 'Modify', 'Y',
    { EVENT_PRIORITY_ID: 9 }, { EVENT_PRIORITY_ID: 10 }, 60 * 24 * 5);
  addHist('eqps', E.PRT02, 'PRT02', 'Modify', 'Y',
    { CURRENT_STATUS: 'MAINT' }, { CURRENT_STATUS: 'RUN' }, 60 * 24 * 3);
  addHist('alarm_settings', AS.CMP_PAD_LIFE, 'CMP_PAD_LIFE', 'AddNew', 'Y', null,
    { ALARM_INFO_ID: 'CMP_PAD_LIFE' }, 60 * 24 * 2);
  addHist('users', U.E0043302, 'E0043302', 'AddNew', 'Y', null,
    { USER_ID: 'E0043302' }, 60 * 24 * 10);
  addHist('eqp_groups', eqpGroups[0].EQP_GROUP_KEY, '$PRT', 'AddNew', 'Y', null,
    { EQP_GROUP_ID: '$PRT' }, 60 * 24 * 15);

  const db = {
    meta: {
      version: '3.0.0',
      createdAt: new Date().toISOString(),
      seedVersion: 1,
      seq: { ...counters, alarmId: alarmIdSeq }
    },
    settings: {
      version: '3.0.0',
      demoSpeed: 1,
      sessionTimeoutMin: 30,
      systemName: 'AMS 警报管理系统'
    },
    users: users.map(({ PASSWORD_HASH, ...u }) => ({ ...u, PASSWORD_HASH })),
    user_groups: userGroups,
    user_group_users: userGroupUsers,
    factories,
    subsystems,
    factory_subsys: factorySubsys,
    eqp_types: eqpTypes,
    eqp_status: eqpStatus,
    eqps,
    eqp_groups: eqpGroups,
    eqp_group_eqp: eqpGroupEqp,
    eqp_type_status: eqpTypeStatus,
    chambers,
    chamber_alarm: chamberAlarm,
    event_groups: eventGroups,
    event_group_users: eventGroupUsers,
    events,
    event_levels: eventLevels,
    event_level_groups: eventLevelGroups,
    alarm_settings: alarmSettings,
    alarm_conditions: alarmConditions,
    devices,
    alarms,
    alarm_levels: alarmLevels,
    alarm_notifications: alarmNotifications,
    alarm_acks: alarmAcks,
    alarm_transactions: alarmTransactions,
    alarm_invalid: invalidAlarms,
    alarm_subjects: subjects,
    report_defs: reportDefs,
    functions,
    brm_defs: brmDefs,
    batch_defs: batchDefs,
    auto_status_rules: autoRules,
    auto_status_logs: autoLogs,
    history
  };

  return db;
}

module.exports = { buildSeed };
