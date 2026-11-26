# 技术设计：AMS 多用户登录/退出会话隔离

- **Spec**：`SPEC-AMS-SESSION-MULTIUSER-001`（工作区路径 `artifacts/产品设计/多用户登录退出问题-产品Spec/01-spec.md`，manifest v2）
- **原型**：`artifacts/产品设计/多用户登录退出问题-产品Spec/04-prototype.md`、`artifacts/产品设计/多用户登录退出问题-原型/index.html`（v2）
- **当前 Repo**：`DawnGuoDev/CX-AMS-1123`，基线 `release`，工作分支 `feat/ef07d5ab-hmg5`
- **设计状态**：已定稿（唯一阻塞项“401 回登录页实现路径”已由负责人确认采用**方案B**）
- **领域**：backend + frontend（同一 Repo，一体化 JAR 部署）

---

## 1. 背景与目标

### 1.1 问题

`Auth.login()` 以 USER_KEY 为键清理会话：

```java
sessions.entrySet().removeIf(e -> e.getValue().userKey.equals(s(user, "USER_KEY"))
    || System.currentTimeMillis() - e.getValue().seen > 1_800_000);
```

由此同一账号在第二个浏览器 Profile 登录后，第一个 Profile 的 token 立即失效，下一次接口调用返回 401 并提示「登入已逾时，请重新登入」。前端收到 401 只清 `sessionStorage` token 与 `state.user`，不跳转登录页、不解释原因，用户看到的是半登录态与顶部错误条。

### 1.2 目标（对应 Spec 1.2 目标表）

| 目标 | 设计落点 |
| --- | --- |
| 多账号并行互不影响 | 不改动按 token 索引的会话表结构，天然隔离 |
| 同一账号多会话并存 | 移除 `login()` 中按 USER_KEY 的 `removeIf` 分支 |
| 登出仅失效自身会话且幂等 | `ApiController` 把 `logout` 分支前置到 `auth.user()` 之前 |
| 会话失效可感知 | `state.js` + `App.vue`：401 → 清态 → 跳登录页 → 登录卡片一次性提示 |
| 刷新保持登录 | 不改 `onMounted` bootstrap 顺序，仅新增 401 后置动作 |

### 1.3 非目标（继承 Spec 1.3）

不引入 SSO/OAuth/LDAP、不改密码策略、不引入 Redis/DB 分布式会话、不改为 localStorage/Cookie、不做在线用户管理/强制下线、不改 30 分钟闲置阈值、不重构业务模块。

---

## 2. 仓库现状与约束

### 2.1 代码事实（已核对 HEAD `7f7896c`）

| 位置 | 现状 |
| --- | --- |
| `backend/src/main/java/com/changxin/ams/Auth.java:23-38` | `login()` 按 USER_KEY + 闲置超时清理；签发 32 字节 SecureRandom hex token；`synchronized` |
| `Auth.java:39-48` | `user()` 校验 token、超时（`1_800_000ms`）、账号启用、活跃续期；`loginAt(token)` 直接 `sessions.get(token).loginAt`，token 不存在时 **NPE** |
| `ApiController.java:22-32` | 统一入口 `Supplier<Object> work`；`logout` 分支位于 `auth.user(token)` 之后；`/login` 为唯一免鉴权路径；GET 走 `store.read`、其他走 `store.write` |
| `ApiController.java:114-118` | `@ExceptionHandler(ApiException.class)` → `ResponseEntity.status(e.status).body({ok:false,message})` |
| `Json.java:58-61` | `ApiException` 已带 `status` 字段 |
| `frontend/src/state.js:13-30` | `api()` 401 且 `path !== '/login'` 时仅 `removeItem` + `state.user=null` |
| `frontend/src/App.vue:12-23` | `login()` 写 token → `bootstrap()`；`logout()` 调 `/logout` 后清 token/user/detail，`router.push('/home')`；`onMounted` 有 token 则 `act(bootstrap)` |
| `frontend/src/main.js` | `createWebHashHistory`，`/` 重定向 `/home`，无独立登录路由（登录状态由 `state.user` 驱动） |

### 2.2 仓库与知识库约束

- **接口契约**（知识库《01-编码规范》§7，及现有代码）：所有业务接口沿用 `/api` + `ok` 字段；HTTP 状态与业务结果一致；错误体 `{ok:false,message}`。
- **日志与敏感字段**（《01-编码规范》§12、《04-常见错误案例库》E13）：不得记录 token、密码、`PASSWORD_HASH`；`clean()` 已负责清洗，本次不得绕过。
- **单例服务字段**（《01-编码规范》§9）：请求级对象不得存入单例字段；本次前端提示状态放在 `state.js` 的 `reactive state`（客户端单例，属既有模式），后端不新增共享状态。
- **SSO 语义来源**（知识库《AMS 背景介绍和名词解释》）：SSO 定义为「同账号仅可在一台 PC 登录，新登录踢出旧会话」。本次是有意改变该语义，须在设计/评审中显式声明，避免被误判为回归。
- **部署形态**：单进程 JAR，会话在 JVM 内存；多实例下不共享（Spec 5.2 已确认接受）。
- **无 AGENTS.md / Checkstyle / SpotBugs**：以 `docs/e2e/*.md`、知识库编码规范作为事实约束。
- **模板**：工作区未提供 `.agentnative/templates/default/design.md` 与 `task.md`，本文按 SKILL 要求的模板语义字段（背景/现状/方案/接口/数据/风险/回滚/验证/i18n/埋点）逐项落位，并在 §12 说明。

---

## 3. 方案总览

```text
浏览器 A / B（各自 sessionStorage token）
        │ Authorization: Bearer <token>
        ▼
ApiController.api()  ── token 解析 ──► work()
   ├─ POST /api/login   → Auth.login()            // 不再按 USER_KEY 删会话，仅清闲置超时
   ├─ POST /api/logout  → auth.logout(token)      // 前置：任何 token 均 200 {ok:true}
   ├─ 其他路径          → auth.user(token)        // 401「登入已逾时」/「账号已停用」
   └─ bootstrap         → auth.loginAt(token)     // 已在 user() 通过之后调用
        ▼
store.read/write  ── 异常冒泡不吞 ──► @ExceptionHandler(ApiException) → 401 {ok:false,message}
        ▼
state.js api()：401 && path!=='/login' → 清 token / user / detail，写 sessionNotice
        ▼
App.vue watch(sessionNotice) → router.push('/home')；登录卡片 a-alert 展示提示
        ▼
登录成功后清空 sessionNotice
```

**关键取舍**（已确认）：保留 `ApiException` + `ResponseEntity` 统一错误出口（不改成在 `work()` 内返回 Map 状态），前端新增 `state.sessionNotice` 全局提示状态，`App.vue` 监听后跳转。理由：后端改动最小、错误语义单一来源；前端与原型（登录卡片内红条）一致。

---

## 4. 后端设计

### 4.1 `Auth.login()` —— 仅清理闲置超时

```java
public synchronized Map<String, Object> login(Map<String, Object> body) {
    // 用户查找 / 启用 / 密码校验保持不变
    long now = System.currentTimeMillis();
    sessions.entrySet().removeIf(e -> now - e.getValue().seen > 1_800_000);   // 仅超时
    byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
    String token = HexFormat.of().formatHex(bytes);
    String at = now();
    sessions.put(token, new Session(s(user, "USER_KEY"), at, now));
    return m("ok", true, "token", token, "user", clean(user), "loginAt", at);
}
```

- 每次登录签发全新 token（`SecureRandom`），不返回既有 token，满足 REQ-002 第三条验收。
- 会话记录仍为 `Session(userKey, loginAt, seen)`，`loginAt` 按 token 独立，不互相覆盖。
- 超时阈值 `1_800_000` 与 `user()` 保持一致；**建议**将 30 分钟常量抽为 `static final long IDLE_TIMEOUT_MS = 1_800_000L` 供两处引用（同一文件内的最小整理，不新建类）。

### 4.2 `Auth.user()` —— 语义不变

保持：token 缺失/超时 → 删会话并抛 `ApiException(401,"登入已逾时，请重新登入")`；账号停用 → `ApiException(401,"账号已停用")`；通过则 `sessions.put` 续期 `seen`。

> 注：风险项——`user()` 的移除只影响该 token，天然满足 REQ-006；不新增跨会话清理。

### 4.3 `Auth.loginAt()` —— 空值防御

```java
public synchronized String loginAt(String token) {
    Session session = sessions.get(token);
    return session == null ? "" : session.loginAt;
}
```

- 调用点仅 `ApiController` 的 `bootstrap`，且该分支已先执行 `auth.user(token)`；防御的目的在于未来路径调整时不产生 NPE（Spec 任务 1.3 的明确要求）。
- 返回 `""` 而非抛异常：`bootstrap` 的 `loginAt` 为展示字段，`App.vue` footer `new Date(state.loginAt)` 对空串显示 `Invalid Date`，因此**不改变**正常路径行为，异常路径由 401 提前拦截。此默认值在任务清单中标注为“防御性默认”，如需改为抛 401 需另立项。

### 4.4 `ApiController.api()` —— logout 前置与幂等

```java
Supplier<Object> work = () -> {
    if (path.equals("login") && method.equals("POST")) return auth.login(body);
    if (path.equals("logout") && method.equals("POST")) { auth.logout(token); return m("ok", true); }
    var user = copy(auth.user(token));
    user.put("_REQUEST_IP", req.getRemoteAddr());
    if (path.equals("bootstrap") && method.equals("GET")) return m("ok", true, "user", user, "loginAt", auth.loginAt(token), ...);
    ...
};
```

- `logout` 在 `auth.user()` 之前，因此有效/失效/伪造/空 token 都走 `sessions.remove(token)`（不存在时为 no-op）并返回 200 `{ok:true}`，满足 REQ-003。
- 不变式：`logout` 仍是 `POST`，GET `/api/logout` 落到 `auth.user()` → 401，不扩大匿名面之外的行为。
- `logout` 不写审计 `history`，不记录请求方标识（与 Spec 5.2 风险处置一致）。
- **注意**：`work` 在 `store.write` 内执行，`logout` 不修改 `store.data`，`store.write` 只在 `!data.equals(before)` 时 persist，因此无额外写盘开销。
- `bootstrap` 顺序不变（`auth.user` → `auth.loginAt`），任务 2.4 复核结论：无需改动。

### 4.5 可观测

- 不新增题面要求的日志字段；`unexpected()` 已有 `traceId` 机制保留。
- 若在 coding 阶段增加登出日志，只允许 `LOG.debug("[AMS] logout ok")` 之类**不含 token** 的内容；默认不新增（Spec 5.1 表述为“可选”）。

### 4.6 数据与兼容

- **无数据模型变更**：`sessions` 为内存 Map，无 DDL、无 H2 快照字段变化，无需 migration。
- **回滚**：回退本次提交即恢复“同账号单会话”行为，无残留数据需要清理（进程内会话随重启失效）。
- **接口兼容**：`/login` 响应结构不变；`/logout` 由“401 或 200”收敛为“恒 200 `{ok:true}`”，对既有前端是放宽，无需同步发布。

---

## 5. 前端设计

### 5.1 `state.js` —— 401 统一清理 + 提示通道

```js
export const state = reactive({ user: null, nav: [], meta: {}, options: {}, settings: {},
  loginAt: '', busy: 0, toast: '', error: '', detail: null, sessionNotice: '' })

// api() 401 分支
if (response.status === 401 && path !== '/login') {
  sessionStorage.removeItem('ams_java_token')
  state.user = null
  state.detail = null
  state.sessionNotice = data.message || '登入已逾时，请重新登入'
}
```

- **为什么在 `state.js` 而非 `App.vue`**：`api()` 是所有请求的唯一出口（含 `bootstrap`、`act` 包裹的调用），在此集中清理可避免每个页面重复实现；`state.js` 不引入 router，跳转交给 `App.vue` 的 `watch`，保持模块依赖方向（state 不依赖视图）。
- `path !== '/login'` 保护不变：登录失败的 401 仍以 `state.error` 展示「账号或密码错误」。
- 提示文案优先级：后端 `message`（如「账号已停用」）> 前端兜底「登入已逾时，请重新登入」，与 Spec 4.1「reflecting backend message」一致。

### 5.2 `App.vue` —— 监听提示并跳转登录页

```js
import { onMounted, ref, watch } from 'vue'
...
watch(() => state.sessionNotice, async notice => {
  if (notice && !state.user) { state.error = ''; if (route.path !== '/home') await router.push('/home') }
})
async function login() {
  await act(async () => {
    const result = await api('/login', credentials.value)
    sessionStorage.setItem('ams_java_token', result.token)
    credentials.value.password = ''
    state.sessionNotice = ''
    await bootstrap()
  })
}
```

模板（登录卡片内，位于现有 `state.error` 提示之前/之后均不改变布局）：

```html
<a-alert v-if="state.sessionNotice" :message="state.sessionNotice" type="error" show-icon role="alert"/>
<a-alert v-if="state.error" :message="state.error" type="error" show-icon role="alert"/>
```

- 跳转目标为 `/home`：仓库无独立登录路由，`state.user === null` 时 `/home` 即渲染登录卡片（`main.js` 中 `/` 亦重定向 `/home`），与既有 `logout()` 的落点一致。
- 现状修正点：`state.error` 在 401 时会同时被 `act()` 捕获设置成全局错误条（`global-error` 需要 `state.user` 才显示，故会话失效时不会露出）；这里显式清空 `state.error`，避免重新登录前残留在登录卡片。
- 一次性：登录成功清 `sessionNotice`（REQ-004 第三条）。登出成功后也清（用户主动登出不显示“已逾时”）。
- 刷新：`onMounted` 逻辑不动，token 有效时 `bootstrap` 成功，不触发 401，不显示提示（REQ-005）。

### 5.3 `logout()` —— 保持现有流程

现有实现（清 token/user/detail + `router.push('/home')`）已满足“仅自身会话失效 + 回到登录页”；服务端收紧为幂等 200 后，即使本地会话已失效也不会再冒出 401 错误条。仅补 `state.sessionNotice = ''` 与 `state.error = ''`。

### 5.4 i18n（必填章节）

- 现状：`legacy-i18n.js` 词典驱动 `t()`，页面文案为中文为主；登录卡片标题等使用 `t('登入')`。
- **本设计不新增 `I18n.t()` 调用**：提示文案直接取后端 message（后端为中文固定文案，本次不改）或前端兜底中文字符串「登入已逾时，请重新登入」，与现有 `state.error` 的展示方式一致（`state.error` 本身未经 `t()` 包装，见 `App.vue` 现有 `a-alert`）。
- 若后续需要多语，需在 `legacy-i18n.js` 增加词条并将 `sessionNotice` 改为 key；**本轮不做**，登记为后续建议。

### 5.5 埋点（必填章节）

- 现状：仓库**无埋点 SDK、无事件上报**（`frontend/src` 无相关依赖或调用）。
- 本设计**不新增埋点**，不引入 SDK。可观测性依赖后端 `traceId` 与 E2E/单测证据。
- 后续若接入，建议事件 `session_expired`（参数：`path`、`status`），本轮只登记建议，不实施。

---

## 6. 接口与数据契约

| 接口 | 变化 | 兼容性 | 关联 REQ |
| --- | --- | --- | --- |
| `POST /api/login` | 行为：不再删除同 USER_KEY 旧 token；响应结构不变 | 兼容 | REQ-002 |
| `POST /api/logout` | 行为：无鉴权前置；任何 token 恒 200 `{ok:true}` | 兼容（放宽） | REQ-003 |
| `GET /api/bootstrap` | 不变（`loginAt` 增加空值防御，正常路径输出一致） | 兼容 | REQ-001/004/005 |
| 其他 `/api/**` | 不变；401 语义不变 | 兼容 | REQ-001/006 |
| 内存 `sessions` | 结构不变；清理策略仅闲置超时 | 内部 | REQ-002/006 |
| 前端 `state` | 新增 `sessionNotice: string` | 内部 | REQ-004 |

---

## 7. 风险与缓解

| 级别 | 风险 | 触发条件 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| 高 | 改变 SSO 语义与知识库名词定义冲突 | 评审按旧定义判为回归 | 评审返工 | 在 MR 描述与文档显式声明“同账号多会话”为本轮目标（Spec 已确认） |
| 中 | 401 监听在初次 `bootstrap` 时触发跳转，导致 `ready` 前闪烁 | 刷新时 token 已失效 | 短暂白屏/跳转 | `watch` 仅在 `!state.user` 时跳转；`ready` 由 `onMounted` 末尾置 true，跳转到 `/home` 仍渲染登录卡片 |
| 中 | `loginAt` 返回空串导致 footer `Invalid Date` | 未来有路径在 `user()` 之前调用 `loginAt` | 展示异常 | 当前唯一调用点在 401 之后；任务中标注约束 |
| 中 | 会话表只增不减（仅闲置超时清理） | 大量登录不活跃 | 内存增长 | 厂区规模 ≤ 数百；每次 `login()` 都执行超时清理，保持在 O(n) |
| 低 | 登出成为无状态成功接口 | 被用于探测 | 不泄露信息 | 接受（Spec 5.2），不记录请求方标识 |
| 低 | 单进程内存会话 | 多实例/蓝绿 | 跨实例需重新登录 | 已确认不做分布式会话 |

---

## 8. 测试设计

### 8.1 单元测试（`backend/src/test/java/com/changxin/ams/unit/`，不启动 Spring）

| 用例 | 构造方式 | 断言 |
| --- | --- | --- |
| `AuthSessionTest#loginKeepsOtherSessionsOfSameUser` | `new Auth(store)`，`store` 用种子数据构造（复用 `AuthPasswordTest` 读取 `seed.json` 的方式）；同账号登录两次 | 两个 token 均非空，`user(t1)` 与 `user(t2)` 均返回同一 `USER_ID`，且不抛异常 |
| `loginIssuesUniqueToken` | 同账号连续登录 | `t1 != t2`，长度 64 hex |
| `logoutIsIdempotentForUnknownToken` | `logout("unknown")`、`logout("")` | 不抛异常；随后 `user("unknown")` 抛 401 |
| `timeoutRemovalDoesNotTouchFreshSessions` | 同账号两次登录后 `user(t2)` | `t1`、`t2` 均可用（验证移除按 `seen` 而非 USER_KEY） |
| 既有 `AuthPasswordTest` | 不改 | 全部保持通过 |

> 超时边界（30 分钟晋升）用真实等待不可行，采用“仅验证清理条件不按 USER_KEY 命中”的等价断言；如需注入时钟，需改 `Auth` 构造签名——**本轮不做**（最小变更），在风险中登记。

### 8.2 前端单测（`frontend/src/__tests__/state.test.js` 扩展）

- 401 时：`sessionNotice` 等于后端 message；`state.detail` 被置空；token 移除。
- `/login` 401 时：`sessionNotice` 不变、token 保留（既有用例扩展断言，不改断言语义）。
- 后端无 message 时：`sessionNotice` 为「登入已逾时，请重新登入」。

### 8.3 E2E 设计（下游节点实现）

- **后端接口 E2E**（`backend/src/test/java/com/changxin/ams/e2e/BackendAuthE2ETest.java` 扩展，真实进程）：
  1. 同账号两次登录 → 两个 token 均 `GET /api/bootstrap` 200；
  2. 账号 A/B/C 依次登录 → 三者 200；
  3. A 登出 → A 401，B/C 200；
  4. 失效 token 重复登出 → 200 `{ok:true}`；
  5. 响应体与报告不含 token/`PASSWORD_HASH`。
- **前端 E2E**（`e2e/frontend/01-login.spec.ts` 扩 `describe`，单 worker）：
  1. 三个 `browserContext` 分别登录 3 个不同账号，各自刷新仍为登录态；
  2. 同账号两个 `browserContext` 登录，先登录者刷新仍登录（回归用例，修复前必失败）；
  3. Profile 1 登出 → Profile 1 回登录卡片，Profile 2 刷新仍登录；
  4. 失效 token（`page.evaluate` 写入伪造 token 后 `reload`）→ 登录卡片出现「登入已逾时，请重新登入」，且无 `.global-error`；
  5. 重新登录成功后提示消失（一次性）。
- 规范引用：`docs/e2e/backend-api-e2e.md`（公共前置/隔离/清理）、`docs/e2e/frontend-e2e.md`（Chromium 1440×900、`support/ams.js` 的 `login`/`apiToken`）、`docs/e2e/unit-tests.md`（分层边界）。

---

## 9. 验证计划

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 后端单测 | `cd backend && mvn -Dtest=AuthSessionTest,AuthPasswordTest test` | 全部通过 |
| 后端编译 | `cd backend && mvn -DskipTests test-compile` | 成功 |
| 后端集成回归 | `cd backend && mvn test` | 既有集成测试通过。已核实 `WorkflowIntegrationTest`/`ManualAlignmentIntegrationTest` 仅通过 `loginToken()` 复用单一 token，无单会话/踢线断言，无需修改 |
| 前端单测 | `cd frontend && npx vitest run src/__tests__/state.test.js` | 通过 |
| 前端构建 | `bash scripts/build-java-vue.sh` 或 `cd frontend && npm run build` | 成功（以脚本为准，保证 dist 被 Maven 打包） |
| 后端接口 E2E | `bash scripts/run-java-e2e.sh` | 通过 |
| 前端 E2E | `bash scripts/run-frontend-e2e.sh 01-login` | 通过 |

---

## 10. 发布与回滚

- **发布影响**：需重启 JAR；既有在线会话在重启后失效（现有行为，非本次引入）；无配置项变更、无数据变更。
- **灰度**：单实例 MVP，无灰度通道；建议观察发布后 24h 内 401 量与登录成功率（Actuator/Prometheus 已有端点可用）。
- **回滚判据**：登录成功率下降、异常 401 上升、或出现 `bootstrap` 500（疑似 `loginAt` 相关）。
- **回滚动作**：回退提交并重启，无数据回滚。

---

## 11. 待确认项 / 假设

| 项 | 状态 |
| --- | --- |
| 401 回登录页实现路径 | **已确认：方案B** |
| `loginAt` 空 token 返回 `""`（而非抛 401） | 设计假设（防御性默认），如评审要求强一致可改抛 401 |
| 是否为登出新增 debug 日志 | 假设不新增（Spec 为“可选”） |
| `sessionNotice` 是否走 i18n | 假设不走（与现有 `state.error` 一致），登记为后续建议 |
| 既有集成测试是否断言旧单会话行为 | **已核实：无此类断言**（两处仅 `loginToken()` 获取一次 token 后复用），集成测试无需修改 |

---

## 12. 模板对齐说明

工作区 `.agentnative/templates/default/` 不存在，无 `design.md`/`task.md` 官方模板可读。本文按 SKILL 要求的模板语义完整覆盖：背景与目标、仓库现状与约束、技术方案、接口与数据契约、风险、测试与验证、发布与回滚、i18n、埋点、待确认项，未新增或省略语义章节。任务拆分见同目录 `session-multiuser-task.md`。
