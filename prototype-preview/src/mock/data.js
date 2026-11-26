// Preview-only fixtures, derived from the shape of release seed/meta data.
// Not a product requirement and not an API contract.
export const previewUser = { USER_ID: 'E0043258', USER_NAME: '系统管理员', ROLE: 'ADMIN' }

export const previewNav = [
  { id: 'n1', code: 'AVPA013', name: '即时警报汇总', path: '/page/AVPA013' },
  { id: 'n2', code: 'ACK_LIST', name: '待我确认', path: '/page/ACK_LIST' },
  { id: 'n3', code: 'TEST', name: '测试告警触发', path: '/page/TEST' },
  { id: 'n4', code: 'SBRM_USER', name: '使用者管理', path: '/page/SBRM_USER' },
  { id: 'n5', code: 'SBRM_FACTORY', name: '厂别管理', path: '/page/SBRM_FACTORY' },
  { id: 'n6', code: 'SBRM_EQP', name: '机台管理', path: '/page/SBRM_EQP' },
  { id: 'n7', code: 'AVMA003', name: '子系统管理', path: '/page/AVMA003' },
  { id: 'n8', code: 'AVMA007', name: '事件通知管理', path: '/page/AVMA007' },
  { id: 'n9', code: 'AVPA004', name: '警报处理查询', path: '/page/AVPA004' },
]

export const previewMeta = {
  pageTitles: { HOME: '即时警报汇总', ACK_LIST: '待我确认', TEST: '测试告警触发' },
  masters: {
    SBRM_USER: { title: '使用者管理', columns: [
      { field: 'USER_ID', label: '使用者代码' }, { field: 'USER_NAME', label: '使用者名称' },
      { field: 'FACTORY_ID', label: '厂别' }, { field: 'ACTIVE', label: '资料状态' },
    ], fields: [
      { name: 'USER_ID', label: '使用者代码', required: true, readOnlyOnEdit: true },
      { name: 'USER_NAME', label: '使用者名称', required: true },
      { name: 'FACTORY_ID', label: '厂别', type: 'select', optionSet: 'factories', required: true },
      { name: 'ACTIVE', label: '资料状态', type: 'checkbox' },
    ] },
    SBRM_FACTORY: { title: '厂别管理', columns: [
      { field: 'FACTORY_ID', label: '厂别代码' }, { field: 'FACTORY_NAME', label: '厂别名称' }, { field: 'ACTIVE', label: '资料状态' },
    ], fields: [
      { name: 'FACTORY_ID', label: '厂别代码', required: true, readOnlyOnEdit: true },
      { name: 'FACTORY_NAME', label: '厂别名称', required: true },
      { name: 'ACTIVE', label: '资料状态', type: 'checkbox' },
    ] },
    SBRM_EQP: { title: '机台管理', columns: [
      { field: 'EQP_ID', label: '机台代码' }, { field: 'EQP_NAME', label: '机台名称' }, { field: 'ACTIVE', label: '资料状态' },
    ], fields: [
      { name: 'EQP_ID', label: '机台代码', required: true, readOnlyOnEdit: true },
      { name: 'EQP_NAME', label: '机台名称', required: true },
      { name: 'ACTIVE', label: '资料状态', type: 'checkbox' },
    ] },
  },
}

export const previewOptions = {
  factories: [{ value: 'F01', label: 'F01 · 一厂' }, { value: 'F02', label: 'F02 · 二厂' }],
  subsystems: [{ value: 'S01', label: 'S01 · 蚀刻' }, { value: 'S02', label: 'S02 · 薄膜' }],
  eqps: [{ value: 'EQP-001', label: 'EQP-001 · 蚀刻机 A' }, { value: 'EQP-002', label: 'EQP-002 · 镀膜机 B' }],
  alarmCodes: [{ value: 'ALM-101', label: 'ALM-101 · 温度超限' }, { value: 'ALM-102', label: 'ALM-102 · 压力异常' }],
}

export const previewAlarms = [
  { ALARM_KEY: 'A-0001', ALARM_ID: 'ALM-20261126-0001', TITLE: '蚀刻机温度超限', STATUS: 'Process', FACTORY_ID: 'F01',
    SUB_SYS_ID: 'S01', EQP_ID: 'EQP-001', CURRENT_LEVEL: 1, LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 2,
    CREATE_DT: '2026-11-26T01:12:00Z', ALARM_INFO_ID: 'ALM-101', EVENT_NAME: '温度超限通知', CONTENT: '腔体温度连续 3 分钟高于上限 185℃。' },
  { ALARM_KEY: 'A-0002', ALARM_ID: 'ALM-20261126-0002', TITLE: '镀膜机压力异常', STATUS: 'Completed', FACTORY_ID: 'F02',
    SUB_SYS_ID: 'S02', EQP_ID: 'EQP-002', CURRENT_LEVEL: 1, LEVEL_ACK_COUNT: 1, LEVEL_REQUIRED: 1,
    CREATE_DT: '2026-11-26T00:40:00Z', ALARM_INFO_ID: 'ALM-102', EVENT_NAME: '压力异常通知', CONTENT: '真空腔压力低于下限。' },
  { ALARM_KEY: 'A-0003', ALARM_ID: 'ALM-20261126-0003', TITLE: '蚀刻机气体流量不足', STATUS: 'Fail', FACTORY_ID: 'F01',
    SUB_SYS_ID: 'S01', EQP_ID: 'EQP-001', CURRENT_LEVEL: 2, LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 1,
    CREATE_DT: '2026-11-25T22:05:00Z', ALARM_INFO_ID: 'ALM-101', EVENT_NAME: '气体流量通知', CONTENT: 'CF4 流量低于设定值 90%。' },
]
