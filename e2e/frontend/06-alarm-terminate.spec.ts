import { expect, test } from '@playwright/test'
import { MENU, apiToken, login, openMenu, unique } from './support/ams.js'

const CONDITIONS = { conditions: {} }

/** Total alarm count from the instant summary (AVPA013 counts Process alarms only). */
/**
 * Creates an alarm through the console API. Each case uses its own factory/subsystem/equipment
 * combination (passed in) because separate spec files share one backend and the trigger API
 * suppresses a repeated alarm for the same settings within its ignore window.
 */
async function triggerAlarm(request, token, marker, setting) {
  const response = await request.post('/api/alarms/test', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...setting, title: `E2E 中断 ${marker}`, content: 'terminate e2e' },
  })
  expect(response.ok(), `trigger failed: HTTP ${response.status()} ${await response.text()}`).toBeTruthy()
  return (await response.json()).alarm
}
const MAIN_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP08', alarmCode: 'CMP_PAD_LIFE' }
const NO_PERMISSION_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP04', alarmCode: 'EQP_OVERHEAT' }

async function summaryTotal(request, token) {
  const response = await request.post('/api/reports/AVPA013/query', {
    headers: { Authorization: `Bearer ${token}` }, data: CONDITIONS,
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).rows.reduce((sum, row) => sum + Number(row.ALARM_COUNT || 0), 0)
}

/**
 * TC-FE-E2E-006: an authorized user terminates a processing alarm from the detail dialog after
 * giving a reason; the alarm leaves the processing list and the instant summary. An account
 * without the new permission sees a disabled entry with an explanation.
 */
test.describe('TC-FE-E2E-006 警报强制中断', () => {
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
    await detail.getByRole('button', { name: '强制中断' }).click()

    const confirm = page.locator('.terminate-modal')
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('确认强制中断警报？')
    await expect(confirm).toContainText('中断后警报将结束且无法恢复')
    await expect(confirm.getByRole('button', { name: '确认中断' })).toBeDisabled()
    await confirm.getByLabel('中断原因').fill('机台已修复，确认误报')
    await confirm.getByRole('button', { name: '确认中断' }).click()

    await expect(confirm).toHaveCount(0)
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Terminated')
    const banner = detail.locator('[data-test="terminated-banner"]')
    await expect(banner).toContainText('警报已中断')
    await expect(banner).toContainText('机台已修复，确认误报')
    await expect(banner).toContainText('陈柏睿')
    // A terminated alarm no longer renders the terminate action at all.
    await expect(detail.getByRole('button', { name: '强制中断' })).toHaveCount(0)

    await detail.getByRole('button', { name: '交易履历' }).click()
    await expect(detail.locator('tbody')).toContainText('AlarmTerminate')
    await expect(detail.locator('tbody')).toContainText('机台已修复，确认误报')

    // Detail view of the termination transaction is read-only: no terminate entry.
    await detail.getByRole('button', { name: /close|关闭/i }).click()
    await expect(list).not.toContainText(marker)

    const history = await request.post('/api/reports/AVPA007/query', {
      headers: { Authorization: `Bearer ${await apiToken(request)}` },
      data: { conditions: { TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' } } },
    })
    expect(history.ok(), await history.text()).toBeTruthy()
    expect((await history.json()).rows.some(row => row.ALARM_KEY === alarm.ALARM_KEY && row.NOTE === '机台已修复，确认误报')).toBe(true)
    expect(await summaryTotal(request, await apiToken(request))).toBe(totalBefore)
  })

  test('disables termination for an account without the permission', async ({ page, request }) => {
    const marker = unique('E2E-NOPERM')
    const created = await triggerAlarm(request, await apiToken(request), marker, NO_PERMISSION_SETTING)
    await login(page, { userId: 'E0043260', name: '林彦廷', password: '123456' })
    await openMenu(page, MENU.alarmTerminate)
    const list = page.locator('.grid')
    await expect(list).toContainText(marker)
    await list.locator('tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('button', { name: '强制中断' })).toBeDisabled()
    await expect(detail).toContainText('您没有强制中断权限，请联系具权限人员处理。')
    // The button state is not a security boundary: the server rejects a direct call too.
    const token = await apiToken(request, { userId: 'E0043260', password: '123456' })
    const denied = await request.post(`/api/alarms/${created.ALARM_KEY}/terminate`, {
      headers: { Authorization: `Bearer ${token}` }, data: { cmt: '越权尝试' },
    })
    expect(denied.status()).toBe(400)
    expect((await denied.json()).message).toBe('您没有强制中断权限')
  })
})
