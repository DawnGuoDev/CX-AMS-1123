import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FieldForm from '../FieldForm.vue'
import { state } from '../../state'

const baseModel = () => ({ FACTORY_KEY: 'F01', SUB_SYS_KEY: 'S01', EVENT_KEY: 'E01' })

const fields = [
  { name: 'FACTORY_KEY', label: '厂别', type: 'select', optionSet: 'factory', required: true },
  { name: 'SUB_SYS_KEY', label: '子系统', type: 'select', optionSet: 'subsystem' },
  { name: 'EVENT_KEY', label: '事件', type: 'select', optionSet: 'event' },
  { name: 'FACTORY_ID', label: '厂别代码', type: 'text', readOnly: true },
  { name: 'FACTORY_NAME', label: '厂别名称', type: 'text', readOnlyOnEdit: true },
  { name: 'IGNORE_PERIOD', label: '忽略间隔', type: 'number', integer: true, min: 0 },
  { name: 'ACTIVE', label: '启用', type: 'checkbox' },
  { name: 'DESC', label: '说明', type: 'textarea', help: '最多 200 字' },
]

function mountForm(overrides = {}) {
  return mount(FieldForm, {
    props: { fields, model: baseModel(), editing: false, ...overrides },
  })
}

describe('FieldForm', () => {
  it('skips readOnly fields but renders editable ones with their labels', () => {
    const wrapper = mountForm()
    const labels = wrapper.findAll('label > span').map(span => span.text())
    expect(labels.some(label => label.includes('厂别代码'))).toBe(false)
    for (const expected of ['厂别', '子系统', '事件', '忽略间隔', '启用', '说明']) {
      expect(labels.some(label => label.startsWith(expected))).toBe(true)
    }
    expect(wrapper.findAll('select')).toHaveLength(3)
    expect(wrapper.find('small').text()).toBe('最多 200 字')
  })

  it('marks required fields with an asterisk', () => {
    const wrapper = mountForm()
    const requiredLabel = wrapper.findAll('label').find(label => label.classes().includes('required'))
    expect(requiredLabel.text()).toContain('厂别')
    expect(requiredLabel.find('b').text()).toBe('*')
  })

  it('uses the right input type per field type', () => {
    const wrapper = mountForm()
    expect(wrapper.find('input[type="number"]').attributes('step')).toBe('1')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('disables readOnlyOnEdit fields only while editing', () => {
    const wrapper = mountForm({ editing: true })
    const nameInput = wrapper.findAll('input').find(input => input.element.closest('label').textContent.includes('厂别名称'))
    expect(nameInput.attributes('disabled')).toBeDefined()
    const readOnlyInCreate = mountForm({ editing: false })
    const editable = readOnlyInCreate.findAll('input').find(input => input.element.closest('label').textContent.includes('厂别名称'))
    expect(editable.attributes('disabled')).toBeUndefined()
  })

  it('offers subsystems of the selected factory and clears dependent values', async () => {
    state.options = {
      factory: [{ value: 'F01', label: 'F01 一厂' }, { value: 'F02', label: 'F02 二厂' }],
      subsystem: [],
      subsystemByFactory: {
        F01: [{ value: 'S01', label: 'S01 子系统一' }],
        F02: [{ value: 'S02', label: 'S02 子系统二' }],
      },
      event: [
        { value: 'E01', label: 'E01 事件一', factoryKey: 'F01', subsysKey: 'S01' },
        { value: 'E02', label: 'E02 事件二', factoryKey: 'F02', subsysKey: 'S02' },
      ],
    }
    const model = baseModel()
    const wrapper = mount(FieldForm, { props: { fields, model } })
    const optionTexts = () => wrapper.findAll('select').at(1).findAll('option').map(o => o.text())

    expect(optionTexts()).toEqual(['请选择', 'S01 子系统一'])

    // A fresh form rendered for the other factory shows the matching subsystem list.
    const other = { FACTORY_KEY: 'F02', SUB_SYS_KEY: '', EVENT_KEY: '' }
    const otherWrapper = mount(FieldForm, { props: { fields, model: other } })
    expect(otherWrapper.findAll('select').at(1).findAll('option').map(o => o.text()))
            .toEqual(['请选择', 'S02 子系统二'])

    // The parent's `changed()` contract clears dependent selections when the factory changes (as
    // done by MasterPage before the API call).
    const cleared = { ...model, SUB_SYS_KEY: '', EVENT_KEY: '' }
    await wrapper.setProps({ model: cleared })
    expect(cleared.SUB_SYS_KEY).toBe('')
  })

  it('filters event options by factory and subsystem', () => {
    state.options = {
      event: [
        { value: 'E01', label: 'E01 事件一', factoryKey: 'F01', subsysKey: 'S01' },
        { value: 'E02', label: 'E02 事件二', factoryKey: 'F02', subsysKey: 'S02' },
      ],
    }
    const wrapper = mountForm()
    const eventSelect = wrapper.findAll('select').at(2)
    expect(eventSelect.findAll('option').map(o => o.text())).toEqual(['请选择', 'E01 事件一'])
  })
})
