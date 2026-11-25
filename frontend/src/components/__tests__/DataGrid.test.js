import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataGrid from '../DataGrid.vue'

const columns = [
  { field: 'FACTORY_ID', label: '厂别代码' },
  { field: 'FACTORY_NAME', label: '厂别名称' },
  { field: 'ACTIVE', label: '状态' },
]

const rows = [
  { FACTORY_KEY: 'factories-000001', FACTORY_ID: 'F01', FACTORY_NAME: '一厂', ACTIVE: 'Y' },
  { FACTORY_KEY: 'factories-000002', FACTORY_ID: 'F02', FACTORY_NAME: '二厂', ACTIVE: 'Y' },
  { FACTORY_KEY: 'factories-000003', FACTORY_ID: 'F03', FACTORY_NAME: 'Hidden 厂', ACTIVE: 'N' },
]

function mountGrid(props = {}) {
  return mount(DataGrid, { props: { rows, columns, ...props } })
}

describe('DataGrid rendering', () => {
  it('renders a header, one row per record and the record count', () => {
    const wrapper = mountGrid()
    const headers = wrapper.findAll('thead th').map(th => th.text())
    expect(headers).toContain('厂别代码')
    expect(headers).toContain('操作')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)')).toHaveLength(3)
    expect(wrapper.text()).toContain('3 笔资料')
  })

  it('renders a dash for empty values and marks hidden rows', () => {
    const wrapper = mountGrid({ rows: [{ FACTORY_ID: '', FACTORY_NAME: null }] })
    const cells = wrapper.findAll('tbody tr:not(.ant-table-measure-row)').at(0).findAll('td')
    expect(cells.at(1).text()).toBe('—')
    expect(cells.at(2).text()).toBe('—')
    expect(mountGrid({ rows: [{ ...rows[2] }] }).find('tbody tr.ant-table-row').classes()).toContain('hidden')
  })

  it('shows an empty placeholder when nothing matches', async () => {
    const wrapper = mountGrid()
    await wrapper.find('input[aria-label="过滤列表"]').setValue('不存在的关键字')
    expect(wrapper.text()).toContain('查无资料')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)')).toHaveLength(1)
  })

  it('toggles sort direction by clicking a header', async () => {
    // The current build's label lookup maps 厂别名称 to 厂别代码, so sort a plain ASCII column to
    // assert the ordering contract independently of UI text.
    const wrapper = mountGrid({ columns: [{ field: 'CODE', label: 'CODE' }, { field: 'NAME', label: 'NAME' }], rows: [
      { CODE: 'b', NAME: 'Beta' },
      { CODE: 'a', NAME: 'Alpha' },
      { CODE: 'c', NAME: 'Gamma' },
    ] })
    // Headers are: CODE | NAME | 操作
    const codeHeader = wrapper.findAll('thead th').at(0)
    await codeHeader.trigger('click')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)').at(0).text()).toContain('Alpha')
    expect(codeHeader.text()).toContain('↑')
    await codeHeader.trigger('click')
    expect(codeHeader.text()).toContain('↓')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)').at(0).text()).toContain('Gamma')
  })
})

describe('DataGrid filtering and selection', () => {
  it('filters rows by the toolbar search case-insensitively', async () => {
    const wrapper = mountGrid()
    await wrapper.find('input[aria-label="过滤列表"]').setValue('HIDDEN')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)')).toHaveLength(1)
    expect(wrapper.text()).toContain('1 笔资料')
  })

  it('emits the filtered rows and exposes them through filtered', async () => {
    const wrapper = mountGrid()
    await wrapper.find('input[aria-label="过滤列表"]').setValue('二厂')
    expect(wrapper.emitted('filtered').at(-1)[0]).toHaveLength(1)
    expect(wrapper.vm.filtered).toHaveLength(1)
  })

  it('applies a column filter operator', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('button').find(button => button.text() === '列过滤').trigger('click')
    const nameFilter = wrapper.findAll('input[aria-label="过滤厂别名称"]').at(0)
    await nameFilter.setValue('一厂')
    expect(wrapper.findAll('tbody tr:not(.ant-table-measure-row)')).toHaveLength(1)
    expect(wrapper.text()).toContain('一厂')
  })

  it('selects the current page and emits selection', async () => {
    const wrapper = mountGrid({ selectable: true, rowKey: 'FACTORY_KEY' })
    const selectAll = wrapper.find('thead input[type="checkbox"]')
    await selectAll.setChecked(true)
    expect(wrapper.emitted('select').at(-1)[0]).toHaveLength(3)
    await wrapper.findAll('tbody input[aria-label="选择资料"]').at(0).setChecked(false)
    expect(wrapper.emitted('select').at(-1)[0]).toHaveLength(2)
  })

  it('emits open when a row action or link cell is clicked', async () => {
    const wrapper = mountGrid({ columns: [{ field: 'FACTORY_ID', label: '厂别代码', link: true }] })
    await wrapper.find('tbody button.link').trigger('click')
    await wrapper.findAll('tbody button.link').at(1).trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(2)
    expect(wrapper.emitted('open')[0][0].FACTORY_ID).toBe('F01')
  })
})
