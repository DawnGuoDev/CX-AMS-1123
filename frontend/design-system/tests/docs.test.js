import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import fixtures from '../mock/fixtures.json'

const root = `${resolve(process.cwd())}/`
const read = path => readFileSync(`${root}${path}`, 'utf8')

describe('design-system docs', () => {
  it('documents every preview route', () => {
    const app = read('src/App.vue')
    const routes = [...app.matchAll(/'(\/[^']*)': defineAsyncComponent/g)].map(m => m[1])
    expect(routes.length).toBeGreaterThanOrEqual(11)
    const index = read('docs/README.md') + read('docs/routes.md')
    for (const route of routes) expect(index).toContain(`#${route}`)
  })

  it('documents the five AMS components with props and events', () => {
    const doc = read('docs/components.md')
    for (const name of ['DataGrid', 'FieldForm', 'UiCheckbox', 'RecordDialog', 'AppSidebar']) {
      expect(doc).toContain(`## ${name}`)
    }
    expect(doc.match(/### Events/g)).toHaveLength(5)
  })

  it('keeps documented tokens in sync with fixtures', () => {
    const design = read('docs/DESIGN.md')
    expect(design).toContain(fixtures.tokens.primary)
    expect(design.toLowerCase()).toContain('#122337')
    expect(design.toLowerCase()).toContain('#1c5063')
    expect(design).toMatch(/size.*middle|middle.*size/)
    expect(design).toContain(String(fixtures.tokens.pageSize))
  })

  it('ships a README and three pattern ids used by the routes', () => {
    expect(existsSync(`${root}docs/README.md`)).toBe(true)
    const patterns = read('docs/patterns.md')
    for (const heading of ['主档编辑', '条件查询与结果表格', '告警详情']) expect(patterns).toContain(heading)
  })
})
