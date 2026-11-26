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

  it('keeps form contents when clicked or dragged onto the overlay', async () => {
    const wrapper = mountDialog()
    const input = document.createElement('input')
    input.value = '尚未保存的事件名称'
    dialog().querySelector('.dialog-body').append(input)
    dialog().querySelector('.body-content').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()
    document.body.querySelector('.ant-modal-wrap').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, buttons: 1 }))
    const overlay = document.body.querySelector('.ant-modal-wrap')
    overlay.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1 }))
    overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    overlay.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(dialog()).not.toBeNull()
    expect(input.value).toBe('尚未保存的事件名称')
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
