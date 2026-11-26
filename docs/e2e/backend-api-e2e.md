# 后端接口 E2E 文本用例

被测对象：`backend` 打包产物以真实进程启动（随机端口、临时 H2 文件库、`ams.scheduling=false`、不配置 SMTP），
用例用 JDK `HttpClient` 发真实 HTTP 请求。所有接口统一入口 `POST/GET/PUT /api/**`，响应体固定含 `ok` 字段。

代码：`backend/src/test/java/com/changxin/ams/e2e/`；共享基类 `E2ETestBase`，实例管理 `E2EInstance`，HTTP 封装 `E2EHttpClient`。
默认 `mvn test` 只跑单元/集成测试；后端接口 E2E 由 `ams.e2e.enabled=true` 显式开启（`scripts/run-java-e2e.sh`）。

## 公共前置

| 项 | 取值 |
| -- | ---- |
| 启动 | `java -jar backend/target/ams-1.0.0.jar --server.port=<随机> --spring.datasource.url=jdbc:h2:file:<系统临时目录>/ams-db` |
| 就绪 | 轮询 `GET /health` 返回 200（上限 120s，进程提前退出则直接失败并附日志尾部） |
| 认证 | `POST /api/login {userId,password}` → `token`（64 位十六进制）；后续请求带 `Authorization: Bearer <token>` |
| 初始账号 | `E0043258` / `123456`（种子用户统一初始密码） |
| 数据隔离 | 每个用例类独立进程与临时库；新建主档代码带 `E2E...` 唯一前缀 |
| 清理 | 进程停止后删除系统临时目录（不含仓库内 `./data`） |

---

## TC-API-E2E-001 认证主链路与未授权拒绝

**优先级**：P0　**类型**：安全 / 主链路　**代码**：`BackendAuthE2ETest#shouldLoginBootstrapAndRejectUnauthorizedAccess`

| # | 步骤 | 预期 |
| - | ---- | ---- |
| 1 | `GET /api/bootstrap`（不带 token） | HTTP 401，`ok=false`，`message` 非空 |
| 2 | `POST /api/login`，错误密码 | HTTP 401，`ok=false` |
| 3 | `POST /api/login`，正确账号密码 | HTTP 200；`token` 匹配 `[0-9a-f]{64}`；`user.USER_ID=E0043258`；响应体不含 `PASSWORD_HASH` |
| 4 | 带该 token `GET /api/bootstrap` | 200；`nav` 非空，含 path 的节点以 `#/` 开头；`options.factory` 为数组；`meta.masters.SBRM_FACTORY.code` 正确 |
| 5 | 新客户端（无 token）访问 `/api/bootstrap` | 401 |
| 6 | `POST /api/logout` 后复用原 token | 401（会话已失效） |
| 7 | 用同一账号再次登入并访问 bootstrap | 200 |

安全要求：token、密码不写入测试报告；`user` 对象不得出现密码摘要字段。

---

## TC-API-E2E-002 厂别主档增改停用与历史

**优先级**：P0　**类型**：主档 CRUD + 审计　**代码**：`MasterDataE2ETest#shouldCreateUpdateHideAndRestoreFactory`

| # | 步骤 | 预期 |
| - | ---- | ---- |
| 1 | `POST /api/master/SBRM_FACTORY`（唯一 `FACTORY_ID`） | 200；`row.ACTIVE=Y`；返回 `FACTORY_KEY` |
| 2 | `GET ...?showHidden=0` | 列表包含该行 |
| 3 | 重复提交同一 `FACTORY_ID` | 400，`ok=false`，`message` 含“唯一”（唯一键校验） |
| 4 | 缺少 `FACTORY_ID` 新增 | 400，`message` 含“必填”，不落库 |
| 5 | `PUT .../{FACTORY_KEY}` 修改名称 | 200；再次查询名称为新值 |
| 6 | `POST .../{FACTORY_KEY}/hide` | 200；`showHidden=0` 不含、`showHidden=1` 含且 `ACTIVE=N` |
| 7 | `GET .../history?key=<FACTORY_KEY>` | 含 `AddNew`/`Modify`/`Hide`；`TRX_DT` 非空、`USER_ID=E0043258` |
| 8 | `POST .../{FACTORY_KEY}/show` | 200；`showHidden=0` 重新可见且 `ACTIVE=Y` |

清理：恢复后停用测试行（`@AfterEach`）。

---

## TC-API-E2E-003 测试告警触发与 ACK 规则

**优先级**：P0　**类型**：业务主链路 + 安全约束　**代码**：`AlarmWorkflowE2ETest#shouldTriggerAlarmAndEnforceAckRules`

前置：`F01 / SS03 / EQP01 / PRT_NODYE` 为种子数据中已配置的四要素；SMTP 未配置（邮件必然 `Fail`）。

| # | 步骤 | 预期 |
| - | ---- | ---- |
| 1 | `GET /api/alarms/test/options?factoryKey=F01&subsysKey=SS03&eqpKey=EQP01` | 200；`alarmCodes` 含 `PRT_NODYE` |
| 2 | `POST /api/alarms/test`（四要素 + 唯一标题） | 200；`alarm.STATUS=Process`；`logOnly=false` |
| 3 | `GET /api/alarms/pending` | **不含**该告警（邮件未成功送达，当前账号不可 ACK） |
| 4 | `GET /api/alarms/{key}` | 200；`TITLE` 为步骤 2 的标题；`LEVEL_REQUIRED>0`；通知记录为 `Pending`/`Email` |
| 5 | 立即 `POST /api/alarms/{key}/ack` | 4xx，`ok=false`，`message` 含“待确认人员” |
| 6 | 再次 `GET /api/alarms/{key}` | `ACK_USERS` 为空、`LEVEL_ACK_COUNT=0`、`STATUS=Process`（拒绝的 ACK 不计数） |
| 7 | `GET /api/alarms/NOT-EXISTING` | 404，`ok=false` |

说明：产品规则要求“邮件成功送达后该层级人员才可 ACK”。未配置 SMTP 时由调度器把通知标记为 `Fail`，因此闭环的
“多人 ACK 至 Completed”由既有集成测试 `WorkflowIntegrationTest#realSmtpMessageAndAuthenticatedAckCompletion`（本地 SMTP 接收器）覆盖，
本 E2E 只验证真实进程下的触发、可见性和 ACK 拒绝规则，不伪造成功。

---

## TC-API-E2E-004 汇出、导入校验与错误契约

**优先级**：P1　**类型**：Excel 交易 + 契约　**代码**：`MasterImportExportE2ETest#shouldExportValidateImportAndRejectUnknownApi`

| # | 步骤 | 预期 |
| - | ---- | ---- |
| 1 | `POST /api/master/SBRM_FACTORY/export {mode:'template'}` | 200；`filename` 以 `.xlsx` 结尾；`base64` 解码为合法 xlsx 且表头含 `FACTORY_ID`/`FACTORY_NAME` |
| 2 | 模板原样 `POST /import/verify` | 200；`rows` 为空（模板无数据行） |
| 3 | 构造缺少 `FACTORY_ID` 的 xlsx 再 verify | 200；该行 `valid=false` 且 `message` 含“必填” |
| 4 | `POST /import` 提交 `valid=false` 行 | 200，`success=0`；主档中不出现该数据（不信任浏览器标记） |
| 5 | 合法行（唯一 `E2EIMP...`）verify 后 `import` | `success=1`；`GET ...?showHidden=1&q=<代码>` 恰好 1 行 |
| 6 | `POST /api/not-exists` | 404，`ok=false` |
| 7 | `POST .../export {mode:'unknown'}` | 非 5xx |

清理：停用导入的测试行。

---

## TC-API-E2E-006 无效警报留存与 AVPA014 报表查询汇出

**优先级**：P1　**类型**：业务流程 + 报表契约 + 鉴权　**代码**：`InvalidAlarmReportE2ETest#shouldPersistFailuresAndServeReport`

前置：种子 `F01=Fab01`、`F02` 未与 `SS03` 对应；`PRT_NODYE` 为 `F01/SS03/EQP01` 的启用中警报设定；本次触发标题共用唯一标记。

| # | 步骤 | 预期 |
| - | ---- | ---- |
| 1 | `GET /api/report-defs/AVPA014` | 200；`REPORT_NAME=无效警报查询`；`ATLEAST_ONE_CONDITION=N`；COLUMNS 含 INVALID_ID/CREATE_DT/REASON/四要素/TITLE/RECEIVE_TYPE/SOURCE_TYPE |
| 2 | 依次以 `MISSING_FACTORY`（未设定厂别）、`F02+SS03`（未设定子系统）、`MISSING_EQP`（未设定机台）、`MISSING_ALARM`（找不到事件）触发 | 均 422、`ok=false`、`message` 为对应中文原因；按标题查询各恰好 1 条记录 |
| 3 | `PUT /api/master/AVMA009/{key}` 将 `PRT_NODYE` 停用后触发，再恢复 | 422“警报设定未启用”，落库 1 条；恢复后设定重新可用 |
| 4 | 成功触发一次 `PRT_NODYE` 后立即再次触发同一四要素 | 第二次 422“忽略相同警报”且落库 1 条 |
| 5 | 触发 `PRT_MOTOR_ERR` | 422“未设定层级1”（该分支落库由 `WorkflowIntegrationTest` 覆盖） |
| 6 | 再次成功触发（不同标题） | 200、`STATUS=Process`；该标题不属于无效警报记录 |
| 7 | 按标题标记查询 AVPA014 | 恰好 6 条，原因集合与步骤 2–4 一致，`CREATE_DT` 倒序 |
| 8 | 检查字段 | `MISSING_FACTORY` 原样保留且厂别名称为空；`MISSING_EQP` 记录厂别名称 `Fab01`、`SUB_SYS_ID=SS03`；`INVALID_ID` 非空；`RECEIVE_TYPE=Mock`、`SOURCE_TYPE=Test` |
| 9 | 以该记录自身 `CREATE_DT` 作为 between 起止 | 命中该记录（端点包含） |
| 10 | 标题+原因等于+机台包含组合；不存在原因；2000 年空区间 | 交集 1 条；后两者 `rows` 为空且 200 |
| 11 | `POST /api/reports/AVPA014/query` 传 `UNKNOWN_FIELD` | 400、`ok=false` |
| 12 | `POST /api/reports/AVPA014/export` 传当前 rows | 200；`filename=无效警报查询.xlsx`；表头等于定义列标签且行数一致；资料时间与失效原因单元格有值，含 `MISSING_EQP` 行 |
| 13 | 无 token 访问 report-defs / query / `POST /api/alarms/test` | 均为 401；未认证触发不产生无效记录 |

清理：测试内恢复被停用的警报设定；无效警报记录为只读追加数据，不做删除。
