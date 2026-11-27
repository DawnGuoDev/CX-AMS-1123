import { afterEach, describe, expect, it } from 'vitest'
import { fmtDT, fmtDate, fmtTime, getLang, setLang, t } from '../legacy-i18n'

afterEach(() => setLang('zh-CN'))

describe('translation', () => {
  it('translates known keys and falls back to the original key', () => {
    setLang('en')
    expect(t('厂别设定')).toBe('Factory Management')
    expect(t('not.a.translation')).toBe('not.a.translation')
  })

  it('re-translates strings after switching language (cache must not leak)', () => {
    expect(t('即时警报汇总')).toBe('即时警报汇总')
    setLang('en')
    expect(t('即时警报汇总')).toBe('即时警报汇总') // not in the EN dictionary: keeps the original key
    expect(t('厂别设定')).toBe('Factory Management')
    setLang('zh-CN')
    expect(t('厂别设定')).toBe('厂别管理')
  })

  it('translates invalid alarm report columns and prompts', () => {
    setLang('en')
    for (const key of ['无效警报查询', '无效警报识别码', '失效类型', '失效原因', '来源接口', '触发人员', '重复警报识别码', '默认近 24 小时，可调整']) {
      expect(t(key)).not.toBe(key)
    }
  })

  it('switches the active language', () => {
    expect(getLang()).toBe('zh-CN')
    setLang('en')
    expect(getLang()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    setLang('zh-TW')
    expect(document.documentElement.lang).toBe('zh-Hant')
  })
})

describe('date formatting', () => {
  it('returns an empty string for missing values', () => {
    expect(fmtDT('')).toBe('')
    expect(fmtDate(null)).toBe('')
    expect(fmtTime(undefined)).toBe('')
  })

  it('formats valid ISO values', () => {
    expect(fmtDate('2026-01-02T03:04:05Z')).toMatch(/^2026\/01\/0[12]$/)
    expect(fmtTime('2026-01-02T03:04:05Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(fmtDT('2026-01-02T03:04:05Z')).toMatch(/^2026\/01\/0[12] \d{2}:\d{2}:\d{2}$/)
  })

  it('passes invalid values through instead of showing Invalid Date', () => {
    expect(fmtDT('not-a-date')).toBe('not-a-date')
    expect(fmtDate('2026-13-45')).toBe('2026-13-45')
  })
})
