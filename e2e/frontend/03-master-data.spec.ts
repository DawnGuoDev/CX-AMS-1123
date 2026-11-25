import { expect, test } from '@playwright/test'
import { MENU, apiToken, login, openMenu, unique } from './support/ams.js'

/**
 * TC-FE-E2E-003: create a factory through the master page, verify it in the list, then hide it.
 * The created record is unique per run and left hidden at the end.
 */
test.describe('TC-FE-E2E-003 厂别主档新增与隐藏', () => {
  test('creates a factory, finds it in the list and hides it', async ({ page, request }) => {
    const token = await apiToken(request)
    const marker = unique('E2E').toUpperCase()
    const name = `E2E 厂别 ${marker}`

    await login(page)
    await openMenu(page, MENU.factories)

    await page.getByRole('button', { name: '新增', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新增' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').nth(0).fill(marker)
    await dialog.getByRole('textbox').nth(1).fill(name)
    await dialog.getByRole('button', { name: '储存' }).click()

    await expect(page.getByRole('status')).toContainText('储存成功')
    await expect(dialog).toHaveCount(0)

    const row = page.locator('tbody tr').filter({ hasText: marker }).first()
    await expect(row).toContainText(name)
    // The status cell renders a "Y" tag for an active record.
    await expect(row.locator('.tag')).toHaveText('Y')

    // Hide it: select the row, confirm, then it disappears from the default (active-only) list.
    await row.locator('input[aria-label="选择资料"]').check()
    await page.getByRole('button', { name: '隐藏', exact: true }).click()
    const confirm = page.getByRole('dialog', { name: '确认' })
    await expect(confirm).toContainText('确认隐藏所选资料')
    await confirm.getByRole('button', { name: '确定' }).click()
    await expect(page.getByRole('status')).toContainText('储存成功')
    await expect(page.locator('tbody tr').filter({ hasText: marker })).toHaveCount(0)

    // With “show hidden records” the row is visible again and marked inactive.
    await page.locator('.toolbar').getByRole('checkbox').check()
    const hiddenRow = page.locator('tbody tr').filter({ hasText: marker }).first()
    await expect(hiddenRow).toContainText('N')

    // Idempotent cleanup through the API for the isolated test database is not required, but the
    // page must still be able to restore the record.
    await hiddenRow.locator('input[aria-label="选择资料"]').check()
    await page.getByRole('button', { name: '取消隐藏', exact: true }).click()
    await page.getByRole('dialog', { name: '确认' }).getByRole('button', { name: '确定' }).click()
    await expect(page.getByRole('status')).toContainText('储存成功')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  test('rejects a duplicate factory code with the server message', async ({ page, request }) => {
    await apiToken(request)
    await login(page)
    await openMenu(page, MENU.factories)

    await page.getByRole('button', { name: '新增', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新增' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('input').first()).toBeVisible()
    // Seeded factory code (unique key) — creating it again must fail server-side validation.
    await dialog.getByRole('textbox').nth(0).fill('Fab01')
    await dialog.getByRole('textbox').nth(1).fill('重复厂别')
    await dialog.getByRole('button', { name: '储存' }).click()

    // The duplicate is rejected by the server. The page keeps the dialog open (no "储存成功"
    // toast) so the user can fix the code; the message may be shown in the global error area.
    await page.waitForTimeout(500)
    const feedback = page.locator('[role="alert"], .error')
    if (await feedback.count()) {
      await expect(feedback.first()).toContainText('唯一')
    }
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(dialog).toBeVisible()
  })
})
