// Local mock host: replaces /api + auth/session bootstrap for the standalone preview.
// Same route shapes as the real app, but state lives in memory only.
import { previewUser, previewNav, previewMeta, previewOptions, previewAlarms } from './data.js'

const clone = value => JSON.parse(JSON.stringify(value))
const alarms = clone(previewAlarms)
const state = { options: clone(previewOptions), meta: clone(previewMeta), nav: clone(previewNav), user: clone(previewUser) }
const delay = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms))

export function createMockApi() {
  return async function api(path, body = {}, method = 'POST') {
    await delay()
    const [route, search] = path.split('?')
    if (route === '/bootstrap') return { ...clone(state), user: state.user, loginAt: new Date().toISOString(), settings: {}, smtpConfigured: false }
    if (route === '/options') return { options: clone(state.options) }
    if (route === '/login') return { token: 'preview-token' }
    if (route === '/logout') return { ok: true }
    if (route === '/alarms/pending') return { rows: clone(alarms.filter(a => a.STATUS === 'Process')) }
    if (route === '/alarms/test/options') return clone(state.options)
    if (route === '/alarms/test') {
      const row = { ALARM_KEY: `A-${Date.now()}`, ALARM_ID: `ALM-PREVIEW-${alarms.length + 1}`, TITLE: body.title || '预览测试告警',
        STATUS: 'Process', FACTORY_ID: body.factoryKey, SUB_SYS_ID: body.subsysKey, EQP_ID: body.eqpKey,
        CURRENT_LEVEL: 1, LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 2, CREATE_DT: new Date().toISOString(),
        ALARM_INFO_ID: body.alarmCode, EVENT_NAME: '预览事件通知', CONTENT: body.content || '预览触发，仅保存在本页内存中。' }
      alarms.unshift(row)
      return { alarm: clone(row) }
    }
    const alarmMatch = route.match(/^\/alarms\/([^/]+)(?:\/(ack))?$/)
    if (alarmMatch) {
      const row = alarms.find(a => a.ALARM_KEY === decodeURIComponent(alarmMatch[1]))
      if (!row) throw Object.assign(new Error('查无此警报'), { status: 404 })
      if (alarmMatch[2] === 'ack') {
        row.LEVEL_ACK_COUNT = Math.min((row.LEVEL_ACK_COUNT || 0) + 1, row.LEVEL_REQUIRED || 1)
        row.STATUS = row.LEVEL_ACK_COUNT >= (row.LEVEL_REQUIRED || 1) ? 'Completed' : 'Process'
        return { ok: true }
      }
      return { alarm: clone({ ...row, CAN_ACK: row.STATUS === 'Process', ACK_CMT: '', NOTIFICATIONS: [], TRANSACTIONS: [], LEVELS: [], ACKS: [] }) }
    }
    throw Object.assign(new Error(`预览未覆盖接口 ${route}`), { status: 404 })
  }
}

export function previewMasterStore() {
  const rows = {
    SBRM_USER: [{ USER_ID: 'E0043258', USER_NAME: '系统管理员', FACTORY_ID: 'F01', ACTIVE: 'Y' }, { USER_ID: 'E0043288', USER_NAME: '值班主管', FACTORY_ID: 'F01', ACTIVE: 'Y' }],
    SBRM_FACTORY: [{ FACTORY_ID: 'F01', FACTORY_NAME: '一厂', ACTIVE: 'Y' }, { FACTORY_ID: 'F02', FACTORY_NAME: '二厂', ACTIVE: 'Y' }],
    SBRM_EQP: [{ EQP_ID: 'EQP-001', EQP_NAME: '蚀刻机 A', ACTIVE: 'Y' }, { EQP_ID: 'EQP-002', EQP_NAME: '镀膜机 B', ACTIVE: 'N' }],
  }
  return {
    rows: code => clone(rows[code] || []),
    save: (code, row, editing) => {
      const list = rows[code] || (rows[code] = [])
      if (editing) Object.assign(list.find(r => r.USER_ID === row.USER_ID || r.FACTORY_ID === row.FACTORY_ID || r.EQP_ID === row.EQP_ID) || {}, clone(row))
      else list.push(clone(row))
    },
  }
}
