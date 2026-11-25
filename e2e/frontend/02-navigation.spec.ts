import { expect, test } from '@playwright/test'
import { MENU, login, openMenu, selectOption } from './support/ams.js'

test.describe('TC-FE-E2E-002 侧栏导航、搜索与主档页面', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('navigates to the factory and user master pages', async ({ page }) => {
    await openMenu(page, MENU.factories)
    await expect(page).toHaveURL(/#\/page\/SBRM_FACTORY$/)
    await expect(page.locator('.description')).toContainText('厂别')
    await expect(page.locator('.grid-tools')).toBeVisible()

    await openMenu(page, MENU.users)
    await expect(page).toHaveURL(/#\/page\/SBRM_USER$/)
    await expect(page.locator('tbody')).toContainText('E0043258')
  })

  test('filters the sidebar with the menu search', async ({ page }) => {
    const search = page.locator('.nav-search input')
    await search.fill('测试告警')
    await expect(page.locator('.sidebar nav a')).toHaveCount(1)
    await expect(page.locator('.sidebar nav a')).toContainText('测试告警触发')

    await search.fill('不存在的菜单')
    await expect(page.locator('.sidebar nav a')).toHaveCount(0)

    await search.fill('')
    await expect(page.locator('.sidebar nav a').first()).toBeVisible()
  })

  test('switches the interface language without stale translations', async ({ page }) => {
    const language = page.getByLabel('语言')
    await selectOption(page, language, 'English')
    await expect(page.locator('.top-actions')).toContainText('Sign out')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // The sidebar is translated immediately; a cached label from the previous language must not
    // survive the switch (regression: setLang() used to keep the translation cache).
    await expect(page.locator('.sidebar nav a[href="#/page/SBRM_FACTORY"]')).toHaveText('Factory Management')
    await expect(page.locator('.sidebar nav a[href="#/page/SBRM_USER"]')).toHaveText('User Management')

    // The language select keeps its Chinese aria-label (the label is not part of the dictionary),
    // and only its options are localized by the browser.
    await selectOption(page, language, '简体中文')
    await expect(page.locator('.sidebar nav a[href="#/page/SBRM_FACTORY"]')).toHaveText('厂别管理')
    await expect(page.locator('.top-actions')).toContainText('登出')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  })

  test('opens a report page and requires a query before showing rows', async ({ page }) => {
    await openMenu(page, MENU.alarmQuery)
    await expect(page.locator('.panel')).toContainText('请执行查询')
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '查询条件' })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('dialog', { name: '查询条件' })).toHaveCount(0)
  })

  test('collapses groups and opens the current route on navigation', async ({ page }) => {
    const basics = page.locator('.sidebar .ant-menu-submenu').filter({ hasText: '基础资料' })
    await basics.locator(':scope > .ant-menu-submenu-title').click()
    await expect(basics.locator('a[href="#/page/SBRM_FACTORY"]')).not.toBeVisible()
    await openMenu(page, MENU.factories)
    await expect(basics.locator('a[aria-current="page"]')).toHaveText('厂别管理')
    await page.goto('/#/page/AVPA007')
    await expect(page.locator('.sidebar nav a[aria-current="page"]')).toHaveText('历史记录查询')
    await expect(page.locator('.sidebar nav a[aria-current="page"]')).toBeVisible()
    const userItem = page.locator('.sidebar .ant-menu-item').filter({ has: page.locator('a[href="#/page/SBRM_USER"]') })
    await userItem.focus()
    await userItem.press('Enter')
    await expect(page.locator('.page-heading h1')).toHaveText('使用者管理')
  })

  test('persists the collapsed sidebar and navigates through its popup menus', async ({ page }) => {
    await page.getByRole('button', { name: '收起导航', exact: true }).click()
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar-collapsed/)
    await page.reload()
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar-collapsed/)
    const basics = page.locator('.sidebar > .ant-layout-sider-children .ant-menu-submenu-title').filter({ hasText: '基础资料' })
    await basics.hover()
    const userLink = page.locator('.ant-menu-submenu-popup:visible a[href="#/page/SBRM_USER"]')
    await userLink.click()
    await expect(page.locator('.page-heading h1')).toHaveText('使用者管理')
    await page.getByRole('button', { name: '展开导航', exact: true }).click()
    await expect(page.locator('.sidebar nav a[aria-current="page"]')).toHaveText('使用者管理')
    await expect(page.locator('.sidebar nav a[aria-current="page"]')).toBeVisible()
  })

  test('searches by feature code, clears with Escape and adapts to a narrow viewport', async ({ page }) => {
    const search = page.getByRole('textbox', { name: '搜索功能', exact: true })
    await search.fill('sbrm_factory')
    await expect(page.locator('.sidebar nav a')).toHaveCount(1)
    await expect(page.locator('.sidebar nav a')).toHaveText('厂别管理')
    await search.fill('不存在的功能')
    await expect(page.locator('.sidebar-empty')).toContainText('未找到匹配功能')
    await search.press('Escape')
    await expect(search).toHaveValue('')
    await page.setViewportSize({ width: 900, height: 800 })
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar-collapsed/)
    await page.getByRole('button', { name: '搜索功能', exact: true }).click()
    await expect(search).toBeFocused()
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar-collapsed/)
  })

})
