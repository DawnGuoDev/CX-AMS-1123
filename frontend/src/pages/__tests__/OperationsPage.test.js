import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationsPage from '../OperationsPage.vue'

const pendingRows = [
  { ALARM_KEY: 'alarms-000001', ALARM_ID: 'A1', TITLE: '警报一', STATUS: 'Process' },
  { ALARM_KEY: 'alarms-000002', ALARM_ID: 'A2', TITLE: '警报二', STATUS: 'Process' },
]

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

vi.mock('../../components/DeviceSimulator.vue', () => ({ default: { template: '<div/>' } }))

function mountPending() {
  return mount(OperationsPage, { props: { code: 'ACK_LIST' } })
}

describe('ACK_LIST 批量确认回报', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    api.mockResolvedValue({ rows: pendingRows })
  })

  it('启用勾选并在无选择时置灰批量按钮', async () => {
    const wrapper = mountPending()
    await flushPromises()
    const grid = wrapper.findComponent({ name: 'DataGrid' })
    expect(grid.props('selectable')).toBe(true)
    expect(grid.props('rowKey')).toBe('ALARM_KEY')
    const batchButton = wrapper.findAll('button').find(b => b.text().includes('批量确认回报'))
    expect(batchButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('已选 0 笔')
  })

  it('勾选后弹窗填写备注并逐笔复用同一备注提交，成功后刷新并清空选择', async () => {
    const wrapper = mountPending()
    await flushPromises()
    const grid = wrapper.findComponent({ name: 'DataGrid' })
    grid.vm.$emit('select', pendingRows)
    await flushPromises()
    expect(wrapper.text()).toContain('已选 2 笔')

    await wrapper.findAll('button').find(b => b.text().includes('批量确认回报')).trigger('click')
    await flushPromises()
    const modal = wrapper.findComponent({ name: 'AModal' })
    expect(modal.props('open')).toBe(true)
    // AModal 通过 Teleport 渲染到 document.body。
    expect(document.body.textContent).toContain('2')

    const textarea = document.body.querySelector('textarea')
    textarea.value = '统一回应备注'
    textarea.dispatchEvent(new Event('input'))
    api.mockClear()
    api.mockImplementation(path => {
      if (path === '/alarms/ack') return Promise.resolve({ items: [
        { ALARM_KEY: 'alarms-000001', ok: true }, { ALARM_KEY: 'alarms-000002', ok: true },
      ], successCount: 2, failCount: 0 })
      return Promise.resolve({ rows: [] })
    })
    modal.vm.$emit('ok')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/alarms/ack', { keys: ['alarms-000001', 'alarms-000002'], cmt: '统一回应备注' })
    expect(notify).toHaveBeenCalledWith('警报确认成功：共 2 笔')
    expect(wrapper.text()).toContain('已选 0 笔')
  })

  it('部分失败时提示成功/失败笔数并保留失败明细', async () => {
    const wrapper = mountPending()
    await flushPromises()
    const grid = wrapper.findComponent({ name: 'DataGrid' })
    grid.vm.$emit('select', pendingRows)
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('批量确认回报')).trigger('click')
    await flushPromises()
    const modal = wrapper.findComponent({ name: 'AModal' })
    api.mockImplementation(path => {
      if (path === '/alarms/ack') return Promise.resolve({ items: [
        { ALARM_KEY: 'alarms-000001', ok: true },
        { ALARM_KEY: 'alarms-000002', ok: false, message: '您不是本层级待确认人员，或已确认过此警报' },
      ], successCount: 1, failCount: 1 })
      return Promise.resolve({ rows: pendingRows.slice(0, 1) })
    })
    modal.vm.$emit('ok')
    await flushPromises()
    expect(notify).toHaveBeenCalledWith('确认完成：成功 1 笔，失败 1 笔')
  })
})
