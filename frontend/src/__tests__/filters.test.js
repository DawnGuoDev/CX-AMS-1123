import { describe, expect, it } from 'vitest'
import { dateOps, emptyFilter, isDate, matches, textOps, toServerConditions } from '../filters'

const textColumn = { field: 'TITLE', type: 'text' }
const dateColumn = { field: 'CREATE_DT', type: 'date' }

describe('filter column detection', () => {
  it('treats explicit date types and *_DT / *_DATE fields as dates', () => {
    expect(isDate({ field: 'X', type: 'date' })).toBe(true)
    expect(isDate({ field: 'CREATE_DT' })).toBe(true)
    expect(isDate({ field: 'HIRE_DATE' })).toBe(true)
    expect(isDate({ field: 'TITLE' })).toBe(false)
  })

  it('builds an empty filter with the matching operator set', () => {
    expect(emptyFilter(textColumn)).toEqual({ enabled: false, type: 'text', operator: 'contains', value: '', from: '', to: '' })
    expect(emptyFilter(dateColumn)).toEqual({ enabled: false, type: 'date', operator: 'between', value: '', from: '', to: '' })
  })

  it('exposes only supported text and date operators', () => {
    expect(textOps.map(([value]) => value)).toEqual(['contains', 'notContains', 'starts', 'ends', 'eq', 'neq'])
    expect(dateOps.map(([value]) => value)).toEqual(['between', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'])
  })
})

describe('text matching', () => {
  const active = (operator, value) => ({ ...emptyFilter(textColumn), enabled: true, operator, value })

  it('passes everything when no condition is enabled or no value is set', () => {
    expect(matches('anything', emptyFilter(textColumn))).toBe(true)
    expect(matches('anything', active('contains', ''))).toBe(true)
    expect(matches('anything', undefined)).toBe(true)
  })

  it('is case-insensitive and treats null as an empty string', () => {
    expect(matches('Printer No Dye', active('contains', 'NO DYE'))).toBe(true)
    expect(matches(null, active('eq', ''))).toBe(true)
    expect(matches(null, active('contains', 'x'))).toBe(false)
  })

  it('supports every text operator', () => {
    expect(matches('abc', active('neContainSer', ''))).toBe(true) // unknown operator -> no match required
    expect(matches('abc', active('starts', 'ab'))).toBe(true)
    expect(matches('abc', active('ends', 'bc'))).toBe(true)
    expect(matches('abc', active('eq', 'abc'))).toBe(true)
    expect(matches('abc', active('neq', 'abc'))).toBe(false)
    expect(matches('abc', active('notContains', 'z'))).toBe(true)
    expect(matches('abc', active('notContains', 'b'))).toBe(false)
  })
})

describe('date matching', () => {
  const active = (operator, extra) => ({ ...emptyFilter(dateColumn), enabled: true, operator, ...extra })

  it('compares whole seconds in the between range', () => {
    const condition = active('between', { from: '2026-01-01T00:00:00Z', to: '2026-01-01T00:00:10Z' })
    expect(matches('2026-01-01T00:00:10Z', condition)).toBe(true)
    expect(matches('2026-01-01T00:00:11Z', condition)).toBe(false)
    expect(matches('2025-12-31T23:59:59Z', condition)).toBe(false)
  })

  it('supports exact and relative comparisons', () => {
    const instant = '2026-01-01T10:00:00Z'
    expect(matches(instant, active('eq', { value: instant }))).toBe(true)
    expect(matches(instant, active('neq', { value: instant }))).toBe(false)
    expect(matches(instant, active('lt', { value: '2026-01-02T00:00:00Z' }))).toBe(true)
    expect(matches(instant, active('lte', { value: instant }))).toBe(true)
    expect(matches(instant, active('gt', { value: '2026-01-01T00:00:00Z' }))).toBe(true)
    expect(matches(instant, active('gte', { value: '2026-01-02T00:00:00Z' }))).toBe(false)
  })

  it('rejects empty or invalid dates instead of pretending they match', () => {
    const condition = active('eq', { value: '2026-01-01T10:00:00Z' })
    expect(matches('', condition)).toBe(false)
    expect(matches(null, condition)).toBe(false)
    expect(matches('not-a-date', condition)).toBe(false)
  })
})

describe('server condition payload', () => {
  it('converts dates to ISO strings and leaves text untouched', () => {
    const converted = toServerConditions({
      CREATE_DT: { ...emptyFilter(dateColumn), enabled: true, from: '2026-01-01T08:00:00Z', to: '' },
      TITLE: { ...emptyFilter(textColumn), enabled: true, value: 'dye' },
    })
    expect(converted.CREATE_DT.from).toBe('2026-01-01T08:00:00.000Z')
    expect(converted.CREATE_DT.to).toBe('')
    expect(converted.TITLE.value).toBe('dye')
  })
})
