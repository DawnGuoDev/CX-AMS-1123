import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import RecordDialog from '../RecordDialog.vue'

// The dialog renders into document.body through Teleport, so assertions query the body.
function mountDialog(props = {}) {
  return mount(RecordDialog, {
    props: { title: '新增', ...props },
    slots: { default: '<p class="body-content">字段内容</p>' },
    attachTo: document.body,
  })
}

const dialog = () => document.body.querySelector('[role="dialog"]')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RecordDialog', () => {
  it('renders a modal dialog with title and slot content', () => {
    const wrapper = mountDialog()
    expect(dialog()).not.toBeNull()
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')).textContent).toBe('新增')
    expect(document.body.textContent).toContain('字段内容')
    expect(dialog().querySelector('.ant-modal-title').textContent).toBe('新增')
    wrapper.unmount()
  })

  it('emits close from the header button', async () => {
    const wrapper = mountDialog()
    dialog().querySelector('.ant-modal-close').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits close when the overlay itself is clicked, but not the dialog', async () => {
    const wrapper = mountDialog()
    dialog().querySelector('.body-content').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()
    document.body.querySelector('.ant-modal-wrap').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('applies the wide layout only when requested', () => {
    const normal = mountDialog()
    expect(document.querySelector('.ant-modal-wrap').classList.contains('large')).toBe(false)
    normal.unmount()
    document.body.innerHTML = ''
    const wide = mountDialog({ wide: true })
    expect(document.querySelector('.ant-modal-wrap').classList.contains('large')).toBe(true)
    wide.unmount()
  })
})
