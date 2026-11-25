import { expect, test } from '@playwright/test'
import { login, MENU, openMenu } from './support/ams.js'

/**
 * TC-FE-E2E-006: 待我确认列表勾选 + 批量确认回报弹窗。
 * 真实后端在 E2E 环境不配置 SMTP，邮件无法成功送达，因此无法产生 CAN_ACK=true 的待确认
 * 警报（该链路由后端 WorkflowIntegrationTest 覆盖）。这里通过 Playwright 路由模拟
 * /api/alarms/pending 与 /api/alarms/ack，验证前端勾选、笔数、置灰、备注提交与结果反馈。
 */
test.describe('TC-FE-E2E-006 批量确认回报', () => {
  test('勾选多笔后填写统一备注并提交，展示成功/失败汇总并刷新', async ({ page }) => {
    const pending = [
      { ALARM_KEY: 'alarms-t1', ALARM_ID: 'A-T1', TITLE: '批量测试警报一', STATUS: 'Process', FACTORY_ID: 'Fab01', SUB_SYS_ID: 'MES', EQP_ID: 'PRT01', CURRENT_LEVEL: 1, LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 2, CREATE_DT: '2026-11-25T10:00:00Z', CAN_ACK: true },
      { ALARM_KEY: 'alarms-t2', ALARM_ID: 'A-T2', TITLE: '批量测试警报二', STATUS: 'Process', FACTORY_ID: 'Fab01', SUB_SYS_ID: 'MES', EQP_ID: 'PRT01', CURRENT_LEVEL: 1, LEVEL_ACK_COUNT: 0, LEVEL_REQUIRED: 2, CREATE_DT: '2026-11-25T10:01:00Z', CAN_ACK: true },
    ]
    let batchBody: any = null
    let calls = 0
    await page.route('**/api/alarms/pending', async route => {
      calls += 1
      await route.fulfill({ json: { ok: true, rows: calls === 1 ? pending : [pending[1]] } })
    })
    await page.route('**/api/alarms/ack', async route => {
      batchBody = route.request().postDataJSON()
      await route.fulfill({ json: {
        ok: true,
        items: [
          { ALARM_KEY: 'alarms-t1', ok: true, completed: false },
          { ALARM_KEY: 'alarms-t2', ok: false, message: '您不是本层级待确认人员，或已确认过此警报' },
        ],
        successCount: 1, failCount: 1,
      } })
    })

    await login(page)
    await openMenu(page, MENU.pending)

    const batchButton = page.getByRole('button', { name: '批量确认回报' })
    await expect(batchButton).toBeDisabled()
    await expect(page.locator('main')).toContainText('已选 0 笔')

    // 全选当前页两笔。
    await page.locator('thead input[type="checkbox"]').check()
    await expect(page.locator('main')).toContainText('已选 2 笔')
    await expect(batchButton).toBeEnabled()
    await batchButton.click()

    const modal = page.getByRole('dialog', { name: '批量确认回报' })
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('2')
    await modal.locator('textarea').fill('统一回应备注')
    await modal.getByRole('button', { name: /确认回报/ }).click()

    await expect(page.getByText('确认完成：成功 1 笔，失败 1 笔')).toBeVisible()
    expect(batchBody).toEqual({ keys: ['alarms-t1', 'alarms-t2'], cmt: '统一回应备注' })
    // 提交后重新拉取 pending（第二次只返回一笔），失败/已确认的一笔不在列表。
    await expect(page.locator('tbody')).toContainText('A-T2')
    await expect(page.locator('tbody')).not.toContainText('A-T1')
  })
})
