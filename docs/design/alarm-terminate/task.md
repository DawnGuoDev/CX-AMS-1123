---
spec_id: SPEC-AMS-ALARM-TERMINATE-001
title: 警报强制中断能力 任务清单
status: draft
template_id: 任务拆分规范
schema_version: 1
created_at: 2026-11-26
updated_at: 2026-11-26
---

# 任务清单: 警报强制中断能力

> 来源：`docs/design/alarm-terminate/design.md`（linked_spec `SPEC-AMS-ALARM-TERMINATE-001`）。
> 顺序即依赖：字段/枚举先落，再后端事务分支，再前端交互，最后作业页与验证。
> 每项「设计来源」指向 design 章节；「验收」对应 Spec REQ 可断言点。

## 1. 数据与元数据准备

- [ ] 1.1 在 `backend/src/main/resources/metadata.json` 的 `masters.SBRM_USER.fields` 末尾追加字段 `{"name":"CAN_TERMINATE","label":"警报强制中断权限","type":"checkbox","grid":true,"filter":true}`，并在 `SBRM_USER.defaults` 增加 `"CAN_TERMINATE":"N"`；同时在 `pageTitles` 增加 `"ALARM_LIST":"警报强制中断作业"`。**设计来源**：2.5.8；**验收**：REQ-001 新建用户默认 `N`、列表/编辑可见。
- [ ] 1.2 在 `backend/src/main/resources/seed.json` 为 12 个用户补 `"CAN_TERMINATE"`：仅 `U001` 为 `"Y"`，其余 `"N"`；在 `functions` 追加 `ALARM_LIST`（`SORT=12`、`FUNC_TYPE=PAGE`、`VISIBLE/ACTIVE=Y`），不改动既有项。**设计来源**：1.2、2.5.8；**验收**：REQ-001/007 种子导航出现菜单，U001 可中断。
- [ ] 1.3 在 `backend/src/main/java/com/changxin/ams/Masters.java` 的 `options()` 中把 `alarmStatus` 由 `Process,Completed,NoNextLevel` 追加为 `Process,Completed,NoNextLevel,Terminated`。**设计来源**：1.2；**验收**：REQ-006 状态下拉含 `Terminated`。

## 2. 后端核心实现

- [ ] 2.1 `AlarmEngine`：新增常量 `COMMENT_MAX=500` 与私有 `boolean canTerminate(Map user)`（读最新主档 `users.CAN_TERMINATE=="Y"` 且 `Json.active`）。**设计来源**：2.5.1（步骤 3）、1.2。**验收**：REQ-001 改 `N` 后下一次请求即拒绝。
- [ ] 2.2 `AlarmEngine.close()`：保留原 5 参签名并委托到新增 6 参重载（`extra` 非空时 `alarm.putAll(extra)`），既有 ACK/NoNextLevel 行为不变。**设计来源**：2.5.2。**验收**：既有 `WorkflowIntegrationTest` 全绿。
- [ ] 2.3 `AlarmEngine.terminate(key, body, user)`：按「存在性 404 → `Process` 400 → 权限 400 → 原因非空/≤500 400」顺序校验，再在同一事务内 `close(alarm,"Terminated","AlarmTerminate",user,cmt,extra)`，最后返回 `{ok:true,alarm:enrich(...),terminated:true}`。**设计来源**：2.5.1。**验收**：REQ-003 全部拒绝分支与成功分支。
- [ ] 2.4 在 `terminate()` 内、`close()` 之后把该警报所有 `RESULT=Pending` 通知改为 `Skipped`、`MESSAGE="警报已中断，取消发送"`、`SEND_DT` 空则填当前时间；不改 `Success`/`Fail` 历史。**设计来源**：2.5.3。**验收**：REQ-004 Pending→Skipped 且不触发 SMTP。
- [ ] 2.5 `AlarmEngine.enrich()`：追加 `CAN_TERMINATE`（严格 `"Y"` 且 `STATUS=Process` 且 `user!=null`）与 `TERMINATE_USER_ID`/`TERMINATE_USER_NAME`（由 `TERMINATE_USER_KEY` 解析，缺失时按空/`SYSTEM`/`系统`），`TERMINATE_DT/CMT/USER_KEY` 由快照带出；`historicalDetail()` 在 `enrich(snapshot,null)` 后显式 `put("CAN_TERMINATE",false)`。**设计来源**：2.5.4。**验收**：REQ-002 五条矩阵。
- [ ] 2.6 `ApiController`：POST 分支新增 `alarms/:key/terminate` → `engine.terminate(p[1],body,user)`；GET 新增 `alarms/process`（仅 `Process`，`PRIORITY` 降序，`enrich(r,user)`），并在既有 `alarms/:key` 详情分支增加 `!p[1].equals("process")` 条件避免路由冲突。**设计来源**：2.5.5。**验收**：REQ-003 接口可用、REQ-007 列表数据。

## 3. 前端实现

- [ ] 3.1 `frontend/src/components/AlarmDetail.vue`：新增 `terminateOpen/terminateCmt/terminateError/terminating` 局部状态并在既有 `watch` 重置时清空；工具区按 `CAN_TERMINATE`/`STATUS`/`HISTORY_CONTEXT` 渲染「强制中断」按钮或禁用说明（文案见 design 2.5.6）。**设计来源**：2.5.6。**验收**：REQ-005 按钮显隐/禁用说明、历史无入口。
- [ ] 3.2 同文件新增二次确认 Modal（标题、目标信息、不可逆风险、必填原因 `maxlength=500`+计数、取消/确认中断、错误区），提交 `POST /alarms/:key/terminate`；成功关闭+`notify('警报已中断')`+`openAlarm(state.detail)`+`emit('changed')`，失败保留原因与弹窗；`STATUS=Terminated` 时渲染中断横幅（时间/操作人/原因）。**设计来源**：2.5.6。**验收**：REQ-005 全部交互条目。
- [ ] 3.3 `frontend/src/pages/OperationsPage.vue` 增加 `ALARM_LIST` 分支（`GET /alarms/process`、10s 定时刷新、`DataGrid` + `openAlarm`），`frontend/src/pages/Workspace.vue` 将 `ALARM_LIST` 分发给 `OperationsPage`，`frontend/src/components/AppSidebar.vue` 将 `ALARM_LIST` 加入 `operations` 分组与图标映射。**设计来源**：2.5.7。**验收**：REQ-007 菜单可见、列表可打开详情。
- [ ] 3.4 `frontend/src/style.css` 增加中断 Modal 风险块、中断横幅、字数计数的最小样式（复用现有 CSS 变量，不引入新主题）；`frontend/src/legacy-i18n.js` 先 `grep` 去重，再仅补缺失词条的三语条目。**设计来源**：2.5.9、2.5.10。**验收**：三语切换无回退中文 key。

## 4. 验证与收尾

- [ ] 4.1 新增 `backend/src/test/java/com/changxin/ams/AlarmTerminateIntegrationTest.java`，覆盖 design 第 6 章后端场景：成功、无权限三态、非 Process、原因边界、404、并发仅 1 次、层级/通知收敛、≥2 调度周期停止、`CAN_TERMINATE` 矩阵、AVPA004/007/013 口径、主档履历、菜单。**设计来源**：第 6 章。**验收**：REQ-001~007 后端可断言点。
- [ ] 4.2 新增 `frontend/src/components/__tests__/AlarmDetail.test.js`（按钮态、二次确认空原因不可提交、取消清空、失败保留原因）与必要的 `OperationsPage` 列表用例。**设计来源**：第 6 章。**验收**：REQ-005/007 前端行为。
- [ ] 4.3 新增 `e2e/frontend/06-alarm-terminate.spec.ts` 并在 `e2e/frontend/support/ams.js` 的 `MENU` 增加 `alarmTerminate`；按仓库惯例同步 `docs/e2e/` 文本用例与用例 ID 映射。**设计来源**：第 6 章。**验收**：REQ-005/007 端到端。
- [ ] 4.4 执行验证并记录结果：`cd backend && mvn test`、`cd frontend && npm run test:unit`、`bash scripts/run-frontend-e2e.sh`（及需要时 `bash scripts/build-java-vue.sh`）；记录命令、版本与失败项，旧包不用于结论。**设计来源**：第 6 章「兼容性/回归」。**验收**：既有用例零回归。
- [ ] 4.5 已知风险与默认方案在 MR 说明中登记：SMTP 竞态不承诺零邮件、权限粒度为全局、ACK 备注未同步加限、老库需管理员授权（design 5、5.1）。**设计来源**：第 5 章。**验收**：评审可追溯取舍。
