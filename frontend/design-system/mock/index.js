/**
 * Local preview SDK (no Java backend, no login).
 *
 * The gallery components only consume mock fixtures. Changes in the preview simulator
 * are held in memory so dialog/table interactions work offline.
 */
import fixtures from './fixtures.json' with { type: 'json' }

const clone = value => JSON.parse(JSON.stringify(value))

export const meta = fixtures.meta
export const tokens = fixtures.tokens
export const options = fixtures.options
export const masterMeta = fixtures.masterMeta
export const reportDefinition = fixtures.reportDefinition
export const alarmColumns = fixtures.alarmColumns
export const historyColumns = fixtures.historyColumns
export const navLinks = fixtures.navLinks

export const store = {
  masters: clone(fixtures.masters),
  rows: clone(fixtures.rows),
  alarms: clone(fixtures.alarms),
  detail: clone(fixtures.detail),
}

export const previewRuntime = {
  get masters() { return store.masters },
  get rows() { return store.rows },
  get alarms() { return store.alarms },
  get detail() { return store.detail },
  saveMaster(_route, record) {
    const keyField = 'USER_KEY'
    const index = store.rows.findIndex(row => row[keyField] === record[keyField])
    if (index >= 0) store.rows.splice(index, 1, clone(record))
    else store.rows.unshift({ ...clone(record), USER_KEY: record.USER_KEY || `U${String(store.rows.length + 1).padStart(3, '0')}` })
    return true
  },
  queryReport(conditions) {
    return store.alarms.filter(row => Object.entries(conditions).every(([field, condition]) => {
      if (!condition?.enabled) return true
      const raw = String(row[field] ?? '').toLowerCase()
      const value = String(condition.value ?? '').toLowerCase()
      if (!value) return true
      if (condition.operator === 'eq') return raw === value
      if (condition.operator === 'neq') return raw !== value
      if (condition.operator === 'starts') return raw.startsWith(value)
      if (condition.operator === 'ends') return raw.endsWith(value)
      if (condition.operator === 'notContains') return !raw.includes(value)
      return raw.includes(value)
    }))
  },
  deleteTestUser(userId) {
    const before = store.rows.length
    store.rows.splice(0, store.rows.length, ...store.rows.filter(row => row.USER_ID !== userId))
    return before !== store.rows.length
  },
  acknowledgeAlarm(cmt) {
    if (!store.detail.CAN_ACK) return false
    const acked = { ...store.detail, ACK_CMT: cmt || '已确认', COMPLETE_DT: new Date().toISOString() }
    store.detail = acked
    const index = store.alarms.findIndex(row => row.ALARM_KEY === acked.ALARM_KEY)
    if (index >= 0) store.alarms.splice(index, 1, { ...store.alarms[index], STATUS: 'Completed' })
    return true
  },
}

export function restoreFixtures() {
  store.masters = clone(fixtures.masters)
  store.rows = clone(fixtures.rows)
  store.alarms = clone(fixtures.alarms)
  store.detail = clone(fixtures.detail)
}

export { clone }
