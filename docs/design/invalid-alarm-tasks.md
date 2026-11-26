# 无效警报查询（AVPA014）任务拆分

> 对应设计：`docs/design/invalid-alarm-design.md`（下称「设计」）
> 需求：AMS系统澄清.xlsx 序号 28 —— 查询时间区间内未成功产生的警报及失效原因（DA 迭代需求，P2）
> 仓库 / 分支：`DawnGuoDev/CX-AMS-1123` @ `feat/9a3c782a-5s1l`（基线 `release`）
> 执行层级：编码节点（backend-coding / frontend-coding）→ E2E 用例节点 → 联调

## 总览

| 任务 | 类型 | 依赖 | 可追溯设计章节 | 预估 |
| --- | --- | --- | --- | --- |
| T1 失效类型常量与无效记录写入服务 | 后端 | — | §3.2 / §3.3 / §3.5 | S |
| T2 引擎失效分支接入落库 | 后端 | T1 | §2.1 / §3.1 / §3.5 / §4 | S |
| T3 报表定义与查询（AVPA014） | 后端 | T1 | §3.4 / §3.5 / §3.7 | M |
| T4 菜单功能项与前端路由/侧栏/词典 | 全栈 | T3 | §2.1 / §3.5 / §3.6 | S |
| T5 后端测试（单元 + 集成） | 测试 | T1–T3 | §5.1 / §4 | M |
| T6 后端接口 E2E 文本用例 + 代码 | 测试 | T3 / T5 | §5.2 | S |
| T7 前端 E2E 文本用例 + 代码 | 测试 | T4 | §5.3 | S |
| T8 发布/联调：已有库菜单补齐验证 | 联调 | T4 | §6.1 / R2 | XS |

优先级：T1 → T2 → T3 → T4 为关键路径；T5–T7 随对应实现并行推进；T8 在联调节点执行。

---

## T1 失效类型常量与无效记录写入服务

**目标**：提供唯一的失效类型枚举与"写一条无效警报记录"的服务方法。

**范围**
- `[NEW] backend/src/main/java/com/changxin/ams/InvalidAlarms.java`
- 失效类型常量 8 个（`FACTORY_NOT_SET` / `SUBSYS_NOT_SET` / `EQP_NOT_SET` / `EVENT_NOT_FOUND` / `SETTING_DISABLED` / `LEVEL1_NOT_SET` / `RECIPIENT_NOT_SET` / `IGNORED_DUPLICATE`）+ 中文标签映射 `label(type)`。
- `record(body, type, ctx)`：生成 `INVALID_KEY`（`store.key("invalid_alarms")`）、`INVALID_ID`（`0000000000` + 5 位十六进制）、`CREATE_DT`（`now()`）、`RECEIVE_TYPE=Mock`、`SOURCE=Test`、`REQUEST_USER_ID`；`TITLE` 截断 200；`FACTORY_KEY/SUB_SYS_KEY/EQP_KEY/ALARM_INFO_ID` 原样保留；名称字段由调用方在 `ctx` 传入或此处按 `store.find` 补齐。
- 不得自行开关事务：调用方已在 `store.write` 内。
- 序列：不改 `seed.json` 的 `meta.seq` 也能工作（`num(null)=0` → 从 1 起）；勿把 `INVALID_ID` 的十六进制序列写进 `meta.seq` 的 `alarmId`（会与正式告警共用计数器）。

**约束**
- 不修改 `Store`（不新增表结构、不改 schema 版本）。
- 不新增日志依赖；如加日志，使用参数化模板，不输出邮箱/密码（设计 §8）。

**验收**
- 常量代码唯一、与设计 §3.3 表逐项一致；`label()` 对全部 8 项非空。

---

## T2 引擎失效分支接入落库

**目标**：`AlarmEngine.trigger` 的每个失效分支在返回 422 的同时写入一条无效记录，且不改变既有响应。

**范围**
- `[MODIFY] backend/src/main/java/com/changxin/ams/AlarmEngine.java`
  - 构造器注入 `InvalidAlarms`（`final`）。
  - `invalid(...)` 扩展为带类型的内部方法（例如 `invalid(body, TYPE, ctx)`），保持 `m("ok",false,"status",422,"message",<原中文>)`。
  - 8 个判定点按**现有顺序**短路，逐个指定类型；并在已解析出 `setting` / `event` 时把它们放入 `ctx`（`ALARM_INFO_KEY` / `EVENT_KEY` / `EVENT_ID`）。
  - 重复抑制分支需在查重命中时记录 `IGNORED_DUPLICATE`（窗口判定不扩到非 Process，见设计 §2.2 / K3 §6）。
  - 成功路径不写无效记录。

**不得做**
- 不改动通配回退顺序；不因"具体配置隐藏"改走通配（NEG-IA-03）。
- 不改动 `IGNORE_PERIOD` 单位（秒）与默认值 900。
- 不改变返回 message 文案（现有 E2E 断言依赖）。

**验收**
- 8 类失效各触发一次 → 各新增 1 行且类型正确；成功触发 → 0 行新增。
- 失败请求不产生 `alarms` / `alarm_notifications`（NEG-IA-01）。

---

## T3 报表定义与查询（AVPA014）

**范围**
- `[MODIFY] backend/src/main/java/com/changxin/ams/Reports.java`
  - `definition("AVPA014")`：返回内置定义（不再依赖 `report_defs` 种子）：`REPORT_ID`、`REPORT_NAME=无效警报查询`、`REPORT_DESC=查询未成功触发的警报与失效原因。`、`ATLEAST_ONE_CONDITION=Y`、`COLUMNS` 与 `CONDITIONS` 按设计 §3.4 表；`CREATE_DT` 标 `type=date`。
  - 白名单从 3 项扩展为 4 项，既有 3 个分支行为保持不变。
  - `query("AVPA014", conditions)`：读 `invalid_alarms` → 补 `FACTORY_ID/NAME` 等展示字段（复用与 `AlarmEngine.enrich` 相同的 `store.find` 思路，**禁止**调用 `engine.enrich`，无效记录无 `ALARM_KEY`）→ 按设计 §3.5 把 `INVALID_TYPE` 输出为中文标签 + 另留 `INVALID_TYPE_CODE`（不列入 `COLUMNS`）→ 复用现有 `matches()` → `CREATE_DT` 倒序。
  - **过滤顺序**：先按条件过滤（含 `INVALID_TYPE` 中文标签），再格式化展示字段；避免展示替换影响条件匹配结果（二者都作用于中文标签值，顺序无冲突，但保持"先过滤后格式化"更易验证）。
- `[MODIFY] backend/src/main/java/com/changxin/ams/ApiController.java`：预期无需改动（校验 `reports/AVPA014/query|export` 走通用分支可用；若 `columns` 取值对 AVPA014 出错，仅在该处最小修正，不得重构路由）。

**约束**
- **禁止修改 `DataGrid.vue` / `ReportPage.vue`**：类型标签由服务端查询输出中文（设计 §3.5 唯一方案），不得为此新增通用 `displayMap`（会波及 AVPA004/007/013）。
- 不改 AVPA004/007/013 的输出。
- 报表代码固定为 `AVPA014`：**禁止**使用 `AVPA005`/`AVPA008`，这两个代码在 `WorkflowIntegrationTest` 中被断言为 404 / bootstrap 不含（设计 R8）。
- 内置定义的做法：AVPA014 不读 `report_defs`，避免依赖"种子是否被加载"的环境差异。

**验收**
- `GET /api/report-defs/AVPA014` → 200，`row.CONDITIONS` 含 `CREATE_DT`，`ATLEAST_ONE_CONDITION=Y`。
- `POST /api/reports/AVPA014/query` 无条件 → 400"至少选择一个查询条件"；字段非法 → 400"查询字段无效"；日期非法 → 400。
- `POST /api/reports/AVPA014/export` 空结果 → 仅表头 `xlsx`。

---

## T4 菜单功能项与前端路由/侧栏/词典

**范围**
- `[MODIFY] backend/src/main/resources/seed.json`：`functions` 追加 `AVPA014`（`FUNCTION_ID=FUNCTION_KEY=AVPA014`，`FUNCTION_NAME=无效警报查询`，`PATH=#/page/AVPA014`，`FUNC_TYPE=PAGE`，`VISIBLE=Y`，`ACTIVE=Y`，`SORT=10`，并把 `TEST` 由 10→11、`ACK_LIST` 由 11→12）。可选：`meta.seq.invalid_alarms=0`。
- `[MODIFY] frontend/src/pages/Workspace.vue`：报表白名单追加 `'AVPA014'`。
- `[MODIFY] frontend/src/components/AppSidebar.vue`：`groups` → `reports.codes` 追加 `'AVPA014'`；`icons` 增加 `AVPA014` 图标（从 `@ant-design/icons-vue` 选告警类，如 `WarningOutlined`；`DESIGN.md` 已确认使用官方 Ant Design Vue 图标，不自造图标集）。
- `[MODIFY] frontend/src/legacy-i18n.js`：复用 `无效警报查询` / `失效类型` / `无效警报识别码`；补齐 `失效原因`、`触发账号`、`判定时间`（若列头使用新词）。只加 key，不新增 `I18n.t()` 调用形态。

**注意**
- 种子仅对空库生效；已有库菜单需 T8 处理（设计 §6.1）。编码节点**不要**为此改动 `Store`。
- `seed.json` 单测风险：`WorkflowIntegrationTest` 断言 bootstrap 响应不含 `AVPA005`（非 AVPA014，无冲突），但若 seed 改动导致 JSON 结构错误，`Store.load` 将整库失败 → 改完必须跑完整 `mvn test`。
- i18n：`legacy-i18n.test.js` 断言"未入词典的 key 在英文下原样返回"，新增 key **不要**顺手写进该测试的既有断言。

**验收**
- 新库登录 → 侧栏「查询报表」下出现「无效警报查询」，点击后标题正确、显示"请执行查询"。
- 繁中/英文切换后标题与表头无未翻译残留。

---

## T5 后端测试（单元 + 集成）

**范围**
- `[NEW] backend/src/test/java/com/changxin/ams/unit/InvalidAlarmTypeTest.java`：UT-IA-01。
- `[MODIFY] backend/src/test/java/com/changxin/ams/unit/ReportConditionsTest.java`：UT-IA-02（AVPA014 定义）。
- `[NEW] backend/src/test/java/com/changxin/ams/InvalidAlarmIntegrationTest.java`：IT-IA-01 ~ IT-IA-05（MockMvc + 临时 H2，参照现有 `WorkflowIntegrationTest` 的建库方式）。
- 测试数据统一唯一前缀，避免与种子冲突（参照 `docs/e2e/README.md` 约定）。
- **种子 alarms 为空**（已核实 5 个告警相关集合均 0 条）：所有用例必须自造无效记录，禁止断言"种子中已有的无效数据"。可用素材：`F01/SS03/EQP01/PRT_NODYE`（成功路径）＋ 同一四要素二次触发（`IGNORED_DUPLICATE`）＋ 不存在的警报代码（`EVENT_NOT_FOUND`）。

**验收**
- `cd backend && mvn test` 全绿；新增用例覆盖设计 §5.1 全部编号。

---

## T6 后端接口 E2E

**范围**
- `[MODIFY] docs/e2e/backend-api-e2e.md`：新增 `TC-API-E2E-005 无效警报查询主链路`（步骤按设计 §5.2）。
- `[NEW] backend/src/test/java/com/changxin/ams/e2e/InvalidAlarmE2ETest.java`：类名/测试名与文本用例 ID 对应；继承 `E2ETestBase`。
- `[MODIFY] docs/e2e/README.md`：用例总表追加一行。

**验收**
- `bash scripts/run-java-e2e.sh` 中该用例 PASS；未配置 SMTP 不影响本用例（不依赖邮件）。

---

## T7 前端 E2E

**范围**
- `[MODIFY] docs/e2e/frontend-e2e.md`：新增 `TC-FE-E2E-006 无效警报查询页面`。
- `[NEW] e2e/frontend/06-invalid-alarm.spec.ts`：先经 API 造无效数据（触发**不存在的警报代码** → `EVENT_NOT_FOUND`），再经 UI 查询与导出。
  - **隔离要求**：不要复用 `04-alarm-workflow.spec.ts` 的四要素（`F01/SS03/EQP01/PRT_NODYE`）做"二次触发求忽略"，避免两 spec 共用临时 H2 时互相影响忽略窗口；忽略判定放在后端 `IT-IA-03` 覆盖。
- `[MODIFY] e2e/frontend/support/ams.js`：`MENU` 追加 `invalidAlarm`。
- `[MODIFY] docs/e2e/README.md`：用例总表追加一行。

**验收**
- `bash scripts/run-frontend-e2e.sh` 中该用例 PASS；截图/报告归档路径符合既有约定。

---

## T8 联调：已有库菜单补齐与回归

**目标**：验证"已存在数据的 H2 库"升级后也能看见并使用该报表（设计 R2；本地当前 `backend/data/` 为空，此场景需联调环境构造）。

**步骤**
1. 用一份预置业务数据的 `ams-mvp` 库（例如先以基线版本启动一次并提交若干主档/告警）启动新版本 → 预期侧栏**无**「无效警报查询」（验证 seed 不会对非空库生效）；
2. 先验证 `POST /api/reports/AVPA014/query` 在**无新菜单行**时仍可用（报表定义走代码、不依赖 `functions` 行）—— 这是"菜单缺失不影响能力"的关键证据；
3. 按设计 §6.1-A 通过功能选单维护补齐 `AVPA014` → 刷新后侧栏可见并可用；
4. 回归：AVPA004 / AVPA007 / AVPA013 查询与导出行为不变；`/api/alarms/test` 失败文案与状态码不变；
5. 记录结论到联调节点交付说明（不改代码即视为通过）。

**验收**
- 已有库经补齐后可查询；三个旧报表回归通过。

---

## 完成定义（DoD）

- [ ] T1–T7 代码与测试全部提交到 `feat/9a3c782a-5s1l`，远程可见；
- [ ] `cd backend && mvn test`、`bash scripts/run-java-e2e.sh`、`cd frontend && npm run test:unit`、`bash scripts/run-frontend-e2e.sh` 均执行并记录结果；
- [ ] `docs/e2e/*.md` 文本用例、测试代码名、报告名三者 ID 一致；
- [ ] 设计 §9 的 Q1–Q7 默认值被采用；若有变更，回写设计文档与测试用例；
- [ ] 未新增无关重构（不触碰 BYPASS/机况/权限/分页等非目标项）；
- [ ] **完整执行 `cd backend && mvn test`**（不只跑新增用例）：`WorkflowIntegrationTest` 中对 `AVPA005`/`AVPA008`=404、对 AVPA004/007/013 的查询断言必须保持通过（设计 R8/R9）；
- [ ] 报表代码确认为 `AVPA014`，未占用 `AVPA005`/`AVPA008`。
