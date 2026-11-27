---
spec_id: AMS-DA-028-INVALID-ALARM-QUERY
title: AMS DA｜无效警报查询 技术设计
status: draft
template_id: knowledge/template/技术设计模板.md
schema_version: 1
linked_spec: 需求来源于 `AMS系统澄清.xlsx` 序号 28（业务需求 / 报表查询 / DA 迭代需求 / P2）；工作区内无独立 Spec/Gate 文件
baseline_design: 当前仓库 `DawnGuoDev/CX-AMS-1123@feat/b49c5010-p3al`（基线 release@7f7896c）
depends_on_designs: []
supersedes_designs: []
created_at: 2026-11-26
updated_at: 2026-11-26
---

# Design: AMS DA｜无效警报查询 技术设计

> Spec 回答 What/Why，Design 回答 How。
> 本工作区无独立 Spec/Gate 文件，需求正文来自任务输入（`AMS系统澄清.xlsx` 序号 28），并已通过人机交互确认 5 项关键设计决策（见 1.2）。
> 标识符（REQ/API/FIELD/STATE/MIG/NFR/DEP-xxx）在本设计内定义，后续任务与代码注释沿用。

---

# 1. 方案概述

本次为 AMS 新增「无效警报查询」（AVPA008）能力。核心思路是**在唯一的上游告警触发入口 `AlarmEngine.trigger()` 的每个业务失败分支上，写入一条无效警报记录**，再复用现有报表框架（`report_defs` 元数据 + `Reports.query` + `ReportPage.vue` + Excel 导出）提供按时间区间查询与导出。

- 不新增触发入口、不改状态机、不改通知/ACK/升级逻辑；成功分支行为完全不变。
- 失败分支的 HTTP 契约保持现状：仍返回 `422 {ok:false,status:422,message:<原因>}`，仅在返回前追加一次无效警报落库（同一 `store.write` 事务内，见 2.5）。
- 复用 H2 单行 `AMS_STATE(PAYLOAD)` JSON 快照，新增顶层集合 `invalid_alarms`；旧库通过**幂等 seed 迁移**补齐 `report_defs.AVPA008` 与 `functions.AVPA008`，不提升 `meta.schema`。

**知识库依据 / 来源**
| 结论 | 来源 |
| --- | --- |
| 无效警报定义：因主档缺失、忽略重复、机况过滤等未成功触发的警报，存入无效警报表供排查 | Context Search（空间 `AMS-poc`）`AMS 背景介绍和名词解释.md`，doc `tos_md_892684f19fa1f1b4539dd33e1a33783ab7b94b1a`，unit `..._content_00002` |
| 失效类型共 10 种：未设定厂别/子系统/机台/找不到事件/未设定发送方式/未设定层级1/未设定发送人员/警报设定未启用/忽略相同警报/在某机况下无需发送 | 同上，unit `..._content_00002` |
| 当前 MVP 明确未实现无效警报报表；BY PASS/机况/多通道已删除 | Context Search `07-AMS系统页面功能汇整.md`（doc `tos_md_5aa5f5e04f2d347df45b5421f31e761ede0e6a60`，unit `..._content_00005` §18）；仓库 `README.md`、`PAGE_MAP.md`、`knowledge/context/repo-profiles/DawnGuoDev_CX-AMS-1123.md` 的 `exclude_signals` |
| 报表共同行为：预定义列、查询弹窗草稿、服务端条件先筛+前端列过滤取交集、导出过滤后全部结果、未查询可导出表头 | Context Search `07-AMS系统页面功能汇整.md` unit `..._content_00004` §11 |
| 接口须沿用 `/api` 与 `ok` 结构，HTTP 状态与业务结果一致；新增状态/集合须同步评估报表、待确认、历史、UI | Context Search `01-编码规范.md`（doc `tos_md_ee22861eabe576a9ad446ea3fbaef794b095d544`）unit `..._content_00003` |
| 快照模型边界：时间秒级比较、缺失历史不得用当前时间补造、锁内禁止 SMTP/HTTP I/O | Context Search `05-数据库编码规范.md`（doc `tos_md_60cbd534cd832f185c5e22461250e89ec2069c55`） |
| 回归须覆盖：新库初始化、旧快照加载、非法 schema 拒绝、响应隔离 | 同上 |

> 说明：知识库文档所述“10 种失效类型”“允许报表代码仅 AVPA004/007/013”是**现状描述**，本次经用户确认后按 8 种落地并新增 AVPA008，需在代码与文档中同步更新该描述，避免文档与实现不一致。

## 1.1 影响范围

| 模块 / 层 | 文件或目录 | 改动说明 | 关联需求 |
|-----------|------------|----------|----------|
| 接口 | `backend/src/main/java/com/changxin/ams/ApiController.java` | `POST /api/reports/AVPA008/query\|export` 复用现有分支（无需新增路由）；无契约变更 | REQ-02, REQ-05 |
| 服务逻辑 | `backend/src/main/java/com/changxin/ams/AlarmEngine.java` | `trigger()` 增加 `recordInvalid(...)` 记录；`invalid(...)` 扩展为携带失效类型与上下文 | REQ-01 |
| 服务逻辑 | `backend/src/main/java/com/changxin/ams/Reports.java` | `definition()` 白名单加入 `AVPA008`；`query()` 增加 `invalid_alarms` 数据源与 AVPA008 必填时间区间校验 | REQ-02, REQ-03 |
| 数据模型 | `backend/src/main/resources/seed.json` | 新增 `invalid_alarms: []`、`meta.seq.invalid_alarms`、`report_defs` 的 AVPA008 定义、`functions` 的 AVPA008 菜单项 | REQ-02, REQ-04 |
| 存储 / 数据库 | `backend/src/main/java/com/changxin/ams/Store.java` | 启动时幂等迁移：缺失 `invalid_alarms` 集合/AVPA008 定义/菜单时补齐（不升 schema、不改历史） | REQ-04, MIG-01 |
| 外部依赖 | 无 | 不新增外部系统、中间件或网络调用 | — |
| 配置 | 无 | 不新增配置项、开关或阈值 | — |
| 前端 | `frontend/src/pages/Workspace.vue` | 路由分发列表加入 `AVPA008` | REQ-05 |
| 前端 | `frontend/src/components/AppSidebar.vue` | 「查询报表」分组 `codes` 加入 `AVPA008`，补图标映射 | REQ-05 |
| 前端 | `frontend/src/legacy-i18n.js` | 复用既有「无效警报查询/失效类型」词条，补新增列/条件/提示词条 | REQ-05 |

## 1.2 关键决策

| 决策点 | 选择 | 原因（含用户确认） |
|--------|------|-------------------|
| 失效类型范围 | 仅 8 种已具备判定条件的类型落库；另 2 种（未设定发送方式、在某机况下无需发送）作为 Non-goal | 用户确认选项 1；当前 MVP 无多通道与机况/BYPASS 能力（仓库 `README.md`、repo profile `exclude_signals`），强行枚举会产生永不出现的类型与虚假验收 |
| 记录范围 | 仅 `POST /api/alarms/test`（`AlarmEngine.trigger`） | 用户确认选项 2；当前系统无 Agent/gRPC/SQL 触发入口，避免设计无调用方的抽象 |
| 存储 | 同一 JSON 快照新增 `invalid_alarms` 集合 + 幂等 seed 迁移，不升 schema | 用户确认选项 3；沿用 `Store.key/store.write`，旧库可直接加载；升 schema 会强制新库，风险高 |
| 报表代码与条件 | `AVPA008`；时间区间必填；支持失效类型/厂别/子系统/机台/警报代码等条件；复用 query/export | 用户确认选项 4；`AVPA004/007/013` 已占用，08 未被占用；必填时间区间避免全量扫描 |
| 保留策略 | 全部保留、每次失败一条，不做去重 | 用户确认选项 5；符合“未成功触发的警报”排查语义；容量风险登记于第 5 节 |
| 失败响应契约 | 保持 `422 {ok:false,message}` 不变 | 现有前端 `act()`、`state.test.js`、后端集成测试依赖该契约；仅新增副作用不改变可见响应 |

---

# 2. 实现设计

## 2.1 文件清单

| 文件路径 | 新增/修改 | 职责 |
|----------|-----------|------|
| `backend/src/main/java/com/changxin/ams/AlarmEngine.java` | 修改 | 在 8 个失败分支记录无效警报；新增私有方法 `recordInvalid`、`failureType` 常量 |
| `backend/src/main/java/com/changxin/ams/Reports.java` | 修改 | 白名单加入 AVPA008；AVPA008 查询数据源、必填时间区间校验 |
| `backend/src/main/java/com/changxin/ams/Store.java` | 修改 | `migrateInvalidAlarmReport()`：幂等补齐集合/报表定义/菜单 |
| `backend/src/main/resources/seed.json` | 修改 | 新增 `invalid_alarms: []`、`meta.seq.invalid_alarms`、`REPORT_DEFS` 的 AVPA008、`functions` 的 AVPA008 |
| `frontend/src/pages/Workspace.vue` | 修改 | `['HOME','AVPA013','AVPA004','AVPA007','AVPA008']` |
| `frontend/src/components/AppSidebar.vue` | 修改 | 报表分组加入 `AVPA008`；`icons` 增加 `AVPA008: WarningOutlined` |
| `frontend/src/legacy-i18n.js` | 修改 | 复用已有词条，补“失效原因/失效类型/来源接口/无效警报查询”等缺失词条 |
| `backend/src/test/java/com/changxin/ams/InvalidAlarmReportIntegrationTest.java` | 新增 | 8 种失效类型落库、成功不落库、422 契约不变、时间区间必填、条件过滤、旧库迁移、导出 |
| `frontend/src/__tests__/legacy-i18n.test.js` | 修改 | 断言新增词条覆盖（与现有 i18n 测试风格一致） |
| `e2e/frontend/support/ams.js` | 修改 | `MENU` 增加 `invalidAlarms` 导航项 |
| `e2e/frontend/0X-invalid-alarms.spec.ts` | 新增 | 导航进 AVPA008、时间区间必填提示、查询结果与导出入口 |
| `docs/e2e/backend-api-e2e.md` / `docs/e2e/frontend-e2e.md` / `docs/e2e/unit-tests.md` | 修改 | 补充用例 ID 与预期（与现有文档风格一致） |
| `README.md`、`PAGE_MAP.md`、`docs/JAVA_VUE_MIGRATION.md` | 修改 | 更新报表清单与“无效警报报表未实现”的描述 |

> 说明：上述 docs/e2e 与 README 的更新属于“让文档与代码一致”，不涉及新框架或抽象；具体改动在编码节点按任务清单执行。

## 2.2 数据模型

新增集合 `invalid_alarms`（JSON 数组，位于 `AMS_STATE.PAYLOAD` 顶层）：

| 对象 / 表 | 字段 | 类型 | 说明 | 关联 FIELD |
|-----------|------|------|------|------------|
| `invalid_alarms` | `INVALID_KEY` | String | 主键，由 `store.key("invalid_alarms")` 生成，格式 `invalid_alarms-000001` | FIELD-01 |
| | `INVALID_ID` | String | 展示用识别码，格式 `IVD-YYYYMMDD-000001`（日期取 `CREATE_DT` 的 UTC 日期） | FIELD-02 |
| | `CREATE_DT` | String（ISO-8601 UTC） | 失效发生时间（记录时刻） | FIELD-03 |
| | `FAILURE_TYPE` | String（枚举） | 失效类型代码，见下表 | FIELD-04 |
| | `FAILURE_REASON` | String | 失效原因说明，与 HTTP `message` 一致（如“未设定厂别”） | FIELD-05 |
| | `FACTORY_KEY` / `FACTORY_ID` / `FACTORY_NAME` | String | 请求中的厂别；主档存在时补代码/名称，不存在时 `_KEY` 有值、`_ID/_NAME` 为空串 | FIELD-06 |
| | `SUB_SYS_KEY` / `SUB_SYS_ID` / `SUB_SYS_NAME` | String | 同上 | FIELD-07 |
| | `EQP_KEY` / `EQP_ID` / `EQP_NAME` | String | 同上 | FIELD-08 |
| | `ALARM_INFO_ID` | String | 请求中的警报代码（原始值） | FIELD-09 |
| | `ALARM_INFO_KEY` | String | 匹配到的警报设定 key；未匹配时为空串 | FIELD-10 |
| | `EVENT_KEY` / `EVENT_ID` / `EVENT_NAME` | String | 匹配到的事件；未匹配时为空串 | FIELD-11 |
| | `TITLE` | String | 请求标题，空时与 `create()` 一致使用 `Empty Subject` | FIELD-12 |
| | `CONTENT` | String | 请求内容，空时与 `create()` 一致使用 `Empty Content` | FIELD-13 |
| | `SOURCE` | String | 固定 `TEST_API`（`POST /api/alarms/test`） | FIELD-14 |
| | `SOURCE_USER_ID` | String | 触发请求的操作者 `USER_ID`（会话用户） | FIELD-15 |
| | `DUPLICATE_ALARM_KEY` | String | 仅 `忽略相同警报` 时有值：命中的在窗告警 `ALARM_KEY`，便于跳转详情复盘 | FIELD-16 |

**`FAILURE_TYPE` 枚举（STATE-01，8 种）**

| 代码 | 中文原因 | 当前判定位置的唯一性 |
| ---- | -------- | -------------------- |
| `NO_FACTORY` | 未设定厂别 | 厂别不存在或未启用 |
| `NO_SUBSYS` | 未设定子系统 | 子系统不存在/未启用，或厂别-子系统未对应 |
| `NO_EQP` | 未设定机台 | 机台不存在或未启用 |
| `EVENT_NOT_FOUND` | 找不到事件 | 四要素无匹配设定；或设定指向的事件不存在/未启用 |
| `SETTING_DISABLED` | 警报设定未启用 | 匹配到的设定被隐藏 |
| `NO_LEVEL1` | 未设定层级1 | 事件无启用层级 1 |
| `NO_RECIPIENTS` | 未设定发送人员 | 层级 1 无启用且有邮箱的人员 |
| `DUPLICATE_IGNORED` | 忽略相同警报 | 忽略窗口内命中同一四要素告警 |

> `EVENT_NOT_FOUND` 同时覆盖“找不到事件”和“事件未启用”，因为二者在同一分支且用户可见原因相同；**不新增第 9 种类型**，保持与当前 8 个判定分支一一对应（避免“设定存在但事件未启用”与“无设定”混淆时多出一个永不单独出现的类型）。

**Non-goal 类型（不落库）**：`未设定发送方式`（无多通道能力）、`在某机况下无需发送`（无 BYPASS/机况能力）。设计文档与页面说明需注明“当前版本不产生这两类记录”。

## 2.3 数据库变更

**不新增 SQL 表、不改 DDL。** 变更全部落在 `AMS_STATE(PAYLOAD)` 的 JSON 内，以下为逻辑等价变更描述与回滚方式：

```sql
-- 变更（逻辑等价，实际由 Store 启动迁移 + store.key 维护）
-- 1) 新集合：AMS_STATE.PAYLOAD.invalid_alarms = []
-- 2) 序号：AMS_STATE.PAYLOAD.meta.seq.invalid_alarms = 0
-- 3) 报表定义：PAYLOAD.report_defs 追加 AVPA008（不存在时）
-- 4) 菜单：PAYLOAD.functions 追加 AVPA008（不存在时）

-- 回滚（逻辑等价；不破坏告警/通知/ACK/交易数据）
-- 1) 删除 PAYLOAD.report_defs 中 REPORT_ID='AVPA008' 的条目
-- 2) 删除 PAYLOAD.functions 中 FUNCTION_KEY='AVPA008' 的条目
-- 3) 视需要删除 PAYLOAD.invalid_alarms 与 meta.seq.invalid_alarms
```

**兼容策略**
- `meta.schema` 保持 `checked-mvp-1`：旧库（无 `invalid_alarms`）启动时由 `Store` 幂等补齐；新库由 `seed.json` 直接提供。
- 迁移仅“追加缺失项”，不重写已有 `report_defs`/`functions` 条目，不触碰 `alarms`/`alarm_transactions`。
- `Store.table(name)` 使用 `computeIfAbsent`，即使遗漏迁移也不会 NPE；迁移的价值是让菜单/报表定义在旧库上可见。

**数据影响 / 灰度 / 验证**
- 数据影响：仅新增记录；历史告警、交易快照、通知、ACK 不变。
- 灰度：单实例应用，随代码发布生效；无需停服数据迁移。
- 验证：用旧库副本启动，确认 `/api/bootstrap.nav` 含 AVPA008、`/api/report-defs/AVPA008` 返回定义、既有 AVPA004/007/013 定义不变。

## 2.4 接口变更

| 接口 | 类型 | 请求变化 | 响应变化 | 兼容性 |
|------|------|----------|----------|--------|
| `POST /api/alarms/test` | 修改（副作用） | 无 | 无（成功 `{ok:true,...}`；失败仍 `422 {ok:false,message}`） | 完全向后兼容；仅新增落库副作用 |
| `GET /api/report-defs/AVPA008` | 新增（复用现有路由） | 无 | `{ok:true,row:{REPORT_ID,REPORT_NAME,REPORT_DESC,ATLEAST_ONE_CONDITION,COLUMNS,CONDITIONS}}` | 新增报表代码；原 3 个代码行为不变 |
| `POST /api/reports/AVPA008/query` | 新增（复用现有路由） | `{conditions:{...}}`，`CREATE_DT` 必须启用且有区间 | `{ok:true,rows,columns,total,lastUpdate}`；条件未满足时 `400 {ok:false,message:"无效警报查询必须指定时间区间"}` | 新增；不影响既有报表 |
| `POST /api/reports/AVPA008/export` | 新增（复用现有路由） | `{rows:[...]}`，可带 `conditions` | `{ok:true,filename,base64}`；仅写出声明列 | 新增；沿用 Excel 导出实现 |

**API-01 查询契约细则**
- `conditions` 键必须属于 `COLUMNS/CONDITIONS` 声明字段，否则 `400 查询字段无效`（沿用 `Reports.query` 现有校验）。
- `CREATE_DT` 必填判定：`enabled=true` 且 `value`/`from`/`to` 至少一个非空；操作符建议 `between`，允许单侧边界（沿用 `matches()` 现有语义）。
- 结果按 `CREATE_DT` 倒序，与 AVPA004/007 一致。

## 2.5 核心流程

**A. 触发失败落库（REQ-01）**

1. `ApiController.mutate("alarms/test")` → `engine.trigger(body,user)`，整个调用已在 `store.write(work)` 的写事务内（`ApiController.api`）。
2. `trigger()` 按既有顺序校验：厂别 → 子系统与厂别对应 → 机台 → 警报设定（精确机台优先，再 `*`；具体机台设定被隐藏时**不回退通配**，保持现状）→ 事件 → 忽略窗口 → 层级1 → 发送人员。
3. 每个失败分支调用 `return invalid(body, user, "NO_FACTORY", "未设定厂别")`：
   - `invalid()` 先调用 `recordInvalid(...)` 写入 `invalid_alarms`（`store.table("invalid_alarms").addFirst(...)`，`INVALID_KEY=store.key("invalid_alarms")`，`CREATE_DT=now()`）。
   - 再返回原 `m("ok",false,"status",422,"message",reason)`。
4. 成功分支 `create(...)`/`startLevel(...)` **不写** `invalid_alarms`。
5. 任一步抛出 `ApiException`（如 JSON 解析）时，`Store.write` 回滚整份快照，不产生半条记录——与“失败不能留下不一致状态”的规范一致。

**B. 忽略相同警报（REQ-01，`DUPLICATE_IGNORED`）**

1. 现有查重条件保持完全不变：`FACTORY_KEY && SUB_SYS_KEY && EQP_KEY && ALARM_INFO_KEY == 匹配设定 key && now-CREATE_DT < IGNORE_PERIOD*1000`，且不限于 `Process`。
2. 命中时把命中的 `ALARM_KEY` 写入 `DUPLICATE_ALARM_KEY`，`FAILURE_REASON` 固定“忽略相同警报”。
3. 记录本身**不参与**后续查重（只查 `alarms`），避免自我抑制；该行为在测试中显式断言。

**C. 无效警报查询（REQ-02、REQ-03、REQ-05）**

1. `GET /api/report-defs/AVPA008` → `Reports.definition("AVPA008")`：白名单放行，返回 `seed.json` 定义；`definition()` 中针对 AVPA004/007 的列增强逻辑**不适用于 AVPA008**（保持定义原样）。
2. `POST /api/reports/AVPA008/query`：
   - `requireTimeRange(conditions)`：`CREATE_DT` 启用且至少一个时间边界；否则 `ApiException(400, "无效警报查询必须指定时间区间")`。
   - 数据源 = `store.table("invalid_alarms")` 深拷贝（不 enrich 当前主档，避免历史名称被当前主档覆盖；名称在记录时冻结）。
   - 用 `matches()` 逐条件过滤，按 `CREATE_DT` 倒序。
3. 前端 `ReportPage.vue` 复用：`isSummary=false`，首次显示“请执行查询”，查询弹窗展示 `CONDITIONS`，导出调用 `/reports/AVPA008/export` 提交表格过滤后行。
4. 时间区间的默认值：前端进入页面时 `CREATE_DT` 默认“近 24 小时”（`from=now-24h,to=now`，`enabled=true`），减少必填摩擦；用户可改。

**D. 旧库迁移（REQ-04、MIG-01）**

1. `Store` 启动加载 `seed.json` 或已持久化数据后，调用 `migrateInvalidAlarmReport()`（仅在 `Store` 构造/初始化末尾，持久化前）。
2. 若 `data` 中无 `invalid_alarms` → 置为 `new ArrayList<>()`；若 `meta.seq` 无该键 → 置 0。
3. 若 `report_defs` 无 `REPORT_ID=AVPA008` → 从 `seed.json` 的 AVPA008 定义复制追加。
4. 若 `functions` 无 `FUNCTION_KEY=AVPA008` → 追加菜单项（`PARENT_KEY=null`、`FUNC_TYPE=PAGE`、`PATH=#/page/AVPA008`、`VISIBLE=Y`、`ACTIVE=Y`），`SORT=12` 置于现有菜单末尾。**不改动既有菜单项的 SORT**（`AVPA007=9`、`TEST=10`、`ACK_LIST=11` 保持不变），避免影响既有 E2E 导航断言。
5. 迁移后 `persist()`，下次启动幂等跳过。

## 2.6 状态变化

不涉及告警状态机变更。仅新增一个**只写不改**的记录集合（`invalid_alarms` 无状态字段、无更新/删除接口）。

| 操作 | 前置状态 | 目标状态 | 说明 |
|------|----------|----------|------|
| 触发失败（8 分支） | 无记录 | `invalid_alarms` 新增 1 条 | 与告警状态无关，告警未创建 |
| 触发成功 | — | — | 不写 `invalid_alarms` |
| 查询/导出 | — | — | 只读 `store.read`（GET/query 走 read；export 为 POST 但仅写响应，不落库） |

> 注意：`export` 是 POST，`ApiController` 会走 `store.write(work)`，但 `reports.query/export` 不修改 `data`，`Store.write` 内 `if (!data.equals(before)) persist()` 不会触发持久化，行为与现有报表一致。

## 2.7 异步处理

无新增异步任务、事件或调度。`EngineScheduler` 行为不变。

## 2.8 外部依赖

无新增或变更外部依赖。不涉及 SMTP（失败记录发生在 SMTP 之前）。

## 2.9 配置

无新增配置项。沿用既有 `IGNORE_PERIOD`（默认 900 秒）语义，仅用于判定 `DUPLICATE_IGNORED`，不改默认值。

---

# 3. 兼容性与迁移

| 影响对象 | 兼容策略 | 迁移步骤 |
|----------|----------|----------|
| 现有 H2 快照（`checked-mvp-1`） | 不升 schema；启动幂等补齐 `invalid_alarms`/AVPA008 定义/菜单 | 部署新版本 → 首次启动自动迁移 → 校验 `/api/bootstrap.nav` 与 `/api/report-defs/AVPA008` |
| `POST /api/alarms/test` 调用方（前端、E2E、后端集成测试） | 响应结构与状态码不变 | 无需改动调用方；新增断言只需关注 `invalid_alarms` 数量 |
| 既有报表 AVPA004/007/013 | `Reports.definition()` 白名单扩展不改变其余分支；`query()` 仅在 `AVPA008` 走新数据源与时间区间校验 | 回归三张报表查询/导出 |
| 前端导航与路由 | 新增菜单项与路由白名单；`AppSidebar` 分组 `codes` 决定归属 | 回归侧栏搜索、折叠、当前路由高亮 |
| 历史数据/交易快照 | 不修改 `alarm_transactions`，无效警报不进入历史交易 | 无 |
| 旧 Node 版数据 | 仍按现状拒绝（schema 校验不变） | 无 |
| Excel 导出 | 新报表仅写声明列，不影响既有模板/导入 | 无 |

**兼容性风险点**：菜单 `SORT` 冲突。设计采用 `AVPA008 SORT=12`（末尾），避免改动 `TEST(10)`、`ACK_LIST(11)` 的既有顺序与 E2E 断言。

---

# 4. 上线与回滚

| 步骤 | 动作 | 备注 |
|------|------|------|
| 1 | 合并并发布代码 | `scripts/build-java-vue.sh`（先前端构建，再 `mvn -Pweb`） |
| 2 | 执行必要的数据或配置变更 | 无手写 SQL；首次启动自动幂等迁移 |
| 3 | 观察核心指标和日志 | 关注：`invalid_alarms` 增长量、`/api/reports/AVPA008/query` 耗时、422 响应量、快照文件大小、GC 与写入延迟 |

**回滚预案**
- 代码回滚到上一版本即可停止写入与菜单展示；`invalid_alarms` 集合保留但不被读取，不影响告警/通知/ACK。
- 如需彻底清理：备份数据库文件后删除 `report_defs.AVPA008`、`functions.AVPA008`、`invalid_alarms` 与 `meta.seq.invalid_alarms`（见 2.3 逻辑 SQL）。
- 回滚不需要重建数据库，不需要停服迁移。

---

# 5. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 全部保留导致快照膨胀 | H2 单行 JSON 随记录增长，`persist()` 全量写入变慢；重复告警风暴会放大 | 文档标注容量风险；监控 `invalid_alarms` 条目数与数据库文件大小；后续可单独立项“归档/保留期”，本期不做 |
| 重复告警风暴 | 忽略窗口内每次失败都记一条，可能短时间大量写入 | 与业务语义一致（排查需要）；监控写入速率；`DUPLICATE_ALARM_KEY` 便于聚合复盘 |
| 失败记录与告警建单的事务边界 | 若未来有人在 `store.write` 之外调用 `recordInvalid`，可能产生半条或重复 | 设计限定只在 `trigger()` 内调用；测试断言失败后 `alarms` 数量不变、`invalid_alarms` 恰好 +1 |
| 8 种 vs 知识库 10 种 | 验收方若按 10 种验收会认为缺失 | 设计文档、页面说明、README 明确 Non-goal 及原因（能力已移除），并保留后续扩展点（新增枚举值即可） |
| 事件未启用与找不到事件合并为 `EVENT_NOT_FOUND` | 排查时无法区分两种细分原因 | `FAILURE_REASON` 保留原始提示（“找不到事件”），必要时后续拆分为独立类型；本期按 1:1 分支映射 |
| 菜单 SORT 冲突 | 若实现时改动既有 SORT，可能导致 E2E 导航断言失败 | 明确 AVPA008 取 SORT=12，不改既有项 |
| 前端时间默认值 | “近 24 小时”可能让用户误以为全量 | 页面提示“默认近 24 小时，可调整”；查询条件弹窗显示区间 |
| 新增报表代码未同步文档 | 文档仍写“仅 3 张报表/未实现无效警报报表” | 任务清单包含 README/PAGE_MAP/JAVA_VUE_MIGRATION/知识库描述更新 |
| PII / 敏感信息 | `TITLE`/`CONTENT` 可能含设备或人员信息 | 沿用既有报表可见范围（登录后全量可见，无 RBAC）；不新增外发渠道；导出沿用现有 Excel 流程 |
| 单实例假设 | 多副本部署下内存会话与本地快照冲突（既有问题） | 本设计不引入新并发写入点；记录写入仍在 `Store.write` 全局锁内 |

---

# 6. 测试要点

| 场景 | 方法 | 关联 REQ |
|------|------|----------|
| 8 种失效类型逐一落库 | `InvalidAlarmReportIntegrationTest`：构造对应主档/设定缺失，调用 `POST /api/alarms/test`，断言 422 message 与 `invalid_alarms` 记录 `FAILURE_TYPE`/`FAILURE_REASON` | REQ-01 |
| 成功触发不落库 | 正常四要素触发 → 201/200 成功，`invalid_alarms` 数量不变 | REQ-01 |
| 忽略相同警报 | 两次相同四要素（窗口内）→ 第二次 422，记录 `DUPLICATE_IGNORED` 且 `DUPLICATE_ALARM_KEY` 指向首条 `ALARM_KEY`；记录本身不触发新抑制 | REQ-01 |
| 失败不产生告警/通知/交易 | 失败后断言 `alarms`、`alarm_notifications`、`alarm_transactions` 数量不变 | REQ-01 |
| 时间区间必填 | `POST /api/reports/AVPA008/query` 无 `CREATE_DT` 或未启用 → 400 `无效警报查询必须指定时间区间` | REQ-02 |
| 时间边界 | 区间外/边界秒/单侧边界 | REQ-02 |
| 条件过滤组合 | 失效类型 + 厂别 + 子系统 + 机台 + 警报代码 交集；非法字段 → 400 | REQ-02 |
| 排序 | 结果按 `CREATE_DT` 倒序 | REQ-02 |
| 导出 | 导出过滤后全部行，表头与声明列一致；空结果仅表头 | REQ-03 |
| 旧库迁移 | 用无 AVPA008 的旧快照启动 → 自动补齐集合/定义/菜单；二次启动不重复追加；既有报表定义不变 | REQ-04、MIG-01 |
| 新库初始化 | 新库启动 → `invalid_alarms` 为空、菜单含 AVPA008 | REQ-04 |
| 前端导航/路由 | Playwright：侧栏「查询报表」可见“无效警报查询”，进入页面显示“请执行查询”，查询后表格渲染，导出可下载 | REQ-05 |
| i18n | 简体/繁体/English 下新增词条不回落原文（与 `legacy-i18n.test.js` 风格一致） | REQ-05 |
| 回归 | `mvn test`、`npm run test:unit`、既有 AVPA004/007/013 查询导出、`POST /api/alarms/test` 成功路径 | 全部 |
| 响应契约 | 失败响应仍为 HTTP 422 且 `{ok:false,message}`，前端 `act()` 提示不变 | REQ-01 |

**验证命令（编码节点执行并记录）**
```bash
cd backend && mvn test
cd frontend && npm run test:unit
bash scripts/run-java-e2e.sh
bash scripts/run-frontend-e2e.sh
```

---

# 7. 待确认项

| 编号 | 事项 | 默认处理 |
|------|------|----------|
| TBD-01 | 知识库 `07-AMS系统页面功能汇整.md` §11 仍写“允许报表代码仅 AVPA004/007/013”“无效警报报表未实现” | 编码节点同步更新该知识条目（属知识回灌，非本仓代码）；若不允许改知识库，至少更新 README/PAGE_MAP |
| TBD-02 | 旧系统/手册是否有指定报表编号（非 AVPA008） | 按用户确认 AVPA008；若后续提供旧编号，仅改 `seed.json` 的 `REPORT_ID` 与白名单，不影响数据模型 |
| TBD-03 | 是否需要把 `EVENT_NOT_FOUND` 拆为“找不到事件/事件未启用” | 本期合并，`FAILURE_REASON` 保留原文；后续按需扩展枚举 |
