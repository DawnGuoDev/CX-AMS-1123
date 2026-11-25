import { expect, test } from '@playwright/test'
import { apiToken, login, unique } from './support/ams.js'

/** TC-FE-E2E-005: the acknowledgment inbox stays empty (and consistent) when SMTP is not configured. */
test.describe('TC-FE-E2E-005 待我确认与告警列表联动', () => {
  test('shows the pending inbox, which stays empty while mail delivery fails', async ({ page, request }) => {
    const token = await apiToken(request)
    // Trigger through the API (outside the UI) so the list state is independent of the trigger page.
    // Each spec file runs in its own worker with an isolated context, but the backend is shared by
    // the run: use a dedicated four-key combination that no other spec triggers.
    const marker = unique('E2E-API')
    const summaryBefore = await request.post('/api/reports/AVPA013/query', {
      headers: { Authorization: `Bearer ${token}` },
      data: { conditions: {} },
    })
    expect(summaryBefore.ok()).toBeTruthy()
    const totalBefore = (await summaryBefore.json()).rows.reduce((sum, row) => sum + Number(row.ALARM_COUNT || 0), 0)

    const created = await request.post('/api/alarms/test', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        factoryKey: 'F01', subsysKey: 'SS03', eqpKey: 'EQP01', alarmCode: 'PRT_MOTOR_ERR',
        title: `E2E 列表告警 ${marker}`, content: 'list e2e',
      },
    })
    expect(created.status(), await created.text()).toBe(200)
    const payload = await created.json()
    expect(payload.ok, `trigger failed: HTTP ${created.status()} ${JSON.stringify(payload)}`).toBe(true)
    expect(created.ok()).toBeTruthy()
    expect(payload.alarm.STATUS).toBe('Process')
    expect(payload.alarm.TITLE).toBe(`E2E 列表告警 ${marker}`)

    await login(page)
    await expect(page.locator('.top-actions .inbox-link')).toHaveText('待我确认')
    await page.locator('.top-actions .inbox-link').click()
    await expect(page.locator('.page-heading h1')).toHaveText('待我确认')
    // SMTP is not configured, so the first-level mail never succeeds and nobody can ACK yet.
    await expect(page.locator('tbody')).toContainText('查无资料')

    // The alarm is still processing: the summary counts it even though nobody can ACK yet.
    // Signing in through the browser replaces the session for the same user, so ask for a fresh
    // token instead of reusing the one issued before the UI login.
    const summaryToken = await apiToken(request)
    const summary = await request.post('/api/reports/AVPA013/query', {
      headers: { Authorization: `Bearer ${summaryToken}` },
      data: { conditions: {} },
    })
    const summaryBody = await summary.json()
    expect(summary.status(), `summary failed: ${JSON.stringify(summaryBody)}`).toBe(200)
    expect(summary.ok()).toBeTruthy()
    const totalAfter = (await summary.json()).rows.reduce((sum, row) => sum + Number(row.ALARM_COUNT || 0), 0)
    expect(totalAfter).toBe(totalBefore + 1)
  })
})
