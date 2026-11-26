// Host adapter shared by pages and components. Mirrors release state.js exports,
// but routes every request to the local in-memory mock instead of /api.
import { reactive, ref } from 'vue'
import { t as translate, setLang, getLang, ensureTraditionalConverter } from './legacy-i18n.js'
import { createMockApi } from './mock/api.js'

export const language = ref(getLang())
export const t = (key) => { language.value; return translate(key) }
export const changeLanguage = value => { language.value = value; setLang(value); ensureTraditionalConverter() }
export const state = reactive({ user: null, nav: [], meta: {}, options: {}, settings: {}, loginAt: '', busy: 0, toast: '', error: '', detail: null })
export const previewMode = true
const mockApi = createMockApi()
let messageTimer
export function notify(message) {
  state.toast = message
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => { state.toast = '' }, 5000)
}
export async function api(path, body, method = 'POST') { return mockApi(path, body, method) }
export async function act(work) {
  state.busy++; state.error = ''
  try { return await work() } catch (error) { state.error = error.message; return null }
  finally { state.busy-- }
}
export async function bootstrap() { Object.assign(state, await api('/bootstrap')) }
export async function refreshOptions() { state.options = (await api('/options')).options }
export const clone = value => JSON.parse(JSON.stringify(value))
export function download(result) {
  const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const alarmColumns = [
  ['ALARM_ID', '警报识别码'], ['TITLE', '警报标题'], ['STATUS', '状态'], ['FACTORY_ID', '厂别'],
  ['SUB_SYS_ID', '子系统'], ['EQP_ID', '机台'], ['CURRENT_LEVEL', '目前事件层级'],
  ['LEVEL_ACK_COUNT', '已回应人数'], ['LEVEL_REQUIRED', '需要回应的人数'], ['CREATE_DT', '资料新增时间'],
  ['CONTENT','详细内容'],['ALARM_INFO_ID','警报代码'],['EVENT_ID','事件通知代码'],['USER_ID','使用者代码'],
  ['USER_NAME','使用者名称'],['LEVEL_PROCESS_DT','处理启始时间'],['RECEIVE_TYPE','资料取得方式'],
].map(([field, label]) => ({ field, label }))
export const historyColumns = [['ACTION','交易类别'],['RECORD_LABEL','资料代码'],['ACTIVE','资料状态'],['TRX_DT','修改时间'],
  ['USER_ID','修改人员代码'],['USER_NAME','修改人员名称'],['IP','客户端 IP'],['HOST','电脑名称'],['BEFORE_JSON','修改前'],['AFTER_JSON','修改后']]
  .map(([field,label])=>({field,label}))
export async function openAlarm(row) {
  await act(async () => {
    const trx=row.HISTORY_CONTEXT?.TRX_KEY || row.TRX_KEY
    state.detail=(await api(`/alarms/${row.ALARM_KEY || row}${trx?'?transaction='+encodeURIComponent(trx):''}`)).alarm
  })
}
