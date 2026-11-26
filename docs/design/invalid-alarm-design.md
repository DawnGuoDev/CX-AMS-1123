# 无效警报查询（AVPA014）技术设计

> 需求来源：AMS系统澄清.xlsx 序号 28｜分类：业务需求｜模块：报表查询｜需求类型：DA 迭代需求｜优先级：P2
> 需求原文：查询时间区间内未成功产生的警报及失效原因
> 本文档路径：`docs/design/invalid-alarm-design.md`（仓库 `DawnGuoDev/CX-AMS-1123`，分支 `feat/9a3c782a-5s1l`）
> 适用技术域：backend + frontend（同仓 Java 21 / Spring Boot 3.5.7 + Vue 3 / Ant Design Vue 4.2.6）

---

## 0. 事实与证据边界

### 0.1 引用的上游产物

| 类型 | 位置 | 状态 |
| --- | --- | --- |
| Requirements | 用户 Turn 原文（序号 28，一行描述） | 仅有标题 + 一句话，无验收标准 |
| Spec / Gate / PRD | `artifacts/_manifest.json` → `items: []` | **不存在**：上一节点（产品设计）未产出任何产物 |
| 代码库 | `repos/DawnGuoDev_CX-AMS-1123`（`README.md` / `PAGE_MAP.md` / `docs/*` / `backend/src` / `frontend/src` / `e2e/*`） | 已完整阅读（含 `AlarmEngine`、`Reports`、`Store`、`ApiController`、`Masters`、`ReportPage.vue`、`AppSidebar.vue`、`seed.json` 与既有测试） |
| 知识库 | Context Search space `AMS-poc`（`nwd6eqibk-diztqogvun`） | 已查询，见 0.2 |

**影响**：无 Spec/Gate 意味着没有 EARS 行为条目与反例可供追溯。本设计以「仓库现状 + 知识库名词定义 + 需求原文」为最低事实基线，所有需求原文未覆盖的点均列入 §9 待确认项，而不是自行编造验收标准。**建议**：产品设计节点补齐 Spec 后，本文件 §4 行为定义与其对齐。

### 0.2 知识库依据（Context Search：space `AMS-poc`）

| # | 依据（文档 / 块） | 结论 | 对本设计的作用 |
| --- | --- | --- | --- |
| K1 | `AMS 背景介绍和名词解释（系统项目背景）.md` unit `..._content_00002` | 「无效警报：因主档缺失、忽略重复、机况过滤等原因未成功触发的警报，**存入无效警报表供排查**」 | 领域定义：需要持久化"无效警报表"，而非仅返回提示 |
| K1 | 同上 | 「无效警报查询：报表之一……**含 10 种失效类型**」 | 失效类型是受控枚举，共 10 种 |
| K1 | 同上 | 10 种失效类型：未设定厂别 / 子系统 / 机台 / 找不到事件 / 未设定发送方式 / 未设定层级1 / 未设定发送人员 / 警报设定未启用 / 忽略相同警报 / 在某机况下无需发送 | 枚举基线（见 §3.3 与本仓现状的差异） |
| K1 | 同上 | 「LogOnly：纯记录，不发送警报通知」「NoNotify：警报状态之一：**无效警报**」 | 无效 ≠ LogOnly（BYPASS 不算无效） |
| K2 | `07-AMS系统页面功能汇整.md` §11 报表共同行为 | 报表统一交互：初次「请执行查询」、条件弹窗独立草稿、文本/日期运算符、日期精确到秒、服务端筛选后前端列过滤取交集、导出为画面结果且空结果仅表头 | 新报表必须复用该交互，不另起一套 |
| K2 | 同上 §11 | 「后端允许的报表代码只有 AVPA004、AVPA007 和 AVPA013」 | 现状白名单，需扩为 4 个 |
| K2 | 同上 §18 **当前未实现的功能** | 「……独立强制中断和**无效警报报表**」 | 本需求正是把该"未实现"项落地 |
| K3 | `01-编码规范.md` §2/§5/§7 | 接口层保持薄、状态变更/查重/履历在同一受保护写操作内、沿用 `/api` + `ok` 包络、异常分级、日志参数化且不记录敏感字段 | 落地约束 |
| K3 | 同上 §6 契约 | 「重复抑制按厂别、子系统、实际机台、**选中配置 key** 及创建时间窗口判断，不限于 Process」；「BYPASS 生成 LogOnly 记录」 | 失效判定必须与 `AlarmEngine.trigger` 保持**同一顺序与同一口径**。已核实代码（L130-133）查重确实**不按 STATUS 过滤** |
| K4 | `04-常见错误案例库.md` E02 / E03 / E05 | 锁内查重；具体机台配置隐藏后不回退通配；秒/分单位不得混用 | 防止把无效统计做成"看似正确"的近似 |
| K5 | `05-数据库编码规范.md` §1/§8 | 数据落在 H2 `AMS_STATE` 单行 JSON 快照，集合是逻辑集合；历史/审计与配置履历用途不同 | 新集合 `invalid_alarms` 直接进快照，无需 DDL |
| K6 | `06-当前实现架构与AWS核实说明.md` §6 | 单实例、无 MQ/Redis；重启由 H2 决定 | 无效记录持久化口径 |
| K7 | 本仓 `README.md` L24 / `docs/MANUAL_ALIGNMENT.md` L12 | 迁移时**已删除**旧 Node 版无效告警报表与相关代码 | 本次是"重新引入"，需与旧实现解耦、按当前引擎重写 |

### 0.3 需求原文未覆盖、需要决策的点（已检索知识库仍无答案 → 待确认，见 §9）

> 另：本次已核实 `artifacts/` 为空、`backend/data/` 无既有库，故「无效数据从何而来」「升级路径」两项均无现成证据，统一按 0.3 编号 5/§6.1 处理，不臆断。

1. **报表代码**：需求只写"无效警报查询"，未给页面代码。本设计**暂定 `AVPA014`**（沿用 AVMA/AVPA 命名族，避开已用的 004/007/013）。
2. **是否包含「未设定发送方式」**：K1 的 10 种类型包含它，但本仓 README 明确"不提供短信/语音/IM 通道"，告警通知渠道固定 Email，`AlarmEngine.trigger` 当前**没有**该判定分支。
3. **「在某机况下无需发送」**：本仓迁移时已删除机况/机型/Chamber/自动切机况代码（README L24、知识库 K7），当前引擎无该判定。
4. **未列入 K1 十种类型但现状代码会产生的情况**：「找不到事件」在 `event` 不存在**或已隐藏**两种情况下都会出现；另外本仓删除 BYPASS 后 `subsystems` 无 BYPASS 字段。
5. **记录时点**：无效判定发生在调用方（外部 Agent / 测试触发）；是否只记录本系统内触发的无效，未说明。
6. **保留期**：无。

以上 6 点均已在 §9 用「保守默认值 + 影响」写明，可执行不被阻塞。

---

## 1. 目标与非目标

### 1.1 目标（可追溯需求原文）

- G1：提供报表页面，按**查询时间区间**查询"未成功产生的警报"。（需求原文）
- G2：查询结果必须能看清**失效原因**。（需求原文）
- G3：失效原因取受控分类，与引擎实际判定一一对应，可比对、可统计。（K1 推论）

### 1.2 非目标（明确不做，避免范围蔓延）

- 不新增/改造 `alarm_settings`、`event_levels` 等配置写入校验：无效是"触发时的运行态事实"，不是"配置保存时的校验错误"。
- 不恢复已被删除的 BYPASS / 机况 / Chamber / 机台群组回退 / 多通道（Email 以外）能力。若确需其中某项类型，必须先有独立需求（§9）。
- 不提供无效记录的"重试补发/转正式告警"操作：需求只要求查询。
- 不改动 AVPA004 / AVPA007 / AVPA013 的输出契约。
- 不为无效报表做客户端分页（沿用现状：服务端返回全量，前端分页/过滤）。

---

## 2. 现状分析（影响面）

### 2.1 调用链路（现状）

```
前端 ReportPage.vue ──POST /api/reports/AVPA004|007|013/query──> ApiController.mutate
                                                          └─> Reports.query(code, conditions)
                                                                ├─ Reports.definition(code)  // 白名单 3 个
                                                                └─ 数据源：alarms / alarm_transactions
前端 TEST / DeviceSimulator ──POST /api/alarms/test──> ApiController.mutate ──> AlarmEngine.trigger
                                                          └─ 8 处 `return invalid(body, "…")`  → {ok:false,status:422,message}
```

- `AlarmEngine.invalid(...)`（`AlarmEngine.java:108`，全文 **9 处**调用：L113/116/118/124/125/127/133/135/136）**只构造响应**，不落任何记录 → 现状"未成功产生的警报"**不可查**，这是需求缺口根因。
- ``Reports.definition` 的报表白名单硬编码 3 个（`Reports.java:13`）；`ApiController` 对 `AVPA013` 有专门分支，其余报表走通用路径。
- **既有测试把 `AVPA005` / `AVPA008` 锁死为"不存在"**：`WorkflowIntegrationTest#checkedPagesWorkAndRemovedApisReturn404` 断言 `report-defs/AVPA005`、`report-defs/AVPA008` 返回 404，`#authenticationSingleSessionAndNoPasswordDisclosure` 断言 bootstrap 响应不含 `AVPA005`。→ 新报表**不得**复用这两个代码（见 R8）。
- 菜单来自种子 `functions` 表（`seed.json` → 12 条），前端侧栏按**硬编码分组**（`AppSidebar.vue` 的 `groups[].codes`）+ 图标映射 `icons` 渲染；未列入分组的会落到「其他功能」。→ 新增页面需同时补 `functions` 种子行与前端 `groups`/`icons`，否则菜单会出现在错误分组。
- 前端 `Workspace.vue` 用白名单 `['HOME','AVPA013','AVPA004','AVPA007']` 决定走 `ReportPage` → 需追加。
- i18n：`frontend/src/legacy-i18n.js` **已预置** `'无效警报查询'`（L57）、`'无效警报识别码'`（L350）、`'失效类型'`（L351）、`'查询未成功触发的警报与失效原因。'`（L632），说明该页面在旧版存在过、词典被保留。**未预置**：`'失效原因'`、`'触发账号'`、`'判定时间'`（已逐个 `grep -c` 核实为 0）→ 需补。

### 2.1.1 新装环境的可测试性（已核实）

`backend/src/main/resources/seed.json` 中 `alarms` / `alarm_transactions` / `alarm_levels` / `alarm_notifications` / `alarm_acks` **均为空数组**（0 条），只有 `alarm_settings` 8 条配置（如 `F01/SS03/EQP01/PRT_NODYE`）。

结论：
- 新装环境**没有任何历史无效警报**，报表必然为空 → 所有测试（单测/集成/E2E）都必须**现场制造**无效记录（触发一个缺配置的四要素，或对已成功触发的四要素在忽略窗口内再触发一次）；
- 这也印证 §5.2 的 E2E 步骤必须自造数据，不能依赖种子；
- 种子里的 8 条 `alarm_settings` 可作为"首次成功 + 二次忽略"的最小构造素材（`F01/SS03/EQP01/PRT_NODYE` 有层级与人员，可成功建单）。

### 2.2 数据模型现状

| 逻辑集合 | 关键字段 | 用途 |
| --- | --- | --- |
| `alarms` | `ALARM_KEY` / `ALARM_ID` / `STATUS` / `FACTORY_KEY` / `SUB_SYS_KEY` / `EQP_KEY` / `ALARM_INFO_KEY` / `CREATE_DT` | 正式告警 |
| `alarm_transactions` | `TRX_KEY` / `ALARM_KEY` / `TRX_TYPE` / `SNAPSHOT` | 告警履历 |
| `report_defs` | `REPORT_ID` / `REPORT_NAME` / `ATLEAST_ONE_CONDITION` / `COLUMNS` / `CONDITIONS` | 报表定义（逐行 JSON） |
| `meta.seq` | `{table}: int` | `Store.key()` 序列来源；**新增表必须登记序列**，否则 `key()` 取 0 起 |

写入一致性：`ApiController` 对 POST/PUT 统一包 `store.write(...)`（深拷贝快照 → 业务 → 持久化 → 异常回滚），`AlarmEngine.trigger` 的匹配 + 查重 + 建单同处一个写事务（知识库 E02）。因此**在同一路由分支内追加"写无效记录"即可获得原子性**，无需额外锁。

### 2.3 技术栈与约定

| 项 | 现状约定 |
| --- | --- |
| 后端 | Java 21、Spring Boot 3.5.7、Spring JDBC + H2、Apache POI；文件按职责分 `ApiController`/`AlarmEngine`/`Reports`/`Store`/`Excel`/`Masters` |
| 响应包络 | 成功 `{ok:true,…}`；业务失败 `{ok:false,status,message}`；`ApiException(status,msg)` |
| 前端 | Vue 3 `<script setup>` + Ant Design Vue 4 按需导入；`api()/act()/t()/download()` 来自 `state.js`；报表统一 `ReportPage.vue` |
| 测试 | 后端 `mvn test`（unit/* + *IntegrationTest，MockMvc）；接口 E2E 需 `ams.e2e.enabled=true`；前端 Vitest；前端 E2E Playwright（`e2e/frontend/*.spec.ts`） |
| 文本用例 | `docs/e2e/backend-api-e2e.md`、`docs/e2e/frontend-e2e.md`（ID 与测试名一一对应） |

---

## 3. 技术方案

### 3.1 总体设计

```
AlarmEngine.trigger(body)
  ├─(existing) 四要素与配置校验，逐条命中失效条件
  │                 └─ 每个失效分支： invalid(body, TYPE)  ──> ①写 invalid_alarms（同一写事务）──> ②返回 {ok:false,status:422,message}
  └─ 成功：建立 Alarm（不写 invalid_alarms）

Reports.definition("AVPA014") → 新报表定义（服务端内置，见 3.4）
Reports.query("AVPA014", conditions) → 无效记录 + 四要素名称补充 → 条件过滤 → 按时间倒序
ApiController → 复用既有 /api/reports/:code/{query,export}（无需新接口）
ReportPage.vue → 无改动即可工作（定义由后端下发；仅需白名单 2 处 + 菜单）
```

设计取舍：
- **不改响应契约**：`POST /api/alarms/test` 仍返回 422 + 原 message（现有 E2E `04-alarm-workflow` / `TC-API-E2E-003` 依赖 message 文案），只是"副作用变多了一条可查记录"。
- **新增 `InvalidAlarms` 服务类**而非把逻辑塞进 `Reports`：写入发生在引擎路径、查询发生在报表路径，二者唯一共享的是集合名与失效类型常量；抽一个薄服务避免 `Reports` 反向依赖引擎（编码规范 §2 依赖方向）。
- **报表定义走代码常量**（`Reports.definition` 内置），与现有 `report_defs` 种子并存的两种做法二选一：选内置，因为 `definition()` 已对 AVPA004 做过列追加（代码里补列的先例），且避免依赖"已有库的种子不会重新加载"这一环境差异（`Store` 只在空库时 load seed）。

### 3.2 数据模型（新增逻辑集合 `invalid_alarms`）

无需 DDL（H2 单行 JSON 快照）。一行 = 一次"未成功产生的警报"尝试。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `INVALID_KEY` | string | Y | 内部主键，`store.key("invalid_alarms")` → `invalid_alarms-000001` |
| `INVALID_ID` | string | Y | 业务识别码（报表首列）。**建议**沿用 `ALARM_ID` 的展示形态（知识库 `ams-web-api.md` L84：`0000000000` + 5 位十六进制），但实现层用独立计数器 `store.key("invalidAlarmId")` 生成十进制递增再补齐，**不复用 `alarmId` 计数器**（避免与正式告警共享序列）→ §9-Q5 |
| `CREATE_DT` | ISO-8601 string | Y | 判定时间（服务端时钟），报表时间区间以此为准 |
| `INVALID_TYPE` | string | Y | 失效类型（§3.3 受控枚举，确定单一主因） |
| `INVALID_REASON` | string | Y | 面向人的失效说明，默认= `INVALID_TYPE` 的中文名 + 关键上下文（见 3.3 表） |
| `FACTORY_KEY/ID/NAME` | string | N | 请求四要素及其主档名称；主档缺失时 ID/NAME 留空，KEY 保留请求值 |
| `SUB_SYS_KEY/ID/NAME` | string | N | 同上 |
| `EQP_KEY/ID/NAME` | string | N | 同上；`*` 时名称记「任一机台」 |
| `ALARM_INFO_ID` | string | N | 请求的警报代码（原样保留） |
| `ALARM_INFO_KEY` | string | N | 匹配到的 `alarm_settings` 主键（未匹配到则为空） |
| `EVENT_KEY/EVENT_ID` | string | N | 匹配到的配置所指向的事件（找不到时为空） |
| `TITLE` | string | N | 请求标题（截断到 200 字符，避免快照膨胀） |
| `RECEIVE_TYPE` | string | Y | 固定 `Mock`（与 `alarms` 的 `RECEIVE_TYPE` 口径一致，标识来源为系统内模拟/接口触发） |
| `SOURCE` | string | Y | 触发来源入口：`Test`（`/api/alarms/test`）。为后续外部 Agent 接入预留 |
| `REQUEST_USER_ID` | string | N | 触发账号（`SYSTEM` 表示系统/无会话来源） |

写入策略：
- 与 `AlarmEngine.trigger` 的判定**同处一个 `store.write` 事务**（`ApiController.mutate` → `POST alarms/test`），失败整体回滚，不会出现"返回 422 但记录丢失"或"记录写入但响应异常"。
- 每行只记**一个主因**（第一个命中的失效条件），不做多因堆叠：与引擎短路顺序一致，便于统计；多因排查信息放在 `ALARM_INFO_KEY` 等上下文列。
- 序列：`Store.key()` 形如 `int next = num(seq.get(table)) + 1`，`Json.num(null)` 返回 0 → 新表无 `meta.seq` 条目时自动从 1 开始（生成 `invalid_alarms-000001`），**无需改 seed.json**；为可读性建议在 seed 的 `meta.seq` 显式登记 `"invalid_alarms": 0`（可选，不阻塞）。已核实：`meta.seq` 是显式白名单字典（16 个键，`alarmId` 为业务码序列），`seed.json` 当前无 `invalid_alarms` 集合，首次写入时由 `Store.table()` 经 `computeIfAbsent` 创建。

### 3.3 失效类型枚举（与现状引擎映射）

以 `AlarmEngine.trigger` 现有 8 个短路分支为准，对齐 K1 十种类型：

| # | `INVALID_TYPE` | 中文（=现有 message，保持兼容） | 引擎判定点 | K1 是否有 |
| --- | --- | --- | --- | --- |
| 1 | `FACTORY_NOT_SET` | 未设定厂别 | `factories` 未命中或 `ACTIVE=N` | ✅ |
| 2 | `SUBSYS_NOT_SET` | 未设定子系统 | `subsystems` 未命中/隐藏，或 `factory_subsys` 无对应 | ✅ |
| 3 | `EQP_NOT_SET` | 未设定机台 | `eqps` 未命中或隐藏 | ✅ |
| 4 | `EVENT_NOT_FOUND` | 找不到事件 | ①四要素无任何 `alarm_settings`（含 `*`）；②命中配置但 `events` 不存在/隐藏 | ✅（本仓合并两种情况，§9-Q2） |
| 5 | `SETTING_DISABLED` | 警报设定未启用 | 选中配置 `ACTIVE=N` | ✅ |
| 6 | `LEVEL1_NOT_SET` | 未设定层级1 | 事件无 `EVENT_LEVEL_ID=1` | ✅ |
| 7 | `RECIPIENT_NOT_SET` | 未设定发送人员 | 层级 1 无启用人员 | ✅ |
| 8 | `IGNORED_DUPLICATE` | 忽略相同警报 | 同厂别/子系统/实际机台/`ALARM_INFO_KEY`，且在 `IGNORE_PERIOD`（默认 900s）内 | ✅ |
| — | `CHANNEL_NOT_SET`（**不实现**） | 未设定发送方式 | 引擎无该分支 | ✅（K1 有，本仓无能力） |
| — | `EQP_STATUS_SKIP`（**不实现**） | 在某机况下无需发送 | 引擎无该分支（机况能力已删） | ✅（K1 有，本仓无能力） |

命名约定：`INVALID_TYPE` 存**稳定的英文代码**（便于筛选/统计/国际化扩展），报表默认按中文标签展示；`INVALID_REASON` 保留中文原 message，便于与现有测试断言、日志对齐。
> 取舍：也可以直接存中文（与现有 message 完全一致、实现最省事）。本设计选英文代码 + 中文标签，理由：报表条件筛选「失效类型 等于 XXX」在未来多语言界面下更稳定；代价是新增 8 个常量与字典。若下游希望更小改动，可退化为直接存中文（§9-Q6）。

### 3.4 报表定义（服务端内置，字段清单）

`REPORT_ID = AVPA014`，`ATLEAST_ONE_CONDITION = Y`（同 AVPA007：至少启用一个有值条件，防止全表拉取）；`CREATE_DT` 类型为 date、默认运算符 `between`（即"查询时间区间"的默认形态）。

| 列 `field` | 标签 | 类型 | 条件可用 | 说明 |
| --- | --- | --- | --- | --- |
| `INVALID_ID` | 无效警报识别码 | text | ✅ | |
| `CREATE_DT` | 判定时间 | date | ✅ | **时间区间主字段** |
| `INVALID_TYPE` | 失效类型 | text | ✅ | 值为中文标签；英文代码存 `INVALID_TYPE_CODE` 不展示（见 3.5） |
| `INVALID_REASON` | 失效原因 | text | ✅ | |
| `FACTORY_ID` | 厂别代码 | text | ✅ | |
| `FACTORY_NAME` | 厂别名称 | text | ✅ | |
| `SUB_SYS_ID` | 子系统代码 | text | ✅ | |
| `SUB_SYS_NAME` | 子系统名称 | text | ✅ | |
| `EQP_ID` | 机台代码 | text | ✅ | |
| `EQP_NAME` | 机台名称 | text | ✅ | |
| `ALARM_INFO_ID` | 警报代码 | text | ✅ | |
| `EVENT_ID` | 事件通知代码 | text | ✅ | |
| `TITLE` | 警报标题 | text | ✅ | |
| `RECEIVE_TYPE` | 资料取得方式 | text | ✅ | |
| `REQUEST_USER_ID` | 触发账号 | text | ✅ | |

排序：`CREATE_DT` 倒序（与 AVPA004 一致）。导出：复用 `ApiController` 的 `/export`（客户端过滤后快照），文件名 `REPORT_NAME + ".xlsx"`。

### 3.5 后端实现点（最小改动清单）

| 文件 | 类型 | 改动 |
| --- | --- | --- |
| `backend/src/main/java/com/changxin/ams/InvalidAlarms.java` | `[NEW]` | 失效类型常量（8 个 + 中文标签映射）；`record(Store, body, type, reason, ctx)` 写入 `invalid_alarms`；`rows()` 读取 |
| `backend/src/main/java/com/changxin/ams/AlarmEngine.java` | `[MODIFY]` | `invalid(...)` 改为同时落库：注入 `InvalidAlarms`；每个失效点带上已解析到的上下文（如已找到的 `setting`/`event`）；删除 `bypass` 之外的行为不变 |
| `backend/src/main/java/com/changxin/ams/Reports.java` | `[MODIFY]` | `definition()` 白名单加 `AVPA014` 并返回内置定义（含 `COLUMNS`/`CONDITIONS`，不读 `report_defs`）；`query()` 增加 `AVPA014` 分支：读 `invalid_alarms` → 补 `FACTORY_ID/NAME` 等展示字段 → `INVALID_TYPE` 回填中文标签到**展示用**字段（见下）→ 复用现有 `matches()` 过滤 → `CREATE_DT` 倒序 |
| `backend/src/main/java/com/changxin/ams/ApiController.java` | `[MODIFY]` | 现有 `POST /api/reports/:code/{query,export}` 已通用，`definition()` 的 `columns` 取 `rows(def.get("COLUMNS"))` 已可用 → **预期无需改**；仅需确认 `AVPA013` 特判不影响 AVPA014（键入提示：`p[1].equals("AVPA013")` 分支保持） |
| `backend/src/main/resources/seed.json` | `[MODIFY]` | `functions` 追加一行 `AVPA014`（`PATH=#/page/AVPA014`，`FUNC_TYPE=PAGE`，`VISIBLE=Y`，`SORT` 排在 AVPA007 之后）；可选：`meta.seq` 加 `invalid_alarms: 0`。**仅对新库生效**（`Store` 只在空库 load seed）→ 已有库需走 §6 兼容策略 |
| `frontend/src/pages/Workspace.vue` | `[MODIFY]` | 报表白名单数组追加 `'AVPA014'` |
| `frontend/src/components/AppSidebar.vue` | `[MODIFY]` | `groups` 的 `reports.codes` 追加 `'AVPA014'`；`icons` 加 `AVPA014`（取 `@ant-design/icons-vue` 的告警/查询类图标，如 `WarningOutlined`；设计系统 `DESIGN.md` 确认图标即 Ant Design Vue 官方图标，无独立图标集） |
| `frontend/src/legacy-i18n.js` | `[MODIFY]` | 复用已有词条（`无效警报查询`/`失效类型`/`无效警报识别码`）；**补齐缺失**：`失效原因`、`触发账号`、`判定时间`（已核实三者当前均不存在）。类型中文标签由后端输出、不经词典，无需新增词条。规则：不新增 `I18n.t()` 调用形态，只往既有词典加 key（仓库现状即此方案） |

**`INVALID_TYPE` 展示方案**（唯一方案，硬约束：**不修改 `DataGrid.vue` / `ReportPage.vue` 通用行为**）

现状约束（已核实）：`DataGrid` 只按列 `field` 取值渲染，`ReportPage` 的列与条件均来自后端 `definition()`，前端**没有**「列值 → 显示文本」的映射钩子。

因此采用最薄做法：
- **存储层**：`invalid_alarms.INVALID_TYPE` 存英文代码（稳定、可统计）；
- **查询层**：`Reports.query("AVPA014", …)` 输出的行里，`INVALID_TYPE` 字段值替换为中文标签，并额外输出 `INVALID_TYPE_CODE` 保存英文代码；
- **列定义**：`COLUMNS` 只声明 `INVALID_TYPE`（中文表头「失效类型」），不声明 `INVALID_TYPE_CODE`（不展示，仅供后端/导出排查）；
- **条件层**：`CONDITIONS` 中 `INVALID_TYPE` 的匹配规则 = 对「中文标签」（展示值）做现有 `matches()`，用户输入中文即可命中；若需按代码筛选，用户输入英文代码不命中 —— 记录为已知边界（不影响需求「按原因查看」）。
- 导出复用同一行数据，故导出文件里「失效类型」列同样是中文。

不采用「新增 `displayMap` 能力」：需要改 `DataGrid` 通用渲染，影响 AVPA004/007/013 三张既有报表，违反最小必要变更原则。

### 3.6 前端交互（复用现状，无新组件）

- 菜单：「查询报表」分组 → 「无效警报查询」→ `#/page/AVPA014`。
- 页面初次："请执行查询"；点「查询」→ 条件弹窗（默认展开 `CREATE_DT` 的区间）；服务端按条件过滤；表格支持搜索/列过滤/排序/分页；「汇出」导出画面结果。
- 无「下钻/告警详情」入口：无效记录没有 `ALARM_KEY`，不提供打开告警详情（与 AVPA013 下钻语义区分，避免误点空白）。
- 空结果：显示表格空态；导出仅表头（现状行为）。

### 3.7 错误语义

| 场景 | HTTP | 响应 |
| --- | --- | --- |
| `GET /api/report-defs/NOT-EXIST` | 404 | `{ok:false,message:"报表不存在"}`（沿用） |
| `POST /api/reports/AVPA014/query` 无条件 | 400 | `{ok:false,message:"至少选择一个查询条件"}`（沿用 `ATLEAST_ONE_CONDITION`） |
| 条件字段不在列清单 | 400 | `{ok:false,message:"查询字段无效"}`（沿用） |
| 非法日期 | 400 | `{ok:false,message:"日期时间格式无效"}`（沿用） |
| 触发无效告警 | 422 | 响应 `status`/`message` **保持不变**（兼容既有断言）；同时落 1 行 `invalid_alarms` |

### 3.8 配置 / 开关 / 权限

- 无新增配置项；无新增环境变量。
- 权限：沿用"登录即可访问全部菜单"的现状（无 RBAC），新页面不引入权限差异。
- 数据迁移：`AMS_STATE` 中旧快照无 `invalid_alarms` 键 → `store.table()` 自动补空列表，**向后兼容**，无需 schema 版本升级（`meta.schema` 保持 `checked-mvp-1`）。

---

## 4. 行为定义（EARS，需求原文可验证部分）

> 注：上游无 Spec，以下为从需求原文 + K1/K2 推导的最小行为集，作为下游测试的追溯基线；均标注来源。

| ID | 行为（EARS） | 来源 |
| --- | --- | --- |
| REQ-IA-01 | 当警报触发因任一失效条件未成功建立时，系统应在同一写事务内持久化一条无效警报记录，并保留返回给调用方的失败消息不变。 | 需求 / K1 / E02 |
| REQ-IA-02 | 当警报成功建立时，系统不应写入任何无效警报记录。 | 需求（"未成功产生的"） |
| REQ-IA-03 | 无效警报查询应按判定时间区间（含单侧边界，精确到秒）返回结果，并按判定时间倒序。 | 需求 / K2 §11 |
| REQ-IA-04 | 查询结果每行应至少包含：无效警报识别码、判定时间、失效类型、失效原因、四要素（代码/名称）、触发账号。 | 需求 / K1 |
| REQ-IA-05 | 当用户未启用任何有值条件时，系统应拒绝查询并提示"至少选择一个查询条件"。 | K2 §11（AVPA007 先例） |
| REQ-IA-06 | 当查询结果为空时，系统仍应允许导出仅含表头的 Excel。 | K2 §11 |
| REQ-IA-07 | 导出内容应等于画面当前过滤后的全部行（非仅当前页）。 | K2 §11 |

**反例（必须拒绝/不得误报）**

| ID | 反例 |
| --- | --- |
| NEG-IA-01 | 失败请求被拒绝后，不得产生 `alarms` 记录，也不得产生 `alarm_notifications`（E02 副作用约束） |
| NEG-IA-02 | BYPASS 已删除；不得把 `LogOnly` 正式记录计入无效报表（K1：LogOnly ≠ NoNotify） |
| NEG-IA-03 | 具体机台配置存在但隐藏时：应记 `SETTING_DISABLED`，**不得**回退通配后建单，也不得记成 `EVENT_NOT_FOUND`（E03） |
| NEG-IA-04 | 重复抑制窗口内第二次触发应记 `IGNORED_DUPLICATE`；窗口外应成功建单且不记无效（E05 时间单位：秒） |
| NEG-IA-05 | 未启用条件（`enabled=false`）即使填了值，也不得生效；全部未启用时按 REQ-IA-05 拒绝 |

---

## 5. 测试与验证设计（供下游 coding / E2E 节点）

### 5.1 后端单元 / 集成

| 编号 | 层级 | 场景 | 建议位置 |
| --- | --- | --- | --- |
| UT-IA-01 | unit | 失效类型与中文标签映射完整性（8 项，无漏、无重复代码） | `backend/src/test/java/com/changxin/ams/unit/` 新增 `InvalidAlarmTypeTest` |
| UT-IA-02 | unit | `Reports.definition("AVPA014")` 返回 `ATLEAST_ONE_CONDITION=Y`、`CREATE_DT` 为 date、列含 `INVALID_TYPE` | `ReportConditionsTest` 追加 |
| IT-IA-01 | integration（MockMvc） | 依次构造 8 类失效请求（主档隐藏/无对应/配置隐藏/层级1缺失/人员为空/重复窗口内/找不到事件），断言 422 + `invalid_alarms` 各 +1 且类型正确 | 新增 `InvalidAlarmIntegrationTest` |
| IT-IA-02 | integration | 成功触发：`alarms` +1、`invalid_alarms` 不变 | 同上 |
| IT-IA-03 | integration | 重复抑制：同四要素 2 次，第 2 次记 `IGNORED_DUPLICATE`；改 `IGNORE_PERIOD=0` 后不再抑制 | 同上 |
| IT-IA-04 | integration | 查询：时间区间过滤（单侧 `from`/`to`）、无条件拒绝、字段非法拒绝 | 同上 |
| IT-IA-05 | integration | 导出：空结果为仅表头；有结果行数与列头一致 | 同上 |

### 5.2 后端接口 E2E（`docs/e2e/backend-api-e2e.md` 新增 TC-API-E2E-005）

1. 登录 → 提交一个**不存在警报代码**的触发 → 422；
2. `POST /api/reports/AVPA014/query`（`CREATE_DT between now-1h..now`）→ 含该行，`INVALID_TYPE` 与响应 message 对齐；
3. 同一请求再触发一次（重复命中）→ 第二条记录的失效类型应为 `IGNORED_DUPLICATE` 或 `EVENT_NOT_FOUND`（取决于首次是否成功建立，用例需用**首次成功**的四要素构造）；
4. 无条件查询 → 400"至少选择一个查询条件"；
5. 导出 → `base64` 非空、文件名为 `无效警报查询.xlsx`。

### 5.3 前端

| 编号 | 层级 | 场景 |
| --- | --- | --- |
| FE-UT-01 | Vitest | 无需新增：`filters.js` 已覆盖日期区间/文本运算符；本设计不改前端通用组件（§3.5），故不新增前端单测；若编码时确需调整 `filters.js`，则必须补对应用例 |
| TC-FE-E2E-006 | Playwright | 侧栏「查询报表」出现「无效警报查询」→ 进入 → 显示"请执行查询" → 开启 `CREATE_DT` 区间 → 查询 → 有数据行（先用 API 造一条无效数据）→ 列过滤 → 汇出触发下载 |

### 5.4 手工/回归检查

- 现有 `04-alarm-workflow.spec.ts`、`TC-API-E2E-003`：422 message 与状态码不变；**注意** `04-alarm-workflow.spec.ts` 第 3 步（二次触发走忽略窗口）与 `06-invalid-alarm` 可能互相影响：Playwright 各 spec 独立浏览器上下文但共用同一临时 H2，建议新 spec 使用**与 04 不同的**警报代码/机台，或将忽略断言放在后端集成测试（`IT-IA-03`）里做；
- `AVPA004/007/013` 查询与导出结果不变（`definition()` 白名单扩展不得改变既有分支）；
- 繁中/英文切换：新页面标题与列头不出现未翻译中文（除业务数据本身）。

---

## 6. 兼容性与回滚

| 维度 | 策略 |
| --- | --- |
| 数据 | 新集合按需创建，旧快照无该键自动补空；`meta.seq` 缺键由 `num(null)=0` 兜底 |
| 接口 | `POST /api/alarms/test` 契约不变（状态码/消息不变，仅多一条记录） |
| 报表 | 白名单 3 → 4，既有 3 个报表分支不变 |
| 菜单（**潜在风险，待核实**） | 菜单来自 DB `functions` 表，`Store` 仅在**空库**（`AMS_STATE` 无 `ID=1`）加载 seed → 若目标环境是已有数据的 H2 库，新菜单**不会自动出现**。本地当前 `backend/data/` 为空（本次已核实：目录不存在、未生成 `ams-mvp.mv.db`），因此本轮无法实测该场景；发布动作见 6.1 |
| 回滚 | 代码回滚即可；已写入的 `invalid_alarms` 行对旧版本无副作用（无读取方）。若需彻底清理，由运维在受控环境删除该键 |

### 6.1 已有库的菜单补齐（发布动作，非编码）

前置事实（已核实）：
- 默认库路径 `jdbc:h2:file:./data/ams-mvp`（`backend/src/main/resources/application.properties`），仓库内 `backend/data/` **当前不存在**，无既有业务库可验证升级路径；
- `Store` 构造：`AMS_STATE` 无 `ID=1` 时 `load("seed.json")` 并持久化，否则只做 `meta.schema == checked-mvp-1` 校验与 BYPASS 字段清理 —— **不会**从 seed 合并新增的功能项。

二选一，均属发布/联调节点执行（本节点不实施）：
- A（推荐）：联调时通过「系统功能选单」维护入口新增 `AVPA014` 功能项（`FUNCTION_KEY/FUNCTION_ID=AVPA014`、`PATH=#/page/AVPA014`、`VISIBLE=Y`）；
- B：在 `Store` 启动时做一次"内置报表功能项缺失则补"的幂等补齐。

> 本设计**默认取 A**：不改 `Store` 启动逻辑（最小必要变更，编码规范 §2）。B 的影响面大于报表本身，若下游坚持 B，需在编码节点显式评审并补充"补齐幂等 + 不覆盖用户停用功能项"的测试（§9-Q4）。

---

## 7. 风险与缓解

| ID | 等级 | 风险 | 触发条件 | 影响 | 缓解 |
| --- | --- | --- | --- | --- | --- |
| R1 | 中 | 无效记录**只覆盖系统内触发**（`/api/alarms/test`） | 外部 Agent 通过其他入口投递告警 | 报表"查不到"真实产线的无效警报，用户误判 | 需求原文未界定来源；已在列 `SOURCE`/`RECEIVE_TYPE` 标注，后续接入真实上游时统一在 `trigger` 落库（§9-Q3） |
| R2 | 中 | 已有库可能无菜单 | 部署到已存在数据的 H2 库（本地当前无此库，未实测） | 功能"看不见" | 6.1-A 发布动作；T8 联调需按"预置一条 seed 前的空功能表"或真实升级库验证 |
| R3 | 低 | 快照膨胀 | 高频重复触发（忽略窗口内密集） | H2 单行 JSON 变大、写放大 | 每行 `TITLE` 截断；同一四要素的连续 `IGNORED_DUPLICATE` **可考虑**按窗口聚合（**不做**，属过度设计；作为后续观察项） |
| R4 | 低 | 失效类型 10 vs 8 | 客户按 K1 逐条验收 | "未设定发送方式 / 某机况下无需发送"无数据 | 报表说明中注明"当前系统不提供该两类配置"；需产品确认（§9-Q2） |
| R5 | 低 | 类型字段存储形态（英文码 vs 中文） | 下游直接沿用中文 message | 列过滤/统计口径不一致 | §3.5：存储英文代码，查询输出中文标签，`INVALID_TYPE_CODE` 保留代码 |
| R6 | 低 | 报表全量返回 | 单库长期累积大量无效记录 | 查询响应体过大、前端卡顿 | 强制至少一个条件（REQ-IA-05）+ 时间区间默认；后续按需引入服务端上限（不做） |
| R7 | 低 | 与历史报表混淆 | 用户期望"点开无效记录看详情" | 误点空白 | 表格不提供 open 回调（3.6） |
| R8 | **高** | 破坏"已删除报表返回 404"的既有回归断言 | 若报表代码误选为 `AVPA005`/`AVPA008`（旧无效告警报表示例代码） | `WorkflowIntegrationTest#checkedPagesWorkAndRemovedApisReturn404`（L208 断言 `report-defs/AVPA005`、`report-defs/AVPA008` → 404）与 `#authenticationSingleSessionAndNoPasswordDisclosure`（L59 断言 bootstrap 响应不含 `AVPA005`）将失败 | **必须使用 `AVPA014`**；编码后须完整跑 `mvn test`（不要只跑新增用例） |
| R9 | 中 | 新报表与其他报表共用导出/条件路径 | 修改 `definition()` 时顺带改结构 | 影响 AVPA004/007/013 | `WorkflowIntegrationTest` L205 已对 3 个报表做 `between` 条件查询断言；改完必须回归该用例 |
| R10 | 低 | 无效记录导致 `mvn test` 中既有用例的计数断言漂移 | 既有用例触发失败告警后断言 `alarms`/`notifications` 数量 | 用例失败 | 现有用例只断言 `alarms`/`alarm_notifications`，不读 `invalid_alarms`（已核实无引用），风险低；但新增用例若清空 `store.data()` 重置，须确保 `invalid_alarms` 一并重置（`WorkflowIntegrationTest` 的 `@BeforeEach` 以整份 seed 覆盖 `store.data()`，天然满足） |

---

## 8. DFX / NFR 自查

| 维度 | 结论 | 证据/处置 |
| --- | --- | --- |
| 一致性 | 通过 | 写无效记录在 `store.write` 内，与建单/查重同事务（E02/K3 §5） |
| 安全 | 通过 | 无新入参透传到 SQL（无 SQL）；不记录 SMTP 凭据；`TITLE` 属业务数据非 PII，原样保留（与 AVPA004 一致）；无越权面扩大（沿用登录态） |
| 可观测 | 部分 | 现状日志仅 `traceId + 异常类型`；本设计**不新增**日志框架，建议在 `InvalidAlarms.record` 用参数化模板记 `INVALID_TYPE / FACTORY / SUBSYS / EQP / ALARM_CODE`（不含人员邮箱）；下游若引入 metric，用 `alarm.invalid.count{type=...}` |
| 性能 | 通过（有界） | 写入 O(1) 追加；查询 O(n) 全表扫描（与现状报表同构），由"至少一个条件"约束输入规模 |
| 可靠性 | 通过 | 无外部调用；失败回滚保证不留半条记录 |
| 兼容 | 通过 | §6；422 文案不变 |
| 发布 | 需明确 | §6.1 菜单补齐属于发布动作，必须在联调节点验证 |
| i18n | 通过（需补 3 个 key） | 只向既有词典加 key，不新增 `I18n.t()` 调用形态；复用 4 个已存在词条，补 `失效原因`/`触发账号`/`判定时间`。注意 `legacy-i18n.test.js` 的兜底断言：未入词典的 key 在英文下**原样返回**（不报错、不阻断） |
| 埋点 | 不适用 | 本仓无埋点 SDK（前端无 analytics 依赖），不做 |
| Agent 质量 | 不适用 | 无 LLM/Agent 代码路径 |

---

## 9. 待确认项（含推荐默认值，不阻塞编码）

| ID | 问题 | 推荐默认值（将按此实施） | 影响 |
| --- | --- | --- | --- |
| Q1 | 报表代码取 `AVPA014`？ | **是** | 路由/菜单/测试 ID；改名成本低（改常量） |
| Q2 | 是否实现「未设定发送方式」「在某机况下无需发送」两类？ | **不实现**（本仓无对应能力，强行实现等于造假） | 客户若逐条验收 10 类，需产品明确"本版本提供 8 类" |
| Q3 | 是否记录来自系统外（非 `/api/alarms/test`）的无效告警？ | **仅记录经过本系统触发入口的** | 报表覆盖范围 |
| Q4 | 已有库菜单补齐走 6.1-A 还是 B？ | **A**（发布动作，不改 `Store`） | 若不执行 A，已有环境看不到菜单 |
| Q5 | `INVALID_ID` 业务码格式 | **独立序列** `store.key("invalidAlarmId")`，展示为定长数字串（与 `ALARM_ID` 观感一致，不复用其计数器） | 报表首列观感；避免污染正式告警序列 |
| Q6 | `INVALID_TYPE` 存英文码还是中文？ | **存储英文码，查询输出中文标签**（§3.5）；禁止改 `DataGrid`/`ReportPage` 通用行为 | 若下游认为成本过高，允许退化为"直接存中文"（此时 §3.3 的英文常量仅作为内部常量名） |
| Q7 | 保留期 | **不设自动清理**（与 `alarms` 同策略） | 存储增长 |

---

## 10. 与 Spec / Gate 的对齐关系

- 上游 `artifacts/` 为空 → 本文件是当前工作流中**第一份**可执行设计；§4 行为定义在 Spec 补齐后应被引用而非复制。
- 当前 Repo 职责边界：本需求**完全在单仓内**闭环（后端落库+报表、前端菜单+页面复用），**无跨 Repo 依赖**。
- 非本 Repo 职责：真实上游告警接入（Agent/MES/FDC）、BYPASS/机况能力恢复、RBAC 权限、报表服务端分页 —— 均不在此实现。
