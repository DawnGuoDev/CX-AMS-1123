---
spec-id: AMS-1123
spec-tier: full
modifies: []
---

# 产品 Spec: AMS 同账号多会话登录/退出

> Spec 回答 What/Why；How 见同目录 `design.md`。B/N/AC 编号在本文件定义，Design 与 Task 只引用不重编。
> 溯源标记：`PRD-§x`＝上游需求说明章节；`代码:路径`＝仓库现状锚点；`KB:文档`＝ContextSearch space `AMS-poc` 证据。
> 上游产物：`artifacts/产品设计/需求说明/需求说明`、`artifacts/产品设计/AMS多会话登录退出交互原型/index.html`、`artifacts/产品设计/DawnGuoDev_CX-AMS-1123@214e7ca/content.json`（commit `214e7ca`）。

## 1. 背景与目标

AMS 是厂区共享警报管理平台，现场存在同一账号在多终端、多浏览器、多标签页同时值守的既定场景（PRD-§1、PRD-§3）。当前后端按“账号维度”收拢会话：同账号新登录会删除该账号全部既有 token（`代码:backend/src/main/java/com/changxin/ams/Auth.java` → `login()` 中 `removeIf(userKey 相同 || 已超时)`），而前端 token 存于每标签页独立的 `sessionStorage`（`代码:frontend/src/state.js:15`、`:30`），两者语义互相矛盾，造成多端互踢、静默回登录页、登出误伤他人。该“单点登录、新登录踢旧会话”语义在知识库中被记录为**旧系统背景约定**（`KB:AMS 背景介绍和名词解释.md` 单位 `…content_00002`），本次显式废弃。

成功指标（PRD-§2.1、PRD-§5）：

| 目标 | 判断标准 |
|------|----------|
| G1 同账号多端并发登录互不影响 | 同账号多次登录返回均 200；任一未过期 token 调 `GET /api/bootstrap` 均 200 |
| G2 登出仅失效自身会话 | 登出后仅该 token 401，其他 token 仍 200 |
| G3 多端切换/刷新后状态一致 | 刷新仍在主壳；登出后刷新仍为登录页 |
| G4 会话失效原因可区分 | 401 `message` 可区分“登入已逾时”与“账号已停用”，三语齐全 |
| G5 固化单会话的文档/用例被显式改写 | 旧断言改写为“旧 token 仍有效”，不靠删除缩小覆盖 |

约束：保持单实例进程内存会话，不引入 Redis/分布式会话（PRD-§2.2、`KB:06-当前实现架构与AWS核实说明.md` §6 “没有共享会话、分布式锁”）；不改 `AMS_STATE` schema（PRD-§4.4、`KB:05-数据库编码规范.md` §1）。

## 2. 用户与场景

| 用户 / 角色 | 使用场景 | 当前痛点 | 期望结果 |
|-------------|----------|----------|----------|
| 值班主管（共用账号） | 中控室大屏 + 个人笔记本同账号登录看即时汇总 | 后登录者踢掉先登录者，大屏静默跳登录页 | 两端长期并存、各自独立 |
| 制程工程师 | 同一浏览器 3 个标签页分别看汇总/处理查询/测试告警 | 任一页重登录后其他页下一次接口 401 回登录页 | 各标签页 token 独立、互不影响 |
| 管理者 | 移动端临时查看后 PC 端继续操作 | 移动端登出导致 PC 端被踢 | 登出只影响本端 |
| 告警接收人 | 通过邮件 ACK 链接进入 `#/ack/:alarmKey` 确认 | 链接页可能已被踢而报“登入已逾时” | 登录后回到原 ACK 页，会话持续有效 |

并发画像：同一共用账号多端登录为常态（大屏 1 + 笔记本 1 + 3 标签页，PRD-§3）；具体 QPS 未提供，性能档位按单实例内存 Map 现状评估。

## 3. 行为定义

- B1 WHEN 同一账号完成一次成功登录 THE 系统 SHALL 新增该账号的独立会话 token，并保持该账号其他未过期会话仍有效。
- B2 WHEN 客户端携带某一 token 调用受保护接口 THE 系统 SHALL 仅依据该 token 对应会话判定有效性并返回 200。
- B3 WHEN 客户端登出 THE 系统 SHALL 仅删除本次请求携带的 token 对应会话，其他会话（同账号或跨账号）仍有效。
- B4 WHEN 客户端以已失效或不存在的 token 登出 THE 系统 SHALL 返回 `200 {ok:true}`（幂等）。
- B5 WHEN 某会话闲置时长超过配置阈值（默认 30 分钟）后收到请求 THE 系统 SHALL 返回 401 且 `message` 为“登入已逾时，请重新登入”。
- B6 WHILE 会话持续被使用且相邻请求间隔小于 30 分钟 THE 系统 SHALL 保持该会话有效（滑动过期）。
- B7 WHEN 某账号被置为非启用后收到请求 THE 系统 SHALL 使该账号全部会话返回 401 且 `message` 为“账号已停用”，其他账号会话不受影响。
- B8 WHEN 前端收到业务接口 401 THE 系统 SHALL 清除本标签页 token、返回登录页，并按失效原因展示“登入已逾时，请重新登入”或“账号已停用”。
- B9 WHEN 未登录用户打开深链 `#/ack/:alarmKey` 或 `#/alarm/:key` 后完成登录 THE 系统 SHALL 回到该目标路径。
- B10 WHEN 同一标签页再次登录 THE 系统 SHALL 用新 token 覆盖本页旧 token，且不影响其他标签页。
- B11 WHEN 用户切换简中/繁中/英文 后触发会话失效提示 THE 系统 SHALL 以对应语言展示该提示。
- B12 THE 认证模块 SHALL CONTINUE TO 使用 32 字节 `SecureRandom` 生成 64 位十六进制 token、以 SHA-256 固定前缀盐校验密码、将会话保存在进程内存且不落盘。
- B13 THE 页脚 SHALL CONTINUE TO 按会话展示“登入时间”，不展示其他端在线数。
- B14 THE 登出按钮 SHALL CONTINUE TO 保持登出为一键操作，不增加二次确认弹窗。
- B15 THE 前端会话存储 SHALL CONTINUE TO 以 `sessionStorage`（键 `ams_java_token`）作为每标签页独立会话的实现基础。

## 4. 接口与数据契约

| 接口 | 请求 | 响应 | 变化 |
|------|------|------|------|
| `POST /api/login` | `{userId, password}` | `200 {ok:true, token, user, loginAt}` | 语义放宽：不再使同账号其他 token 失效 |
| `POST /api/logout` | Bearer token，body `{}` | `200 {ok:true}` | token 已失效时由 401 改为 200（幂等） |
| `GET /api/bootstrap` | Bearer token | `200 {ok, user, loginAt, nav, options, meta, smtpConfigured, serverTime}` | 无字段变化；`loginAt` 为该 token 会话自身登录时间 |
| 任意业务接口 | Bearer token | 401 `{ok:false, message}` | `message` 按关键字区分（含“登入已逾时”或含“账号已停用”）：`登入已逾时，请重新登入` / `账号已停用` |

会话对象（内存，不落库）：`token`（64 位十六进制字符串）→ `{userKey, loginAt, seen}`。`user` 字段经 `clean()` 脱敏，不包含 `PASSWORD_HASH`（`代码:Auth.java`、`ApiController.java:26-31`）。

## 5. 边界与反例

- N1 IF 登录密码错误或账号已停用 THEN THE 系统 SHALL 返回 401 且不创建新会话、不影响既有会话。
- N2 IF 客户端提交伪造或篡改的 token THEN THE 系统 SHALL 返回 401 且不产生新会话、不影响真实会话。
- N3 IF 登出的 token 不存在或已失效 THEN THE 系统 SHALL 返回 `200 {ok:true}` 而非 401。
- N4 IF 同账号另一端登录 WHEN 本端随后调用接口 THEN THE 系统 SHALL 返回 200，不得返回 401 或回登录页。
- N5 IF 服务重启 WHEN 任一端调用接口 THEN THE 系统 SHALL 返回 401 且提示“登入已逾时，请重新登入”，不得提示“账号或密码错误”。
- N6 IF 深链目标不是仓库已有路由 THEN THE 系统 SHALL 回落到 `/home`，不得跳转外部地址。
- N7 IF 某标签页登出 THEN THE 系统 SHALL NOT 清除其他标签页的 `sessionStorage` token。

## 6. Non-goals

- 不做 SSO/OIDC/LDAP、不做细粒度 RBAC 与数据行级权限（PRD-§2.2）。
- 不做设备管理/会话列表/后台远程踢人页面（PRD-§2.2、PRD-§9）。
- 不改为分布式会话、不引入 Redis；保持单实例内存会话（PRD-§2.2、PRD-§7）。
- 不改密码哈希算法、不新增登录/登出审计记录、不新增表或改 `AMS_STATE` schema（PRD-§2.2、PRD-§4.4）。
- 不保留“后登录踢前登录”的可配置开关（PRD-§10 Q6 推荐值，本 Spec 采纳）。
- 不设置人为会话数量上限，仅靠闲置超时清理（PRD-§4.1 S-07）。
- 不将前端 token 存储从 `sessionStorage` 改为 `localStorage`（PRD-§7 最后一行）。
- 不新增前端埋点或业务日志埋点（Spec 约束；NFR 见 §8）。

## 7. 验收标准

- AC1↔B1：同账号连续两次 `POST /api/login` 均 200，得到两个不同且匹配 `[0-9a-f]{64}` 的 token；用第一个 token `GET /api/bootstrap` 仍 200，且 `user.USER_ID` 为该账号。
- AC2↔B2, B13：用 token2 调 `GET /api/bootstrap` 200，`loginAt` 为第二次登录时间；token1 的 `loginAt` 仍为第一次登录时间，不因后登录改变。
- AC3↔B3 ↩B10, N4：token1 登出 200 后，token1 调接口 401、token2 仍 200。
- AC4↔B4, N3：对已失效 token 再次 `POST /api/logout` 返回 `200 {ok:true}`。
- AC5↔B5, N5：以 `ams.session.idle-timeout-minutes=0.02` 启动实例，登录后等待超过阈值再调 `GET /api/bootstrap`，返回 401 且 `message` 含“登入已逾时”。
- AC6↔B6：登录后每隔 200ms 调 `GET /api/bootstrap` 持续超过阈值总时长，始终 200。
- AC7↔B7：账号 B 被置为 `ACTIVE=N` 后其所有 token 调接口返回 401 且 `message` 含“账号已停用”；账号 A 的 token 仍 200。
- AC8↔B8：浏览器中令 token 进入过期状态后刷新，回到登录页并显示“登入已逾时，请重新登入”。
- AC9↔B9, N6：未登录打开 `#/ack/:alarmKey` 并登录，URL hash 回到该 ACK 路径；深链为未知路径时落到 `/home`。
- AC10↔B10, N7：两个同源 page 分别登录；page1 登出后 page2 reload 仍显示主壳。
- AC11↔B11：切换简中/繁中/英文后触发过期提示，三种语言均显示对应文案且无缺失 key。
- AC12↔B12, N1, N2：伪造 64 位十六进制 token 调接口 401 且真实会话不受影响；错误密码登录 401 后原 token 仍 200；登录响应与 `bootstrap` 响应均不含 `PASSWORD_HASH`。
- AC13↔B13, B14, B15：刷新后页脚“登入时间”不变；登出无二次确认弹窗；`sessionStorage` 键仍为 `ams_java_token`。
- AC14↔N4：显式改写 `WorkflowIntegrationTest#authenticationSingleSessionAndNoPasswordDisclosure`，断言两次登录后第一个 token 仍 200（旧“第一个 token 401”断言不得保留）。

## 8. NFR 档位声明

性能=P1（会话 Map 查询 O(1)、超时清理仅登录时一次 O(n)） · 灰度=G1（单实例直接发布，可开关回滚） · 日志=O1（沿用 traceId 异常日志，不新增埋点） · 可靠性=R1（无外部调用，单实例内存会话） · 单测=T1（认证单元/集成测试更新） · 集成测试=I1（TC-API-E2E-005/006） · 安全=S2（token 随机性与会话隔离需回归，密码算法不变） · AI Agent=N/A（本次无 Agent 相关触点）

## 9. 开放问题

- 闲置超时阈值的最小粒度是否接受小数分钟（如 `0.02`）？——由研发在实现时确认，阻塞合入：B5 的 AC5 可测性；默认按小数分钟实现，不支持小数则回退为秒级配置项。
- 深链回跳是否需要记住登录前的查询参数（如 `?transaction=`）？——由产品在 E2E 用例编写前确认，不阻塞开工：B9 的实现细节，默认仅回跳 `fullPath`。
- 会话无上限导致的内存增长是否需要独立清理任务？——由研发在联调部署前确认，不阻塞开工：B1 的长期运行约束，默认沿用登录时清理并在交付说明中登记为已知限制。
