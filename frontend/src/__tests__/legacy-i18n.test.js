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

  it('translates the force-terminate copy in every supported language', () => {
    // REQ-005/REQ-007: the detail action, its confirmation and the work-list menu must not fall back
    // to the Chinese key inside an English or Traditional Chinese session.
    const phrases = ['强制中断', '确认强制中断警报？', '确认中断', '警报已中断', '警报强制中断作业',
      '您没有强制中断权限，请联系具权限人员处理。', '仅处理中（Process）的警报可中断', '警报已中断，流程已结束']
    setLang('en')
    expect(t('强制中断')).toBe('Force terminate')
    expect(t('警报强制中断作业')).toBe('Force Terminate Alarm')
    for (const phrase of phrases) expect(t(phrase), phrase).not.toBe(phrase)
    // Traditional Chinese is converted by the optional OpenCC bundle loaded by index.html; without it
    // the page intentionally keeps the Simplified copy, so only assert the conversion when present.
    setLang('zh-TW')
    if (window.OpenCC) for (const phrase of phrases) expect(t(phrase), phrase).not.toBe(phrase)
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
