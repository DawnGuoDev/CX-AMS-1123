import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportPage from '../ReportPage.vue'
import { state } from '../../state'

const api = vi.fn()

vi.mock('../../state', async (importOriginal) => ({
  ...(await importOriginal()),
  api: (...args) => api(...args),
  download: vi.fn(),
  openAlarm: vi.fn(),
}))

vi.mock('../../components/DataGrid.vue', () => ({
  default: {
    name: 'DataGrid',
    props: ['rows', 'columns'],
    emits: ['open', 'filtered'],
    template: '<div class="grid-stub"/>',
  },
}))

vi.mock('../../components/RecordDialog.vue', () => ({
  default: {
    name: 'RecordDialog',
    props: ['title', 'wide'],
    emits: ['close'],
    template: '<section role="dialog" :aria-label="title"><slot/></section>',
  },
}))

const definition = {
  REPORT_ID: 'AVPA008',
  COLUMNS: [
    { field: 'CREATE_DT', label: '资料新增时间' },
    { field: 'TITLE', label: '警报标题' },
  ],
  CONDITIONS: [
    { field: 'CREATE_DT', label: '资料新增时间', type: 'date' },
    { field: 'TITLE', label: '警报标题', type: 'text' },
  ],
}

beforeEach(() => {
  api.mockReset()
  state.busy = 0
  state.error = ''
  api.mockResolvedValue({ ok: true, row: definition })
})

describe('ReportPage AVPA008', () => {
  it('mounts, shows the query prompt and prefills the 24-hour time range', async () => {
    const wrapper = mount(ReportPage, { props: { code: 'AVPA008' } })
    await flushPromises()

    expect(api).toHaveBeenCalledWith('/report-defs/AVPA008')
    expect(wrapper.get('.panel').text()).toContain('请执行查询')
    const queryButton = wrapper.get('.toolbar button.primary')
    expect(queryButton.text().replace(/\s+/g, '')).toBe('查询')

    await queryButton.trigger('click')
    await nextTick()
    const dialog = wrapper.get('[role="dialog"]')
    const bounds = dialog.findAll('input[type="datetime-local"]')
    expect(bounds).toHaveLength(2)
    expect(bounds[0].element.value).not.toBe('')
    expect(bounds[1].element.value).not.toBe('')
  })
})
