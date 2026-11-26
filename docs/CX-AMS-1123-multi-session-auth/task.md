---
spec_id: spec-cx-ams-1123-multi-session-auth
title: AMS 同账号多会话登录/退出 任务清单
status: draft
template_id: task-list
schema_version: 1
created_at: 2026-11-26T11:42:33Z
updated_at: 2026-11-26T11:42:33Z
---

# 任务清单: AMS 同账号多会话登录/退出

> 任务全部来源于同目录 `design.md`（章节号见括号），无超范围内容。
> 代码任务由「代码编写」节点执行；测试任务由「E2E测试用例编写」节点执行，本节点不落地代码。

## 1. 后端会话模型 准备工作

- [ ] 1.1 在 `backend/src/main/resources/application.yml` 新增 `ams.session.idle-timeout-minutes: ${AMS_SESSION_IDLE_TIMEOUT_MINUTES:30}`（design §2.9 / B5、B6）。
- [ ] 1.2 在 `Auth` 构造器注入 `Clock`（默认 `Clock.systemUTC()`）与 `@Value` 超时配置，解析为 `Duration`；`≤0` 回退 30 分钟并 `log.warn`（design §1.2、§2.9）。

## 2. 后端会话模型 核心实现

- [ ] 2.1 `Auth.login()` 删除 `removeIf` 中“同 userKey 全删”子句，仅保留超时清理；保持密码校验、停用校验与 401 文案不变（design §2.5 F1 / B1）。
- [ ] 2.2 `Auth.user()` 保持“取 Session → 判超时 → 判账号停用 → 刷新 `seen`”顺序，`loginAt` 从旧 Session 继承（design §2.5 F2 / B1、B5、B6、B7）。
- [ ] 2.3 `ApiController` 将 `logout` 分支前移到 `auth.user(token)` 之前，调用幂等 `auth.logout(token)` 并返回 `{ok:true}`（design §2.5 F3 / B3、B4）。
- [ ] 2.4 确认无其他读取 `sessions` 的绕过路径；`Auth` 公开方法仍为 `synchronized`（design §5 并发风险 / PRD-§10 Q4）。

## 3. 前端会话与交互 核心实现

- [ ] 3.1 `frontend/src/state.js` 的 401 分支：清本页 token、置 `state.user=null`，并按 `message` 归类过期/停用原因（design §2.5 F4 / B8、B11）。
- [ ] 3.2 `frontend/src/App.vue` 登录成功后 `router.replace` 到登录前目标路径，缺省 `/home`（design §2.5 F5 / B9）。
- [ ] 3.3 确认登出逻辑保持“调接口→清本页 token→回登录页”，无二次确认、不清其他页 `sessionStorage`（design §2.5 F3 / B10、B15）。
- [ ] 3.4 `frontend/src/legacy-i18n.js` 补齐“登入已逾时，请重新登入”“账号已停用”英文词条，繁中沿用简→繁转换（design §1.1 / B8、B11）。

## 4. 回归用例对齐

- [ ] 4.1 将 `WorkflowIntegrationTest#authenticationSingleSessionAndNoPasswordDisclosure` 显式改写为多会话断言（两次登录后 first token 仍 200），并按新语义更名（design §6 / AC14）。
- [ ] 4.2 `E2ETestBase` 支持追加 `--ams.session.idle-timeout-minutes` 启动参数，供闲置超时用例使用（design §5 风险 / B5、B6）。
- [ ] 4.3 新增 `BackendAuthE2ETest#shouldKeepSessionsIndependentForSameAccount`（TC-API-E2E-005，design §6）。
- [ ] 4.4 新增 `BackendAuthE2ETest#shouldIsolateAccountsAndExpireIdleSessions`（TC-API-E2E-006，短超时实例）。
- [ ] 4.5 新增前端 401 原因分类单测与 TC-FE-E2E-006/007 对应实现（由 E2E 用例节点落地，本清单只登记范围）。

## 5. 验证与收尾

- [ ] 5.1 执行 `cd backend && mvn -q test`，确认认证相关用例全部通过（design §6）。
- [ ] 5.2 执行 `cd frontend && npm run test:unit`，确认前端单测通过（design §6）。
- [ ] 5.3 执行 `bash scripts/run-frontend-e2e.sh frontend/01-login.spec.ts`，确认登录/登出/刷新行为（design §6）。
- [ ] 5.4 记录多实例部署与“会话无上限”两项已知限制到交付说明（design §5）。
