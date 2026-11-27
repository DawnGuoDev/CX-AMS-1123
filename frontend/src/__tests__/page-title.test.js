import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pageTitle } from '../page-title'

// jsdom rewrites import.meta.url to an http:// document URL, so resolve from the working directory.
const metadataPath = ['../backend/src/main/resources/metadata.json', 'backend/src/main/resources/metadata.json']
  .map(file => resolve(process.cwd(), file)).find(existsSync)
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))

describe('pageTitle', () => {
  it('uses the master title when one exists', () => {
    expect(pageTitle('SBRM_USER', { title: '使用者设定' }, metadata.pageTitles)).toBe('使用者设定')
  })

  it('resolves every report page from the shipped metadata instead of 页面不存在', () => {
    for (const code of ['AVPA004', 'AVPA007', 'AVPA008', 'AVPA013']) {
      expect(pageTitle(code, undefined, metadata.pageTitles)).not.toBe('页面不存在')
    }
    expect(pageTitle('AVPA004', undefined, metadata.pageTitles)).toBe('警报处理查询')
    expect(pageTitle('AVPA007', undefined, metadata.pageTitles)).toBe('历史记录查询')
    expect(pageTitle('AVPA008', undefined, metadata.pageTitles)).toBe('无效警报查询')
  })

  it('keeps the built-in home and ACK headings', () => {
    expect(pageTitle('HOME', undefined, {})).toBe('即时警报汇总')
    expect(pageTitle('ACK', undefined, {})).toBe('邮件警报确认')
  })

  it('falls back to 页面不存在 only for unknown codes', () => {
    expect(pageTitle('NOT_A_PAGE', undefined, metadata.pageTitles)).toBe('页面不存在')
  })
})
