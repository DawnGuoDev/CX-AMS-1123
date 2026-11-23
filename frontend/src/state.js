import { reactive, ref } from 'vue'
import { t as translate, setLang, getLang } from './legacy-i18n.js'
export const language = ref(getLang())
export const t = (key) => { language.value; return translate(key) }
export const changeLanguage = value => { language.value = value; setLang(value) }
export const state = reactive({ user: null, nav: [], meta: {}, options: {}, settings: {}, loginAt: '', busy: 0, toast: '', error: '', detail: null })
let messageTimer
export function notify(message) {
  state.toast = message
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => { state.toast = '' }, 5000)
}
export async function api(path, body, method = 'POST') {
  const response = await fetch('/api' + path, {
    method: body === undefined ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('ams_java_token') || ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || data.ok === false) {
    if (response.status === 401 && path !== '/login') { sessionStorage.removeItem('ams_java_token'); state.user = null }
    throw new Error(data.message || `HTTP ${response.status}`)
  }
  return data
}
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
].map(([field, label]) => ({ field, label }))
export const historyColumns = ['ACTION', 'RECORD_LABEL', 'TRX_DT', 'USER_NAME', 'BEFORE_JSON', 'AFTER_JSON'].map((field, i) => ({
  field, label: ['交易类别', '资料代码', '修改时间', '修改人员名称', '修改前', '修改后'][i],
}))
export async function openAlarm(row) { await act(async () => { state.detail = (await api(`/alarms/${row.ALARM_KEY || row}`)).alarm }) }
