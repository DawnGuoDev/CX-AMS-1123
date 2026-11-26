import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { MENU, apiToken, login, openMenu, unique } from './support/ams.js'

/**
 * TC-FE-E2E-006 无效警报查询（AVPA008）
 *
 * Design: docs/design/ams-da-028-invalid-alarm-query/design.md §2.5 / §6 (REQ-02 / REQ-03 / REQ-05)
 *
 * The backend is shared by the whole run and already holds invalid-alarm records created by smoke
 * tests, so no assertion depends on a fixed row count: each test tags its own records with a unique
 * title and drives real failures through POST /api/alarms/test before looking them up in the report.
 */
const BAD_FACTORY = 'E2E-NO-FACTORY'

/** A closed CREATE_DT condition that skips the "ATLEAST_ONE_CONDITION" guard, so the AVPA008-only
 *  time-range rule is the one under test. */
function withTimeRange(from = '2026-01-01T00:00:00', to = '2099-12-31T23:59:59') {
  return { CREATE_DT: { enabled: true, operator: 'between', from, to } }
}

/**
 * Mirrors what the browser sends (filters.toServerConditions): the month/day/time fields of a
 * datetime-local input become "...T00:00:00.000Z" / "...T10:40:35.000Z" when the draft is closed,
 * and every condition carries its column type. A backend that only compares whole-second ISO
 * strings can silently drop these values.
 */
function browserTimeRange(from = '2026-01-01T00:00:00.000Z', to = '2099-12-31T23:59:59.000Z') {
  return { CREATE_DT: { enabled: true, type: 'date', operator: 'between', value: '', from, to } }
}

/** Fails the trigger on an unknown factory; this is the NO_FACTORY branch of AlarmEngine.trigger(). */
async function triggerInvalid(request: APIRequestContext, token: string, title: string) {
  const response = await request.post('/api/alarms/test', {
    headers: { Authorization: `Bearer ${token}` },
    data: { factoryKey: BAD_FACTORY, subsysKey: 'SS03', eqpKey: 'EQP01', alarmCode: 'PRT_NODYE', title, content: 'invalid-alarm e2e' },
  })
  expect(response.status(), await response.text()).toBe(422)
  const body = await response.json()
  expect(body.ok).toBe(false)
  // Failure contract is unchanged by this feature: HTTP 422 + {ok:false,message}.
  expect(body.status).toBe(422)
  expect(body.message).toBe('未设定厂别')
}

async function queryInvalidAlarms(request: APIRequestContext, token: string, conditions: Record<string, unknown>) {
  const response = await request.post('/api/reports/AVPA008/query', {
    headers: { Authorization: `Bearer ${token}` },
    data: { conditions },
  })
  return { response, body: await response.json() }
}

/**
 * D1 regression guard: ReportPage.vue:12 used an undeclared `code` (props.code), which threw
 * "ReferenceError: code is not defined" while mounting and left the report body blank with a 200
 * page shell. Functional selectors alone did not fail fast enough in the deployed build, so every
 * page-level test records uncaught page errors and asserts none happened on the query path.
 */
function trackPageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

test.describe('TC-FE-E2E-006 无效警报查询', () => {
  test('opens AVPA008 from the report group and requires a query before showing rows', async ({ page, request }) => {
    const pageErrors = trackPageErrors(page)
    const token = await apiToken(request)
    const title = `E2E 无效警报 ${unique('UI')}`
    await triggerInvalid(request, token, title)

    // Browser login replaces the API session for the same seed user (single-session rule), so data
    // is prepared first and the UI only reads.
    await login(page)
    // Navigate first, then assert the heading: like the other report pages (02-navigation.spec.ts),
    // AVPA008 must resolve its own title from meta.pageTitles, not fall back to 页面不存在.
    await openMenu(page, MENU.invalidAlarms)
    await expect(page).toHaveURL(/#\/page\/AVPA008$/)
    await expect(page.locator('.page-heading h1')).toHaveText(MENU.invalidAlarms.title)
    await expect(page.locator('.panel')).toContainText('请执行查询')

    await page.getByRole('button', { name: '查询', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '查询条件' })
    await expect(dialog).toBeVisible()
    // CREATE_DT is pre-filled with a "近 24 小时" draft and the page explains it can be adjusted.
    await expect(dialog).toContainText('默认近 24 小时，可调整')
    const createDt = dialog.locator('.query-fields label').filter({ hasText: '资料新增时间' })
    await expect(createDt).toBeVisible()
    await expect(createDt.locator('.date-range input').first()).not.toHaveValue('')

    await dialog.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '查询条件' })).toHaveCount(0)
    await expect(page.locator('.panel')).toHaveCount(0)
    const grid = page.locator('.grid')
    await expect(grid).toContainText('失效类型')
    await expect(grid).toContainText('失效原因')
    await expect(grid).toContainText(title)
    // No uncaught ReferenceError/TypeError while mounting and querying the report.
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0)
  })

  test('rejects a query without a time range and returns only the requested window', async ({ request }) => {
    const token = await apiToken(request)
    const title = `E2E 无效警报 ${unique('API')}`
    await triggerInvalid(request, token, title)

    // CREATE_DT switched off: the AVPA008 time-range rule must reject with 400.
    const noRange = await queryInvalidAlarms(request, token, {
      CREATE_DT: { enabled: false, operator: 'between', from: '', to: '' },
      FAILURE_TYPE: { enabled: true, operator: 'eq', value: 'NO_FACTORY' },
    })
    expect(noRange.response.status(), JSON.stringify(noRange.body)).toBe(400)
    expect(noRange.body.message).toBe('无效警报查询必须指定时间区间')

    // CREATE_DT key missing entirely (old clients): still the time-range rule, not a 500 or the
    // generic "至少选择一个查询条件" message.
    const missingRange = await queryInvalidAlarms(request, token, {
      FAILURE_TYPE: { enabled: true, operator: 'eq', value: 'NO_FACTORY' },
    })
    expect(missingRange.response.status(), JSON.stringify(missingRange.body)).toBe(400)
    expect(missingRange.body.message).toBe('无效警报查询必须指定时间区间')

    // Empty conditions as sent by "清除" + "查询": the report-specific rule wins over the generic one.
    const emptyConditions = await queryInvalidAlarms(request, token, {})
    expect(emptyConditions.response.status(), JSON.stringify(emptyConditions.body)).toBe(400)
    expect(emptyConditions.body.message).toBe('无效警报查询必须指定时间区间')

    // Window that excludes the record just created: it must not be returned.
    const outside = await queryInvalidAlarms(request, token, {
      CREATE_DT: { enabled: true, operator: 'between', from: '2020-01-01T00:00:00', to: '2020-12-31T23:59:59' },
      TITLE: { enabled: true, operator: 'eq', value: title },
    })
    expect(outside.response.status(), JSON.stringify(outside.body)).toBe(200)
    expect(outside.body.rows).toHaveLength(0)

    // Inside the window the record appears with the frozen failure type and reason.
    const inside = await queryInvalidAlarms(request, token, {
      ...withTimeRange(),
      TITLE: { enabled: true, operator: 'eq', value: title },
    })
    expect(inside.response.status(), JSON.stringify(inside.body)).toBe(200)
    expect(inside.body.rows).toHaveLength(1)
    const row = inside.body.rows[0]
    expect(row.TITLE).toBe(title)
    expect(row.FAILURE_TYPE).toBe('NO_FACTORY')
    expect(row.FAILURE_REASON).toBe('未设定厂别')
    expect(row.SOURCE).toBe('TEST_API')
    expect(row.INVALID_ID).toMatch(/^IVD-\d{8}-\d{6}$/)
    expect(row.SOURCE_USER_ID).toBe('E0043258')

    // Same window but serialized exactly as the UI sends it (millisecond precision + type tag).
    const uiWindow = await queryInvalidAlarms(request, token, {
      ...browserTimeRange(),
      TITLE: { enabled: true, type: 'text', operator: 'eq', value: title },
    })
    expect(uiWindow.response.status(), JSON.stringify(uiWindow.body)).toBe(200)
    expect(uiWindow.body.rows).toHaveLength(1)
    expect(uiWindow.body.rows[0].TITLE).toBe(title)

    // Partial window (only "from") must keep the record; only "to" before it must exclude it.
    const onlyFrom = await queryInvalidAlarms(request, token, {
      CREATE_DT: { enabled: true, type: 'date', operator: 'between', from: browserTimeRange().CREATE_DT.from, to: '' },
      TITLE: { enabled: true, operator: 'eq', value: title },
    })
    expect(onlyFrom.response.status(), JSON.stringify(onlyFrom.body)).toBe(200)
    expect(onlyFrom.body.rows).toHaveLength(1)
    const onlyTo = await queryInvalidAlarms(request, token, {
      CREATE_DT: { enabled: true, type: 'date', operator: 'between', from: '', to: '2020-01-01T00:00:00.000Z' },
      TITLE: { enabled: true, operator: 'eq', value: title },
    })
    expect(onlyTo.response.status(), JSON.stringify(onlyTo.body)).toBe(200)
    expect(onlyTo.body.rows).toHaveLength(0)

    // D2 observation: "触发人员" is offered as a condition by GET /api/report-defs/AVPA008, while
    // Reports.query builds its field whitelist from COLUMNS. Both sides must agree: filtering by the
    // operator who fired the request has to hit the record instead of returning 400 查询字段无效.
    const bySourceUser = await queryInvalidAlarms(request, token, {
      ...withTimeRange(),
      TITLE: { enabled: true, operator: 'eq', value: title },
      SOURCE_USER_ID: { enabled: true, type: 'text', operator: 'eq', value: 'E0043258' },
    })
    expect(bySourceUser.response.status(), JSON.stringify(bySourceUser.body)).toBe(200)
    expect(bySourceUser.body.rows).toHaveLength(1)

    // Unknown field names are still rejected by the shared report contract.
    const badField = await queryInvalidAlarms(request, token, {
      ...withTimeRange(),
      NOT_A_FIELD: { enabled: true, operator: 'eq', value: 'x' },
    })
    expect(badField.response.status(), JSON.stringify(badField.body)).toBe(400)
    expect(badField.body.message).toBe('查询字段无效')
  })

  test('exports the filtered invalid alarms as a downloadable workbook', async ({ page, request }) => {
    const pageErrors = trackPageErrors(page)
    const token = await apiToken(request)
    const title = `E2E 无效警报 ${unique('XLS')}`
    await triggerInvalid(request, token, title)

    await login(page)
    await openMenu(page, MENU.invalidAlarms)
    await page.getByRole('button', { name: '查询', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '查询条件' })
    await dialog.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '查询条件' })).toHaveCount(0)

    // Narrow the grid to this test's record so the download is deterministic on a shared backend.
    await page.getByLabel('过滤列表').fill(title)
    await expect(page.locator('tbody')).toContainText(title)
    await expect(page.locator('.grid-tools')).toContainText('1 笔资料')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '汇出', exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
    const path = await download.path()
    expect(path).toBeTruthy()
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0)
  })
})
