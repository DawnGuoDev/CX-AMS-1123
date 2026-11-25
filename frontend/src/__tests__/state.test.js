import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../legacy-i18n.js', () => ({
  t: (key) => `t:${key}`,
  setLang: vi.fn(),
  getLang: () => 'zh-CN',
}))

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

async function importState() {
  vi.resetModules()
  return import('../state')
}

describe('state.api', () => {
  beforeEach(() => {
    sessionStorage.clear()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('sends a GET without body and attaches the bearer token', async () => {
    sessionStorage.setItem('ams_java_token', 'abc123')
    fetch.mockResolvedValue(jsonResponse(200, { ok: true, rows: [] }))
    const { api } = await importState()

    const result = await api('/bootstrap')

    expect(result).toEqual({ ok: true, rows: [] })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/bootstrap')
    expect(options.method).toBe('GET')
    expect(options.body).toBeUndefined()
    expect(options.headers.Authorization).toBe('Bearer abc123')
  })

  it('sends JSON bodies with the requested method', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { ok: true }))
    const { api } = await importState()

    await api('/master/SBRM_FACTORY/F01', { FACTORY_NAME: '厂别一' }, 'PUT')

    const [, options] = fetch.mock.calls[0]
    expect(options.method).toBe('PUT')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ FACTORY_NAME: '厂别一' })
  })

  it('throws the server message and drops the session on 401', async () => {
    sessionStorage.setItem('ams_java_token', 'expired')
    fetch.mockResolvedValue(jsonResponse(401, { ok: false, message: '登入已逾时，请重新登入' }))
    const { api, state } = await importState()
    state.user = { USER_ID: 'E0043258' }

    await expect(api('/bootstrap')).rejects.toMatchObject({
      message: '登入已逾时，请重新登入',
      status: 401,
    })
    expect(sessionStorage.getItem('ams_java_token')).toBeNull()
    expect(state.user).toBeNull()
  })

  it('keeps the session when the login itself fails', async () => {
    sessionStorage.setItem('ams_java_token', 'kept')
    fetch.mockResolvedValue(jsonResponse(401, { ok: false, message: '账号或密码错误' }))
    const { api, state } = await importState()
    state.user = { USER_ID: 'E0043258' }

    await expect(api('/login', { userId: 'x', password: 'y' })).rejects.toThrow('账号或密码错误')
    expect(sessionStorage.getItem('ams_java_token')).toBe('kept')
    expect(state.user).not.toBeNull()
  })

  it('falls back to an HTTP status message when the body has none', async () => {
    fetch.mockResolvedValue(jsonResponse(500, { ok: false }))
    const { api } = await importState()
    await expect(api('/boom')).rejects.toThrow('HTTP 500')
  })
})

describe('state.act', () => {
  it('tracks busy state and surfaces the error message', async () => {
    const { act, state } = await importState()
    state.error = 'old error'

    const ok = await act(async () => 'value')
    expect(ok).toBe('value')
    expect(state.busy).toBe(0)
    expect(state.error).toBe('')

    const failed = await act(async () => {
      expect(state.busy).toBe(1)
      throw new Error('invalid input')
    })
    expect(failed).toBeNull()
    expect(state.busy).toBe(0)
    expect(state.error).toBe('invalid input')
  })
})

describe('state helpers', () => {
  it('clone detaches nested objects', async () => {
    const { clone } = await importState()
    const source = { row: { values: [1, 2] } }
    const copy = clone(source)
    copy.row.values.push(3)
    expect(source.row.values).toEqual([1, 2])
  })

  it('notify shows a toast and clears it after 5 seconds', async () => {
    vi.useFakeTimers()
    const { notify, state } = await importState()
    notify('储存成功')
    expect(state.toast).toBe('储存成功')
    vi.advanceTimersByTime(4999)
    expect(state.toast).toBe('储存成功')
    vi.advanceTimersByTime(1)
    expect(state.toast).toBe('')
    vi.useRealTimers()
  })
})
