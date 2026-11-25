import { expect, test } from '@playwright/test'
import { MENU, apiToken, login, openMenu, unique, selectOption } from './support/ams.js'

/**
 * TC-FE-E2E-004: trigger a test alarm from the console, inspect the detail dialog and open the
 * mail acknowledgment entry point. SMTP is not configured in E2E, so the ACK button stays hidden
 * and the page must explain that a delivered mail is required.
 */
test.describe('TC-FE-E2E-004 测试告警触发、详情与确认入口', () => {
  test('triggers a test alarm and shows it in the detail dialog', async ({ page, request }) => {
    await apiToken(request)
    const marker = unique('E2E-ALARM')

    await login(page)
    await openMenu(page, MENU.alarmTest)
    const warning = page.locator('.warning')
    await expect(warning).toContainText('SMTP 尚未配置')

    const selects = page.locator('.send-form .fields .ant-select')
    await expect(selects).toHaveCount(4)
    await selectOption(page, selects.nth(0), /^Fab01/)
    await expect(selects.nth(1)).toBeEnabled()
    await selectOption(page, selects.nth(1), /^MES/)
    await selectOption(page, selects.nth(2), /^PRT01/)
    await selectOption(page, selects.nth(3), /^PRT_NODYE/)

    await page.getByLabel('警报标题').fill(`E2E 测试告警 ${marker}`)
    await page.getByLabel('详细内容').fill('由前端 E2E 触发的测试告警内容')
    await page.getByRole('button', { name: '触发测试告警' }).click()

    const detail = page.getByRole('dialog', { name: '警报详情' })
    await expect(detail).toBeVisible()
    await expect(detail.locator('.dialog-body > h2')).toContainText(marker)
    // The detail shows display IDs (seed: F01=Fab01, SS03=MES, EQP01=PRT01), not the keys.
    await expect(detail.locator('.detail-meta')).toContainText('Fab01 / MES / PRT01')
    await expect(detail.locator('.detail-meta .tag')).toHaveText('Process')
    // Notification records are attributed to the recipients; with no SMTP the first level is
    // still pending delivery, which is exactly why the current account cannot ACK yet.
    await expect(detail).toContainText('LEVEL-1 · 0 / 2 已回应人数')

    await detail.getByRole('button', { name: '详细内容' }).click()
    await expect(detail.locator('.alarm-content')).toContainText('由前端 E2E 触发的测试告警内容')
    await expect(detail.getByRole('button', { name: '警报确认' })).toHaveCount(0)
    await expect(detail).toContainText('当前账号暂无待确认操作')

    await detail.getByRole('button', { name: /close|关闭/i }).click()
    await expect(detail).toHaveCount(0)
  })

  test('opens the mail acknowledgment page without auto-confirming', async ({ page, request }) => {
    await apiToken(request)
    await login(page)
    await page.goto('/#/ack/not-an-existing-alarm')
    await expect(page.locator('.page-heading h1')).toHaveText('邮件警报确认')
    await expect(page.locator('main')).toContainText('打开邮件链接不会自动 ACK')
    await expect(page.getByRole('button', { name: '打开确认页' })).toBeVisible()

    // The ACK page itself never confirms: it only offers to open the detail dialog.
    await expect(page.getByRole('dialog', { name: '警报详情' })).toHaveCount(0)
    await page.getByRole('button', { name: '打开确认页' }).click()
    await expect(page.getByRole('alert')).toContainText('警报不存在')
  })
})
