import { expect, test } from '@playwright/test'
import { ADMIN, login } from './support/ams.js'

test.describe('TC-FE-E2E-001 登录页加载与账号密码登入', () => {
  test('shows the login screen and rejects an empty password', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.login-brand .brandmark')).toContainText('MS')
    await expect(page.locator('.login-card h2')).toHaveText('登入')
    await expect(page.getByLabel('使用者代码')).toHaveValue(ADMIN.userId)
    await expect(page.getByLabel('密码')).toHaveValue('')

    // Required password: the browser blocks submission, the app stays on the login screen.
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page.locator('.login-card')).toBeVisible()
    await expect(page.locator('.app-shell')).toHaveCount(0)
  })

  test('rejects a wrong password with the server message', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('使用者代码').fill(ADMIN.userId)
    await page.getByLabel('密码').fill('wrong-password')
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('账号或密码错误')
    await expect(page.locator('.login-card')).toBeVisible()
  })

  test('logs in with the seed account and lands on the alarm summary', async ({ page }) => {
    await login(page)
    await expect(page.locator('.page-heading h1')).toHaveText('即时警报汇总')
    await expect(page.locator('.sidebar')).toContainText('测试告警触发')
    await expect(page.locator('.inbox-link')).toHaveText('待我确认')
    await expect(page.getByRole('button', { name: '登出' })).toBeVisible()

    await page.getByRole('button', { name: '登出' }).click()
    await expect(page.locator('.login-card')).toBeVisible()
  })

  test('keeps the session after a page reload', async ({ page }) => {
    await login(page)
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('.page-heading h1')).toHaveText('即时警报汇总')
  })
})
