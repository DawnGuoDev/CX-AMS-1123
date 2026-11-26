import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { state } from '../../state'
import AlarmDetail from '../AlarmDetail.vue'

const api = vi.fn()
const notify = vi.fn()

vi.mock('../../state', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    state: actual.state,
    api: (...args) => api(...args),
    notify: (...args) => notify(...args),
    openAlarm: vi.fn(async () => {}),
  }
})

vi.mock('../RecordDialog.vue', () => ({
  default: {
    name: 'RecordDialog',
    props: ['title', 'wide'],
    emits: ['close'],
    template: '<section role="dialog" :aria-label="title"><slot/></section>',
  },
}))
vi.mock('../DataGrid.vue', () => ({
  default: { name: 'DataGrid', props: ['rows', 'columns'], template: '<div class="grid-stub"/>' },
}))

const base = {
  ALARM_KEY: 'alarms-000001', ALARM_ID: 'A0001', TITLE: '机台高温', STATUS: 'Process', CURRENT_LEVEL: 1,
  LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 2, FACTORY_ID: 'F01', SUB_SYS_ID: 'SS03', EQP_ID: 'EQP01',
  NOTIFICATIONS: [], TRANSACTIONS: [], LEVELS: [], ACKS: [],
}

function mountDetail(overrides = {}) {
  state.detail = { ...base, ...overrides }
  state.user = { USER_ID: 'E0043258', USER_NAME: '陈柏睿' }
  state.busy = 0
  return mount(AlarmDetail, { attachTo: document.body })
}
/** The confirmation dialog is portaled to <body> so it is not clipped by the detail dialog. */
const dialogText = () => document.body.textContent
function dialogButton(label) {
  // Ant Design inserts a space between two CJK characters ("取 消").
  return Array.from(document.body.querySelectorAll('button')).find(button => button.textContent.replace(/\s/g, '') === label.replace(/\s/g, ''))
}
function reasonInput() {
  return document.body.querySelector('textarea')
}
function terminateButton(wrapper) {
  const button = wrapper.findAll('button').find(b => b.text() === '强制中断')
  if (!button) throw new Error('terminate button not rendered')
  return button
}

beforeEach(() => {
  api.mockReset()
  notify.mockReset()
  state.error = ''
})

describe('AlarmDetail forced termination', () => {
  it('offers an enabled button to an authorized user on a processing alarm', async () => {
    const wrapper = mountDetail({ CAN_TERMINATE: true })
    expect(terminateButton(wrapper).attributes('disabled')).toBeUndefined()
    await terminateButton(wrapper).trigger('click')
    await flushPromises()
    expect(dialogText()).toContain('确认强制中断警报？')
    expect(dialogText()).toContain('机台高温')
  })

  it('disables the button with a permission hint for users without permission', () => {
    const wrapper = mountDetail({ CAN_TERMINATE: false })
    expect(terminateButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('您没有强制中断权限，请联系具权限人员处理。')
  })

  it('does not render a terminate entry inside historical transaction views', () => {
    const wrapper = mountDetail({ CAN_TERMINATE: true, STATUS: 'Terminated', TERMINATE_DT: '2026-11-26T08:00:00Z',
      HISTORY_CONTEXT: { TRX_KEY: 'alarm_transactions-000002', SEQ: 2, TRX_DT: '2026-11-26T08:00:00Z', STATUS_AFTER: 'Terminated' } })
    expect(wrapper.findAll('button').some(b => b.text() === '强制中断')).toBe(false)
  })

  it('keeps confirm disabled until a reason is entered and sends the trimmed comment once', async () => {
    api.mockResolvedValue({ ok: true, terminated: true, alarm: { ...base, STATUS: 'Terminated' } })
    const wrapper = mountDetail({ CAN_TERMINATE: true })
    await terminateButton(wrapper).trigger('click')
    await flushPromises()
    expect(dialogButton('确认中断').disabled).toBe(true)

    const reason = reasonInput()
    reason.value = '  机台已修复  '
    reason.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(dialogButton('确认中断').disabled).toBe(false)
    dialogButton('确认中断').click()
    await flushPromises()
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('/alarms/alarms-000001/terminate', { cmt: '机台已修复' })
    expect(notify).toHaveBeenCalledWith('警报已中断')
    expect(dialogText()).not.toContain('确认强制中断警报？')
  })

  it('clears the draft on cancel without calling the API', async () => {
    const wrapper = mountDetail({ CAN_TERMINATE: true })
    await terminateButton(wrapper).trigger('click')
    await flushPromises()
    // A fresh dialog (destroy-on-close) can render asynchronously; wait for the footer.
    expect(dialogButton('取消')).toBeDefined()
    const reason = reasonInput()
    reason.value = '待取消'
    reason.dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton('取消').click()
    await flushPromises()
    expect(api).not.toHaveBeenCalled()
    expect(dialogText()).not.toContain('确认强制中断警报？')
    await terminateButton(wrapper).trigger('click')
    await flushPromises()
    expect(reasonInput()).not.toBe(reason)
    expect(reasonInput().value).toBe('')
  })

  it('keeps the dialog open with the reason and surfaces the server error', async () => {
    api.mockRejectedValue(Object.assign(new Error('该警报已非处理中状态'), { status: 400 }))
    const wrapper = mountDetail({ CAN_TERMINATE: true })
    await terminateButton(wrapper).trigger('click')
    await flushPromises()
    reasonInput().value = '原因保留'
    reasonInput().dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton('确认中断').click()
    await flushPromises()
    expect(dialogText()).toContain('确认强制中断警报？')
    expect(reasonInput().value).toBe('原因保留')
    expect(document.body.querySelector('[role="alert"]').textContent).toBe('该警报已非处理中状态')
    expect(notify).not.toHaveBeenCalled()
  })

  it('shows the termination banner with time, operator and reason after termination', () => {
    const wrapper = mountDetail({ CAN_TERMINATE: false, STATUS: 'Terminated', TERMINATE_DT: '2026-11-26T08:00:00Z',
      TERMINATE_CMT: '误报', TERMINATE_USER_ID: 'E0043258', TERMINATE_USER_NAME: '陈柏睿' })
    const banner = wrapper.get('[data-test="terminated-banner"]')
    expect(banner.text()).toContain('警报已中断')
    expect(banner.text()).toContain('陈柏睿 (E0043258)')
    expect(banner.text()).toContain('误报')
  })

  it('explains that only Process alarms can be terminated', () => {
    const wrapper = mountDetail({ CAN_TERMINATE: false, STATUS: 'Completed' })
    expect(wrapper.text()).toContain('仅处理中（Process）的警报可中断')
    expect(terminateButton(wrapper).attributes('disabled')).toBeDefined()
  })
})
