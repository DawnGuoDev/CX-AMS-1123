# AMS E2E 测试文本用例

本目录存放 AMS（Java 后端 + Vue 前端）的 **E2E 文本用例**，随代码用 git 维护。
可执行代码位于仓库根 `e2e/`（前端 Playwright 用例 + 共用配置）；后端接口 E2E 位于
`backend/src/test/java/com/changxin/ams/e2e/`。文本用例 ID、代码用例名、测试报告名称三者一一对应。

## 文档索引

| 文件 | 内容 |
| ---- | ---- |
| `backend-api-e2e.md` | 后端接口 E2E 文本用例（真实 Spring Boot 进程 + HTTP） |
| `frontend-e2e.md` | 前端 E2E 文本用例（Vite 构建产物 + Playwright + Chromium） |
| `unit-tests.md` | 单元测试清单与执行方式 |

## 测试分层

| 层级 | 位置 | 说明 |
| ---- | ---- | ---- |
| 后端单元测试 | `backend/src/test/java/com/changxin/ams/unit/` | 纯逻辑：JSON 辅助、密码哈希、报表条件运算，不起 Spring |
| 后端集成测试 | `backend/src/test/java/com/changxin/ams/*IntegrationTest.java` | 既有：引擎、SMTP、主档、报表（MockMvc） |
| 后端接口 E2E | `backend/src/test/java/com/changxin/ams/e2e/` | 真实进程（随机端口）+ 真实 HTTP + 临时 H2 文件库 |
| 前端单元测试 | `frontend/src/**/__tests__/*.test.js` | Vitest：纯函数、store、composable |
| 前端 E2E | `e2e/frontend/` | Playwright：构建后的真实页面 + 真实后端 |

E2E 只覆盖跨进程主链路，不复刻单元/集成测试的分支细节。

## 环境与数据约定

- JDK 21 + Maven 3.9；Node 20.19+（建议 22 LTS）。
- 每个后端接口 E2E 用例类随机端口启动真实实例，H2 使用临时文件库，**不写仓库内 `./data`**；
  实例停止后删除临时目录，失败时保留并在报告中给出路径。
- 种子账号：`E0043258` / `123456`（种子用户统一初始密码）；测试新建数据统一带唯一前缀 `e2e-<时间戳><随机>`。
- SMTP 一律不配置真实服务器：未配置时邮件记录为 `Fail`，用例据此断言“不假装发送成功”。
- 前端 E2E 通过同源静态服务器提供 `frontend/dist` 并把 `/api/**` 反代到后端，等价部署形态。

## 执行

```bash
./scripts/build-java-vue.sh          # 构建（含后端测试）
cd backend && mvn test               # 单元 + 集成 + 后端接口 E2E
cd frontend && npm run test:unit     # 前端单元测试
cd e2e && npm ci && npx playwright install chromium && npm test   # 前端 E2E
```

## 用例总表

| 用例 ID | 层级 | 标题 | 代码 |
| ------- | ---- | ---- | ---- |
| TC-API-E2E-001 | 后端接口 | 登入 → bootstrap → 未授权拒绝 → 登出失效 | `e2e/BackendAuthE2ETest` |
| TC-API-E2E-002 | 后端接口 | 厂别主档 新增/修改/停用/历史/恢复 | `e2e/MasterDataE2ETest` |
| TC-API-E2E-003 | 后端接口 | 测试告警触发 → 详情/通知记录 → 未送达时 ACK 拒绝且不计数 | `e2e/AlarmWorkflowE2ETest` |
| TC-API-E2E-004 | 后端接口 | 汇出范本/导入校验/校验失败不落库/404 契约 | `e2e/MasterImportExportE2ETest` |
| TC-API-E2E-005 | 后端接口 | 强制中断：HTTP 契约/状态与通知收敛/报表口径/拒绝分支/主档权限即时生效/作业页与状态选项 | `e2e/AlarmTerminateE2ETest` |
| TC-FE-E2E-000 | 前端 | 入口装配：index.html 模块图挂载登录壳、路由兜底、繁中词典可用（不依赖构建产物） | `frontend/00-app-entry.spec.ts` |
| TC-FE-E2E-001 | 前端 | 登录页加载 → 账号密码登入 → 进入即时汇总 | `frontend/01-login.spec.ts` |
| TC-FE-E2E-002 | 前端 | 侧栏导航与菜单搜索、语言切换（无残留翻译）、报表查询入口 | `frontend/02-navigation.spec.ts` |
| TC-FE-E2E-003 | 前端 | 厂别主档：新增、列表可见、停用后隐藏 | `frontend/03-master-data.spec.ts` |
| TC-FE-E2E-004 | 前端 | 测试告警触发 → 告警详情 → 邮件 ACK 确认页 | `frontend/04-alarm-workflow.spec.ts` |
| TC-FE-E2E-005 | 前端 | 待我确认列表为空（SMTP 未配置）与即时汇总计数联动 | `frontend/05-alarm-list.spec.ts` |
| TC-FE-E2E-006 | 前端 | 有权限强制中断（原因/二次确认/报表口径）与无权限禁用 | `frontend/06-alarm-terminate.spec.ts` |

状态判定：PASS = 执行且断言通过；FAIL = 已执行但断言不符；BLOCKED = 环境前置不满足（浏览器缺失、端口/构建产物缺失）。
