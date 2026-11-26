---
spec_id: AMS-DA-028-INVALID-ALARM-QUERY
title: AMS DA｜无效警报查询 任务清单
status: draft
template_id: knowledge/template/任务拆分规范.md
schema_version: 1
created_at: 2026-11-26
updated_at: 2026-11-26
---

# 任务清单: AMS DA｜无效警报查询

<!-- 按依赖顺序组织：数据/后端 → 元数据/迁移 → 前端 → 测试 → 文档。每个任务均可独立验证。 -->
<!-- 所有任务来源于 design.md 对应章节；不包含重构、抽象清理、历史债等超范围内容。 -->

## 1. 准备与数据契约

- [x] 1.1 在 `AlarmEngine` 中定义失效类型常量（8 个 `public static final String` 或 `enum`），值固定为 `NO_FACTORY`/`NO_SUBSYS`/`NO_EQP`/`EVENT_NOT_FOUND`/`SETTING_DISABLED`/`NO_LEVEL1`/`NO_RECIPIENTS`/`DUPLICATE_IGNORED`，与 `design.md` §2.2 `STATE-01` 一致；不引入第 9、10 种。
- [x] 1.2 在 `seed.json` 顶层新增 `"invalid_alarms": []`，并在 `meta.seq` 新增 `"invalid_alarms": 0`（`design.md` §2.2、§2.3）。

## 2. 后端核心实现

- [x] 2.1 扩展 `AlarmEngine.invalid(...)` 为 `invalid(body, user, failureType, reason, context)`：先在当前 `store.write` 事务内追加一条 `invalid_alarms` 记录（字段见 `design.md` §2.2），再返回原 `m("ok",false,"status",422,"message",reason)`；不改变 422 契约。
- [x] 2.2 在 `trigger()` 的 8 个失败分支分别传入对应 `FAILURE_TYPE`：厂别/子系统/机台/事件/设定未启用/层级1/发送人员/重复；`EVENT_NOT_FOUND` 固定 `FAILURE_REASON` 为“找不到事件”，`DUPLICATE_IGNORED` 额外传 `DUPLICATE_ALARM_KEY`（命中的 `ALARM_KEY`）。
- [x] 2.3 保留既有匹配顺序与边界：精确机台优先、隐藏的具体机台设定不回退 `*`、查重条件不变且不限于 `Process`、查重只读 `alarms` 不读 `invalid_alarms`。
- [x] 2.4 实现 `INVALID_ID` 生成（`IVD-YYYYMMDD-NNNNNN`，日期取 `CREATE_DT` UTC 日期，序号取 `store.key("invalid_alarms")` 的数值部分），并保证在同一次写事务内唯一。
- [x] 2.5 记录中的 `FACTORY_ID/NAME`、`SUB_SYS_ID/NAME`、`EQP_ID/NAME` 通过 `store.find` 补全；主档不存在时留空串，不伪造名称；`TITLE/CONTENT` 空值处理与 `create()` 一致（`Empty Subject`/`Empty Content`）。
- [x] 2.6 `Reports.definition()` 白名单加入 `AVPA008`，且不套用 AVPA004/007 的列增强逻辑。
- [x] 2.7 `Reports.query()` 增加 `AVPA008` 分支：校验 `CREATE_DT` 必填且至少一个时间边界（否则 `ApiException(400,"无效警报查询必须指定时间区间")`），数据源为 `invalid_alarms` 深拷贝，用 `matches()` 过滤并按 `CREATE_DT` 倒序；不改动 AVPA004/007/013 分支。
- [x] 2.8 在 `Store` 初始化末尾增加幂等迁移 `migrateInvalidAlarmReport()`：补齐 `invalid_alarms`、`meta.seq.invalid_alarms`、`report_defs.AVPA008`、`functions.AVPA008`（`SORT=12`，不改既有菜单 SORT）；仅在数据变化时 `persist()`。
- [x] 2.9 在 `seed.json` 的 `report_defs` 增加 AVPA008 定义（`REPORT_NAME=无效警报查询`、`ATLEAST_ONE_CONDITION=Y`、列/条件见 `design.md` §2.4），在 `functions` 增加 AVPA008 菜单项（`FUNCTION_NAME=无效警报查询`、`PATH=#/page/AVPA008`、`SORT=12`、`VISIBLE=Y`、`ACTIVE=Y`）。

## 3. 前端实现

- [x] 3.1 `Workspace.vue` 路由分发列表加入 `AVPA008`，复用 `ReportPage`，不做专用页面。
- [x] 3.2 `AppSidebar.vue` 的「查询报表」分组 `codes` 加入 `AVPA008`，`icons` 增加 `AVPA008` 映射（如 `WarningOutlined`），沿用后端 `nav` 可见性。
- [x] 3.3 `ReportPage.vue` 进入 AVPA008 时，为 `CREATE_DT` 预置“近 24 小时”草稿（`enabled=true`、`operator=between`、`from/to` 为本地时间），并在查询弹窗提示“默认近 24 小时，可调整”；不改其他报表的初始化行为。
- [x] 3.4 `legacy-i18n.js` 复用已有「无效警报查询」「失效类型」词条，补齐新增列/条件/提示词条（如“失效原因”“来源接口”“无效警报识别码”“警报代码”“查询未成功触发的警报与失效原因。”已在库中则复用），确保简体/繁体/English 都有值。

## 4. 测试

- [x] 4.1 新增 `backend/src/test/java/com/changxin/ams/InvalidAlarmReportIntegrationTest.java`：8 种失效类型逐一落库并断言 `FAILURE_TYPE`/`FAILURE_REASON`；成功触发不落库；忽略重复记录 `DUPLICATE_ALARM_KEY` 且不自我抑制；失败后 `alarms`/`alarm_notifications`/`alarm_transactions` 数量不变。
- [x] 4.2 同文件覆盖查询：时间区间必填 400、边界秒、单侧边界、条件交集、非法字段 400、`CREATE_DT` 倒序。
- [x] 4.3 同文件覆盖导出：导出过滤后全部行、表头仅声明列、空结果仅表头。
- [x] 4.4 覆盖迁移：旧快照（无 AVPA008）启动后自动补齐且幂等；新库初始化含 AVPA008；既有 AVPA004/007/013 定义不变。
- [x] 4.5 `frontend/src/__tests__/legacy-i18n.test.js` 增加新增词条断言（与现有测试风格一致）。
- [ ] 4.6（后续 E2E 节点） `e2e/frontend/support/ams.js` 增加 `MENU.invalidAlarms`；新增 Playwright 用例：侧栏「查询报表」进入“无效警报查询”→ 显示“请执行查询”→ 执行默认时间区间查询 → 表格渲染 → 导出可下载；不改既有导航断言。
- [x] 4.7 更新 `docs/e2e/backend-api-e2e.md`、`docs/e2e/frontend-e2e.md`、`docs/e2e/unit-tests.md` 中 AVPA008 相关用例 ID 与预期，保持与代码测试名一致。
- [ ] 4.8 执行验证并记录：`cd backend && mvn test`、`cd frontend && npm run test:unit`、`bash scripts/run-java-e2e.sh`、`bash scripts/run-frontend-e2e.sh`；记录通过数与未执行项。

## 5. 文档与收尾

- [x] 5.1 更新 `README.md`、`PAGE_MAP.md`、`docs/JAVA_VUE_MIGRATION.md`：报表清单加入 AVPA008；删除/修正“无效警报报表未实现”的过期描述；说明 8 种失效类型与 2 项 Non-goal 原因。
- [x] 5.2 在 `docs/MANUAL_ALIGNMENT.md` 或等价位置记录本需求的验收证据（8 种类型、必填时间区间、导出、旧库兼容）。
- [x] 5.3 提交并推送工作分支 `feat/b49c5010-p3al`，确认远程可见；提交信息按仓库惯例（`feat: 新增无效警报查询`），仅包含本次变更。
- [x] 5.4 复核 diff 无无关改动、无凭据/真实邮箱/临时文件；确认未修改 `artifacts/`。

## 6. 节点执行记录（代码编写节点，2026-11-26）

- 已提交：`5cf4fea feat: 新增无效警报查询`（已推送 `feat/b49c5010-p3al`，远程可见）。
- 编译：`cd backend && mvn -B -DskipTests test-compile` → BUILD SUCCESS。
- 后端单元测试：`mvn -B -Dtest='com.changxin.ams.unit.*Test' -DfailIfNoTests=false test` → 20/20 通过（`ReportConditionsTest` 新增 3 个 AVPA008 用例）。
- 前端单元测试：`npm run test:unit` → 9 文件 / 61 用例通过。
- 未执行（按节点范围仅要求单元测试）：集成测试 `mvn test`（含 `InvalidAlarmReportIntegrationTest`）、Java E2E、前端 E2E（4.6 / 4.8 的 E2E 部分及 4.7 中 E2E 文档）。
- 交付物：`代码实现交付物`（bundle，artifact `workflow-node-artifact-yf0chhq800w1oyrr9gj7`）。
