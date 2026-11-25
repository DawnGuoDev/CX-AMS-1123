import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { state } from '../../state'
import MasterPage from '../MasterPage.vue'

const factories = [
  { FACTORY_KEY: 'factories-000001', FACTORY_ID: 'F01', FACTORY_NAME: '一厂', FACTORY_DESC: '', ACTIVE: 'Y' },
  { FACTORY_KEY: 'factories-000002', FACTORY_ID: 'F02', FACTORY_NAME: '二厂', FACTORY_DESC: '', ACTIVE: 'N' },
]

const api = vi.fn()

vi.mock('../../state', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    state: actual.state,
    api: (...args) => api(...args),
    notify: vi.fn(),
    refreshOptions: vi.fn(async () => {}),
    download: vi.fn(),
  }
})

vi.mock('../../components/RecordDialog.vue', () => ({
  default: {
    name: 'RecordDialog',
    props: ['title', 'wide'],
    emits: ['close'],
    template: '<section role="dialog" :aria-label="title"><slot/></section>',
  },
}))

vi.mock('../../components/DataGrid.vue', () => ({
  default: {
    name: 'DataGrid',
    props: ['rows', 'columns', 'selectable', 'rowKey'],
    emits: ['select', 'open'],
    template: '<div class="grid-stub"/>',
  },
}))
vi.mock('../../components/FieldForm.vue', () => ({
  default: { name: 'FieldForm', props: ['fields', 'model', 'editing'], template: '<div class="fields-stub"/>' },
}))

const meta = {
  code: 'SBRM_FACTORY',
  title: '厂别设定',
  table: 'factories',
  keyField: 'FACTORY_KEY',
  idField: 'FACTORY_ID',
  uniqueFields: ['FACTORY_ID'],
  fields: [
    { name: 'FACTORY_ID', label: '厂别代码', type: 'text', required: true, readOnlyOnEdit: true },
    { name: 'FACTORY_NAME', label: '厂别名称', type: 'text', required: true },
  ],
  defaults: {},
}

function mountPage() {
  return mount(MasterPage, { props: { code: 'SBRM_FACTORY' } })
}

beforeEach(() => {
  api.mockReset()
  state.busy = 0
  state.error = ''
  state.detail = null
  state.meta = { masters: { SBRM_FACTORY: meta } }
  api.mockImplementation(async (path, body) => {
    if (path.startsWith('/master/SBRM_FACTORY/')) return { ok: true, row: {} }
    if (body !== undefined) return { ok: true, row: {}, masterKey: 'factories-000003' }
    return { ok: true, meta, rows: factories.map(row => ({ ...row })), history: [] }
  })
})

describe('MasterPage factory list', () => {
  it('loads the factory list with the active-only filter and renders the grid', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/master/SBRM_FACTORY?showHidden=0')
    expect(wrapper.find('.grid-stub').exists()).toBe(true)
    expect(wrapper.find('.grid-stub').attributes('rows')).toBeUndefined()
    expect(wrapper.findAllComponents({ name: 'DataGrid' })).toHaveLength(1)
  })

  it('reloads with hidden records when the toolbar checkbox is toggled', async () => {
    const wrapper = mountPage()
    await flushPromises()
    api.mockClear()
    await wrapper.find('.toolbar input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/master/SBRM_FACTORY?showHidden=1')
  })

  it('opens the create dialog and saves through POST', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('.toolbar button.primary').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('新增')

    wrapper.vm.edit = { FACTORY_ID: 'F09', FACTORY_NAME: '新厂' }
    await wrapper.vm.save()
    expect(api).toHaveBeenCalledWith('/master/SBRM_FACTORY', expect.objectContaining({ FACTORY_ID: 'F09' }), 'POST')
  })

  it('uses PUT when editing a row and confirms before hiding', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.start(factories[0])
    expect(wrapper.vm.editing).toBe(true)
    await wrapper.vm.save()
    expect(api).toHaveBeenCalledWith('/master/SBRM_FACTORY/factories-000001', expect.anything(), 'PUT')

    wrapper.vm.selected = [factories[0]]
    wrapper.vm.confirm = 'hide'
    await flushPromises()
    // The confirmation dialog is titled by the question, not by the generic "确认".
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toContain('确认隐藏所选资料')
    await wrapper.vm.changeActive()
    expect(api).toHaveBeenCalledWith('/master/SBRM_FACTORY/factories-000001/hide', {})
    expect(wrapper.vm.confirm).toBe('')
  })

  it('copies a row without its key and identity fields', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.start(factories[0], true)
    expect(wrapper.vm.editing).toBe(false)
    expect(wrapper.vm.edit.FACTORY_KEY).toBeUndefined()
    expect(wrapper.vm.edit.FACTORY_ID).toBeUndefined()
    expect(wrapper.vm.edit.FACTORY_NAME).toBe('一厂')
  })

  it('blocks saving while a level draft is open and surfaces the error', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.levelDraft = { EVENT_LEVEL_ID: 1, USER_KEYS: [] }
    api.mockClear()
    await wrapper.vm.save()
    expect(api).not.toHaveBeenCalled()
    expect(state.error).toBe('请先确认或取消正在编辑的层级')
  })
})
