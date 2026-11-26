export const localUser = { USER_KEY: 'u-1', USER_ID: 'E0043258', USER_NAME: '系统管理员', EMAIL: 'demo@example.invalid' }

export const localNav = [
  { key: 'n-home', id: 'HOME', name: '首页', type: 'PAGE', path: '#/design-system', children: [] },
  { key: 'n-master', id: 'SBRM_USER', name: '使用者设定', type: 'PAGE', path: '#/page/SBRM_USER', children: [] },
  { key: 'n-report', id: 'AVPA004', name: '警报处理查询', type: 'PAGE', path: '#/page/AVPA004', children: [] },
]

export const masterRows = [
  { USER_KEY: 'u-1', USER_ID: 'E0043258', USER_NAME: '陈柏睿', E_MAIL: 'bo-chen@example.invalid', ACTIVE: 'Y', MTR_DATE: '2026-11-20T08:12:30' },
  { USER_KEY: 'u-2', USER_ID: 'E0043288', USER_NAME: '林彦廷', E_MAIL: 'yan-ting@example.invalid', ACTIVE: 'Y', MTR_DATE: '2026-11-22T10:44:00' },
  { USER_KEY: 'u-3', USER_ID: 'E0043271', USER_NAME: '许雅婷', E_MAIL: 'ya-ting@example.invalid', ACTIVE: 'N', MTR_DATE: '2026-11-24T15:09:45' },
]

export const masterColumns = [
  { field: 'USER_ID', label: '使用者代码', width: 120 },
  { field: 'USER_NAME', label: '使用者名称', width: 130 },
  { field: 'E_MAIL', label: 'E-Mail', width: 210 },
  { field: 'ACTIVE', label: '状态', width: 90 },
  { field: 'MTR_DATE', label: '修改时间', type: 'date', width: 180 },
]

export const masterFields = [
  { name: 'USER_ID', label: '使用者代码', type: 'text' },
  { name: 'USER_NAME', label: '使用者名称', type: 'text', required: true },
  { name: 'E_MAIL', label: 'E-Mail', type: 'text', required: true },
  { name: 'IS_EMPLOYEE', label: '是否公司员工', type: 'checkbox' },
  { name: 'NOTE', label: '备注', type: 'textarea', wide: true },
]

export const queryRows = [
  { ALARM_KEY: 'a-1001', ALARM_ID: 'ALM-1001', TITLE: 'PRT01 温度上限告警', STATUS: 'Process', FACTORY_ID: 'Fab01', SUB_SYS_ID: 'MES', EQP_ID: 'PRT01', CREATE_DT: '2026-11-25T10:18:22' },
  { ALARM_KEY: 'a-1002', ALARM_ID: 'ALM-1002', TITLE: 'FDC 规则超限', STATUS: 'Completed', FACTORY_ID: 'Fab01', SUB_SYS_ID: 'FDC', EQP_ID: 'PRT02', CREATE_DT: '2026-11-25T11:03:10' },
  { ALARM_KEY: 'a-1003', ALARM_ID: 'ALM-1003', TITLE: 'MES 通讯失败', STATUS: 'NoNextLevel', FACTORY_ID: 'Fab02', SUB_SYS_ID: 'MES', EQP_ID: 'PRT03', CREATE_DT: '2026-11-25T11:41:08' },
]

export const queryColumns = [
  { field: 'ALARM_ID', label: '警报识别码', width: 130 },
  { field: 'TITLE', label: '警报标题', width: 210 },
  { field: 'STATUS', label: '状态', width: 120 },
  { field: 'FACTORY_ID', label: '厂别', width: 100 },
  { field: 'SUB_SYS_ID', label: '子系统', width: 110 },
  { field: 'EQP_ID', label: '机台', width: 100 },
  { field: 'CREATE_DT', label: '产生时间', type: 'date', width: 180 },
]

export const alarmDetail = {
  ALARM_KEY: 'a-1001',
  ALARM_ID: 'ALM-1001',
  TITLE: 'PRT01 温度上限告警',
  STATUS: 'Process',
  FACTORY_ID: 'Fab01',
  FACTORY_NAME: '一厂',
  SUB_SYS_ID: 'MES',
  SUB_SYS_NAME: '制造执行',
  EQP_ID: 'PRT01',
  ALARM_INFO_ID: 'TEMP_HIGH',
  EVENT_ID: 'EVT-001',
  EVENT_NAME: '设备超温通知',
  CREATE_DT: '2026-11-25T10:18:22',
  CONTENT_TYPE: 'TEXT',
  CONTENT: 'PRT01 当前温度 88 °C，超过上限 80 °C。\n采样来源：设备模拟器。\n请确认后执行现场处置。',
  CURRENT_LEVEL: 1,
  LEVEL_ACK_COUNT: 1,
  LEVEL_REQUIRED: 2,
  CAN_ACK: false,
  HISTORY_CONTEXT: { TRX_KEY: 'history', SEQ: 3, TRX_DT: '2026-11-25T11:00:00', STATUS_AFTER: 'Process' },
  NOTIFICATIONS: [
    { USER_ID: 'E0043258', USER_NAME: '陈柏睿', CHANNEL: 'Email', RESULT: 'Success', SEND_DT: '2026-11-25T10:18:30', MESSAGE: 'SMTP accepted' },
    { USER_ID: 'E0043288', USER_NAME: '林彦廷', CHANNEL: 'Email', RESULT: 'Fail', SEND_DT: '2026-11-25T10:18:31', MESSAGE: 'SMTP unavailable' },
  ],
  TRANSACTIONS: [
    { SEQ: 1, TRX_TYPE: 'Create', STATUS_BEFORE: '—', STATUS_AFTER: 'Process', USER_NAME: '系统', TRX_DT: '2026-11-25T10:18:22', NOTE: '设备模拟触发' },
  ],
  LEVELS: [
    { LEVEL_ID: 1, REQUIRED_ACK: 2, ACK_COUNT: 1, RESEND_COUNT: 1, START_DT: '2026-11-25T10:18:22', STATUS: 'Process' },
  ],
  ACKS: [
    { USER_ID: 'E0043258', USER_NAME: '陈柏睿', ACK_DT: '2026-11-25T10:24:00', ACK_CMT: '现场复机中' },
  ],
}
