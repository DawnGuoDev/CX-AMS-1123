# 任务清单：AMS 多用户登录/退出会话隔离

- **Spec**：`SPEC-AMS-SESSION-MULTIUSER-001`
- **设计**：`docs/tech-design/session-multiuser-design.md`
- **Repo / 分支**：`DawnGuoDev/CX-AMS-1123` @ `feat/ef07d5ab-hmg5`
- 每条任务可追溯到设计章节；未列入的清理/重构不属本轮范围。

---

## T1 后端：登录不再按账号踢出旧会话（设计 §4.1）

- [ ] T1.1 `backend/src/main/java/com/changxin/ams/Auth.java`
  - 移除 `login()` 中 `e.getValue().userKey.equals(...)` 条件，仅保留 `now - seen > 1_800_000` 的超时清理；
  - 新增 `private static final long IDLE_TIMEOUT_MS = 1_800_000L;` 并在 `login()`/`user()` 共用；
  - 保持每次登录签发全新 32 字节 token，`Session(userKey, loginAt, seen)` 结构不变。
- [ ] T1.2 `Auth.loginAt()` 空值防御：`Session` 为 null 时返回 `""`（设计 §4.3）。
- [ ] 验收：同账号两次登录后两个 token 均可 `user()` 通过。

## T2 后端：登出前置且幂等（设计 §4.4）

- [ ] T2.1 `backend/src/main/java/com/changxin/ams/ApiController.java`
  - 将 `if (path.equals("logout") && method.equals("POST")) { auth.logout(token); return m("ok",true); }` 移至 `auth.user(token)` 之前；
  - 保持 `bootstrap` 分支顺序不变（`auth.user` → `auth.loginAt`）；
  - 不调用 `store.write` 之外的写操作，不新增审计记录、不记录 token。
- [ ] 验收：任意 token（有效/失效/伪造/空）POST `/api/logout` 返回 200 `{ok:true}`；登出后原 token 访问 `/api/bootstrap` 为 401。

## T3 后端单测（设计 §8.1）

- [ ] T3.1 新增 `backend/src/test/java/com/changxin/ams/unit/AuthSessionTest.java`
  - `loginKeepsOtherSessionsOfSameUser`：同账号两次登录，两个 token 均可用，`USER_ID` 一致；
  - `loginIssuesUniqueToken`：两 token 不同且匹配 `[0-9a-f]{64}`；
  - `logoutIsIdempotentForUnknownToken`：未知/空 token 登出不抛异常，之后 `user()` 抛 401；
  - `timeoutCleanupDoesNotRemoveFreshSessionsOfWorkmate`：同账号第二会话不使第一会话失效。
  - 构造 `Auth` 时复用 `AuthPasswordTest` 读取 `seed.json` 的方式构造 `Store`，不启动 Spring。
- [ ] T3.2 确认 `AuthPasswordTest` 不改且通过。

## T4 前端：401 统一清理与提示状态（设计 §5.1）

- [ ] T4.1 `frontend/src/state.js`
  - `state` 新增 `sessionNotice: ''`；
  - 401 且 `path !== '/login'` 分支：移除 token、`state.user = null`、`state.detail = null`、`state.sessionNotice = data.message || '登入已逾时，请重新登入'`；
  - 不引入 router 依赖。
- [ ] 验收：401 后 token 移除、detail 置空、sessionNotice 有值；`/login` 401 不受影响。

## T5 前端：跳转登录页并展示一次性提示（设计 §5.2/§5.3）

- [ ] T5.1 `frontend/src/App.vue`
  - `watch(() => state.sessionNotice, ...)`：非空且 `!state.user` 时清 `state.error` 并 `router.push('/home')`（已在 `/home` 不重复跳转）；
  - `login()` 成功路径：写入 token 后 `state.sessionNotice = ''`；
  - `logout()`：补 `state.sessionNotice = ''` 与 `state.error = ''`，保留现有清 token/user/detail 与 `router.push('/home')`；
  - 登录卡片内新增 `<a-alert v-if="state.sessionNotice" :message="state.sessionNotice" type="error" show-icon role="alert"/>`，位于现有 `state.error` 提示上方，不改变布局。
- [ ] 验收：401 → 登录卡片显示后端 message（默认「登入已逾时，请重新登入」）；重新登录后提示消失；刷新有效会话不出现提示。

## T6 前端单测（设计 §8.2）

- [ ] T6.1 扩展 `frontend/src/__tests__/state.test.js`
  - 401 时 `sessionNotice` 等于后端 message、`state.detail` 为 null；
  - 401 且 body 无 message 时 `sessionNotice` 为「登入已逾时，请重新登入」；
  - `/login` 401 时 `sessionNotice` 不被设置（既有用例补断言）。

## T7 E2E 用例实现（下游「E2E 测试用例编写」节点）

- [ ] T7.1 `backend/src/test/java/com/changxin/ams/e2e/BackendAuthE2ETest.java` 新增：
  - 同账号两次登录两 token 均 200；3 账号并行互不影响；A 登出后 B/C 200；失效 token 重复登出 200。
- [ ] T7.2 `e2e/frontend/01-login.spec.ts` 新增 describe：
  - 3 个 `browserContext` 登录 3 个不同账号并各自刷新保持登录；
  - 同账号 2 个 context，先登录者刷新仍登录（修复前必失败）；
  - Profile 1 登出后仅其回登录卡片；
  - 伪造失效 token 后 `reload`，登录卡片出现「登入已逾时，请重新登入」，无 `.global-error`。
- [ ] T7.3 同步 `docs/e2e/backend-api-e2e.md`、`docs/e2e/frontend-e2e.md` 用例表。

## T8 验证与交付（设计 §9/§10）

- [ ] T8.1 `cd backend && mvn -Dtest=AuthSessionTest,AuthPasswordTest test`
- [ ] T8.2 `cd backend && mvn -DskipTests test-compile && mvn test`
- [ ] T8.3 `cd frontend && npx vitest run src/__tests__/state.test.js`
- [ ] T8.4 `bash scripts/build-java-vue.sh`
- [ ] T8.5 `bash scripts/run-java-e2e.sh`、`bash scripts/run-frontend-e2e.sh 01-login`（E2E 节点执行）
- [ ] T8.6 提交并推送 `feat/ef07d5ab-hmg5`，确认远程可见；MR 描述中声明「同账号多会话」为有意变更的 SSO 语义。

---

## 不做（超出本轮）

- 抽取 `Clock` 注入改造 `Auth` 构造签名（超时边界单测）；
- 新增登出审计日志 / 在线会话管理 / 强制下线；
- 前端 i18n 词条化 `sessionNotice`、接入埋点 SDK；
- 分布式会话、多实例一致性。
