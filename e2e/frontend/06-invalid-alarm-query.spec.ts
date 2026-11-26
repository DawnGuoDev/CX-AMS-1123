import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { MENU, apiToken, login, openMenu, unique } from './support/ams.js'

const run = promisify(execFile)

/** Reads the shared strings of an xlsx (zip) file so assertions check cells, not raw bytes. */
async function sharedStrings(file: string) {
  const { stdout } = await run('unzip', ['-p', file, 'xl/sharedStrings.xml'], { encoding: 'utf8' })
  return [...stdout.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(match => match[1])
}

/**
 * TC-FE-E2E-006: a failed trigger is recorded and can be found in 无效警报查询 (AVPA014).
 *
 * The invalid branches used here need no master-data edits: one non-existent factory
 * (未设定厂别) and one non-existent alarm code (找不到事件). Each title carries a unique marker so
 * the report filter narrows the table to the rows written by this run.
 */
test.describe('TC-FE-E2E-006 无效警报查询与导出', () => {
  test('persists invalid triggers and queries them through the AVPA014 report', async ({ page, request }) => {
    const token = await apiToken(request)
    const marker = unique('E2E-INVQ')
    const factoryTitle = `${marker} 未设定厂别`
    const eventTitle = `${marker} 找不到事件`

    const trigger = (body: Record<string, string>) => request.post('/api/alarms/test', {
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    })
    const missingFactory = { factoryKey: 'MISSING_FACTORY', subsysKey: 'SS03', eqpKey: 'EQP01', alarmCode: 'PRT_NODYE' }
    const missingEvent = { factoryKey: 'F01', subsysKey: 'SS03', eqpKey: 'EQP01', alarmCode: 'MISSING_ALARM' }
    const first = await trigger({ ...missingFactory, title: factoryTitle, content: 'invalid e2e' })
    expect(first.status(), await first.text()).toBe(422)
    expect((await first.json()).message).toBe('未设定厂别')
    const second = await trigger({ ...missingEvent, title: eventTitle, content: 'invalid e2e' })
    expect(second.status(), await second.text()).toBe(422)
    expect((await second.json()).message).toBe('找不到事件')

    await login(page)
    await openMenu(page, MENU.invalidAlarms)
    await expect(page).toHaveURL(/#\/page\/AVPA014$/)
    // Same report shell as AVPA004: query / refresh / export, and no rows before the first query.
    await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '汇出', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '重新整理', exact: true })).toBeDisabled()
    await expect(page.locator('.panel')).toContainText('请执行查询')

    // Query by the unique title marker: both failures come back, newest first.
    await page.getByRole('button', { name: '查询', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '查询条件' })
    await expect(dialog).toBeVisible()
    const titleField = dialog.locator('.query-fields > label').filter({ hasText: '警报标题' })
    await titleField.locator('.ant-checkbox-input').check()
    await expect(titleField.locator('.ant-select')).toBeEnabled()
    await titleField.locator('input[type="text"]').fill(marker)
    await dialog.getByRole('button', { name: '查询', exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await expect(page.getByRole('button', { name: '重新整理', exact: true })).toBeEnabled()
    await expect(page.locator('.grid-tools')).toContainText('2 笔资料')
    const rows = page.locator('tbody tr.ant-table-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(eventTitle)
    await expect(rows.first()).toContainText('找不到事件')
    await expect(rows.nth(1)).toContainText(factoryTitle)
    await expect(rows.nth(1)).toContainText('未设定厂别')
    await expect(rows.nth(1)).toContainText('MISSING_FACTORY')
    await expect(page.locator('tbody')).toContainText('Mock')

    // An empty interval keeps the empty state instead of failing.
    await page.getByRole('button', { name: '查询', exact: true }).click()
    const emptyDialog = page.getByRole('dialog', { name: '查询条件' })
    await emptyDialog.getByRole('button', { name: '清除', exact: true }).click()
    const dateField = emptyDialog.locator('.query-fields > label').filter({ hasText: '资料时间' })
    await dateField.locator('.ant-checkbox-input').check()
    await dateField.locator('.ant-select').click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: /^介于$/ }).click()
    await dateField.getByLabel('资料时间起始').fill('2000-01-01T00:00:00')
    await dateField.getByLabel('资料时间结束').fill('2000-01-01T00:00:01')
    await emptyDialog.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.locator('tbody')).toContainText('查无资料')

    // Export the current screen rows and read the workbook back from the downloaded file.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '汇出', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('无效警报查询.xlsx')
    const file = await download.path()
    expect((await fs.readFile(file)).subarray(0, 2).toString()).toBe('PK')
    const strings = await sharedStrings(file)
    // Header labels follow the report definition (Excel export writes labels, not field names);
    // the workbook name itself is 无效警报查询.xlsx, asserted above.
    expect(strings).toEqual(expect.arrayContaining([
      '无效警报识别码', '资料时间', '失效原因', '厂别代码', '厂别名称',
      '子系统代码', '子系统名称', '机台代码', '警报代码', '警报标题', '资料取得方式', '来源类型',
    ]))
    // The empty-interval query left no rows on screen, so nothing from this run is exported.
    expect(strings).not.toContain(factoryTitle)
    expect(strings).not.toContain('MISSING_FACTORY')
  })
})
