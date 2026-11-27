# 警报强制中断 · 影响范围

- Spec：`SPEC-AMS-ALARM-TERMINATE-001`（B 类，1 WARN: safety）
- 口径（已与负责人确认）：**工作分支 `feat/0ae13b26-ka7z` 相对基线 `release`（`13c8434`）的全部提交**
- 基线证据：本地 `release` 合并提交 `13c84348c339d0acea9062954b043b1ec7e56e5d`（与 Spec 第 9 章记录的基线一致）；本次环境无法访问远端 `origin/release`（TLS 中断），如需按远端最新基线重算需重新拉取。

## 1. 纳入的提交（10 个，按时间序）

| 提交 | 类型 | 说明 | 文件数 |
| --- | --- | --- | --- |
| `b36b758` | 产品 | Spec 与产品原型 | —（属产品设计节点） |
| `0ace5a9` | 设计 | 技术设计 `docs/design/alarm-terminate/design.md` + 任务拆分 `task.md` | 2 |
| `4b0ca35` | 实现 | 后端 `terminate`/`CAN_TERMINATE`/路由/种子/元数据；前端详情、作业页、侧栏、i18n、样式 | 20 |
| `e398b2b` / `7d141e0` / `de547d9` | 文档 | 代码实现交付物 HTML（仅文档） | — |
| `582fb41` | 测试 | 前端 E2E 用例 + `support/ams.js` helper | 4 |
| `a6f7e3b` | 测试 | 状态/权限/菜单覆盖 + `tsconfig.check.json` | 3 |
| `92fb816` | 测试 | 后端接口 E2E `AlarmTerminateE2ETest`、前端 `OperationsPage.test.js`、`00-app-entry.spec.ts` | 6 |
| `ba2ce8b` | 测试 | 选择器修正、6-1b 回归、ALARM_ID 用例、集成用例修正、i18n 用例、覆盖映射 | 8 |

合并视角（`git diff --stat 13c8434...HEAD`）：60 个文件、+4902 / −20，其中运行时业务代码 7 个文件、测试代码 9 个文件，其余为文档/交付物 HTML/原型资源。

## 2. 运行时改动触点（影响面来源）

| 触点 | 改动 | 影响的功能/页面 | 关联 REQ |
| --- | --- | --- | --- |
| `AlarmEngine.terminate()` | 新增：404 → 非 Process → 无权限 → 原因（trim 非空、≤500）顺序校验；同一 `store.write` 内 Terminated + 关 Active 层级 + Pending→Skipped + `AlarmTerminate` 交易 | 警报状态机、通知派发、ACK、调度器 | REQ-003/004 |
| `AlarmEngine.close()` 重载 | 增加 `extra` 参数写入 `TERMINATE_*`；层级关闭范围不变 | 既有 Completed/NoNextLevel 关闭路径（回归风险点） | REQ-004 |
| `AlarmEngine.canTerminate()` + `enrich()` | 权限每次读**实时主档**（不信会话副本）；`CAN_TERMINATE` 仅「有权限 + Process」为真；新增 `TERMINATE_USER_ID/NAME`（操作人不存在显示 `SYSTEM/系统`） | 详情接口、作业列表每行 | REQ-001/002 |
| `historicalDetail()` | 历史快照恒 `CAN_TERMINATE=false` | 历史记录查询只读语义 | REQ-002/005 |
| `ApiController` | 新增 `POST /api/alarms/:key/terminate`、`GET /api/alarms/process`；`alarms/{key}` 路由显式排除 `process` 段 | 全部 `/api/alarms/*` 路由解析（回归风险点） | REQ-003/007 |
| `Masters.options()` | `alarmStatus` 追加 `Terminated`（顺序追加） | 三张报表的状态下拉 | REQ-006 |
| `metadata.json` | `SBRM_USER.CAN_TERMINATE`（checkbox、默认 N、grid/filter）+ `ALARM_LIST` 页面标题 | 使用者主档列表/编辑/筛选、页面标题 | REQ-001/007 |
| `seed.json` | 12 个种子账号补 `CAN_TERMINATE`（U001=`Y`，其余 `N`）；`functions` 44 项含 `ALARM_LIST` | 登录账号、侧栏菜单 | REQ-001/007 |
| `Excel.java` | 汇入时跳过**真正空白**单元格（原先写空值） | 全部主档 Excel 汇入（影响面**超出**本功能，需回归） | REQ-001 / 兼容 |
| `AlarmDetail.vue` | 中断按钮（danger）、二次确认（必填/500 上限/不可逆提示）、中断横幅、失败保留原因 | 警报详情弹窗（所有状态与历史只读） | REQ-005 |
| `OperationsPage.vue` / `Workspace.vue` | `ALARM_LIST` 走 `/alarms/process`，10s 刷新与 ACK_LIST 一致；页面分发新增编码 | 作业页、路由 | REQ-007 |
| `AppSidebar.vue` | `ALARM_LIST` 归入「警报作业」分组 + 图标 | 侧栏菜单、图标模式、搜索 | REQ-007 |
| `style.css` / `legacy-i18n.js` | 中断横幅/确认样式；新增中文词条 EN 映射 | 三语切换、视觉 | REQ-005/007 |

**后端未改动**：`Reports.java`（设计明确不改查询逻辑，口径由数据状态自然满足）——因此报表结论依赖数据断言而非代码差异，见 §4。

## 3. 需要测试的用例条目（按影响面推导）

| 影响面 | 必须覆盖的用例 | 层级 |
| --- | --- | --- |
| 中断事务与状态收敛 | `authorizedTerminationConvergesStateLevelsNotificationsAndTransaction`、FE 6-1 主流程 | 集成 + 前端 E2E |
| 权限实时读取（撤销/停用/缺字段/越权直调） | `permissionIsReadFromLiveMasterAndRejectionsHaveNoSideEffects`、`shouldReadThePermissionFromTheLiveMasterRecord`、FE 6-5 / 6-7 | 集成 + 后端 E2E + 前端 E2E |
| 状态机与原因边界、404 | `rejectsMissingAlarmNonProcessAlarmAndInvalidReasons`、`shouldRejectUnauthorizedStatusAndInvalidReasonWithoutSideEffects`、`shouldReturnNotFoundForUnknownAlarm`、FE 6-3 | 集成 + 后端 E2E + 前端 E2E |
| 并发仅一次 | `concurrentTerminationsSucceedOnlyOnce` | 集成 |
| 调度停止/不重送 | `schedulerStopsEscalationRetriesAndDeliveryAfterTermination` | 集成 |
| `:key` 同时接受 ALARM_KEY / ALARM_ID | `shouldLocateTheAlarmByAlarmIdAsWellAsByAlarmKey` | 后端 E2E |
| 详情字段矩阵与历史只读 | `detailExposesTerminateMatrixAndTransactionViewIsReadOnly`、FE 6-3 | 集成 + 前端 E2E |
| 报表口径（含既有状态回归） | `reportsDistinguishTerminatedAlarms`、FE 6-1 / **6-1b** | 集成 + 前端 E2E |
| 菜单与状态选项 | `masterFieldNavigationAndExcelRoundTrip`、`shouldExposeTheTerminateWorkPageAndTheAlarmStatusOption`、FE 6-6 | 集成 + 后端 E2E + 前端 E2E |
| 主档字段与 Excel（含**全局汇入行为变更**） | `masterFieldNavigationAndExcelRoundTrip` + 既有 `MasterImportExportE2ETest`（TC-API-E2E-004） | 集成 + 后端 E2E |
| 详情交互（按钮态/二次确认/失败/取消） | `AlarmDetail.test.js` ×9、FE 6-1 / 6-2 / 6-4 | 前端单测 + 前端 E2E |
| 作业页数据源与刷新 | `OperationsPage.test.js` ×4 | 前端单测 |
| 三语文案 | `legacy-i18n.test.js` 新增用例 | 前端单测 |
| 既有路由解析未受影响 | `BackendAuthE2ETest`（bootstrap/nav/404）、FE `02-navigation` | 回归 |

## 4. 影响面评估结论与风险

| 项 | 评估 |
| --- | --- |
| 影响域 | 警报状态机与调度（核心链路）、警报详情/作业页（主用户路径）、使用者主档与 Excel、三张报表口径、侧栏菜单 |
| 扩散风险 1 | `close()` 被 Completed/NoNextLevel 共用 → 必须回归既有 ACK/升级/超时关闭链路（`WorkflowIntegrationTest`、`ManualAlignmentIntegrationTest`） |
| 扩散风险 2 | 路由 `alarms/{key}` 排除 `process` 段 → 若存在以 `process` 命名的 key 会受影响，但 key 形如 `alarms-000123`，不构成实际风险 |
| 扩散风险 3 | `Excel.java` 跳过空白单元格是**全主档通用行为**改动，超出中断功能范围 → 需回归其他主档汇入（如厂别/机台） |
| 权限风险 | 主档为唯一授权依据，前端按钮非安全边界；任何拒绝分支都不得产生写入（已用 `store.data()` 全等断言锁定） |
| 不可逆风险 | Terminated 为终态，误操作不可恢复（Spec safety WARN）→ 二次确认 + 必填原因 + 权限字段 |
| 可观测性 | 失败沿用统一 `ApiException` 响应；不输出敏感信息（token/邮件地址不落测试报告） |

## 5. 推荐最小执行集

1. `cd backend && mvn test`（重点 `AlarmTerminateIntegrationTest`，并确认 `WorkflowIntegrationTest`/`ManualAlignmentIntegrationTest` 回归通过）
2. `bash scripts/run-java-e2e.sh`（`AlarmTerminateE2ETest` + `MasterImportExportE2ETest` 回归）
3. `cd frontend && npm run test:unit`（`AlarmDetail` / `OperationsPage` / `legacy-i18n`）
4. `bash scripts/run-frontend-e2e.sh 06-alarm-terminate`，必要时加 `02-navigation`、`04|05-alarm-*`
