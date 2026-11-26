import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { state } from '../../state'
import OperationsPage from '../OperationsPage.vue'

const api = vi.fn()
const openAlarm = vi.fn(async () => {})

vi.mock('../../state', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    state: actual.state,
    api: (...args) => api(...args),
    notify: vi.fn(),
    openAlarm: (...args) => openAlarm(...args),
  }
})

vi.mock('../../components/DataGrid.vue', () => ({
  default: {
    name: 'DataGrid',
    props: ['rows', 'columns'],
    emits: ['open'],
    template: '<div class="grid-stub"><button class="open-first" @click="$emit(\'open\', rows[0])">open</button></div>',
  },
}))

const processAlarm = {
  ALARM_KEY: 'alarms-000101',
  ALARM_ID: 'A0101',
  TITLE: '机台过热',
  STATUS: 'Process',
  CAN_TERMINATE: true,
}

function mountPage(code) {
  return mount(OperationsPage, { props: { code } })
}

beforeEach(() => {
  api.mockReset()
  openAlarm.mockClear()
  state.busy = 0
  state.error = ''
  state.smtpConfigured = true
  api.mockResolvedValue({ ok: true, rows: [processAlarm] })
})

describe('OperationsPage termination work list', () => {
  it('loads the process work list for ALARM_LIST instead of the pending inbox', async () => {
    const wrapper = mountPage('ALARM_LIST')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/alarms/process')
    expect(api).not.toHaveBeenCalledWith('/alarms/pending')
    expect(wrapper.find('.grid-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps the acknowledgement inbox on its own endpoint', async () => {
    const wrapper = mountPage('ACK_LIST')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/alarms/pending')
    expect(api).not.toHaveBeenCalledWith('/alarms/process')
    wrapper.unmount()
  })

  it('opens the shared alarm detail from a work list row so termination stays in one component', async () => {
    const wrapper = mountPage('ALARM_LIST')
    await flushPromises()
    await wrapper.get('.open-first').trigger('click')
    expect(openAlarm).toHaveBeenCalledTimes(1)
    expect(openAlarm.mock.calls[0][0].ALARM_KEY).toBe(processAlarm.ALARM_KEY)
    wrapper.unmount()
  })

  it('refreshes the work list on the 10 second cadence used by the acknowledgement inbox', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountPage('ALARM_LIST')
      await flushPromises()
      api.mockClear()
      await vi.advanceTimersByTimeAsync(10_000)
      await flushPromises()
      expect(api).toHaveBeenCalledWith('/alarms/process')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('OperationsPage test alarm trigger', () => {
  it('keeps the trigger form on the TEST page and does not load an alarm list', async () => {
    api.mockResolvedValue({ ok: true, factories: [], subsystems: [], eqps: [], alarmCodes: [] })
    const wrapper = mountPage('TEST')
    await flushPromises()
    // The form watchers also refresh the cascading options, so assert on all calls rather than one.
    const paths = api.mock.calls.map(([path]) => path)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every(path => path.startsWith('/alarms/test/options?'))).toBe(true)
    expect(paths).not.toContain('/alarms/process')
    expect(wrapper.find('.grid-stub').exists()).toBe(false)
    expect(wrapper.find('.send-form').exists()).toBe(true)
    wrapper.unmount()
  })
})
