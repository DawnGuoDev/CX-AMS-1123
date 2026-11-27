import { reactive, shallowReactive } from 'vue'
import fixtures from '../../mock/fixtures.json'
import { previewRuntime } from '../../mock/index.js'

export const clone = value => JSON.parse(JSON.stringify(value))
export const mock = fixtures
/** Shallow proxy so `runtime.alarms` / `runtime.detail` re-reads stay reactive after in-place updates. */
export const runtime = shallowReactive(previewRuntime)
export const mockState = reactive({ toast: '', detailOpen: false })

export function notify(message) {
  mockState.toast = message
  window.clearTimeout(notify.timer)
  notify.timer = window.setTimeout(() => { mockState.toast = '' }, 3200)
}
