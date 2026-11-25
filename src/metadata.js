'use strict';

/**
 * 页面元数据：驱动通用 BRMNormal / BRMMapping / BRMMasterDetail 页面。
 * 字段 type: text | textarea | select | number | date | datetime | password | checkbox
 * optionSet 对应 /api/options 返回的下拉资料来源。
 */

const f = {
  text: (name, label, opt = {}) => ({ name, label, type: 'text', width: 160, filter: true, ...opt }),
  textarea: (name, label, opt = {}) => ({ name, label, type: 'textarea', rows: 3, grid: false, ...opt }),
  select: (name, label, optionSet, opt = {}) => ({ name, label, type: 'select', optionSet, width: 180, filter: true, ...opt }),
  number: (name, label, opt = {}) => ({ name, label, type: 'number', width: 120, filter: true, ...opt }),
  password: (name, label, opt = {}) => ({ name, label, type: 'password', grid: false, ...opt }),
  checkbox: (name, label, opt = {}) => ({ name, label, type: 'checkbox', width: 110, ...opt }),
  code: (name, label, opt = {}) => ({ name, label, type: 'text', required: true, readOnlyOnEdit: true, width: 170, filter: true, ...opt })
};

const auditFields = [
  { name: 'MTR_DATE', label: '修改时间', type: 'datetime', readOnly: true, width: 155, grid: true },
  { name: 'MTR_USER_NAME', label: '修改人员名称', type: 'text', readOnly: true, width: 110, grid: true, filter: false }
];

const MASTERS = {
  SBRM_USER: {
    code: 'SBRM_USER',
    title: '使用者设定',
    table: 'users',
    keyField: 'USER_KEY',
    idField: 'USER_ID',
    uniqueFields: ['USER_ID'],
    desc: '维护使用者基本资料与警报联络方式（Email／短信／IM／语音）。',
    fields: [
      f.code('USER_ID', '使用者代码', { width: 110 }),
      { name: 'USER_NAME', label: '使用者名称', type: 'text', required: true, width: 130, filter: true },
      { name: 'LAST_NAME', label: '使用者姓', type: 'text', grid: false },
      { name: 'FIRST_NAME', label: '使用者名', type: 'text', grid: false },
      { name: 'GENDER', label: '性别', type: 'select', optionSet: 'gender', grid: false },
      { name: 'PASSWORD', label: '密码', type: 'password', grid: false, help: '新增时默认 123456' },
      { name: 'E_MAIL', label: 'E-Mail', type: 'text', width: 210, filter: true },
      { name: 'ALARM_SMS_TEL', label: '警报短信电话', type: 'text', width: 135 },
      { name: 'IM_ID', label: 'IM ID', type: 'text', width: 130 },
      { name: 'EXTENSION', label: 'Voice 分机', type: 'text', width: 110 },
      { name: 'IPPHONE_IM', label: 'IPPhone(IM)', type: 'text', grid: false },
      { name: 'PHONE', label: '电话', type: 'text', grid: false },
      { name: 'MOBILE', label: 'Mobile', type: 'text', grid: false },
      { name: 'TITLE', label: '职称', type: 'text', width: 130 },
      { name: 'SHIFT_KEY', label: '班别', type: 'select', optionSet: 'shift', width: 90 },
      { name: 'ORGAN_KEY', label: '部门', type: 'select', optionSet: 'department', width: 150, filter: true }
    ],
    filters: ['USER_ID', 'USER_NAME', 'E_MAIL', 'ORGAN_KEY'],
    defaults: { PASSWORD: '123456', SHIFT_KEY: 'A', GENDER: 'M' }
  },
  SBRM_USER_GROUP: {
    code: 'SBRM_USER_GROUP',
    title: '使用者群组设定',
    table: 'user_groups',
    keyField: 'GROUP_KEY',
    idField: 'GROUP_ID',
    uniqueFields: ['GROUP_ID'],
    desc: '使用者分组，用于权限管控与事件通知人员群组。',
    fields: [
      f.code('GROUP_ID', '使用者群组代码'),
      { name: 'GROUP_NAME', label: '使用者群组名称', type: 'text', required: true, width: 190, filter: true },
      { name: 'GROUP_DESC', label: '使用者群组说明', type: 'text' }
    ],
    filters: ['GROUP_ID', 'GROUP_NAME']
  },
  SBRM_FACTORY: {
    code: 'SBRM_FACTORY',
    title: '厂别设定',
    table: 'factories',
    keyField: 'FACTORY_KEY',
    idField: 'FACTORY_ID',
    uniqueFields: ['FACTORY_ID'],
    desc: '厂别是警报四要素之一，用于区分各厂警报与事件。',
    fields: [
      f.code('FACTORY_ID', '厂别代码'),
      { name: 'FACTORY_NAME', label: '厂别名称', type: 'text', required: true, width: 190, filter: true },
      { name: 'FACTORY_DESC', label: '厂别说明', type: 'text', width: 260 }
    ],
    filters: ['FACTORY_ID', 'FACTORY_NAME']
  },
  SBRM_EQP: {
    code: 'SBRM_EQP',
    title: '机台设定',
    table: 'eqps',
    keyField: 'EQP_KEY',
    idField: 'EQP_ID',
    uniqueFields: ['EQP_ID'],
    desc: '定义机台代码、名称与所属型号，是警报通知设定的必要主档。',
    fields: [
      f.code('EQP_ID', '机台代码', { width: 130 }),
      { name: 'EQP_NAME', label: '机台名称', type: 'text', required: true, width: 180, filter: true },
      { name: 'EQP_DESC', label: '机台说明', type: 'text', width: 240 },
      f.select('EQP_TYPE_KEY', '机台型号', 'eqpType', { width: 150 }),
      f.select('CURRENT_STATUS', '当前机况', 'eqpStatus', { width: 120 })
    ],
    filters: ['EQP_ID', 'EQP_NAME', 'EQP_TYPE_KEY', 'CURRENT_STATUS']
  },
  SBRM_EQP_GROUP: {
    code: 'SBRM_EQP_GROUP',
    title: '机台群组设定',
    table: 'eqp_groups',
    keyField: 'EQP_GROUP_KEY',
    idField: 'EQP_GROUP_ID',
    uniqueFields: ['EQP_GROUP_ID'],
    desc: '机台分组用于事件通知与警报发生时的机台群组回退匹配。',
    fields: [
      f.code('EQP_GROUP_ID', '机台群组代码'),
      { name: 'EQP_GROUP_NAME', label: '机台组名', type: 'text', required: true, width: 190, filter: true },
      { name: 'EQP_GROUP_DESC', label: '机台群组说明', type: 'text', width: 260 }
    ],
    filters: ['EQP_GROUP_ID', 'EQP_GROUP_NAME']
  },
  CVMA012: {
    code: 'CVMA012',
    title: '机台类型设定',
    table: 'eqp_types',
    keyField: 'EQP_TYPE_KEY',
    idField: 'EQP_TYPE_ID',
    uniqueFields: ['EQP_TYPE_ID'],
    desc: '机台型号主档，供「特定机台区域特定机况不发警报」引用。',
    fields: [
      f.code('EQP_TYPE_ID', '机台型号代码'),
      { name: 'EQP_TYPE_DESC', label: '机台型号说明', type: 'text', width: 300, filter: true }
    ],
    filters: ['EQP_TYPE_ID', 'EQP_TYPE_DESC']
  },
  CVMA013: {
    code: 'CVMA013',
    title: '机台状态清单',
    table: 'eqp_status',
    keyField: 'EQP_STATUS_KEY',
    idField: 'EQP_STATUS_ID',
    uniqueFields: ['EQP_STATUS_ID'],
    desc: '机台状态代码，供机况判断与警报抑制规则引用。',
    fields: [
      f.code('EQP_STATUS_ID', '机台状态代码'),
      { name: 'EQP_STATUS_DESC', label: '机台状态说明', type: 'text', width: 300, filter: true }
    ],
    filters: ['EQP_STATUS_ID', 'EQP_STATUS_DESC']
  },
  AVMA003: {
    code: 'AVMA003',
    title: '子系统设定',
    table: 'subsystems',
    keyField: 'SUB_SYS_KEY',
    idField: 'SUB_SYS_ID',
    uniqueFields: ['SUB_SYS_ID'],
    desc: '厂别下的系统维度（EAP／FDC／MES／SPC／EDC…）。支持 BYPASS 只留 Log 不发送。',
    fields: [
      f.code('SUB_SYS_ID', '子系统代码', { width: 120 }),
      { name: 'SUB_SYS_NAME', label: '子系统名称', type: 'text', required: true, width: 220, filter: true },
      { name: 'BYPASS', label: 'BYPASS', type: 'checkbox', help: '启用后警报只留 Log，不发送通知' }
    ],
    filters: ['SUB_SYS_ID', 'SUB_SYS_NAME']
  },
  AVMA009: {
    code: 'AVMA009',
    title: '警报通知设定',
    table: 'alarm_settings',
    keyField: 'ALARM_INFO_KEY',
    idField: 'ALARM_INFO_ID',
    uniqueFields: [],
    uniqueComposite: [['FACTORY_KEY', 'SUB_SYS_KEY', 'EQP_KEY', 'ALARM_INFO_ID']],
    desc: '绑定厂别／子系统／机台／警报代码到事件通知；四要素不可完全相同。',
    fields: [
      f.code('ALARM_INFO_ID', '警报代码', { width: 150 }),
      { name: 'ALARM_ID_DESC', label: '警报说明', type: 'text', required: true, width: 220, filter: true },
      f.select('FACTORY_KEY', '厂别', 'factory', { required: true }),
      f.select('SUB_SYS_KEY', '子系统', 'subsystem', { required: true, dependsOn: 'FACTORY_KEY' }),
      { name: 'EQP_KEY', label: '机台', type: 'select', optionSet: 'eqpWithAny', required: true, width: 150 },
      f.select('EVENT_KEY', '通知事件', 'event', { required: true, width: 200 }),
      { name: 'EVENT_PTY_ID', label: '优先权代码', type: 'number', width: 110 },
      { name: 'IGNORE_PERIOD', label: '忽略相同警报时间间隔(秒)', type: 'number', width: 190, help: '默认 900 秒' },
      { name: 'ALARM_CMT', label: '备注', type: 'text', grid: false }
    ],
    filters: ['ALARM_INFO_ID', 'ALARM_ID_DESC', 'FACTORY_KEY', 'SUB_SYS_KEY', 'EQP_KEY'],
    defaults: { IGNORE_PERIOD: 900, EVENT_PTY_ID: 5, EQP_KEY: '*' }
  }
};

const MAPPINGS = {
  SBRM_USER_GROUP_USER: {
    code: 'SBRM_USER_GROUP_USER',
    title: '群组使用者对应设定',
    desc: '将使用者对应到使用者群组，权限依群组设定。',
    master: { table: 'user_groups', key: 'GROUP_KEY', label: '使用者群组', display: ['GROUP_ID', 'GROUP_NAME'] },
    item: { table: 'users', key: 'USER_KEY', label: '使用者', display: ['USER_ID', 'USER_NAME', 'ORGAN_KEY'] },
    mapTable: 'user_group_users',
    mapMasterFk: 'GROUP_KEY',
    mapItemFk: 'USER_KEY',
    masterColumns: ['GROUP_ID', 'GROUP_NAME', 'GROUP_DESC'],
    itemColumns: ['USER_ID', 'USER_NAME', 'ORGAN_KEY', 'E_MAIL']
  },
  SBRM_EQP_GROUP_EQP: {
    code: 'SBRM_EQP_GROUP_EQP',
    title: '机台群组与机台对应设定',
    desc: '维护机台群组包含哪些机台，用于警报机台群组回退匹配。',
    master: { table: 'eqp_groups', key: 'EQP_GROUP_KEY', label: '机台群组', display: ['EQP_GROUP_ID', 'EQP_GROUP_NAME'] },
    item: { table: 'eqps', key: 'EQP_KEY', label: '机台', display: ['EQP_ID', 'EQP_NAME', 'EQP_TYPE_KEY'] },
    mapTable: 'eqp_group_eqp',
    mapMasterFk: 'EQP_GROUP_KEY',
    mapItemFk: 'EQP_KEY',
    masterColumns: ['EQP_GROUP_ID', 'EQP_GROUP_NAME', 'EQP_GROUP_DESC'],
    itemColumns: ['EQP_ID', 'EQP_NAME', 'EQP_TYPE_KEY', 'CURRENT_STATUS']
  },
  CVMA011: {
    code: 'CVMA011',
    title: '特定机台区域特定机况不发警报设定',
    desc: '设定某机台型号处于某些机况时不发送警报。',
    master: { table: 'eqp_types', key: 'EQP_TYPE_KEY', label: '机台型号', display: ['EQP_TYPE_ID', 'EQP_TYPE_DESC'] },
    item: { table: 'eqp_status', key: 'EQP_STATUS_KEY', label: '机台状态', display: ['EQP_STATUS_ID', 'EQP_STATUS_DESC'] },
    mapTable: 'eqp_type_status',
    mapMasterFk: 'EQP_TYPE_KEY',
    mapItemFk: 'EQP_STATUS_KEY',
    masterColumns: ['EQP_TYPE_ID', 'EQP_TYPE_DESC'],
    itemColumns: ['EQP_STATUS_ID', 'EQP_STATUS_DESC']
  },
  CBRM_CHAMBER_ALARM_MAPPING: {
    code: 'CBRM_CHAMBER_ALARM_MAPPING',
    title: '子机台与警报对应设定',
    desc: '维护子机台（Chamber）与警报信息的对应关系。',
    master: { table: 'chambers', key: 'PROCRSC_KEY', label: '子机台 PROCRSC_ID', display: ['PROCRSC_ID', 'CHAMBER_NAME'] },
    item: { table: 'alarm_settings', key: 'ALARM_INFO_KEY', label: '警报信息', display: ['ALARM_INFO_ID', 'ALARM_ID_DESC'] },
    mapTable: 'chamber_alarm',
    mapMasterFk: 'PROCRSC_KEY',
    mapItemFk: 'ALARM_INFO_KEY',
    masterColumns: ['PROCRSC_ID', 'CHAMBER_NAME', 'EQP_KEY'],
    itemColumns: ['ALARM_INFO_ID', 'ALARM_ID_DESC', 'FACTORY_KEY', 'SUB_SYS_KEY']
  },
  AVMA004: {
    code: 'AVMA004',
    title: '厂别子系统对应设定',
    desc: '维护厂别与子系统多对多对应关系。',
    master: { table: 'factories', key: 'FACTORY_KEY', label: '厂别', display: ['FACTORY_ID', 'FACTORY_NAME'] },
    item: { table: 'subsystems', key: 'SUB_SYS_KEY', label: '子系统', display: ['SUB_SYS_ID', 'SUB_SYS_NAME'] },
    mapTable: 'factory_subsys',
    mapMasterFk: 'FACTORY_KEY',
    mapItemFk: 'SUB_SYS_KEY',
    masterColumns: ['FACTORY_ID', 'FACTORY_NAME', 'FACTORY_DESC'],
    itemColumns: ['SUB_SYS_ID', 'SUB_SYS_NAME', 'BYPASS']
  }
};

const MASTER_DETAILS = {
  AVMA006: {
    code: 'AVMA006',
    title: '事件通知人员群组设定',
    desc: '维护厂别、子系统下的通知人员群组；警报产生时按群组通知所有成员。',
    masterTable: 'event_groups',
    masterKey: 'EVENT_GROUP_KEY',
    masterId: 'EVENT_GROUP_ID',
    masterUnique: [['EVENT_GROUP_ID', 'FACTORY_KEY', 'SUB_SYS_KEY']],
    fields: [
      f.code('EVENT_GROUP_ID', '事件通知人员群组代码', { width: 190 }),
      { name: 'EVENT_GROUP_NAME', label: '事件通知人员群组名称', type: 'text', required: true, width: 210, filter: true },
      f.select('FACTORY_KEY', '厂别', 'factory', { required: true }),
      f.select('SUB_SYS_KEY', '子系统', 'subsystem', { required: true, dependsOn: 'FACTORY_KEY' }),
      { name: 'EVENT_GROUP_DESC', label: '群组说明', type: 'text', width: 240 }
    ],
    filters: ['EVENT_GROUP_ID', 'EVENT_GROUP_NAME', 'FACTORY_KEY', 'SUB_SYS_KEY'],
    detail: {
      mode: 'transfer',
      table: 'event_group_users',
      fk: 'EVENT_GROUP_KEY',
      itemTable: 'users',
      itemKey: 'USER_KEY',
      itemLabel: '群组人员',
      itemDisplay: ['USER_ID', 'USER_NAME', 'ORGAN_KEY'],
      title: '列表信息'
    }
  },
  AVMA007: {
    code: 'AVMA007',
    title: '事件通知设定',
    desc: '警报通知核心：定义事件属性与发送通知的层级、回应人数、升级间隔与重送策略。',
    masterTable: 'events',
    masterKey: 'EVENT_KEY',
    masterId: 'EVENT_ID',
    masterUnique: [['EVENT_ID']],
    fields: [
      f.code('EVENT_ID', '事件通知代码', { width: 180 }),
      { name: 'EVENT_NAME', label: '事件通知名称', type: 'text', required: true, width: 210, filter: true },
      f.select('FACTORY_KEY', '厂别', 'factory', { required: true }),
      f.select('SUB_SYS_KEY', '子系统', 'subsystem', { required: true, dependsOn: 'FACTORY_KEY' }),
      { name: 'EVENT_DESC', label: '事件通知说明', type: 'text', width: 240 },
      { name: 'EVENT_PRIORITY_ID', label: '优先权代码', type: 'number', width: 110 }
    ],
    filters: ['EVENT_ID', 'EVENT_NAME', 'FACTORY_KEY', 'SUB_SYS_KEY'],
    detail: {
      mode: 'grid',
      table: 'event_levels',
      fk: 'EVENT_KEY',
      key: 'EVENT_LEVEL_KEY',
      title: '事件层级',
      idField: 'EVENT_LEVEL_ID',
      fields: [
        { name: 'EVENT_LEVEL_ID', label: '事件层级代码', type: 'number', width: 110 },
        { name: 'EVENT_LEVEL_DESC', label: '事件层级说明', type: 'text', width: 170 },
        { name: 'NUMBER_OF_ACK_USERS', label: '需要回应的人数', type: 'text', width: 130, help: '0=不需回应，*=全员' },
        { name: 'LEVEL_INTERVAL', label: '升级层级时间间隔(分)', type: 'number', width: 170 },
        { name: 'FAIL_RETRY_TIMES', label: '失败重送次数', type: 'number', width: 120 },
        { name: 'FAIL_RETRY_INTERVAL', label: '失败重送时间间隔(秒)', type: 'number', width: 170 }
      ]
    }
  }
};

const PAGE_TITLES = {
  HOME: '首页',
  MCMS038: '系统功能选单设定',
  MCMS040: '一般主档设定',
  MCMS042: 'Mapping主档设定',
  MCMS041: 'MasterDetail主档设定',
  MCMS051: '批次状态变更设定',
  CVMA015: '自动切机况设定',
  AVPA002: '警报手动发送作业',
  AVPA009: '警报补登作业',
  AVPA003: '警报确认回报作业',
  AVPA006: '警报强制中断作业',
  AVPA013: '即时警报彙整',
  AVPA004: '警报处理查询',
  AVPA007: '历史纪录查询',
  AVPA005: '无效警报查询',
  AVPA008: '系统装置状态查询',
  RPTSET001: '报表设定',
  AVPA015: '警报装置参数设定',
  CVMA014: '警报通知设定批次隐藏',
  AVMA008: '事件层级与事件通知群组对应设定',
  AVMA010: '警报触发条件设定'
};

const REPORT_SEEDS = [
  {
    REPORT_ID: 'AVPA004',
    REPORT_NAME: '警报处理查询',
    REPORT_DESC: '查询时间区间内所有警报的处理状况。',
    CONNECTION_STRING_NAME: 'AMS_DB',
    ATLEAST_ONE_CONDITION: 'N',
    DATASOURCE_TYPE: 'SQL',
    QUERY_SQL: 'SELECT * FROM SALM_ALARM_MASTER WHERE 1=1',
    CONDITIONS: [
      { field: 'CREATE_DT', label: '资料新增时间', type: 'dateRange', defaultDays: 7, enabled: true },
      { field: 'EQP_GROUP_KEY', label: '机台群组', type: 'select', optionSet: 'eqpGroup' }
    ],
    COLUMNS: [
      ['ALARM_ID', '警报识别码'], ['CREATE_DT', '资料新增时间'], ['TITLE', '警报标题'],
      ['CONTENT', '警报详细内容'], ['STATUS', '状态'], ['FACTORY_ID', '厂别代码'],
      ['FACTORY_NAME', '厂别名称'], ['SUB_SYS_ID', '子系统代码'], ['SUB_SYS_NAME', '子系统名称'],
      ['EQP_ID', '机台代码'], ['ALARM_INFO_ID', '警报代码'], ['EVENT_ID', '事件通知代码'],
      ['CURRENT_LEVEL', '目前事件层级'], ['PRIORITY', '优先权代码'], ['FIRST_PROCESS_DT', '首次开始处理时间'],
      ['COMPLETE_DT', '处理完成日期时间'], ['RECEIVE_TYPE', '资料取得方式']
    ].map(([fld, caption]) => ({ field: fld, label: caption })),
    DISPLAY: { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', gridBackgroundColor: '#ffffff', exportType: 'Excel' },
    ADVANCED: {}
  },
  {
    REPORT_ID: 'AVPA005',
    REPORT_NAME: '无效警报查询',
    REPORT_DESC: '查询因主档缺失、忽略重复、机况过滤等原因未成功触发的警报。',
    CONNECTION_STRING_NAME: 'AMS_DB',
    ATLEAST_ONE_CONDITION: 'N',
    DATASOURCE_TYPE: 'SQL',
    QUERY_SQL: 'SELECT * FROM SALM_INVALID_ALARM WHERE 1=1',
    CONDITIONS: [
      { field: 'CREATE_DT', label: '资料新增时间', type: 'dateRange', defaultDays: 7, enabled: true },
      { field: 'EQP_GROUP_KEY', label: '机台群组', type: 'select', optionSet: 'eqpGroup' },
      { field: 'SUB_SYS_ID', label: '子系统代码', type: 'text' },
      { field: 'EQP_ID', label: '机台代码', type: 'text' }
    ],
    COLUMNS: [
      ['INVALID_ID', '无效警报识别码'], ['CREATE_DT', '产生警报时间'], ['TITLE', '警报标题'],
      ['CONTENT', '警报详细内容'], ['FACTORY_ID', '厂别代码'], ['FACTORY_NAME', '厂别名称'],
      ['SUB_SYS_ID', '子系统代码'], ['SUB_SYS_NAME', '子系统名称'], ['EQP_ID', '机台代码'],
      ['EQP_NAME', '机台名称'], ['ALARM_INFO_ID', '警报代码'], ['RECEIVE_TYPE', '资料取得方式'],
      ['INVALID_TYPE', '失效类型']
    ].map(([fld, caption]) => ({ field: fld, label: caption })),
    DISPLAY: { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', gridBackgroundColor: '#ffffff', exportType: 'Excel' },
    ADVANCED: {}
  },
  {
    REPORT_ID: 'AVPA007',
    REPORT_NAME: '历史纪录查询',
    REPORT_DESC: '查询警报全履历（建立、发送、升级、确认、完成、失败、中断）。',
    CONNECTION_STRING_NAME: 'AMS_DB',
    ATLEAST_ONE_CONDITION: 'Y',
    DATASOURCE_TYPE: 'SQL',
    QUERY_SQL: 'SELECT * FROM SALM_ALARM_TRANSACTION WHERE 1=1',
    CONDITIONS: [
      { field: 'CREATE_DT', label: '产生警报时间', type: 'dateRange', defaultDays: 3, enabled: true },
      { field: 'EQP_GROUP_KEY', label: '机台群组', type: 'select', optionSet: 'eqpGroup' },
      { field: 'EQP_ID', label: '机台代码', type: 'text' },
      { field: 'SUB_SYS_ID', label: '子系统代码', type: 'text' }
    ],
    COLUMNS: [
      ['TRX_DT', '修改时间'], ['ALARM_ID', '警报识别码'], ['SEQ', '警报讯息处理序号'],
      ['TRX_TYPE', '警报交易处理类型'], ['STATUS', '状态'], ['TITLE', '警报标题'],
      ['CONTENT', '警报详细内容'], ['FACTORY_ID', '厂别代码'], ['SUB_SYS_ID', '子系统代码'],
      ['EQP_ID', '机台代码'], ['ALARM_INFO_ID', '警报代码'], ['EVENT_ID', '事件通知代码'],
      ['CREATE_DT', '资料新增时间'], ['FIRST_PROCESS_DT', '首次开始处理时间'],
      ['COMPLETE_DT', '处理完成日期时间'], ['RECEIVE_TYPE', '资料取得方式'],
      ['PRIORITY', '优先权代码'], ['CURRENT_LEVEL', '目前事件层级']
    ].map(([fld, caption]) => ({ field: fld, label: caption })),
    DISPLAY: { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', gridBackgroundColor: '#ffffff', exportType: 'Excel' },
    ADVANCED: {}
  },
  {
    REPORT_ID: 'AVPA008',
    REPORT_NAME: '系统装置状态查询',
    REPORT_DESC: '查询 Server／Agent／装置健康状态与收发统计。',
    CONNECTION_STRING_NAME: 'AMS_DB',
    ATLEAST_ONE_CONDITION: 'N',
    DATASOURCE_TYPE: 'SQL',
    QUERY_SQL: 'SELECT * FROM SALM_AGENT_STATUS',
    CONDITIONS: [],
    COLUMNS: [
      ['SERVER_ID', 'Server 代码'], ['AGENT_ID', 'Agent 代码'], ['AGENT_STATUS', 'Agent 状态'],
      ['STATUS_DESC', '状态说明'], ['RECEIVED_COUNT', '接收命令数量'], ['SUCCESSFUL_COUNT', '成功的数量'],
      ['FAIL_COUNT', '失败的数量'], ['DEVICE_ERROR_COUNT', '装置异常的数量']
    ].map(([fld, caption]) => ({ field: fld, label: caption })),
    DISPLAY: { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', gridBackgroundColor: '#ffffff', exportType: 'Excel' },
    ADVANCED: {}
  },
  {
    REPORT_ID: 'AVPA013',
    REPORT_NAME: '即时警报彙整',
    REPORT_DESC: '按厂别、子系统、机台汇总当前处理中的警报数量。',
    CONNECTION_STRING_NAME: 'AMS_DB',
    ATLEAST_ONE_CONDITION: 'N',
    DATASOURCE_TYPE: 'SQL',
    QUERY_SQL: 'SELECT FACTORY_ID, SUB_SYS_ID, COUNT(*) FROM SALM_ALARM_MASTER WHERE STATUS = \'Process\' GROUP BY FACTORY_ID, SUB_SYS_ID',
    CONDITIONS: [],
    COLUMNS: [
      ['FACTORY_ID', '厂别代码'], ['FACTORY_NAME', '厂别名称'], ['SUB_SYS_ID', '子系统代码'],
      ['SUB_SYS_NAME', '子系统名称'], ['ALARM_COUNT', '警报数量']
    ].map(([fld, caption]) => ({ field: fld, label: caption })),
    DISPLAY: { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', gridBackgroundColor: '#ffffff', exportType: 'Excel' },
    ADVANCED: {}
  }
];

const REPORT_COLUMN_CATALOG = {
  AVPA004: [
    'ALARM_ID', 'CREATE_DT', 'TITLE', 'CONTENT', 'STATUS', 'FACTORY_ID', 'FACTORY_NAME',
    'SUB_SYS_ID', 'SUB_SYS_NAME', 'EQP_ID', 'ALARM_INFO_ID', 'EVENT_ID', 'CURRENT_LEVEL',
    'PRIORITY', 'FIRST_PROCESS_DT', 'COMPLETE_DT', 'RECEIVE_TYPE'
  ],
  AVPA005: [
    'INVALID_ID', 'CREATE_DT', 'TITLE', 'CONTENT', 'FACTORY_ID', 'FACTORY_NAME', 'SUB_SYS_ID',
    'SUB_SYS_NAME', 'EQP_ID', 'EQP_NAME', 'ALARM_INFO_ID', 'RECEIVE_TYPE', 'INVALID_TYPE'
  ],
  AVPA007: [
    'TRX_DT', 'ALARM_ID', 'SEQ', 'TRX_TYPE', 'STATUS', 'TITLE', 'CONTENT', 'FACTORY_ID',
    'SUB_SYS_ID', 'EQP_ID', 'ALARM_INFO_ID', 'EVENT_ID', 'CREATE_DT', 'FIRST_PROCESS_DT',
    'COMPLETE_DT', 'RECEIVE_TYPE', 'PRIORITY', 'CURRENT_LEVEL'
  ],
  AVPA008: [
    'SERVER_ID', 'AGENT_ID', 'AGENT_STATUS', 'STATUS_DESC', 'RECEIVED_COUNT', 'SUCCESSFUL_COUNT',
    'FAIL_COUNT', 'DEVICE_ERROR_COUNT'
  ],
  AVPA013: ['FACTORY_ID', 'FACTORY_NAME', 'SUB_SYS_ID', 'SUB_SYS_NAME', 'ALARM_COUNT']
};

module.exports = {
  MASTERS,
  MAPPINGS,
  MASTER_DETAILS,
  PAGE_TITLES,
  REPORT_SEEDS,
  REPORT_COLUMN_CATALOG,
  auditFields
};
