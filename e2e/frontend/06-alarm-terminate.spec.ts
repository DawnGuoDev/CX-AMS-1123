import { expect, test } from '@playwright/test'
import { ALARM_TEXT, MENU, alarmDetail, apiToken, login, openMenu, reportRows, summaryTotal, triggerAlarm, unique } from './support/ams.js'

/**
 * TC-FE-E2E-006 警报强制中断 (SPEC-AMS-ALARM-TERMINATE-001, REQ-002~006).
 *
 * The backend is shared by the whole run and the trigger API suppresses a repeated alarm for the
 * same factory/subsystem/equipment/setting inside its ignore window, so every case reserves its own
 * combination (F01 + SS01 + a distinct equipment + a matching alarm setting from seed.json).
 */
const MAIN_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP08', alarmCode: 'CMP_PAD_LIFE' }
const CANCEL_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP06', alarmCode: 'CMP_PAD_LIFE' }
const HISTORY_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP07', alarmCode: 'CMP_PAD_LIFE' }
const NO_PERMISSION_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP04', alarmCode: 'EQP_OVERHEAT' }

/** An account whose master record has CAN_TERMINATE=N (seed.json U002). */
const NO_PERMISSION_USER = { userId: 'E0043260', name: '林彦廷', password: '123456' }

test.describe('TC-FE-E2E-006 警报强制中断', () => {
  // A session token issued before a different user's UI login is invalidated by the server, so each
  // case prepares its data first and asks for a fresh token only after the browser session is set.

  test('terminates a processing alarm with a reason and stops counting it as processing', async ({ page, request }) => {
    const marker = unique('E2E-TERMINATE')
    const token = await apiToken(request)
    const totalBefore = await summaryTotal(request, token)
    const alarm = await triggerAlarm(request, token, marker, MAIN_SETTING)

    await login(page)
    await openMenu(page, MENU.alarmTerminate)
    const list = page.locator('.grid')
    await expect(list).toContainText(marker)
    await list.locator('tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()

    const detail = page.getByRole('dialog', { name: '警报详情' })
    await expect(detail).toBeVisible()
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Process')
    const terminate = detail.getByRole('button', { name: '强制中断' })
    await expect(terminate).toBeEnabled()
    await terminate.click()

    const confirm = page.locator('.terminate-modal')
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('确认强制中断警报？')
    await expect(confirm).toContainText('中断后警报将结束且无法恢复')
    // The confirmation echoes the target alarm so an irreversible action is never ambiguous.
    await expect(confirm).toContainText(marker)
    // A blank reason keeps the confirm button disabled; the textarea is capped at 500 characters.
    await expect(confirm.getByRole('button', { name: '确认中断' })).toBeDisabled()
    await expect(confirm.getByLabel('中断原因')).toHaveAttribute('maxlength', '500')
    await confirm.getByLabel('中断原因').fill('机台已修复，确认误报')
    await expect(confirm.getByRole('button', { name: '确认中断' })).toBeEnabled()
    await confirm.getByRole('button', { name: '确认中断' }).click()

    await expect(confirm).toHaveCount(0)
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Terminated')
    await expect(detail.getByRole('status')).toContainText('警报已中断')
    const banner = detail.locator('[data-test="terminated-banner"]')
    await expect(banner).toContainText('警报已中断')
    await expect(banner).toContainText('机台已修复，确认误报')
    await expect(banner).toContainText('陈柏睿')
    // Terminated is a terminal state: the terminate action is gone and its hint explains why.
    await expect(detail.getByRole('button', { name: '强制中断' })).toHaveCount(0)
    await expect(detail).toContainText('警报已中断，流程已结束')

    await detail.getByRole('button', { name: '交易履历' }).click()
    await expect(detail.locator('tbody')).toContainText('AlarmTerminate')
    await expect(detail.locator('tbody')).toContainText('机台已修复，确认误报')

    await detail.getByRole('button', { name: /close|关闭/i }).click()
    await expect(detail).toHaveCount(0)
    // The work list only lists Process alarms, so the terminated alarm disappears from it.
    await expect(list).not.toContainText(marker)

    // Audit trail: AVPA007 finds the termination transaction with the reason as its note, and the
    // alarm is readable by its Terminated status. AVPA013 no longer counts it as processing.
    const auditToken = await apiToken(request)
    const history = await reportRows(request, auditToken, 'AVPA007', {
      TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' },
    })
    const record = history.find(row => row.ALARM_KEY === alarm.ALARM_KEY)
    expect(record, `AVPA007 has no AlarmTerminate row for ${alarm.ALARM_KEY}`).toBeTruthy()
    expect(record.NOTE).toBe('机台已修复，确认误报')
    expect(record.STATUS).toBe('Terminated')
    expect((await reportRows(request, auditToken, 'AVPA007', {
      STATUS: { enabled: true, operator: 'eq', value: 'Terminated' },
    })).map(row => row.ALARM_KEY)).toContain(alarm.ALARM_KEY)

    const handled = (await reportRows(request, auditToken, 'AVPA004', {
      STATUS: { enabled: true, operator: 'eq', value: 'Terminated' },
    })).find(row => row.ALARM_KEY === alarm.ALARM_KEY)
    expect(handled, `AVPA004 has no Terminated row for ${alarm.ALARM_KEY}`).toBeTruthy()
    expect(handled.COMPLETE_DT).toBeTruthy()

    expect(await summaryTotal(request, auditToken)).toBe(totalBefore)
    const finalDetail = await alarmDetail(request, auditToken, alarm.ALARM_KEY)
    expect(finalDetail.STATUS).toBe('Terminated')
    expect(finalDetail.CAN_TERMINATE).toBe(false)
    expect(finalDetail.TERMINATE_CMT).toBe('机台已修复，确认误报')
    expect(finalDetail.TERMINATE_USER_NAME).toBe('陈柏睿')
    expect(finalDetail.TERMINATE_DT).toBeTruthy()
  })

  test('keeps the confirmation open on cancel and sends nothing', async ({ page, request }) => {
    const marker = unique('E2E-CANCEL')
    const token = await apiToken(request)
    const alarm = await triggerAlarm(request, token, marker, CANCEL_SETTING)

    await login(page)
    await openMenu(page, MENU.alarmTerminate)
    await page.locator('.grid tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await detail.getByRole('button', { name: '强制中断' }).click()

    const confirm = page.locator('.terminate-modal')
    await expect(confirm).toBeVisible()
    await confirm.getByLabel('中断原因').fill('误触后取消')
    // Closing the dialog through its close icon (not just 取消) must also keep the alarm untouched.
    await confirm.getByRole('button', { name: /close|关闭/i }).first().click()
    await expect(confirm).toHaveCount(0)
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Process')

    // Reopening starts from a clean form: the previous reason was discarded.
    await detail.getByRole('button', { name: '强制中断' }).click()
    await expect(confirm).toBeVisible()
    await expect(confirm.getByLabel('中断原因')).toHaveValue('')
    await confirm.getByRole('button', { name: '取消' }).click()
    await expect(confirm).toHaveCount(0)

    const current = await alarmDetail(request, await apiToken(request), alarm.ALARM_KEY)
    expect(current.STATUS).toBe('Process')
    expect(current.CAN_TERMINATE).toBe(true)
    expect(current.TERMINATE_CMT || '').toBe('')
    expect((await reportRows(request, await apiToken(request), 'AVPA007', {
      TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' },
      ALARM_KEY: { enabled: true, operator: 'eq', value: alarm.ALARM_KEY },
    }))).toHaveLength(0)
  })

  test('history detail is read-only and the UI never offers termination for a non-Process alarm', async ({ page, request }) => {
    const marker = unique('E2E-HISTORY')
    const token = await apiToken(request)
    const alarm = await triggerAlarm(request, token, marker, HISTORY_SETTING)

    // Create a real termination transaction through the API so a historical snapshot exists. The
    // same call also covers the first half of REQ-002: terminate is allowed while still Process.
    expect((await alarmDetail(request, token, alarm.ALARM_KEY)).CAN_TERMINATE).toBe(true)
    const terminated = await request.post(`/api/alarms/${alarm.ALARM_KEY}/terminate`, {
      headers: { Authorization: `Bearer ${token}` }, data: { cmt: '历史只读校验' },
    })
    expect(terminated.status(), await terminated.text()).toBe(200)
    expect((await terminated.json()).alarm.STATUS).toBe('Terminated')
    // REQ-002: a Terminated alarm is never actionable again, even for an authorized user.
    const current = await alarmDetail(request, token, alarm.ALARM_KEY)
    expect(current.STATUS).toBe('Terminated')
    expect(current.CAN_TERMINATE).toBe(false)

    const trx = (await reportRows(request, token, 'AVPA007', {
      TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' },
      ALARM_KEY: { enabled: true, operator: 'eq', value: alarm.ALARM_KEY },
    }))[0]?.TRX_KEY
    expect(trx, 'the termination transaction must exist before opening its history view').toBeTruthy()
    const historicalApi = await alarmDetail(request, token, alarm.ALARM_KEY, trx)
    expect(historicalApi.HISTORY_CONTEXT, 'history context must be present').toBeTruthy()
    expect(historicalApi.CAN_TERMINATE).toBe(false)

    // The read-only historical detail renders no terminate entry at all.
    await login(page)
    await page.goto(`/#/alarm/${alarm.ALARM_KEY}?transaction=${encodeURIComponent(trx)}`)
    const historical = page.getByRole('dialog', { name: '警报详情' })
    await expect(historical).toBeVisible()
    await expect(historical.locator('.detail-meta .tag')).toHaveText('Terminated')
    await expect(historical.getByRole('button', { name: '强制中断' })).toHaveCount(0)
    await expect(historical).not.toContainText('确认强制中断警报？')
  })

  // Serial: this account is the only seeded CAN_TERMINATE=N user used by the tests, so it must not
  // run twice concurrently against the same backend if the worker count is raised.
  test.describe('TC-FE-E2E-006 无中断权限', () => {
  test.describe.configure({ mode: 'serial' })
  test('disables termination for an account without the permission', async ({ page, request }) => {
    const marker = unique('E2E-NOPERM')
    const created = await triggerAlarm(request, await apiToken(request), marker, NO_PERMISSION_SETTING)
    await login(page, NO_PERMISSION_USER)
    await openMenu(page, MENU.alarmTerminate)
    const list = page.locator('.grid')
    await expect(list).toContainText(marker)
    await list.locator('tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await expect(detail.getByRole('button', { name: '强制中断' })).toBeDisabled()
    await expect(detail).toContainText('您没有强制中断权限，请联系具权限人员处理。')

    // The button state is not a security boundary: the server rejects a direct call too, and the
    // rejection leaves the alarm untouched.
    const token = await apiToken(request, NO_PERMISSION_USER)
    expect((await alarmDetail(request, token, created.ALARM_KEY)).CAN_TERMINATE).toBe(false)
    const denied = await request.post(`/api/alarms/${created.ALARM_KEY}/terminate`, {
      headers: { Authorization: `Bearer ${token}` }, data: { cmt: '越权尝试' },
    })
    expect(denied.status()).toBe(400)
    expect((await denied.json()).message).toBe('您没有强制中断权限')
    const after = await alarmDetail(request, token, created.ALARM_KEY)
    expect(after.STATUS).toBe('Process')
    expect(after.TERMINATE_DT || '').toBe('')
  })
  })
})
