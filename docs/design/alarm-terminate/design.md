---
spec_id: SPEC-AMS-ALARM-TERMINATE-001
title: 警报强制中断能力 技术设计
status: draft
template_id: 技术设计模板
schema_version: 1
linked_spec: SPEC-AMS-ALARM-TERMINATE-001
baseline_design: null
depends_on_designs: []
supersedes_designs: []
created_at: 2026-11-26
updated_at: 2026-11-26
---

# Design: 警报强制中断能力

> Spec 回答 What/Why，Design 回答 How。
> 标识符（REQ/API/FIELD/STATE/MIG/NFR/DEP-xxx）沿用 Spec，不重新编号。
> 如果 Design 与 Spec 冲突，以 Spec 为准；如果需求不清楚，先提问再设计。

# 1. 方案概述

在既有 `AlarmEngine` 内新增「中断」收口方法 `terminate()`：服务端以「当前登录用户主档 `CAN_TERMINATE=Y` + 警报 `STATUS=Process` + 原因合法」三重校验后，在同一 `store.write()` 事务内完成 ①状态置 `Terminated` 并写 `COMPLETE_DT`/`TERMINATE_*`；②关闭所有 `Active` 层级；③同警报所有 `Pending` 通知改 `Skipped`；④写一条 `TRX_TYPE=AlarmTerminate` 交易。`ApiController` 新增 `POST /api/alarms/:key/terminate` 路由；`enrich()` 追加 `CAN_TERMINATE` 与中断展示字段（含操作人可读名）。前端在 `AlarmDetail.vue` 工具区增加「强制中断」+二次确认（Ant Design Modal），在 `Workspace`/`OperationsPage` 增加 `ALARM_LIST` 作业页，`AppSidebar` 归类；`SBRM_USER` 通过元数据新增权限复选框；`alarmStatus` 选项与报表口径按「只增不改」扩展。

## 1.1 影响范围

| 模块 / 层 | 文件或目录 | 改动说明 | 关联需求 |
|-----------|------------|----------|----------|
| 接口 | `backend/src/main/java/com/changxin/ams/ApiController.java` | 新增 `POST alarms/:key/terminate` 路由，转发 `engine.terminate()`；异常沿用 `ApiException` | REQ-003 |
| 服务逻辑 | `backend/src/main/java/com/changxin/ams/AlarmEngine.java` | 新增 `canTerminate()`、`terminate()`；`enrich()` 补 `CAN_TERMINATE`/`TERMINATE_*` 可读字段；扩充 `close()` 关闭全部层级（对中断复用） | REQ-002/003/004 |
| 数据模型 | `backend/src/main/resources/metadata.json` | `SBRM_USER.fields` 追加 `CAN_TERMINATE`（checkbox，+`pageTitles.ALARM_LIST`） | REQ-001/007 |
| 数据模型（报表/菜单选项） | `backend/src/main/java/com/changxin/ams/Masters.java` | `alarmStatus` 选项追加 `Terminated` | REQ-006 |
| 存储 / 数据库 | `backend/src/main/resources/seed.json` | 用户种子补 `CAN_TERMINATE`（U001=`Y`，其余 `N`）；`functions` 新增「警报强制中断作业」`ALARM_LIST` | REQ-001/007 |
| 报表 | `backend/src/main/java/com/changxin/ams/Reports.java` | **不改查询逻辑**；仅回归确认 `Terminated` 可按状态/交易类型查询且 AVPA013 不含 `Terminated` | REQ-006 |
| 前端 | `frontend/src/components/AlarmDetail.vue` | 工具区「强制中断」+二次确认 Modal+中断横幅+提交中态 | REQ-005 |
| 前端 | `frontend/src/pages/OperationsPage.vue`、`frontend/src/pages/Workspace.vue` | 新增 `ALARM_LIST` 作业页（`Process` 列表，`CAN_TERMINATE` 标识） | REQ-007 |
| 前端 | `frontend/src/components/AppSidebar.vue` | `ALARM_LIST` 归入「警报作业」分组与图标映射 | REQ-007 |
| 前端 | `frontend/src/style.css` | 中断二次确认/横幅所需最小样式（复用既有 `--accent`/`--border` 变量） | REQ-005 |
| 前端 | `frontend/src/legacy-i18n.js` | 复用既有词条；仅补缺失的新中文文案三语条目 | REQ-005/007 |
| 测试 | `backend/src/test/java/com/changxin/ams/WorkflowIntegrationTest.java`（或同目录新测试类） | 中断成功/拒绝分支/并发/调度停止/报表口径 | REQ-001~006 |
| 测试 | `frontend/src/components/__tests__/`、`frontend/src/pages/__tests__/` | 详情按钮态、二次确认校验、作业列表 | REQ-005/007 |
| 测试 | `e2e/frontend/06-alarm-terminate.spec.ts`（新增）+ `support/ams.js`（`MENU` 增项） | 端到端中断主流程与无权限分支 | REQ-005/007 |
| 外部依赖 | 无 | 中断不发 SMTP、不新增依赖 | — |
| 配置 | 无新增配置项 | 复用 `ams.scheduling` 等既有配置 | — |

## 1.2 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 权限字段命名 | `users.CAN_TERMINATE`（`Y/N`，默认 `N`） | 与 Spec 4.2 默认一致；`CAN_` 前缀与详情响应布尔 `CAN_TERMINATE` 同名但语义均为「是否可中断」，主档为存储值、响应为计算结果，命名不冲突且便于前后端对齐 |
| 权限判定来源 | 每次请求从 `store.find("users","USER_KEY",user.USER_KEY)` 读取；`user` 取自 `Auth.user(token)` 的内存会话快照（登录时副本） | 满足 REQ-001「改 N 后下一次请求即拒绝、无需重登」：判定不读会话副本，而读最新主档 |
| 中断写入口 | 复用 `AlarmEngine` 新方法 `terminate()`，内部复用 `close()` 的「置状态+关层级+写交易」骨架 | 符合知识库「状态机不在路由层实现」，且 `close()` 已是唯一状态收口 |
| Pending 通知收敛方式 | 在中断事务内直接把 `Pending→Skipped`（`MESSAGE="警报已中断，取消发送"`，`SEND_DT` 空则填当前时刻） | 不依赖下一次 `dispatch()`；即便 SMTP 正在发送，回写阶段会因 `STATUS!=Process` 再判 `Skipped`（幂等） |
| 状态优先级校验顺序 | 存在性(404)→`Process`(400)→权限(400)→原因(400) | 与 Spec 4.4 错误表顺序一致；对无权用户也避免在非处理中告警上泄露可操作信息 |
| 原因上限常量 | 新增 `AlarmEngine.COMMENT_MAX = 500`，中断使用；**ACK 备注不动** | Spec 4.2「按 ACK 备注对齐，默认 500」——仓库现状 ACK 无上限，本次不扩大 ACK 行为改动范围，仅以同值常量落地中断上限；ACK 是否同步加限列为待确认 |
| 详情请求触发方式 | 前端复用 `api(path, body)` 的 POST（`/alarms/:key/terminate`），GET 详情不变 | 与现有 `perform('ack')` 模式一致 |
| 历史详情 | `historicalDetail()` 在 `enrich(snapshot,null)` 后显式 `CAN_TERMINATE=false` | 与现有强制 `CAN_ACK=false` 同一处理点；`enrich(...,null)` 本身因 `user==null` 已得 `false`，显式设置防回归 |
| 作业页形态 | 复用 `OperationsPage.vue` 新增 `ALARM_LIST` 分支，后端新增 `GET /api/alarms/process` | 复用现有页面骨架与 `DataGrid`/`openAlarm`；避免新建独立页面文件与路由 |
| 状态枚举 | `Masters.options().alarmStatus` 追加 `Terminated`（仅追加） | REQ-006；不影响既有下拉顺序 |
| 报表 | 不改 `Reports.java` 查询代码 | AVPA004 数据源为 `alarms`（`enrich` 后含新状态与 `COMPLETE_DT`），AVPA007 数据源为 `alarm_transactions.STATUS_AFTER`，AVPA013 仅计 `Process`，均已天然满足 |

---

## 1.3 上游输入、知识库依据与设计约束

### 1.3.1 引用的上游产物

| 产物 | 类型 | 工作区路径 | 说明 |
|------|------|-----------|------|
| 需求Spec | spec | `artifacts/产品设计/需求Spec/SPEC-AMS-ALARM-TERMINATE-001.md`（manifest v1，`sync_status=synced`） | 本次唯一需求来源，REQ-001~007 |
| 产品原型 | bundle | `artifacts/产品设计/产品原型/index.html`（manifest v1）+ `screenshots/00~05` | 文案、布局、交互与 `CAN_TERMINATE`/`TERMINATED` 字段展示口径 |
| 基线代码 | commit | `artifacts/产品设计/DawnGuoDev_CX-AMS-1123@b36b758` | 与本地仓库 `repos/DawnGuoDev_CX-AMS-1123` 一致 |

说明：`repos/DawnGuoDev_CX-AMS-1123/docs/spec/SPEC-AMS-ALARM-TERMINATE-001.md` 与 `docs/design/alarm-terminate/` 下的原型副本同为上游产物在仓库内的同步副本，内容同源。

### 1.3.2 仓库职责边界

- 本产品仅 `DawnGuoDev/CX-AMS-1123` 单仓，基线 `release`（当前 `b36b758`），工作分支 `feat/0ae13b26-ka7z`。前后端在同一 Spring Boot JAR 内同源部署，**无跨仓依赖**。
- 本设计只覆盖该仓库的后端字段/接口/状态机/报表与前端详情、主档、作业页；数据库为 H2 单行 JSON 快照（`AMS_STATE.PAYLOAD`），无独立 DDL。

### 1.3.3 知识库依据（Context Search）

检索空间：`AMS-poc`（space_id `nwd6eqibk-diztqogvun`），检索主题：中断语义、权限边界、编码/数据库规范、架构约束、接口与状态机约定。

| 结论 | 来源证据（doc / unit） | 对设计的影响 |
|------|------------------------|--------------|
| `Terminated` 是既有领域状态（数值 3，「手动结束」），区别于 `Completed`(1)、`NoNextLevel`(2) | `AMS 背景介绍和名词解释（系统项目背景）.md` / `..._content_00002`；`AMS 背景介绍和名词解释.md` / `..._content_00002` | 本次不改状态语义与编号，仅落地「人工强制中断」入口；报表与详情沿用既有状态词口径 |
| 状态机需按「警报状态」与「通知状态」分离维护，新增状态须同步评估报表、待确认、历史与 UI | `01-编码规范.md` / `tos_md_ee22861eabe576a9ad446ea3fbaef794b095d544_content_00003` | 设计必须同时覆盖 `alarms.STATUS`、`alarm_notifications.RESULT`、AVPA013/004/007 与待确认列表（见 2.6、3） |
| 隐藏按钮不能阻止直接构造 POST，业务授权必须服务端校验（E07） | `04-常见错误案例库.md` / `tos_md_e7bf07766fd220e70ed54283f1e3a3238cfe2a74_content_00002`；`07-AMS系统页面功能汇整.md` / `..._content_00006` | 权限只认服务端主档字段；前端显隐不作为安全边界（见 2.5、5） |
| 有业务契机的局部问题优先在既有职责归属内实现，不在路由层复制告警状态机 | `01-编码规范.md` / `..._content_00002`（模块职责与依赖方向） | 状态收口放在 `AlarmEngine`，`ApiController` 仅做路由与响应映射（见 2.1、2.5） |
| 查重→状态变更→通知处理应在同一次受保护写操作内；SMTP I/O 必须在快照锁外 | `03-编码风格示例.md` / `..._content_00003`（原子操作与外部副作用） | 中断不强依赖 `dispatch()` 改写：在中断事务内直接 `Pending→Skipped`（见 1.2、2.5） |
| 当前为 H2 单快照存储，逻辑集合不是关系表；持久化必须复用既有事务边界 | `05-数据库编码规范.md` / `..._content_00002` | 无 DDL/迁移脚本；字段靠 JSON 默认值与 `metadata.json` 元数据（见 2.2、2.3） |
| 查询历史/报表必须保持历史快照语义，不能用当前主档覆盖过去 | `05-数据库编码规范.md` / `..._content_00001`；`01-编码规范.md` / `..._content_00002` | 中断信息写入告警本身与 `alarm_transactions`，历史详情按 `TRX_DT` 截断（见 2.5、3） |
| 前端编辑须使用独立草稿，取消即丢弃；Y/N 字符串 `"N"` 不可当真值 | `03-编码风格示例.md` / `..._content_00003`（前端配合） | 二次确认使用局部草稿，关闭即清空；`CAN_TERMINATE` 只接受布尔真（见 2.5） |

### 1.3.4 设计约束清单（来自仓库现状，只读探索结论）

1. **元数据驱动主档**：`metadata.json` 的字段 `type=checkbox` 在 `Masters.values()` 中归一为 `Y/N`，`Excel.verify()` 亦将 `Y/是/true/1` 归一为 `Y`，其余为 `N`；`FieldForm.vue` 用 `UiCheckbox true-value="Y" false-value="N"`。→ 切换权限字段只需补元数据 + 种子值。
2. **单一写事务**：`ApiController.api()` 对非 GET 请求整体包在 `store.write()` 中，`Store.write()` 失败回滚内存快照再重抛；业务校验统一用 `Json.require(...)`→`ApiException(status,message)`。
3. **状态收口**：`AlarmEngine.close()` 负责置 `STATUS`+`COMPLETE_DT`、仅将 `Active` 层级置 `Closed`、写交易；`tick()` 只遍历 `STATUS=Process`。
4. **派发语义**：`dispatch()` 在锁外发 SMTP，回写时若「层级已结束或警报非 Process」则记 `Skipped`；`Skipped` 不被 `tick()` 重送（仅重送 `Fail`）。
5. **详情富化**：`enrich(alarm,user)` 输出 `CAN_ACK`，`historicalDetail()` 额外强制 `CAN_ACK=false`。
6. **主档履历**：`Masters.save()` 对字段变更写 `store.audit()`（BEFORE/AFTER JSON 全量），新字段自动被记录。
7. **i18n 为键式词典**：`legacy-i18n.js` 以中文原文为 key，`t()` 查表；**禁止新增 `I18n.t()` 之外的翻译机制**，缺失词条需补简体/繁体/英文三条。
8. **前端无 Pinia/Vuex**：全局 reactive `state`（`frontend/src/state.js`）；详情弹窗由 `App.vue` 挂 `AlarmDetail`，列表刷新靠 `emit('changed')`。
9. **测试范式**：后端 `WorkflowIntegrationTest`（`@SpringBootTest` + MockMvc + `SmtpCapture`，`reset()` 直接重灌 `seed.json`）；前端 Vitest 组件测试；E2E Playwright `e2e/frontend/*.spec.ts` + `support/ams.js`。

---

# 2. 实现设计

## 2.1 文件清单

| 文件路径 | 新增/修改 | 职责 |
|----------|-----------|------|
| `backend/src/main/java/com/changxin/ams/AlarmEngine.java` | 修改 | `COMMENT_MAX`、`canTerminate()`、`terminate()`；`enrich()` 补 `CAN_TERMINATE`+`TERMINATE_DT/CMT/USER_KEY/USER_ID/USER_NAME`；`close()` 关闭全部层级（`Active`+未结束） |
| `backend/src/main/java/com/changxin/ams/ApiController.java` | 修改 | `POST alarms/:key/terminate` 路由；`GET alarms/process` 列表路由 |
| `backend/src/main/java/com/changxin/ams/Masters.java` | 修改 | `alarmStatus` 枚举追加 `Terminated` |
| `backend/src/main/resources/metadata.json` | 修改 | `masters.SBRM_USER.fields` 追加 `CAN_TERMINATE`；`pageTitles.ALARM_LIST` |
| `backend/src/main/resources/seed.json` | 修改 | 用户 `CAN_TERMINATE` 种子值；`functions` 新增 `ALARM_LIST` |
| `frontend/src/components/AlarmDetail.vue` | 修改 | 工具区按钮态、二次确认 Modal、中断横幅、提交中/失败保留 |
| `frontend/src/pages/OperationsPage.vue` | 修改 | `ALARM_LIST` 列表分支 + 10s 刷新（同 ACK_LIST 节奏） |
| `frontend/src/pages/Workspace.vue` | 修改 | `ALARM_LIST` 分发到 `OperationsPage` |
| `frontend/src/components/AppSidebar.vue` | 修改 | `operations` 分组 codes 与图标映射加入 `ALARM_LIST` |
| `frontend/src/style.css` | 修改 | 中断 Modal 风险块、横幅、字数计数等最小样式 |
| `frontend/src/legacy-i18n.js` | 修改 | 仅补缺失新文案三语条目 |
| `backend/src/test/java/com/changxin/ams/AlarmTerminateIntegrationTest.java` | 新增 | 中断后端集成测试（独立类，避免污染既有用例的 `seed.json` 重置） |
| `frontend/src/components/__tests__/AlarmDetail.test.js` | 新增 | 按钮态/二次确认组件测试 |
| `e2e/frontend/06-alarm-terminate.spec.ts` | 新增 | 端到端中断 + 无权限 |
| `e2e/frontend/support/ams.js` | 修改 | `MENU.alarmTerminate` |
| `docs/e2e/*.md` | 修改/新增 | 文本用例映射（按仓库 E2E 文本用例惯例） |

## 2.2 数据模型

| 对象 / 表 | 字段 | 类型 | 说明 | 关联 FIELD |
|-----------|------|------|------|------------|
| `users`（JSON 集合） | `CAN_TERMINATE` | 字符串 `Y`/`N` | 中断权限；缺省视为 `N`（`eq` 比较天然区分）；`metadata.json` 中 `type=checkbox`、`grid:true`、`filter:true`、`defaults` 不加（新记录由 `Masters.values` 归一为 `N`） | `CAN_TERMINATE`（主档存储） |
| `alarms` | `TERMINATE_DT` | ISO 时间字符串 | 中断时刻；仅中断写入 | `TERMINATE_DT` |
| `alarms` | `TERMINATE_CMT` | 文本（trim，≤500） | 中断原因 | `TERMINATE_CMT` |
| `alarms` | `TERMINATE_USER_KEY` | `USER_KEY` | 操作人主键 | `TERMINATE_USER_KEY` |
| `alarms` | `STATUS` | 枚举追加 `Terminated` | 终态 | `STATUS` |
| `alarm_levels` | `STATUS` | 既有 `Active`/`Closed` | 中断时所有 `Active`→`Closed`，不新增层级状态 | — |
| `alarm_notifications` | `RESULT` | 既有 `Pending/Success/Fail/Skipped` | 中断时 `Pending`→`Skipped` | — |
| `alarm_transactions` | `TRX_TYPE` | 自由文本追加 `AlarmTerminate` | 中断交易；`STATUS_BEFORE=Process`、`STATUS_AFTER=Terminated`、`NOTE=原因`、`USER_KEY=操作人` | — |
| 详情响应（派生，不落库） | `CAN_TERMINATE` | 布尔 | `bool(user.CAN_TERMINATE==Y) && STATUS==Process && 非历史` | `CAN_TERMINATE`（响应） |
| 详情响应（派生） | `TERMINATE_USER_ID`/`TERMINATE_USER_NAME` | 文本 | 由 `TERMINATE_USER_KEY` 解析；用户不存在时 `SYSTEM`/`系统`（与 `detail()` 既有 SECTION 解析口径一致） | — |

## 2.3 数据库变更

无 DDL。存储为 `AMS_STATE` 单行 JSON 快照（知识库 `05-数据库编码规范.md` 已确认），新增字段均以 JSON 键存在，读取端用 `s()`/`eq()` 容错缺省。

```sql
-- 变更 SQL：无。users/alarms 等为 PAYLOAD JSON 逻辑集合，不建表、不迁移。
-- 回滚：无数据回滚。代码回滚后，Terminated 告警将不再出现在 tick()/pending/AVPA013，
--       但 AVPA004/AVPA007 仍可按状态读取（只增不改，旧代码兼容）。
```

兼容与灰度：
1. 老库（已有 `AMS_STATE` 行）不存在 `users.CAN_TERMINATE` → 全部视为无权限，需管理员在主档勾选后生效。
2. 老 `alarms` 不存在 `TERMINATE_*` → 详情用 `—` 占位，不报错。
3. 种子变更只对**新库**（`AMS_STATE` 无数据）生效；老库通过主档页面/Excel 维护权限。

## 2.4 接口变更

| 接口 | 类型 | 请求变化 | 响应变化 | 兼容性 |
|------|------|----------|----------|--------|
| `POST /api/alarms/:key/terminate` | 新增 | Body `{cmt:String}` | 成功 `{ok:true, alarm:<detail 结构>, terminated:true}`；失败 `{ok:false,message}` | 纯新增 |
| `GET /api/alarms/:key` | 修改 | 无 | 新增 `CAN_TERMINATE`、`TERMINATE_DT`、`TERMINATE_CMT`、`TERMINATE_USER_KEY`、`TERMINATE_USER_ID`、`TERMINATE_USER_NAME` | 只增字段 |
| `GET /api/alarms/process` | 新增 | Query `q`（可选，前端本地过滤，不传） | `{ok:true, rows:[enrich 后告警]}`，仅 `STATUS=Process`，按 `PRIORITY` 降序（与 `pending` 一致） | 纯新增 |
| `GET /api/bootstrap` | 修改 | 无 | `options.alarmStatus` 含 `Terminated`；`nav` 含 `ALARM_LIST` | 只增 |
| `GET/PUT /api/master/SBRM_USER` | 修改 | Body 可含 `CAN_TERMINATE` | 行含 `CAN_TERMINATE`；履历 BEFORE/AFTER 记录 | 只增 |

错误语义（沿用 `ApiException`，`ok:false`）：

| 场景 | HTTP | message |
|------|------|---------|
| 未登录 | 401 | 现有鉴权提示（`store.write` 前置统一拦截） |
| 警报不存在 | 404 | `警报不存在`（`detail` 用；`terminate` 为避免遗漏先按 `ALARM_KEY` 查，查不到抛 404 `警报不存在`） |
| 非 `Process` | 400 | `该警报已非处理中状态` |
| 无权限 | 400 | `您没有强制中断权限` |
| 原因空 | 400 | `请填写中断原因` |
| 原因超长 | 400 | `中断原因不可超过 500 个字符` |

## 2.5 核心流程

### 2.5.1 `AlarmEngine.terminate(key, body, user)`

1. `alarm = store.table("alarms").stream().filter(r -> eq(r,"ALARM_KEY",key) || eq(r,"ALARM_ID",key)).findFirst()`（与 `detail()` 同口径支持两键）；为空 → `ApiException(404,"警报不存在")`。
2. `require(eq(alarm,"STATUS","Process"), "该警报已非处理中状态")`。
3. `require(canTerminate(user), "您没有强制中断权限")`；`canTerminate(user)` = `user != null && eq(store.find("users","USER_KEY",user.get("USER_KEY")), "CAN_TERMINATE", "Y") && Json.active(row)`（隐藏/停用即无权限）。
4. `cmt = s(body,"cmt").trim()`；空 → `require(false,"请填写中断原因")`；长度 > `COMMENT_MAX` → `require(false,"中断原因不可超过 500 个字符")`。
5. 调用 `close(alarm, "Terminated", "AlarmTerminate", user, cmt, true)`（见 2.5.2）。
6. 返回 `m("ok",true,"alarm",enrich(alarm,user),"terminated",true)`。

并发：整个流程在 `ApiController` 的 `store.write()`（`Store` 全局 `synchronized`）内执行；第二笔请求读到 `Terminated` 即失败，保证仅一条 `AlarmTerminate`。直接调用 `engine.terminate()` 的测试亦须包 `store.write()`（与既有 `engine.action()` 用例一致）。

### 2.5.2 `close()` 重构（最小改动）

现状：`close()` 只把 `Active` 层级置 `Closed`，原因：`tick()` 升级后旧层级已 `Closed`。中断需关闭**所有尚未结束层级**（含因升级被置 `Closed`？—— Spec REQ-004 口径为「当前层级 `Active`→`Closed`」，与 `close()` 行为一致）。

因此 `close()` 保持「置 `STATUS`+`COMPLETE_DT`；`Active`→`Closed`；写交易」不变，新增重载参数 `extra`：
- `close(alarm, status, type, user, note)` → 委托 `close(..., null)`。
- `close(alarm, status, type, user, note, extra)`：在 `alarm.put("STATUS"/"COMPLETE_DT")` 后，若 `extra` 非空则 `alarm.putAll(extra)`；再关闭 `Active` 层级、写交易。
- `terminate()` 传入 `extra = m("TERMINATE_DT", nowMillis, "TERMINATE_CMT", cmt, "TERMINATE_USER_KEY", user.USER_KEY)` 并传入同一 `now` 用于 `COMPLETE_DT`（两者取同一时间点，避免前端展示先后不一致）。

`TERMINATE_DT` 存储格式：仓库时间统一由 `Json.now()` 产出（ISO 字符串）；详情时间字段由前端 `new Date(v).toLocaleString()` 渲染，故写入 `Json.now()` 即可（与 `COMPLETE_DT`、`CREATE_DT` 同口径）。

### 2.5.3 待发通知收敛（在 `close()` 之后、交易写入之前，同一事务）

```
related("alarm_notifications", alarm.ALARM_KEY)
  .filter(r -> eq(r,"RESULT","Pending"))
  .forEach(r -> { r.put("RESULT","Skipped"); r.put("MESSAGE","警报已中断，取消发送");
                  if (s(r,"SEND_DT").isBlank()) r.put("SEND_DT", now); });
```

- 该处理只针对中断路径（在 `terminate()` 内调用，不放 `close()` 公共路径，避免改变 ACK/NoNextLevel 完成时对 `Pending` 的既有处理）。
- 交易 `DETAIL_SNAPSHOT` 由 `transaction()` 现取当前集合快照，因此快照内的 `NOTIFICATIONS` 已是 `Skipped`（与原型 05 交易履历截图一致）。
- 与 `dispatch()` 竞态：`dispatch()` 在锁外 SMTP 完成后回写，会重新读 `alarms.STATUS`；`Terminated` 时 `current=false` → 记 `Skipped`，不会把已发出邮件改写为 `Fail`/重送。
- `tick()` 只遍历 `Process`，`Terminated` 后不会再出现 `LevelUpgrade`/`AlarmFail`/`AlarmComplete`/重送。

### 2.5.4 `enrich()` 增补

```java
String terminateStatus = s(alarm,"TERMINATE_USER_KEY");
var terminator = terminateStatus.isBlank() ? null : store.find("users","USER_KEY",alarm.get("TERMINATE_USER_KEY"));
result.putAll(m(
  "CAN_TERMINATE", user != null && eq(alarm,"STATUS","Process") && "Y".equals(s(store.find("users","USER_KEY",user.get("USER_KEY")),"CAN_TERMINATE")),
  "TERMINATE_USER_ID", terminator == null ? (terminateStatus.isBlank() ? "" : "SYSTEM") : terminator.get("USER_ID"),
  "TERMINATE_USER_NAME", terminator == null ? (terminateStatus.isBlank() ? "" : "系统") : terminator.get("USER_NAME")));
```

- `CAN_TERMINATE` 必须只接受字符串 `"Y"`（避免 `"N"` 被当作真值，知识库 E07/编码风格要求）。
- `TERMINATE_DT`/`TERMINATE_CMT`/`TERMINATE_USER_KEY` 由 `copy(alarm)` 已带出，无需重写。
- `historicalDetail()` 在 `enrich(snapshot,null)` 之后追加 `result.put("CAN_TERMINATE",false)`，与既有 `CAN_ACK=false` 并列。
- 注意：`enrich()` 被 `Reports.summary()`/`Reports.query()` 以 `user=null` 调用，每次多一次 `store.find(users)` 仅在 `user!=null` 时发生，性能影响可忽略。

### 2.5.5 `ApiController` 路由

```java
// GET 分支： alarms/process
if (path.equals("alarms/process")) yield m("ok",true,"rows",store.table("alarms").stream()
    .filter(r -> eq(r,"STATUS","Process")).map(r -> engine.enrich(r,user))
    .sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"PRIORITY")).reversed()).toList());
// POST 分支：
if (method.equals("POST") && p.length==3 && p[0].equals("alarms") && p[2].equals("terminate"))
    return engine.terminate(p[1], body, user);
```

注：`get()` 的 `switch(path)` 需把 `"alarms/process"` 放在 `p.length==2 && p[0].equals("alarms")` 的 default 分支**之前**判断，避免与 `alarms/:key` 冲突（`path.split("/")` 对 `alarms/process` 长度为 2，会先命中详情分支——因此必须在 `default` 前显式判断，或改为 `p.length==2 && p[0].equals("alarms") && !p[1].equals("process")`）。设计采用后者更稳妥：详情分支加 `!p[1].equals("process")` 条件。

### 2.5.6 前端详情交互（`AlarmDetail.vue`）

状态：
- `terminateOpen = ref(false)`、`terminateCmt = ref('')`、`terminateError = ref('')`、`terminating = ref(false)`。
- `watch` 既有 `ALARM_KEY/HISTORY_CONTEXT.TRX_KEY` 重置时同步清空上述状态（草稿隔离）。
- 打开时重置 `terminateCmt/terminateError`。

按钮区（主资讯工具区，与「警报确认」同排，仅 `!HISTORY_CONTEXT`）：
- `CAN_TERMINATE === true`：主危险按钮「强制中断」（`danger`），点击 `terminateOpen=true`。
- `HISTORY_CONTEXT` 存在：不渲染按钮（REQ-005）。
- `STATUS==='Process' && CAN_TERMINATE!==true`：禁用按钮 +「您没有强制中断权限，请联系具权限人员处理。」（工具区说明）。
- `STATUS==='Terminated'`：禁用按钮 +「警报已中断，流程已结束」。
- 其他非 `Process`：禁用按钮 +「仅处理中（Process）的警报可中断」。

二次确认 Modal（Ant Design `a-modal`，宽度 640，`maskClosable=false`，`destroyOnClose`）：
- 标题「确认强制中断警报？」；识别码/标题/范围三行；风险块既定文案；「中断原因」必填 textarea（`maxlength="500"`，`show-count`，占位既定文案）；错误提示区；底部「取消」「确认中断」（danger，`:disabled="busy||!cmt.trim()"`，`:loading="terminating"`）。
- 校验：前端仅 `trim()` 非空与长度提示；**不做权限判断**，服务端为准。
- 提交：`api('/alarms/'+ALARM_KEY+'/terminate',{cmt})`；成功 → 关闭 Modal、`terminateOpen=false`、`notify('警报已中断')`、`openAlarm(state.detail)`（刷新详情，`openAlarm` 接受行对象，天然兼容）、`emit('changed')`；失败 → Modal 保留、`terminateError=error.message`、原因保留。
- 中断横幅：`STATUS==='Terminated'` 且非历史时，在工具区下渲染「警报已中断 · Terminated」+ 说明 + 中断时间/操作人（`USER_NAME (USER_ID)`）/原因三行。

实现形态：Modal 使用 `a-modal` 直渲（与 `RecordDialog` 同库），**嵌套在 `RecordDialog` 内部**需注意 Ant Design z-index 与 `getContainer`：采用 `:get-container="() => document.body"` 固定到 body，避免被详情弹窗裁剪；关闭用 `:open="terminateOpen"`。

### 2.5.7 作业页（`ALARM_LIST`）

- `OperationsPage.vue` 增加分支：`if(props.code==='ALARM_LIST')` → `api('/alarms/process')`；`onMounted` 复用 `ACK_LIST` 的 10s 定时刷新（`document.hidden` 时暂停）。
- 列：复用 `alarmColumns`（含 `STATUS`、`LEVEL_ACK_COUNT`/`LEVEL_REQUIRED`、`CREATE_DT`）。
- 行点击 → `openAlarm(row)`，进入 REQ-005 交互；无权限账号仍可查看列表，但详情按钮为禁用态（服务端仍拒绝）。
- `Workspace.vue`：`['TEST','ACK_LIST','ALARM_LIST'].includes(code)`。
- 页面标题：`metadata.json` `pageTitles.ALARM_LIST = "警报强制中断作业"`（`Workspace` 的 `title` 计算已含 `pageTitles` 回退）。
- `AppSidebar`：`operations.codes` 增加 `'ALARM_LIST'`，`icons` 增加 `ALARM_LIST: InboxOutlined`（或 `WarningOutlined`，取现有已导入图标，避免新增依赖导入）。

### 2.5.8 主档权限字段与种子

`metadata.json` `masters.SBRM_USER.fields` 末尾追加：

```json
{"name":"CAN_TERMINATE","label":"警报强制中断权限","type":"checkbox","grid":true,"filter":true}
```

- 不设 `defaults`：`Masters.values()` 对 checkbox 未传值时不进入分支（`body.containsKey` 判断在前，未传则不加字段）；为了让新记录显式为 `N`，在 `defaults` 增加 `"CAN_TERMINATE":"N"`（`save()` 新增时先 `copy(defaults)` 再 `putAll(values)`，若前端复选框未勾选会提交 `"N"` 覆盖，行为正确）。
- `seed.json`：12 个用户统一加 `"CAN_TERMINATE":"N"`；仅 `U001`（`E0043258`，现有登录演示账号、`title=设备工程师`）设 `"Y"` 作为演示账号（Spec 5.2 默认方案）。
- `functions` 追加：

```json
{"FUNCTION_KEY":"ALARM_LIST","FUNCTION_ID":"ALARM_LIST","FUNCTION_NAME":"警报强制中断作业","PARENT_KEY":null,"PATH":"#/page/ALARM_LIST","SORT":12,"FUNC_TYPE":"PAGE","VISIBLE":"Y","ACTIVE":"Y"}
```

`SORT=12` 追加在 `ACK_LIST(11)` 之后，不改动既有排序。

### 2.5.9 i18n

- 复用既有词条：`警报强制中断作业`（EN `Force Terminate Alarm`）、`警报已中断`、`中断`、`中断后警报将无法再确认` 不直接适用。
- 需补充的中文原文（作为 key，三语均补）：
  - `强制中断`、`确认强制中断警报？`、`中断原因`、`取消`、`确认中断`、`中断失败`、`警报已中断，流程已结束`、`仅处理中（Process）的警报可中断`、`您没有强制中断权限 请联系具权限人员处理`、`中断时间`、`中断操作人`、`中断后警报将结束且无法恢复 当前层级将关闭 不再发送通知 升级或失败重送`（标点精简为词典一致风格）。
  - 若项目既有 `取消`/`确定` 等通用词已存在则**不重复添加**（实现前用 `grep` 校验，避免重复 key 覆盖繁体/英文）。
- 不新增 `I18n.t()` 之类新机制；仅沿用 `legacy-i18n.js` 的 `t(key)`。

### 2.5.10 埋点

- 仓库当前无埋点 SDK / 指标上报约定（`knowledge/context/tech-stack.md`「观测与运维」仅 Actuator/Prometheus + 业务库记录）。本次**不新增埋点**，中断可观测性依赖：`alarm_transactions`（审计事实）、`ApiController` 既有 `traceId` 错误日志、`alarm_notifications.MESSAGE`。

## 2.6 状态变化

| 操作 | 前置状态 | 目标状态 | 说明 |
|------|----------|----------|------|
| 强制中断（权限+原因合法） | `Process` | `Terminated` | 写 `COMPLETE_DT`/`TERMINATE_*`，`Active` 层级→`Closed`，`Pending` 通知→`Skipped`，写 `AlarmTerminate` 交易 |
| 强制中断（无权限） | `Process` | `Process`（不变） | 400 `您没有强制中断权限` |
| 强制中断（非 Process） | `Completed`/`NoNextLevel`/`Terminated` | 不变 | 400 `该警报已非处理中状态` |
| 强制中断（原因空/超长） | `Process` | `Process`（不变） | 400 原因提示 |
| 撤销中断 | `Terminated` | 不支持 | 无出边，无接口 |

`Terminated` 无出边：`tick()`/ACK/`dispatch()` 均以 `STATUS=Process` 为前提，天然不推进。

## 2.7 异步处理

| 任务 / 事件 | 触发时机 | 处理逻辑 | 失败处理 |
|-------------|----------|----------|----------|
| `EngineScheduler.tick()` | 每 2s（`ams.scheduling`） | 仅 `Process` 告警；`Terminated` 不进入任何分支 | 不适用（不处理即终止） |
| `AlarmEngine.dispatch()` | 每 2s tick 后 | 待发通知在回写时判定 `STATUS!=Process` → `Skipped` | SMTP 已发出不回撤（Spec 5.2 竞态风险） |

## 2.8 外部依赖

无新增。中断流程**不调用 SMTP**。

## 2.9 配置

无新增配置项。`COMMENT_MAX=500` 为代码常量（Spec 5.2 允许参数级调整）；如后续需要可配置，改为 `application.yml` 的 `ams.alarm.terminate-comment-max`，本次不做。

---

# 3. 兼容性与迁移

| 影响对象 | 兼容策略 | 迁移步骤 |
|----------|----------|----------|
| 既有告警数据 | 只读兼容；缺 `TERMINATE_*` 时详情显示空 | 无 |
| 既有用户数据 | 缺 `CAN_TERMINATE` 视为无权限（`s()` 得空串，不等于 `"Y"`） | 无；管理员按需在主档/Excel 授予 |
| 既有接口 | `GET /api/alarms/:key`、`/ack`、`/pending` 行为不变；`alarms/process` 为新增 | 无 |
| 报表 AVPA004/007 | 数据源已含新状态与交易；列定义不新增「中断原因」列（Spec 4.2 说明默认不改报表列） | 回归既有三种状态查询结果不变 |
| 报表 AVPA013 | 仅计 `Process`，中断后自动减少 | 回归 |
| Excel 用户导入/导出 | 新字段自动进入列（非 password/非 readOnly），`Excel.verify` 对 checkbox 归一；旧模板缺列时 `values` 无该键 → `Masters.values` 不写入 → 编辑保留原值、新增取 `defaults`=`N` | 无需重发模板；建议重导出新模板 |
| 历史交易详情 | `historicalDetail` 强制 `CAN_TERMINATE=false`，不出现中断入口 | 无 |
| 数据库 schema | `meta.schema='checked-mvp-1'` 不变（不涉及 schema 版本升级） | 无 |

---

# 4. 上线与回滚

| 步骤 | 动作 | 备注 |
|------|------|------|
| 1 | 合并并发布代码（单仓，前后端同一 JAR） | `bash scripts/build-java-vue.sh` 先前端后 `mvn -Pweb` |
| 2 | 配置权限 | 管理员在「使用者设定」勾选 `警报强制中断权限`（老库必做；新库 U001 已为 `Y`） |
| 3 | 观察核心指标和日志 | 侧栏出现「警报强制中断作业」；`alarm_transactions` 出现 `AlarmTerminate`；`ApiController` 无异常 `traceId` 激增 |

**回滚预案**：直接回滚代码。已中断的告警保持 `Terminated` 记录（AVPA004/007 可查），旧代码 `tick()`/`pending`/AVPA013 天然忽略非 `Process`，无需回滚数据；`users.CAN_TERMINATE` 为无副作用新增字段，可保留。回滚后前端不再展示中断入口。

---


# 5. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 中断与 SMTP 派发竞态：中断瞬间已出队的邮件仍可能发出 | 收件人收到一封「已被中断」的邮件 | Spec 5.2 已声明不承诺绝对零邮件；`dispatch()` 回写改为 `Skipped`，后续不再重送 |
| `CAN_TERMINATE` 语义同名（主档存储 vs 详情响应布尔） | 阅读代码时可能混淆 | 主档存 `Y/N` 字符串、响应为布尔；命名注释与元数据 label 明确；测试覆盖 `"N"` 不得为真 |
| 权限为全局（不区分厂别/事件） | 授权粒度过粗 | 非目标；后续独立需求 |
| 原因上限与 ACK 备注不一致（ACK 目前无上限） | 用户预期差异 | 本次只对中断设 500；ACK 是否同步加限列为待确认，避免扩大改动范围 |
| `close()` 重载改动影响 ACK 完成路径 | 既有 `Completed`/`NoNextLevel` 回归 | 重载委托保持原签名行为，仅 `extra!=null` 时新增字段写入；既有测试全量回归 |
| 老库用户无权限导致功能「看不见入口」 | 上线后误判缺陷 | 上线步骤 2 明确授权；详情禁用态文案提示联系有权限者 |
| 作业页 `alarms/process` 路由与 `alarms/:key` 冲突 | 详情取到 `process` 当 key 报 404 | 设计明确在详情分支排除 `p[1]=="process"`；测试覆盖 |

## 5.1 待确认项（不阻塞实现，均有默认方案）

| 项 | 默认方案 | 影响 |
|----|----------|------|
| 权限字段命名 | `CAN_TERMINATE` | 若改为 `IS_ALARM_TERMINATE`，仅需同步 `metadata.json`/`seed.json`/`enrich`/`terminate` 4 处常量 |
| 首授予账号 | `U001`（`E0043258`）在种子中置 `Y`，其余 `N` | 影响演示账号可见性 |
| 中断通知反向发送 | 不发（仅 `Skipped` + 履历） | 如需发送属新需求 |
| ACK 备注是否同步加 500 上限 | 本次不加，仅中断加 | 若产品要求对齐，追加 `action("ack")` 校验与测试 |

## 5.2 设计自检结论

| 自检项 | 类别 | 结论 |
|--------|------|------|
| 已完整阅读工作区 Spec/原型/基线代码 | 前置输入 | 通过：见 1.3，仓库副本与 artifacts 同源 |
| 记录上游产物路径、职责边界与对齐关系 | 前置输入 | 通过：1.3.1/1.3.2，单仓无跨仓设计 |
| 严格遵循模板结构（1~6 章 + 模板字段） | 文档结构 | 通过：一级章节与模板一致；1.3/5.1/5.2 为章内补充，不删模板字段 |
| 最小必要变更、无无关抽象/重构/新框架 | 范围 | 通过：不改报表代码、不改 ACK 语义、不新建页面文件、不加依赖 |
| 只覆盖当前 Repo | 范围 | 通过：仅 CX-AMS-1123 |
| 任务可追溯至设计 | 任务拆分 | 通过：见 `task.md` 各任务「设计来源」列 |
| 未知项标记、无虚构接口/数值 | 事实边界 | 通过：5.1；知识库结论均附来源 |
| 后端 API 兼容性/错误语义/字段约束 | Domain backend | 通过：2.4/2.5 |
| 数据模型/migration/回滚 | Domain backend | 通过：2.2/2.3（无 DDL，JSON 兼容） |
| 配置/开关/阈值/权限默认值 | Domain backend | 通过：2.5.8/2.9 |
| 前端状态管理一致性 | Domain frontend | 通过：复用 `state`+`act`/`api` |
| i18n 章节（是否新增 `I18n.t()`） | Domain frontend | 通过：2.5.9，不新增新机制 |
| 埋点章节（事件/参数/时机/SDK） | Domain frontend | 通过：2.5.10，现有无 SDK，不新增 |

**结论**：设计可直接进入编码阶段；5.1 四项为参数级默认值，不阻塞实现。

---

# 6. 测试要点

| 场景 | 方法 | 关联 REQ |
|------|------|----------|
| 正常主流程：有权限 + Process + 合法原因 → `Terminated`，`COMPLETE_DT`/`TERMINATE_*` 写入，交易 `AlarmTerminate` 一条 | 后端集成：`store.write(() -> engine.terminate(key, m("cmt","机台已修复"), user))` 断言返回与库记录 | REQ-003/004 |
| 权限拒绝：`CAN_TERMINATE=N`、缺字段、用户 `ACTIVE=N` | 后端集成：逐项断言 `ApiException` message 与库无变化 | REQ-001/003 |
| 状态拒绝：`Completed`/`NoNextLevel`/`Terminated` 再中断 | 后端集成：断言 400「该警报已非处理中状态」，交易数不变 | REQ-003 |
| 原因校验：缺失/空白/501 字符/500 字符边界 | 后端集成：断言 400 与成功边界 | REQ-003 |
| 不存在的 key | 后端集成：404 `警报不存在` | REQ-003 |
| 并发中断 | 后端集成：8 线程同时 `store.write(terminate)`，断言成功 1、`AlarmTerminate` 恰 1 条 | REQ-003 |
| 层级与通知收敛 | 后端集成：断言 `alarm_levels.STATUS=Closed`（所有 Active）、`Pending→Skipped` 且 `MESSAGE`/`SEND_DT`；`Success` 不变 | REQ-004 |
| 调度停止 | 后端集成：中断后把时间回拨并 `tick()`+`dispatch()` ≥2 次，断言无新交易、无新通知、SMTP 消息数不增 | REQ-004 |
| 详情 `CAN_TERMINATE` 矩阵 | 后端集成：有权限+Process=`true`；无权限/非 Process/`?transaction=`=`false`；`CAN_ACK` 不受影响 | REQ-002 |
| 报表口径 | 后端集成：AVPA013 不含 `Terminated`；AVPA004 按 `STATUS=Terminated` 命中且 `COMPLETE_DT` 非空；AVPA007 按 `TRX_TYPE=AlarmTerminate` 命中且 `NOTE=原因` | REQ-006 |
| 主档字段 | 后端集成：SBRM_USER 保存 `CAN_TERMINATE` 后 `history` 记录变更；Excel 导入 `是/Y/NA` 归一 | REQ-001 |
| 菜单 | 后端集成：`nav` 含 `ALARM_LIST`；`VISIBLE=N`/`ACTIVE=N` 后不出现 | REQ-007 |
| 前端组件 | Vitest：有权限按钮可用；无权限禁用说明；历史无按钮；二次确认空原因不可提交；取消清空；失败保留原因 | REQ-005 |
| 端到端 | Playwright：登录 → 「警报强制中断作业」→ 打开 Process 详情 → 中断 → 状态 `Terminated` 与中断信息 → 列表不再出现；无权限账号禁用态 | REQ-005/007 |
| 兼容性 / 回归 | `cd backend && mvn test`、`cd frontend && npm run test:unit`、`bash scripts/run-frontend-e2e.sh` | 全部 |
