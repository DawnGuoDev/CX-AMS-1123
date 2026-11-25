import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiCheckbox from '../UiCheckbox.vue'

describe('checkbox API value compatibility', () => {
  it('emits Y/N flags rather than booleans for API fields', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: 'N', trueValue: 'Y', falseValue: 'N' } })
    await wrapper.get('input').setChecked(true)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['Y'])
    await wrapper.setProps({ modelValue: 'Y' })
    await wrapper.get('input').setChecked(false)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['N'])
  })

  it('adds and removes recipients without mutating the original array', async () => {
    const original = ['U01']
    const wrapper = mount(UiCheckbox, { props: { modelValue: original, value: 'U02' } })
    await wrapper.get('input').setChecked(true)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([['U01','U02']])
    expect(original).toEqual(['U01'])
    await wrapper.setProps({ modelValue: ['U01','U02'] })
    await wrapper.get('input').setChecked(false)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([['U01']])
  })
})
