# AMS 无效警报查询 V2 技术设计

## 1. 输入与证据

- 上游 Spec：`docs/specs/无效警报查询-Spec.md`（同 `artifacts/产品设计/无效警报查询-Spec/无效警报查询-Spec.md`，SPEC-DA-INVALID-ALARM-QUERY-V2）。
- 上游打标：`docs/specs/无效警报查询-需求打标.json`，分类 A、七维 PASS、无阻塞项。
- 仓库约定：`README.md`、`PAGE_MAP.md`、`docs/JAVA_VUE_MIGRATION.md`、`docs/e2e/backend-api-e2e.md`、`docs/e2e/frontend-e2e.md`。
- 关键代码证据：
  - `backend/src/main/java/com/changxin/ams/AlarmEngine.java`：`trigger(...)` 依序短路校验，`invalid(...)` 当前只返回 `ok=false/status=422/message=reason`，不落库；成功与 BYPASS 不进入 `invalid(...)`。
  - `backend/src/main/java/com/changxin/ams/Reports.java`：AVPA004/AVPA007/AVPA013 采用白名单 + `report_defs` 元数据 + 内存条件过滤 + 倒序。
  - `backend/src/main/java/com/changxin/ams/ApiController.java`：报表定义/查询/汇出共用 `/api/report-defs/{code}`、`/api/reports/{code}/query`、`/api/reports/{code}/export`。
  - `backend/src/main/java/com/changxin/ams/Store.java`：单事务快照写；`store.table(name).add(...)` + `store.key(name)` 为新增记录统一模式。
  - `frontend/src/pages/ReportPage.vue`、`frontend/src/components/DataGrid.vue`、`frontend/src/components/AppSidebar.vue`、`frontend/src/pages/Workspace.vue`：通用报表页、本地过滤/排序/分页/汇出、后端 functions 驱动导航、按 code 白名单渲染。
  - `frontend/src/legacy-i18n.js`：已包含「无效警报查询」「无效警报识别码」「失效类型」及主要失效原因翻译；本轮不新增 `I18n.t()`。
- 知识库检索：已按技术设计阶段调用 Context Search；空间发现/检索请求超时，未返回可用条目。设计依据以上工作区产物与仓库只读证据，未虚构知识库结论。

## 2. 技术域与范围

本设计为单仓库全栈设计：后端数据留存与报表、前端报表入口，以及测试任务拆解。产品行为以 Spec 为准，不扩展至重发、补登、编辑、删除、ACK、统计图表或旧模块恢复。

## 3. 现状对齐与仓库约束

- 使用 Java 21 + Spring Boot 3.5.7 + H2 JSON 快照 Store，前端为 Vue 3 + Ant Design Vue 4.2.6。
- 新增记录必须发生在 API 传入的 `store.write(...)` 事务内，复用 `Store` 快照模式，不新增数据库表结构或外部组件。
- 报表定义是 `report_defs` 数据，而不是独立 controller；前端仅按 code 选择 `ReportPage`，不新增页面组件。
- 所有 API 已由 `ApiController` 统一鉴权，登录态检查沿用现有机制。
- Excel 导出使用前端传入的当前画面结果与后端定义列，保持只读。
- 本地化继续使用 `state.t()` / `legacy-i18n.js`；中文为默认契约文案。

## 4. 关键决策

| 编号 | 决策 | 理由 | 对应待确认 |
|---|---|---|---|
| D1 | 报表 code 定为 `AVPA014`，名称「无效警报查询」 | 接续 AVPA007/AVPA013 编码惯例；Spec 建议相同；前端 legacy-i18n 已有该名称翻译 | Q2 |
| D2 | 未加条件允许全量查询，分页兜底，`ATLEAST_ONE_CONDITION=N` | 与 AVPA004 默认口径一致；避免改变现有报表交互 | Q1 |
| D3 | 落库保留标题/内容/取得方式/来源类型，不保留 IP 或凭据；内容不在默认报表列中导出 | 满足排查需要且减少敏感面 | Q3 |
| D4 | 新增只追加集合 `invalid_alarms`，失败原因直接保存 Spec 规定的中文文案 | 与触发响应 message 一致，便于后端/前端和导出统一 | REQ-001 |
| D5 | 对既有 checked-mvp-1 H2 数据做幂等启动补齐：缺 `AVPA014` 报表定义/菜单则从 seed 复制；缺 `invalid_alarms`/序列则补空集合与序列 | 避免已有持久化数据库升级后看不到新功能，也不迁移 checked-mvp-1 之前旧库 | 5.1 兼容 |

## 5. 数据模型与持久化

### 5.1 新增集合 `invalid_alarms`

每条失败触发写 1 条不可变记录：

| 字段 | 来源 | 说明 |
|---|---|---|
| `INVALID_KEY` | `store.key("invalid_alarms")` | 内部唯一主键 |
| `INVALID_ID` | `store.key("invalid_alarms")` | 展示用识别码；实现可复用同一次生成的 key 值 |
| `CREATE_DT` | `now()` | 资料时间，ISO Instant，报表排序和区间条件字段 |
| `FACTORY_ID` / `FACTORY_NAME` | 入参 `factoryKey`；若 `factories.FACTORY_KEY` 可匹配，则补 `FACTORY_ID`/`FACTORY_NAME`，否则名称留空 | 代码按入参原样保留 |
| `SUB_SYS_ID` / `SUB_SYS_NAME` | 入参 `subsysKey`；若 `subsystems.SUB_SYS_KEY` 可匹配，则补名称，否则留空 | 同上 |
| `EQP_ID` | 入参 `eqpKey` | 支持不存在代码原样留存；不额外存 EQP 名称 |
| `ALARM_INFO_ID` | 入参 `alarmCode` | 不存在代码原样留存 |
| `TITLE` / `CONTENT` | 触发 body 原值 | 空值按空保存；CONTENT 只落库，不进入默认报表列 |
| `REASON` | 当前 `invalid(...)` reason | 与 422 message 完全一致，中文枚举 |
| `RECEIVE_TYPE` | `"Mock"` | 与有效警报表口径一致 |
| `SOURCE_TYPE` | `"Test"` | 与现行测试触发一致 |

不新增 `ACTIVE` 状态流转字段；记录只读、不可编辑、不可删除。

### 5.2 seed / metadata / 兼容

- `backend/src/main/resources/seed.json`：
  - `meta.seq` 增加 `"invalid_alarms": 0`。
  - 顶层新增 `"invalid_alarms": []`。
  - `report_defs` 新增 `AVPA014`；`COLUMNS` 与 `CONDITIONS` 显式声明：`INVALID_ID`、`CREATE_DT`、`REASON`、`FACTORY_ID`、`FACTORY_NAME`、`SUB_SYS_ID`、`SUB_SYS_NAME`、`EQP_ID`、`ALARM_INFO_ID`、`TITLE`、`RECEIVE_TYPE`、`SOURCE_TYPE`。`CREATE_DT` type 为 `date`，其余为 `text`；`ATLEAST_ONE_CONDITION=N`。
  - `functions` 新增 `AVPA014`，路径 `#/page/AVPA014`、名称「无效警报查询」、`FUNC_TYPE=PAGE`、`VISIBLE=Y`、`ACTIVE=Y`。排序置于「查询报表」分组语义位置；若与 TEST/ACK 使用数字排序冲突，则同步顺延后续 SORT。
- `backend/src/main/resources/metadata.json`：`pageTitles` 增加 `AVPA014: "无效警报查询"`。
- 存量 checked-mvp-1 H2：`Store` 初始化时执行幂等补齐：
  1. `invalid_alarms` 缺失时创建空集合，`meta.seq.invalid_alarms` 缺失时置 0。
  2. `report_defs` 缺 `REPORT_ID=AVPA014` 时从 `seed.json` 复制该定义。
  3. `functions` 缺 `FUNCTION_KEY=AVPA014` 时从 `seed.json` 复制该菜单。
  - 不修改其它业务数据；补齐后按现有 Store 规则持久化。重复启动不重复插入。
- 回滚：上线前备份 H2；回滚代码后新增集合保留但不可见，不影响旧功能；若需彻底清理，可由 DBA 从 JSON 快照移除 `invalid_alarms`、`AVPA014` 定义/菜单，本需求不提供删除接口。

## 6. 后端方案

### 6.1 失效触发落库

- 修改 `AlarmEngine.invalid(Map<String,Object> body, String reason)`：
  - 在返回失败结果前调用一个私有 `recordInvalid(body, reason)` 方法。
  - `recordInvalid` 构造 5.1 记录并 `store.table("invalid_alarms").addFirst(record)`。
  - 因 `POST /api/alarms/test` 已在 `ApiController` 的 `store.write(...)` 中执行，本副作用与原响应在同一事务快照内提交。
  - 返回体保持 `{ok:false,status:422,message:reason}`，HTTP 状态码不变。
- 不在 BYPASS、成功创建路径调用该方法；BYPASS 仍只生成有效 alarm + transaction，状态 `LogOnly`。
- 一次失败只会经过一个 `invalid(...)` 返回点，天然满足“只写 1 条、取首个未通过校验”。
- 主档缺失时只用安全 find / 空字符串补名称，不能因 join 失败抛错或丢入参代码。

### 6.2 报表白名单与查询

- `Reports.definition(String code)` 白名单加入 `AVPA014`。
- `Reports.query(String code, Map<String,Object> conditions)`：
  - `AVPA014` 的 source 使用 `store.table("invalid_alarms")` 的副本，不再调用 `engine.enrich(...)`。
  - 直接以记录中已保存的代码/名称作为报表列；若名称为空则显示空。
  - 条件字段必须来自报表定义列，继续复用现有 `matches(...)`；`CREATE_DT` 走 date 条件，`between` 含起止端点。
  - 多启用条件交集；按 `CREATE_DT` 倒序。
  - `ATLEAST_ONE_CONDITION=N`，不强制时间区间。
- 汇出无需新增端点：`/api/reports/AVPA014/export` 由现有路由处理，使用报表定义列与前端当前画面过滤/排序结果。

### 6.3 API 契约与权限

- `GET /api/report-defs/AVPA014` 返回现有报表定义结构。
- `POST /api/reports/AVPA014/query` 请求/响应沿用 `{ok,rows,columns,total,lastUpdate}` 与 `{enabled,operator,value,from,to}`。
- `POST /api/reports/AVPA014/export` 沿用 Excel base64/filename 契约。
- `POST /api/alarms/test` 失败响应不变，仅新增副作用。
- 未登录访问任一接口仍被现有统一鉴权拒绝。

## 7. 前端方案

- `Workspace.vue` 的 `ReportPage` 渲染白名单加入 `AVPA014`。
- `AppSidebar.vue`：
  - `groups.reports.codes` 加入 `AVPA014`。
  - `icons.AVPA014` 复用 `FileSearchOutlined`。
  - 菜单仍仅渲染后端 `functions` 返回的链接。
- `ReportPage.vue` 与 `DataGrid.vue` 不做功能改造：
  - 通过后端定义自动生成条件弹窗、列过滤、排序、分页。
  - 初始显示「请执行查询」，提交后倒序展示，空态「查无资料」。
  - 汇出使用 `grid.filtered` 当前画面结果。
- 本地化无需新增文案；`legacy-i18n.js` 已覆盖主要名称与失效原因。若新增默认列名缺失翻译，才补对应映射，不引入 `vue-i18n`。

## 8. 测试设计

### 8.1 后端单元/集成

新增或扩展集中验证失败留存与报表行为，优先新建聚焦测试类：

- 逐类失效原因：未设定厂别、未设定子系统、未设定机台、找不到事件、警报设定未启用、忽略相同警报、未设定层级1、未设定发送人员；断言响应 422/message 不变，且 `invalid_alarms` 恰好新增 1 条，`REASON` 与四要素/标题正确。
- 主档不存在：厂别/子系统/机台/警报代码不存在时，记录仍保留入参原值，名称允许为空。
- 成功与 BYPASS：有效触发和 BYPASS `LogOnly` 均不新增无效记录。
- 一事务性：失败响应生成后记录可见；若持久化异常则触发事务回滚且请求不得返回成功。
- 报表条件：时间区间含端点、多条件交集、倒序、空态、未知字段拒绝、原因包含/等于。
- 导出：列与定义一致、空结果仍有表头、时间列保持时间格式。

### 8.2 接口 / 前端 E2E

- 登录后 bootstrap nav 含 `#/page/AVPA014`；未登录查询返回 401。
- 触发失败后进入「无效警报查询」，按资料时间区间（含起止端点）取到记录，原因与四要素正确。
- 叠加条件取交集；切换条件/列过滤/排序后汇出文件内容一致。
- 回归现有触发成功、BYPASS、AVPA004/AVPA007、导航和登录 E2E。

## 9. 非功能与风险

| 维度 | 设计 |
|---|---|
| 性能 | 单次失败只写一条；查询沿用内存过滤与前端分页。当前 P2 数据量无服务端分页。若未来全量查询明显变慢，作为后续迭代增加服务端分页/索引，不在本轮扩容。 |
| 可靠性 | 落库在 Store 写事务中；异常按现有事务回滚，失败触发不能返回成功。注意：底层持久化异常会使请求由现有异常处理返回 5xx，而不是 422；这是“不成功”语义下的可接受结果。 |
| 安全 | 仅登录可见；记录不含密码、邮箱凭据、IP 或外部敏感信息。 |
| 可观测 | 原因是稳定中文枚举，可通过报表检索；不新增日志埋点或指标。 |
| 兼容 | API 均为扩展；现有报表和触发语义不变。旧 checked-mvp-1 数据用幂等补齐；checked-mvp-1 之前旧库仍拒绝加载。 |
| 回滚 | 部署前备份 H2。代码回滚后旧版本不查询新增集合，不影响主链路。 |

## 10. 风险与处理

| 风险/假设 | 影响 | 处理 |
|---|---|---|
| seed 中部分历史序列计数与实际行数不一致 | 新增 seq 只需保证 key 单调，不要求等于实际行数 | 保持现有 `store.key` 行为；只递增相关序列 |
| 持久化失败时无法既回滚记录又返回 422 | 请求可能返回 5xx | 接受为失败语义，不吞异常；测试断言不返回成功 |
| 老数据启动补齐若实现过宽可能复制无关 seed 数据 | 数据面扩大 | 明确只补 `invalid_alarms`/`AVPA014` 定义与菜单，不做通用 seed merge |
| 失效原因使用中文作检索键 | locale/文案变化会影响统计 | 本轮文案由 Spec 锁定；若未来多语言统计，再增加 reason code，不在本轮改动 |
