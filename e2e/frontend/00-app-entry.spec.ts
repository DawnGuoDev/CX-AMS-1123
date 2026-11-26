import { expect, test } from '@playwright/test'

/**
 * TC-FE-E2E-000: entry page assembly, independent of the backend and of a Vite build.
 *
 * The run's web server serves frontend/dist, which needs `npm run build` (Vite). This case instead
 * loads the real frontend/index.html module graph from disk and checks the shell mounts, so the SPA
 * entry, the router fallback and the vendored dictionary (used by 繁體中文) are verified even when the
 * production bundle is unavailable. Business flows stay in 01~06.
 */
const FRONTEND = new URL('../../frontend/', import.meta.url)

test.describe('TC-FE-E2E-000 前端入口装配', () => {
  test('mounts the login shell from index.html and keeps the traditional-Chinese dictionary', async ({ page }) => {
    await page.route('http://ams-e2e.test/**', route => {
      const url = new URL(route.request().url())
      route.fulfill({ path: new URL(url.pathname + url.search, FRONTEND).pathname })
    })
    await page.goto('http://ams-e2e.test/index.html')

    // index.html mounts the real App component; without a session the login card is rendered.
    await expect(page.locator('#app .login-card h2')).toHaveText('登入')
    await expect(page.locator('#app .login-card')).toContainText('使用者代码')

    // The vendored OpenCC build is what legacy-i18n uses for zh-TW; a broken copy would show raw keys.
    const conversion = await page.evaluate(() => {
      const opencc = (window as unknown as { OpenCC?: { Converter?: (options: unknown) => (text: string) => string } }).OpenCC
      if (!opencc || typeof opencc.Converter !== 'function') return 'missing'
      return opencc.Converter({ from: 'cn', to: 'tw' })('警报强制中断作业')
    })
    expect(conversion).toBe('警報強制中斷作業')

    // An unknown hash route falls back to /home (router catch-all) and, without a session, still
    // renders the mountable shell instead of a blank page.
    await page.goto('http://ams-e2e.test/index.html#/not-a-page')
    await expect(page.locator('#app .login-card h2')).toHaveText('登入')
    expect(await page.evaluate(() => location.hash)).toBe('#/home')
  })
})
