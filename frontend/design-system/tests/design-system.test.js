import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Antd from 'ant-design-vue'
import DataGrid from '../src/components/DataGrid.vue'
import UiCheckbox from '../src/components/UiCheckbox.vue'
import FieldForm from '../src/components/FieldForm.vue'
import RecordDialog from '../src/components/RecordDialog.vue'
import fixtures from '../mock/fixtures.json'
import { previewRuntime, restoreFixtures } from '../mock/index.js'

const opts = { global: { plugins: [Antd] } }
afterEach(() => restoreFixtures())

describe('AMS design-system components', () => {
  it('UiCheckbox adapts Y/N flags', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: 'N', trueValue: 'Y', falseValue: 'N' }, ...opts })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['Y'])
  })

  it('UiCheckbox adapts recipient arrays without duplicates', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: ['U001'], value: 'U006' }, ...opts })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([['U001', 'U006']])
    const second = mount(UiCheckbox, { props: { modelValue: ['U001', 'U006'], value: 'U001' }, ...opts })
    await second.find('input').setValue(false)
    expect(second.emitted('update:modelValue').at(-1)).toEqual([['U006']])
  })

  it('DataGrid uses middle density and 20 rows/page by default', () => {
    const wrapper = mount(DataGrid, { props: { rows: fixtures.rows, columns: [{ field: 'USER_ID', label: '使用者代码' }], rowKey: 'USER_KEY' }, ...opts })
    expect(wrapper.find('.ant-table-middle').exists()).toBe(true)
    expect(wrapper.text()).toMatch(/20\s*\/\s*page|20 条\/页|20\s*\/\s*頁/)
    expect(wrapper.find('.ant-pagination').exists()).toBe(true)
    expect(wrapper.text()).toContain('12 笔资料')
  })

  it('DataGrid emits filtered rows when searching', async () => {
    const wrapper = mount(DataGrid, { props: { rows: fixtures.rows, columns: [{ field: 'USER_NAME', label: '使用者名称' }], rowKey: 'USER_KEY' }, ...opts })
    await wrapper.find('input[aria-label="过滤列表"]').setValue('许雅婷')
    await nextTick()
    const filtered = wrapper.emitted('filtered').at(-1)[0]
    expect(filtered).toHaveLength(1)
    expect(filtered[0].USER_ID).toBe('E0043271')
  })

  it('FieldForm renders required, read-only-on-edit and metadata help', () => {
    const wrapper = mount(FieldForm, { props: { fields: fixtures.masterMeta.fields, model: { USER_ID: 'E0043258', USER_NAME: '陈柏睿' }, editing: true, options: fixtures.options }, ...opts })
    const userCode = wrapper.findAll('label').find(label => label.text().includes('使用者代码'))
    expect(userCode.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('新增时必填；修改时留空保留原密码')
  })

  it('RecordDialog emits close and sets 1120 width in wide mode', async () => {
    const wrapper = mount(RecordDialog, { props: { open: true, title: '新增使用者', wide: true }, slots: { default: '<p>内容</p>' }, attachTo: document.body, ...opts })
    await nextTick()
    expect(document.querySelector('.ant-modal').style.width).toContain('1120')
    await wrapper.findComponent({ name: 'AModal' }).vm.$emit('cancel')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('fixtures are explicitly local and contain no secrets', () => {
    expect(fixtures.meta.mock).toBe(true)
    const serialized = JSON.stringify(fixtures)
    expect(serialized).not.toContain('PASSWORD_HASH')
    expect(serialized).not.toMatch(/https?:\/\//)
    expect(fixtures.rows.every(row => row.E_MAIL.endsWith('.invalid'))).toBe(true)
  })

  it('mock store can add a user and restore without network', () => {
    previewRuntime.deleteTestUser('E0043258')
    expect(fixtures.rows.some(row => row.USER_ID === 'E0043258')).toBe(true)
    restoreFixtures()
  })
})
