import { expect, test } from '@playwright/test'
import { MENU, alarmDetail, apiToken, login, openMenu, reportRows, selectOption, summaryTotal, triggerAlarm, unique } from './support/ams.js'

/**
 * TC-FE-E2E-006 警报强制中断 (SPEC-AMS-ALARM-TERMINATE-001, REQ-001~007).
 *
 * The backend is shared by the whole run and the trigger API suppresses a repeated alarm for the
 * same factory/subsystem/equipment inside its ignore window, so every case reserves its own
 * combination from seed.json (factory, subsystem, equipment and alarm code must match one setting).
 */
const MAIN_SETTING = { factoryKey: 'F01', subsysKey: 'SS01', eqpKey: 'EQP08', alarmCode: 'CMP_PAD_LIFE' }
const CANCEL_SETTING = { factoryKey: 'F01', subsysKey: 'SS02', eqpKey: 'EQP06', alarmCode: 'FDC_GASFLOW' }
const HISTORY_SETTING = { factoryKey: 'F02', subsysKey: 'SS03', eqpKey: '*', alarmCode: 'MES_SERVICE_DOWN' }
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
    // REQ-004 (prototype screenshot 04): the queued notifications are Pending before termination.
    await detail.getByRole('button', { name: '通知发送记录' }).click()
    await expect(detail.locator('tbody')).toContainText('Pending')
    await detail.getByRole('button', { name: '基本资讯' }).click()

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
    // A whitespace-only reason is still blank after trimming and must not become submittable.
    await confirm.getByLabel('中断原因').fill('  ')
    await expect(confirm.getByRole('button', { name: '确认中断' })).toBeDisabled()
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

    // REQ-004: the same notification tab now shows Skipped, mirroring the API assertion below.
    await detail.getByRole('button', { name: '通知发送记录' }).click()
    await expect(detail.locator('tbody')).not.toContainText('Pending')
    await expect(detail.locator('tbody')).toContainText('Skipped')

    await detail.getByRole('button', { name: '交易履历' }).click()
    await expect(detail.locator('tbody')).toContainText('AlarmTerminate')
    await expect(detail.locator('tbody')).toContainText('机台已修复，确认误报')

    // Ant Design renders the close icon as a button named by the dialog title, not by a "close" label.
    await detail.getByRole('button', { name: '警报详情' }).click()
    await expect(detail).toHaveCount(0)
    // The work list only lists Process alarms, so the terminated alarm disappears from it.
    await expect(list).not.toContainText(marker)

    // REQ-004: the acknowledgement inbox also only lists Process alarms.
    await openMenu(page, MENU.pending)
    await expect(page.locator('.grid')).not.toContainText(marker)

    // REQ-004: every notification of the alarm is Skipped in the single write transaction, so no
    // further mail can be sent or retried for it.
    const notifiedToken = await apiToken(request)
    const notified = await alarmDetail(request, notifiedToken, alarm.ALARM_KEY)
    expect(notified.NOTIFICATIONS.length).toBeGreaterThan(0)
    expect(notified.NOTIFICATIONS.every(item => item.RESULT === 'Skipped')).toBe(true)
    expect(notified.NOTIFICATIONS.every(item => item.MESSAGE === '警报已中断，取消发送')).toBe(true)
    const pending = await request.get('/api/alarms/pending', { headers: { Authorization: `Bearer ${notifiedToken}` } })
    expect(pending.ok(), await pending.text()).toBeTruthy()
    expect((await pending.json()).rows.map(item => item.ALARM_KEY)).not.toContain(alarm.ALARM_KEY)

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

  test('keeps the existing report status semantics for non-terminated alarms', async ({ request }) => {
    // REQ-006 regression: adding Terminated must not change what Process/Completed/NoNextLevel return.
    const marker = unique('E2E-REGRESSION')
    const token = await apiToken(request)
    // F01/SS03/EQP01 is outside every ignore window reserved by the cases above, so this third
    // alarm on that equipment is allowed (unlike the other PRT_NODYE helpers).
    const alarm = await triggerAlarm(request, token, marker, { factoryKey: 'F01', subsysKey: 'SS03', eqpKey: 'EQP01', alarmCode: 'PRT_NODYE' })
    const process = await reportRows(request, await apiToken(request), 'AVPA004', {
      STATUS: { enabled: true, operator: 'eq', value: 'Process' },
    })
    expect(process.map(row => row.ALARM_KEY)).toContain(alarm.ALARM_KEY)
    expect(process.every(row => row.STATUS === 'Process')).toBe(true)
    expect(await reportRows(request, await apiToken(request), 'AVPA004', {
      STATUS: { enabled: true, operator: 'eq', value: 'Completed' },
    })).toHaveLength(0)
    expect(await reportRows(request, await apiToken(request), 'AVPA004', {
      STATUS: { enabled: true, operator: 'eq', value: 'NoNextLevel' },
    })).toHaveLength(0)
    // A Process alarm has no termination transaction, so the new type filter stays empty for it.
    expect(await reportRows(request, await apiToken(request), 'AVPA007', {
      TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' },
    })).toHaveLength(0)
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
    await expect(detail.locator('.ant-modal-close')).toHaveCount(2)
    await detail.locator('.ant-modal-close').nth(1).click()
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
      ALARM_ID: { enabled: true, operator: 'eq', value: alarm.ALARM_ID },
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

    const trxRows = await reportRows(request, token, 'AVPA007', {
      TRX_TYPE: { enabled: true, operator: 'eq', value: 'AlarmTerminate' },
      ALARM_ID: { enabled: true, operator: 'eq', value: alarm.ALARM_ID },
    })
    const trx = trxRows[0]?.TRX_KEY
    expect(trx, 'the termination transaction must exist before opening its history view').toBeTruthy()
    // REQ-002: a historical snapshot is never actionable, even for an authorised user.
    const historicalApi = await alarmDetail(request, token, alarm.ALARM_KEY, trx)
    expect(historicalApi.HISTORY_CONTEXT, 'history context must be present').toBeTruthy()
    expect(historicalApi.CAN_TERMINATE).toBe(false)

    // The UI opens the transaction row from AVPA007 (TRX_KEY on the row) as a read-only history view.
    await login(page)
    await openMenu(page, MENU.alarmQuery)
    await page.getByRole('button', { name: '查询', exact: true }).click()
    const query = page.getByRole('dialog', { name: '查询条件' })
    const trxFilter = query.locator('.query-fields label').filter({ hasText: '警报交易处理类型' })
    await trxFilter.getByRole('checkbox').check()
    // Text conditions default to "contains"; AlarmTerminate is a whole-value match here.
    await selectOption(page, trxFilter.locator('.ant-select'), '等于')
    await trxFilter.locator('input[type="text"]').fill('AlarmTerminate')
    await query.getByRole('button', { name: '查询', exact: true }).click()
    await expect(query).toHaveCount(0)
    const historyRow = page.locator('.grid tbody tr').filter({ hasText: 'AlarmTerminate' })
      .filter({ hasText: alarm.ALARM_ID }).first()
    await expect(historyRow).toBeVisible()
    await historyRow.getByRole('button', { name: '查看', exact: true }).click()
    const historical = page.getByRole('dialog', { name: '警报详情' })
    await expect(historical).toBeVisible()
    await expect(historical.locator('.detail-meta .tag')).toHaveText('Terminated')
    // The read-only historical detail renders no terminate entry at all.
    await expect(historical.getByRole('button', { name: '强制中断' })).toHaveCount(0)
    await expect(historical).not.toContainText('确认强制中断警报？')
  })

  test('explains why an already terminated alarm cannot be terminated again', async ({ page, request }) => {
    // REQ-005: a non-Process alarm keeps the control visible but disabled with an explanation;
    // REQ-002: the same account reads CAN_TERMINATE=false. The alarm is terminated through the API
    // because SMTP is not configured (nobody can ACK) and scheduling is disabled in the E2E backend.
    const marker = unique('E2E-NONPROCESS')
    const token = await apiToken(request)
    const alarm = await triggerAlarm(request, token, marker, { factoryKey: 'F03', subsysKey: 'SS04', eqpKey: 'EQP11', alarmCode: 'SPC_OOC' })
    const terminated = await request.post(`/api/alarms/${alarm.ALARM_KEY}/terminate`, {
      headers: { Authorization: `Bearer ${token}` }, data: { cmt: '状态不允许用例准备' },
    })
    expect(terminated.status(), await terminated.text()).toBe(200)
    expect((await alarmDetail(request, token, alarm.ALARM_KEY)).CAN_TERMINATE).toBe(false)

    await login(page)
    await openMenu(page, MENU.alarmQuery)
    await page.getByRole('button', { name: '查询', exact: true }).click()
    const query = page.getByRole('dialog', { name: '查询条件' })
    const alarmFilter = query.locator('.query-fields label').filter({ hasText: '警报识别码' })
    await alarmFilter.getByRole('checkbox').check()
    await alarmFilter.locator('input[type="text"]').fill(String(alarm.ALARM_ID))
    await query.getByRole('button', { name: '查询', exact: true }).click()
    await expect(query).toHaveCount(0)

    await page.locator('.grid tbody tr').filter({ hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Terminated')
    await expect(detail).toContainText('警报已中断，流程已结束')
    // The action is not offered again once the alarm reached its terminal state.
    await expect(detail.getByRole('button', { name: '强制中断' })).toHaveCount(0)
  })

  test('keeps previous acknowledgements visible after the alarm is terminated', async ({ page, request }) => {
    // REQ-004: alarm_acks are never deleted by termination and stay readable in the detail tabs.
    const marker = unique('E2E-ACKS')
    const token = await apiToken(request)
    // EVT02 level 1 requires 1 acknowledgement out of U001/U009/U010, so one ACK leaves it Process.
    const alarm = await triggerAlarm(request, token, marker, { factoryKey: 'F03', subsysKey: 'SS04', eqpKey: 'EQP11', alarmCode: 'SPC_OOC' })
    // Without SMTP the level-1 delivery fails; the engine retries twice and then marks the level failed,
    // which opens the ACK action for its first recipient (this mirrors the documented E2E constraint).
    await expect.poll(async () => {
      const current = await alarmDetail(request, token, alarm.ALARM_KEY)
      const pending = current.NOTIFICATIONS.filter(item => item.LEVEL_ID === current.CURRENT_LEVEL && item.RESULT === 'Pending')
      const failed = current.NOTIFICATIONS.filter(item => item.LEVEL_ID === current.CURRENT_LEVEL && item.RESULT === 'Fail')
      return pending.length === 0 && failed.length === current.NOTIFICATIONS.filter(item => item.LEVEL_ID === current.CURRENT_LEVEL).length
    }, { message: 'SMTP failures must stop being retried before the level accepts an acknowledgement', timeout: 120_000 }).toBe(true)

    await login(page)
    await openMenu(page, MENU.alarmTerminate)
    await page.locator('.grid tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await detail.getByRole('button', { name: '回应备注' }).click()
    // The comment tab renders a textarea only when the account may acknowledge (CAN_ACK=true).
    await expect(detail.locator('textarea')).toBeVisible()
    await detail.locator('textarea').fill('先回应，再中断')
    await detail.getByRole('button', { name: '警报确认' }).click()
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Process')
    await expect(detail.getByRole('button', { name: '回应记录' })).toBeVisible()
    const acknowledged = await alarmDetail(request, await apiToken(request), alarm.ALARM_KEY)
    expect(acknowledged.ACKS.map(item => item.ACK_CMT)).toContain('先回应，再中断')

    // The same browser session terminates as the authorised operator (the ACK above came from U001).
    await detail.getByRole('button', { name: '基本资讯' }).click()
    await detail.getByRole('button', { name: '强制中断' }).click()
    const confirm = page.locator('.terminate-modal')
    await confirm.getByLabel('中断原因').fill('回应后仍决定中断')
    await confirm.getByRole('button', { name: '确认中断' }).click()
    await expect(confirm).toHaveCount(0)
    await detail.getByRole('button', { name: '回应记录' }).click()
    await expect(detail.locator('tbody')).toContainText('先回应，再中断')
    const after = await alarmDetail(request, await apiToken(request), alarm.ALARM_KEY)
    expect(after.STATUS).toBe('Terminated')
    expect(after.ACKS.map(item => item.ACK_CMT)).toContain('先回应，再中断')
  })

  test('exposes the work entry in the sidebar only while the function is active and visible', async ({ page }) => {
    // REQ-007: the menu is a PAGE function; its visibility follows the existing ACTIVE/VISIBLE rules.
    await login(page)
    // The first login captured the menu while the function was still ACTIVE=Y / VISIBLE=Y.
    await openMenu(page, MENU.alarmTerminate)
    // The entry belongs to the alarm operations group (design 2.5.7) and its list only has Process rows.
    const entry = page.locator('.sidebar a[href="#/page/ALARM_LIST"]')
    await expect(entry).toHaveText('警报强制中断作业')
    // Column filters skip the header row, so every rendered data row must be a Process alarm.
    const rows = page.locator('.grid tbody tr').filter({ has: page.getByRole('button', { name: '查看', exact: true }) })
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThan(0)
    for (const text of await rows.allTextContents()) expect(text).toContain('Process')

    // Simulate an operator retiring the function in the master data: the shared E2E backend exposes no
    // function-master API, so bootstrap is stubbed on reload with the same payload minus the menu item.
    // Hash navigation reuses the already-bootstrapped SPA and never re-fetches /api/bootstrap, so
    // the stub must be installed for the next document load and the page must really reload. The
    // session lives in sessionStorage, so the reload stays signed in.
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, init) => {
        const response = await original(input, init)
        if (String(input).endsWith('/api/bootstrap')) {
          const body = await response.clone().json()
          // nav exposes the function key as "key" and the page route as "path".
          body.nav = body.nav.filter(node => node.key !== 'ALARM_LIST')
          return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return response
      }
    })
    await page.goto('/#/page/ALARM_LIST')
    await page.reload()
    await expect(page.locator('.sidebar nav a[href="#/page/ALARM_LIST"]')).toHaveCount(0)
    // Only the retired entry disappears; the existing operations navigation keeps working.
    await expect(page.locator('.sidebar nav a[href="#/page/ACK_LIST"]')).toHaveCount(1)
    await expect(page.locator('.sidebar nav a[href="#/page/AVPA004"]')).toHaveCount(1)
  })

  test('grants the permission through the user master record and records the change in history', async ({ page, request }) => {
    // REQ-001: the checkbox lives on SBRM_USER and is stored as Y/N (default N for new users).
    const candidate = 'E0043271'
    await login(page)
    await openMenu(page, MENU.users)
    const row = page.locator('.grid tbody tr').filter({ hasText: candidate }).first()
    await expect(row).toBeVisible()
    // The approved seed value is N; the check tolerates a leftover Y from an aborted earlier run,
    // which the restore case below always clears.
    await expect(row).toContainText('N')
    await row.locator('input[aria-label="选择资料"]').check()
    await page.getByRole('button', { name: '修改', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '修改' })
    await expect(editor).toBeVisible()
    const permission = editor.locator('label').filter({ hasText: '警报强制中断权限' }).getByRole('checkbox')
    await permission.check()
    await editor.getByRole('button', { name: '储存' }).click()
    await expect(page.getByRole('status')).toContainText('储存成功')
    await expect(editor).toHaveCount(0)
    // The master list reflects the saved Y value without a reload.
    await expect(page.locator('.grid tbody tr').filter({ hasText: candidate })).toContainText('Y')

    // The saved value is exposed by the master list and the permission takes effect for that account.
    const list = await request.get('/api/master/SBRM_USER', { headers: { Authorization: `Bearer ${await apiToken(request)}` } })
    expect(list.ok(), await list.text()).toBeTruthy()
    expect((await list.json()).rows.find(item => item.USER_ID === candidate).CAN_TERMINATE).toBe('Y')

    // The master audit trail keeps the before/after values of the new field.
    await page.getByRole('button', { name: '履历', exact: true }).click()
    const historyRow = page.locator('.grid tbody tr').filter({ hasText: candidate }).first()
    await expect(historyRow).toBeVisible()
    await expect(historyRow).toContainText('CAN_TERMINATE')
    await expect(historyRow).toContainText('Y')
  })

  test('restores the permission to N so later runs still exercise the denied branch', async ({ request }) => {
    // The master page grants permission to E0043271 in the case above; the backend is shared by the
    // whole run, so the denied branch depends on this account staying CAN_TERMINATE=N.
    const token = await apiToken(request)
    const list = await request.get('/api/master/SBRM_USER', { headers: { Authorization: `Bearer ${token}` } })
    const row = (await list.json()).rows.find(item => item.USER_ID === 'E0043271')
    expect(row).toBeTruthy()
    const saved = await request.put(`/api/master/SBRM_USER/${row.USER_KEY}`, {
      headers: { Authorization: `Bearer ${token}` }, data: { ...row, CAN_TERMINATE: 'N' },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    expect((await saved.json()).row.CAN_TERMINATE).toBe('N')
  })

  test('keeps the dialog and the typed reason when the alarm stops being Process before submit', async ({ page, request }) => {
    // REQ-005: on failure the dialog stays open, the reason is kept and the server message is shown.
    // The reverse proxy cannot be reached from this test, so the failure is injected at the network
    // layer with the server's own 400 payload (the backend branch itself is covered by the
    // AlarmTerminateIntegrationTest).
    const marker = unique('E2E-FAIL')
    const token = await apiToken(request)
    const alarm = await triggerAlarm(request, token, marker, { factoryKey: 'F03', subsysKey: 'SS05', eqpKey: 'EQP10', alarmCode: 'EDC_TIMEOUT' })

    await login(page)
    await openMenu(page, MENU.alarmTerminate)
    await page.locator('.grid tbody tr', { hasText: marker }).getByRole('button', { name: '查看', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '警报详情' })
    await detail.getByRole('button', { name: '强制中断' }).click()
    const confirm = page.locator('.terminate-modal')
    await expect(confirm).toBeVisible()
    const reason = '提交前已被他人处理'
    await confirm.getByLabel('中断原因').fill(reason)
    await page.route('**/api/alarms/*/terminate', route => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, message: '该警报已非处理中状态' }),
    }))
    await confirm.getByRole('button', { name: '确认中断' }).click()

    await expect(confirm.getByRole('alert')).toHaveText('该警报已非处理中状态')
    await expect(confirm).toBeVisible()
    await expect(confirm.getByLabel('中断原因')).toHaveValue(reason)
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Process')
    // The header state is untouched: no termination was written.
    expect((await alarmDetail(request, await apiToken(request), alarm.ALARM_KEY)).STATUS).toBe('Process')
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
