import { expect } from '@playwright/test'

/** Seed administrator from backend/src/main/resources/seed.json; initial password for all seed users. */
export const ADMIN = { userId: 'E0043258', name: '陈柏睿', password: '123456' }

/** Unique marker so repeated runs never collide on business data. */
export function unique(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Signs in through the real login form and waits for the shell. */
export async function login(page, user = ADMIN) {
  await page.goto('/')
  await expect(page.locator('.login-card h2')).toHaveText('登入')
  await page.getByLabel('使用者代码').fill(user.userId)
  await page.getByLabel('密码').fill(user.password)
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page.locator('.top-actions')).toContainText(user.name)
}

/**
 * Navigates through the sidebar. Menu labels are the user-facing page names
 * (e.g. 厂别管理); the target is matched by its hash route, not by translated text.
 */
export const MENU = {
  users: { route: '/page/SBRM_USER', title: '使用者管理', label: '使用者管理' },
  factories: { route: '/page/SBRM_FACTORY', title: '厂别管理', label: '厂别管理' },
  alarmTest: { route: '/page/TEST', title: '测试告警触发', label: '测试告警触发' },
  pending: { route: '/page/ACK_LIST', title: '待我确认', label: '待我确认' },
  alarmQuery: { route: '/page/AVPA004', title: '警报处理查询', label: '警报处理查询' },
  invalidAlarms: { route: '/page/AVPA008', title: '无效警报查询', label: '无效警报查询' },
}

export async function openMenu(page, menu = MENU.factories) {
  const link = page.locator(`.sidebar nav a[href="#${menu.route}"]`)
  if (!await link.isVisible()) {
    const group = page.locator('.sidebar .ant-menu-submenu').filter({ has: page.locator(`a[href="#${menu.route}"]`) })
    await group.locator(':scope > .ant-menu-submenu-title').click()
  }
  await expect(link).toBeVisible()
  await link.click()
  await expect(page.locator('.page-heading h1')).toHaveText(menu.title)
}

/** Logs in through the API to prepare data; returns the bearer token. */
export async function apiToken(request, user = ADMIN) {
  const response = await request.post('/api/login', { data: { userId: user.userId, password: user.password } })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.ok).toBe(true)
  return body.token
}

/** Select an Ant Design Vue option in its portaled dropdown. */
export async function selectOption(page, select, label) {
  await select.click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click()
}
