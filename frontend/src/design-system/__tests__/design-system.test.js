import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = file => readFileSync(resolve(process.cwd(), file), 'utf8')
const app = read('src/design-system/DesignSystemApp.vue')
const main = read('src/design-system/main.js')
const data = read('src/design-system/data.js')
const vite = read('vite.config.js')
const designDoc = read('../docs/design-system/DESIGN.md')

describe('AMS design system preview', () => {
  it('stays independent from the Java API, login bootstrap and session token', () => {
    const source = [app, main, data].join('\n')
    expect(source).not.toMatch(/sessionStorage|\/login|\/bootstrap|await api\(/)
    expect(app).toContain('state.user')
    expect(app).toContain('state.nav')
  })

  it('uses the project business components and the three representative compositions', () => {
    for (const component of ['DataGrid', 'FieldForm', 'UiCheckbox', 'RecordDialog', 'AppSidebar']) {
      expect(app).toContain(`components/${component}.vue`)
      expect(designDoc).toContain(component)
    }
    expect(app).toContain('components/AlarmDetail.vue')
    expect(app).toContain('主档编辑')
    expect(app).toContain('条件查询与结果表格')
    expect(app).toContain('告警详情')
  })

  it('is emitted as a standalone Vite entry and documents the Ant Design Vue baseline', () => {
    expect(vite).toContain("design-system.html")
    expect(read('design-system.html')).toContain('/src/design-system/main.js')
    expect(designDoc).toContain('Ant Design Vue 4.2.6')
    expect(designDoc).toContain('size="middle"')
    expect(designDoc).toContain('#167d92')
  })
})
