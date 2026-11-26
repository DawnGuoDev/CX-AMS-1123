---
spec_id: spec-cx-ams-1123-multi-session-auth
title: AMS 同账号多会话登录/退出 技术设计
status: draft
template_id: tech-design
schema_version: 1
linked_spec: spec-cx-ams-1123-multi-session-auth
baseline_design: none
depends_on_designs: []
supersedes_designs: []
created_at: 2026-11-26T11:42:33Z
updated_at: 2026-11-26T11:42:33Z
---

# Design: AMS 同账号多会话登录/退出

> Spec 回答 What/Why（`spec.md`），Design 回答 How。
> 标识符（REQ/API/STATE/NFR）沿用 `spec.md`，不重新编号；冲突时以 Spec 为准。

## 0. 上游输入与知识库依据

| 来源 | 路径 / 标识 | 用途 |
|------|-------------|------|
| Spec（本节点产出，9 节机检格式，`spec-lint --strict` 已 PASS） | `docs/tech-design/CX-AMS-1123-multi-session-auth/spec.md` | B1～B15、N1～N7、AC1～AC14 |
| PRD | `artifacts/产品设计/需求说明/需求说明`（PRD v1） | 会话规则 S-01～07、前端规则 F-01～09、§10 待确认 Q1～Q6 |
| 原型 | `artifacts/产品设计/AMS多会话登录退出交互原型/index.html` | 登录/登出/过期提示交互 |
| 产物提交 | `artifacts/产品设计/DawnGuoDev_CX-AMS-1123@214e7ca/content.json`（commit `214e7ca`） | 已改写的 `docs/e2e/*` 与 `e2e/README.md` |
| 用户决策（上一节点 HiL） | PRD 头部表“决策来源” | 多会话；同账号多人/多端；闲置 30 分钟；测试/生产/本地演示 |

**知识库依据（ContextSearch space `AMS-poc`，9 篇文档）**：

| 结论 | 证据 |
|------|------|
| 登录会话存于 Java 进程内存，重启失效；无共享会话/分布式锁，单实例支持边界 | `06-当前实现架构与AWS核实说明.md` 单位 `…content_00003` §6 |
| “SSO＝同账号仅一台 PC 登录、新登录踢旧会话”是**旧系统背景语义** | `AMS 背景介绍和名词解释.md` 单位 `…content_00002`（`单点登录（SSO）` 词条，被转录截断于“新登录踢”） |
| 数据库为 `AMS_STATE(ID,PAYLOAD)` 单行 JSON 快照，本轮不做关系化迁移 | `05-数据库编码规范.md` 单位 `…content_00001` §1 |
| 新模块可用 `Clock` 注入当前时间，使到期边界测试不依赖真实等待 | `03-编码风格示例.md` 单位 `…content_00003` §8 |
| 测试应断言外部可观察行为；未配置 Checkstyle/覆盖率门禁，不得声称已有检查 | `01-编码规范.md` 单位 `…content_00004` §10 |
| Review 需说明触发条件/影响/最小修复；未知路径写成待核实 | `02-Code-Review规范.md` 单位 `…content_00003` §8 |
| 审查重点：锁内不做网络调用、不为小收益引入难失效缓存 | `02-Code-Review规范.md` 单位 `…content_00002` §4/§5 |

> 说明：`knowledge/context/tech-stack.md`、`system-architecture.md` 仍写“同账号新登录会踢掉旧会话”，属**变更前事实**，本次不修改知识库（PRD-§6 明确由后续上下文同步任务更新）。

---

# 1. 方案概述

核心思路：**把会话有效性判定从“账号维度”下沉到“token 维度”，并让失效原因沿既有 401 `message` 通道传到前端**。

- 后端 `Auth`：`login()` 去掉“同 userKey 全删”分支，只保留超时清理；新增可配置闲置阈值；`logout()` 改为幂等（`ApiController` 侧对已失效 token 也返回 `200 {ok:true}`）。会话 Map、token 生成、`synchronized` 并发模型、`seen` 滑动刷新均沿用现状（代码:`Auth.java`）。
- 前端 `state.js` / `App.vue`：401 分支不再只清 token，而是记录失效原因并提示；登录成功后回跳原目标路由；`sessionStorage` 键与行为保持不变。
- 文档/用例：`docs/e2e/*` 已在 `214e7ca` 改写，本设计只需让测试代码与之对齐，并**显式改写** `WorkflowIntegrationTest#authenticationSingleSessionAndNoPasswordDisclosure`。

与现有系统的关系：不新增模块、不改 `AMS_STATE`、不引入新依赖；改动集中在 2 个后端文件、2 个前端文件、1 个前端 i18n 文件、2 个测试文件与 1 个测试基类。

## 1.1 影响范围

| 模块 / 层 | 文件或目录 | 改动说明 | 关联需求 |
|-----------|------------|----------|----------|
| 接口 | `backend/src/main/java/com/changxin/ams/ApiController.java` | `/api/logout` 已失效 token 幂等返回 200；login/logout 分支保持在 `auth.user()` 之前 | B3、B4 |
| 服务逻辑 | `backend/src/main/java/com/changxin/ams/Auth.java` | `login()` 去除同账号删除；超时阈值可配置；`logout()` 返回是否命中 | B1、B2、B3、B4、B5、B6、B12 |
| 数据模型 | 无 | 会话仍是进程内存 `Map<String, Session>` | — |
| 存储 / 数据库 | 无 | 不动 `AMS_STATE`、不新增表 | — |
| 外部依赖 | 无 | 不引入 Redis/新库 | — |
| 配置 | `backend/src/main/resources/application.yml` | 新增 `ams.session.idle-timeout-minutes: 30`（环境变量 `AMS_SESSION_IDLE_TIMEOUT_MINUTES`） | B5、B6、B12 |
| 前端状态 | `frontend/src/state.js` | 401 处理记录 `state.sessionExpired`/错误文案；`loginAt` 语义不变 | B8、B11 |
| 前端页面 | `frontend/src/App.vue` | 登录成功回跳原目标；登出保持现状；401 提示展示 | B10、B15、B13、B8、B11、B9 |
| 前端 i18n | `frontend/src/legacy-i18n.js` | 补充“登入已逾时，请重新登入”“账号已停用”英文词条（繁中用既有简→繁转换） | B8、B11 |
| 测试 | `backend/src/test/java/com/changxin/ams/WorkflowIntegrationTest.java` | 显式改写单会话断言为多会话断言 | AC14 |
| 测试 | `backend/src/test/java/com/changxin/ams/e2e/BackendAuthE2ETest.java` | 新增 TC-API-E2E-005/006 方法 | AC14 |
| 测试基类 | `backend/src/test/java/com/changxin/ams/e2e/E2ETestBase.java` | 支持以 `--ams.session.idle-timeout-minutes` 启动/覆盖 | B5、B6、B12、AC14 |
| 前端测试 | `frontend/src/**/__tests__` | 401 原因分支单测（Vitest） | B8、B11 |

## 1.2 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 会话存储 | 继续进程内存 `HashMap` + `synchronized` | 现状即单实例（KB `06-…` §6），Spec §1.3 明确不引入 Redis；改动最小 |
| 失效原因传递 | 沿用 401 `message` 文本，前端按文本关键字判定 | 不新增错误码字段可保持契约零变更（Spec §4.4）；现有文案已存在（代码:`Auth.java` 两个 `ApiException(401, …)`） |
| 超时配置 | `ams.session.idle-timeout-minutes`，`double` 分钟→`Duration` | 便于 AC05 用 0.02 分钟（≈1.2s）验证；`docs/e2e/backend-api-e2e.md` TC-API-E2E-006 已预设该参数名 |
| 是否保留“踢人”开关 | 不保留 | PRD-§10 Q6 推荐值，Spec §1.3 采纳 |
| 超时清理时机 | 仅 `login()` 内一次 `removeIf`（含超时）；`user()` 命中当前 token 时只判断自身 | 避免每请求 O(n) 扫描；内存上界由“峰值登录率×30min”约束（Spec §5.1） |
| 时间源 | 新增 `Clock` 注入（默认 `Clock.systemUTC()`），保留 `System.currentTimeMillis()` 语义 | KB `03-编码风格示例.md` §8 建议；使 AC05/AC06 可确定性地验证 |

---

# 2. 实现设计

## 2.1 文件清单

| 文件路径 | 新增/修改 | 职责 |
|----------|-----------|------|
| `backend/src/main/java/com/changxin/ams/Auth.java` | 修改 | 多会话登录、可配置超时、幂等 logout、`Clock` 注入 |
| `backend/src/main/java/com/changxin/ams/ApiController.java` | 修改 | `/api/logout` 在 token 无效时返回 200 |
| `backend/src/main/resources/application.yml` | 修改 | 新增 `ams.session.idle-timeout-minutes` |
| `frontend/src/state.js` | 修改 | 401 按 message 分类、暴露失效原因、清理本页 token |
| `frontend/src/App.vue` | 修改 | 登录后回跳原目标；登出保持；展示失效原因 |
| `frontend/src/legacy-i18n.js` | 修改 | 过期/停用提示英文词条 |
| `backend/src/test/java/com/changxin/ams/WorkflowIntegrationTest.java` | 修改 | `authenticationSingleSessionAndNoPasswordDisclosure` → 多会话语义并更名 |
| `backend/src/test/java/com/changxin/ams/e2e/BackendAuthE2ETest.java` | 修改 | 新增 `shouldKeepSessionsIndependentForSameAccount`、`shouldIsolateAccountsAndExpireIdleSessions` |
| `backend/src/test/java/com/changxin/ams/e2e/E2ETestBase.java` | 修改 | 实例启动参数支持可配置超时 |
| `frontend/src/state.js` 对应单测（`frontend/src/__tests__/state.test.js`，若仓库无该目录则新建） | 新增 | 401 原因分类与清理行为 |

> 说明：测试文件清单仅作范围说明，实际测试代码由「E2E测试用例编写」节点落地；本节点不改任何测试代码（tech-design 约束）。

## 2.2 数据模型

| 对象 / 表 | 字段 | 类型 | 说明 | 关联 FIELD |
|-----------|------|------|------|------------|
| `Auth.Session`（record，已存在） | `userKey` | `String` | 用户 KEY，用于每次请求校验账号是否停用 | — |
| | `loginAt` | `String` | 会话自身登录时间（ISO），`/api/bootstrap` 返回 | — |
| | `seen` | `long` | 最近一次成功鉴权毫秒时间戳，用于滑动过期 | — |

不新增字段、不新增集合。会话继续存于 `Map<String token, Session>`。

## 2.3 数据库变更

无。会话不落库；`AMS_STATE` schema 不变（KB `05-数据库编码规范.md` §1、PRD-§4.4）。

## 2.4 接口变更

| 接口 | 类型 | 请求变化 | 响应变化 | 兼容性 |
|------|------|----------|----------|--------|
| `POST /api/login` | 语义 | 无 | 无字段变化；不再使同账号其他 token 失效 | 兼容（放宽） |
| `POST /api/logout` | 语义 | 无 | 已失效 token 由 `401` 改为 `200 {ok:true}` | 兼容（前端原已 `act()` 容错） |
| 任意业务接口 | 语义 | 无 | 401 `message` 稳定区分“登入已逾时，请重新登入”/“账号已停用” | 兼容（文本已存在） |
| `GET /api/bootstrap` | 无 | 无 | 无 | 兼容 |

## 2.5 核心流程

**F1 登录（`Auth.login`）**

1. 按 `userId` 取用户；不存在 / 非启用 / 密码哈希不匹配 → `ApiException(401, "账号或密码错误，或账号已停用")`，**不写 Map**。
2. `sessions.entrySet().removeIf(e -> now - e.getValue().seen > idleMillis)` —— **只保留超时分支**，删除 `e.getValue().userKey.equals(...)` 子句。
3. 生成 32 字节 `SecureRandom` → 64 位十六进制 token；`loginAt = now()`；`sessions.put(token, new Session(userKey, loginAt, now))`。
4. 返回 `{ok, token, user(clean), loginAt}`。

**F2 鉴权（`Auth.user`）**

1. `sessions.get(token)`；为空 → `ApiException(401, "登入已逾时，请重新登入")`。
2. `now - seen > idleMillis` → 移除该 token → 同上 401。
3. 查 `users`：不存在或 `ACTIVE≠Y` → 移除该 token → `ApiException(401, "账号已停用")`。
4. `sessions.put(token, Session(userKey, loginAt, now))` 刷新 `seen`（滑动过期）。
5. 返回 `clean(user)`。

> 关键点：`loginAt` 必须从旧 Session 继承，不能重置（否则 AC04 页脚登录时间会漂移）。

**F3 登出（`ApiController` + `Auth.logout`）**

1. `ApiController` 中 `login` 分支之后、`auth.user(token)` 之前**先**判定 `path=="logout" && method=="POST"`：
   - 直接调用 `auth.logout(token)`（无论 token 是否存在都幂等删除）；
   - 返回 `m("ok", true)`，**不再走 `auth.user()`**，因此不会因过期/停用抛 401。
2. 影响：`logout` 后不再执行 `user.put("_REQUEST_IP", …)`，该值原本只用于响应内部字段，登出响应体不含它，无行为差异。

**F4 前端 401 处理（`state.js`）**

1. `response.status === 401 && path !== '/login'` 时：
   - `sessionStorage.removeItem('ams_java_token')`；`state.user = null`（保持现状）；
   - 新增：按 `data.message` 归类 `state.sessionExpired = /账号已停用/.test(msg) ? 'disabled' : 'expired'`。
2. 抛出 `Error`，由 `act()` 写入 `state.error`，登录页 `<a-alert>` 展示（现状即如此，代码:`App.vue:34`）。
3. 不得在 `api()` 内直接 `router.push`（`state.js` 无 router 依赖），保持现有分层。

**F5 登录回跳（`App.vue`）**

1. 使用 `useRoute()` 在未登录时记录 `route.fullPath` 到模块级变量 `redirectTarget`（仅当目标不是 `/home` 时）。
2. 登录成功后：`await bootstrap()` → `router.replace(redirectTarget ?? '/home')`。
3. 深链 `#/ack/:key` → 登录后回 `#/ack/:key`；直接打开登录页 → 走 `/home`。

## 2.6 状态变化

| 操作 | 前置状态 | 目标状态 | 说明 |
|------|----------|----------|------|
| 登录 | 无会话 | `Active`（新增） | 同账号其他会话保持 `Active` |
| 鉴权成功 | `Active` | `Active` | 仅刷新 `seen` |
| 登出 | `Active`/不存在 | 删除 | 幂等 |
| 超时 | `Active` 且超阈值 | 删除 | 401“登入已逾时” |
| 账号停用 | 账号 `ACTIVE≠Y` | 删除 | 401“账号已停用” |

## 2.7 异步处理

无新增异步。不改 `EngineScheduler`、不改 SMTP 派发。

## 2.8 外部依赖

无新增外部依赖。

## 2.9 配置

| 配置项 | 默认值 | 用途 | 生效范围 |
|--------|--------|------|----------|
| `ams.session.idle-timeout-minutes`（env `AMS_SESSION_IDLE_TIMEOUT_MINUTES`） | `30` | 闲置过期阈值，支持小数（如 `0.02`） | 单实例全局；测试实例通过启动参数覆盖 |

解析方式：`@Value("${ams.session.idle-timeout-minutes:30}") double minutes` → `Duration.ofSeconds(Math.round(minutes*60))`；≤0 时回退 30 分钟并记录 warn（防止配置错误让所有会话立即失效）。

---

# 3. 兼容性与迁移

| 影响对象 | 兼容策略 | 迁移步骤 |
|----------|----------|----------|
| 已登录用户（部署时） | 新版本沿用内存会话模型，部署即重启，全部会话失效 | 无；重启后重新登录（现状行为） |
| 旧前端（未升级） | `/api/logout` 返回 200，`act()` 正常；401 仍清 token | 无 |
| 依赖“新登录踢旧会话”的外部脚本 | 行为改变 | 检查 `docs/e2e`、外部压测脚本是否有该断言；已由 `214e7ca` 覆盖文档层 |
| 知识库文档 | `tech-stack.md`/`system-architecture.md` 仍是旧描述 | 不属本节点；由后续上下文同步任务更新（PRD-§6） |

---

# 4. 上线与回滚

| 步骤 | 动作 | 备注 |
|------|------|------|
| 1 | 合并并发布代码（后端 + 前端同包） | 一体化构建 `bash scripts/build-java-vue.sh` |
| 2 | 执行必要的数据或配置变更 | 无（新配置有默认值 30） |
| 3 | 观察核心指标和日志 | `401` 数量分布、`/health`、`[AMS] request failed traceId=` 日志 |

**回滚预案**：代码回滚即可恢复单会话行为；无数据变更需回滚（会话在内存，重启即清）。若需保留多会话但怀疑超时配置异常，可单独将 `AMS_SESSION_IDLE_TIMEOUT_MINUTES` 调回 `30` 并重启。

---

# 5. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 会话只增不减 | 内存增长 | 仅在 `login` 做一次超时清理；无上限（Spec §1.3）→ 记录为已知限制；后续可加独立清理任务 |
| 多实例部署 | 跨实例 401 | 部署文档显式声明单实例（KB `06-…` §6） |
| 401 文本匹配脆弱 | 文案改动导致前端分类失效 | 前端只做 `includes('账号已停用')` 判定，兜底为“expired”；文案集中在 `Auth.java` 两处，改动需同步前端与 `legacy-i18n.js` |
| 前端 401 竞态 | 多请求同时 401 反复清理 | 清理与赋值幂等；`act()` 已用 `try/finally` 恢复 `busy` |
| 回跳开放重定向 | 被构造恶意 hash | 仅允许仓库既有路由（`/home`、`/page/:code`、`/alarm/:key`、`/ack/:key`），由 `router.replace` 匹配失败回落 `/:pathMatch(.*)* → /home` |
| 测试实例超时参数注入 | AC05/06 不可测 | `E2ETestBase` 追加 `--ams.session.idle-timeout-minutes=0.02`（设计给出，测试节点落地） |

---

# 6. 测试要点

| 场景 | 方法 | 关联条目 |
|------|------|----------|
| 正常主流程 | 同账号两次登录 → 两个 token → 分别 bootstrap 200（TC-API-E2E-005） | B1、B2 |
| 边界条件 | 登出 token1 → token1 401 / token2 200；已失效 token 再登出 → 200 | B3、B4 |
| 边界条件 | 闲置 `> 阈值` → 401 含“登入已逾时”；活跃使用跨阈值 → 仍 200（TC-API-E2E-006，超时 `0.02` 分钟） | B5、B6 |
| 异常处理 | 账号停用 → 401 含“账号已停用”；跨账号不受影响 | B7 |
| 异常处理 | 伪造 64 位十六进制 token → 401 且不影响真实会话 | N2、AC12 |
| 前端行为 | 双标签页：page1 登出、page2 reload 仍主壳（TC-FE-E2E-006） | B10、B15、B13 |
| 前端行为 | 过期提示三语（TC-FE-E2E-007，简/繁/英） | B8、B11 |
| 前端行为 | `#/ack/:key` 未登录 → 登录后回原路径 | B9 |
| 兼容性 / 回归 | `WorkflowIntegrationTest` 单会话断言显式改写为多会话；`BackendAuthE2ETest` 主链路保留 | AC14 |

**验证命令（供后续节点执行）**

```bash
cd backend && mvn -q test
cd frontend && npm run test:unit
bash scripts/run-frontend-e2e.sh frontend/01-login.spec.ts
```
