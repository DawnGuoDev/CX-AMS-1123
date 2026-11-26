# AMS 仓库协作指南

本文依据当前仓库的代码、配置和脚本编写，供在本仓库工作的 Agent 使用。命令默认从仓库根目录执行；实际分支以 `git branch --show-current` 为准，不能仅根据 README 中的发布分支标注判断。

## 1. 功能范围

本项目是 AMS 告警管理 MVP，范围为 **10 个业务页面 + Email**，另保留测试告警触发、设备模拟和单笔 ACK。

| 页面代码 | 功能 |
|---|---|
| `SBRM_USER` | 使用者管理 |
| `SBRM_FACTORY` | 厂别管理 |
| `SBRM_EQP` | 机台管理 |
| `AVMA003` | 子系统管理 |
| `AVMA004` | 厂别子系统对应 |
| `AVMA007` | 事件通知管理、通知层级 |
| `AVMA009` | 警报通知管理、四要素匹配 |
| `AVPA013` | 即时警报汇总、机台下钻 |
| `AVPA004` | 警报处理查询 |
| `AVPA007` | 历史记录查询 |
| `TEST` / `ACK_LIST` | 测试触发、设备模拟／当前账号待确认告警 |
| `#/ack/:alarmKey` | 邮件确认链接，登录后单笔 ACK |

- 通知渠道仅为 Email，每个事件层级直接选择人员。
- 不恢复人员群组、事件通知群组、短信／语音／IM、多通道、机台群组、SQL 触发、设备 Agent 管理、独立强制中断或无效告警报表。
- BYPASS 已移除。子系统只维护代码、名称；`Store` 中仅保留清除旧字段的数据迁移，不能重新引入仅记录、不通知的业务分支。
- 一般主档和对应关系保留既有 Excel 能力；不扩展主档 Excel 流程、事件主从 Excel 或批量 ACK。
- 操作手册只用于核对上述已选功能，不因手册描述其他功能而扩大范围。页面使用“管理”命名，菜单和标题不显示内部页面代码。

范围依据见 [README.md](README.md)、[PAGE_MAP.md](PAGE_MAP.md) 和 [docs/MANUAL_ALIGNMENT.md](docs/MANUAL_ALIGNMENT.md)。README 引用的操作手册不是仓库根目录内的文件；需要查看时先确认实际路径。

## 2. 技术栈与目录

后端为 Java 21、Spring Boot 3.5.7、Maven，使用 Spring JDBC、H2、Jackson、Spring Mail 和 Apache POI。前端为 Vue 3、Vue Router、Vite 6、Ant Design Vue 4.2.6，测试使用 Vitest 和 Playwright。版本以 `backend/pom.xml`、`frontend/package.json` 和锁文件为准。

| 路径 | 职责 |
|---|---|
| `backend/src/main/java/com/changxin/ams/ApiController.java` | `/api` 路由、认证、Store 读写边界、错误响应 |
| 同目录 `Masters.java` | 元数据驱动的主档／对应／事件层级维护与校验 |
| 同目录 `AlarmEngine.java` | 告警匹配、去重、层级快照、发送队列、重试、升级、ACK、历史详情 |
| 同目录 `SmtpDelivery.java` / `EngineScheduler.java` | SMTP 投递／每 2 秒推进告警并派发通知 |
| 同目录 `Reports.java` / `Excel.java` | 查询条件、即时汇总、报表与既有主档 Excel |
| 同目录 `Store.java` / `Auth.java` / `Json.java` | 数据快照／内存会话与密码验证／JSON 辅助函数 |
| `backend/src/main/resources/metadata.json` | 页面、字段、选项与固定报表定义 |
| `backend/src/main/resources/seed.json` | 首次初始化的样例数据 |
| `backend/src/main/resources/application.yml` | 端口、H2、SMTP、调度、健康检查配置 |
| `frontend/src/main.js` / `App.vue` | Hash 路由／登录、主题、语言和应用外壳 |
| `frontend/src/state.js` | 共享状态、API 请求、错误处理、下载、告警详情 |
| `frontend/src/pages/` | `Workspace` 分发页面；`MasterPage`、`ReportPage`、`OperationsPage` 实现业务 |
| `frontend/src/components/` | 表单、数据表、侧栏、弹窗、告警详情、设备模拟等共享组件 |
| `frontend/src/filters.js` / `legacy-i18n.js` | 条件运算／界面翻译 |
| `scripts/` | 构建、启动、后端接口 E2E、前端 E2E |
| `backend/src/test/` / `frontend/src/**/__tests__/` / `e2e/frontend/` | 后端测试／前端单元测试／浏览器 E2E |
| `docs/e2e/` | 测试文本用例及用例 ID |

## 3. 构建与启动

环境要求：JDK 21、Maven 3.9+、Node.js 20.19+（建议 22 LTS）、npm。仓库没有 Maven Wrapper。

```bash
export JAVA_HOME=/path/to/jdk-21
# Maven 不在 PATH 中时，可设置 MAVEN_COMMAND 为可执行文件路径。
bash scripts/build-java-vue.sh
# 仅首次创建配置；已有 .env.local 时不要覆盖。
test -f .env.local || cp .env.example .env.local
bash scripts/start-java.sh
```

- 构建脚本执行 `frontend/npm ci`、前端构建，再执行 `mvn -Pweb clean package`，包含后端测试。
- 一体化产物是 `backend/target/ams-1.0.0.jar`；`-Pweb` 将 `frontend/dist` 放入 JAR 的静态资源目录。
- 启动脚本读取 `.env.local`，默认入口为 `http://localhost:8180`。直接执行 `java -jar` 不会自动读取 `.env.local`，`application.yml` 的默认端口为 8080。
- 启动脚本将产物复制到 `backend/.runtime/ams-<SHA256>.jar` 后运行，避免构建覆盖正在使用的 JAR。重新构建后，须重启才能应用新版本。
- `/health` 用于健康检查，`/metrics` 提供 Prometheus 指标。
- 登录默认账号为 `E0043258`，密码框必须为空；种子账号的初始密码为 `123456`，实际持久账号可能已修改。

前后端分开开发：

```bash
# Java 服务另行通过 scripts/start-java.sh 启动。
cd frontend
npm ci
API_TARGET=http://127.0.0.1:8180 npm run dev
```

开发入口为 `http://127.0.0.1:5173`。Vite 代理 `/api` 和 `/health`；未设置 `API_TARGET` 时默认代理到 8080。

## 4. 代码与业务约定

### 数据和接口

- 当前为**单实例 H2 JSON 快照**：业务数据保存在 `AMS_STATE` 表 `ID=1` 的 `PAYLOAD` 中，不是按业务实体拆分的关系表，也没有多副本调度、租户隔离或细粒度 RBAC。
- 业务字段沿用大写键名（如 `EVENT_KEY`、`USER_KEYS`），内部配置／请求结构按现有契约维护；使用 `Json` 辅助函数处理 Map、列表和数值。
- 读操作经 `Store.read`，写操作经 `Store.write`。锁覆盖校验、修改与持久化；写入异常回滚快照，响应脱离内部对象引用。不要在锁外直接修改 `Store.data()` 或 `Store.table()` 返回的数据。
- SMTP 网络操作必须保持在 Store 锁外，结果再通过受保护的写操作持久化。
- `/api` 使用 Bearer token，登录之外的业务接口需要认证；前端 token 放在 `sessionStorage` 的 `ams_java_token`。会话在服务端内存中，重启失效，同账号再次登录会替换旧会话。
- 复用 `ApiException` 的状态码及 `{ok:false,message}` 错误契约。未知或已删除接口保持拒绝，不新增静默兼容。
- 修改字段时核对 `metadata.json`、后端校验、前端表单／列表、关联选项和测试，不只改显示标签。
- `seed.json` 只用于首次初始化，修改种子不能更新现有数据；兼容改动需考虑当前 schema `checked-mvp-1` 的旧快照。旧演示 schema 会拒绝加载。

### 告警、层级与 ACK

- 告警按厂别、子系统、机台、警报码四要素匹配；指定机台优先，其次 `*`。重复告警受忽略间隔约束。
- 层级从 1 连续，每层直接保存 `USER_KEYS`，至少有一位启用且有邮箱的人员；ACK 人数支持 `0`、`*` 或不超过通知人数的非负整数。
- 升级间隔为分钟，失败重送间隔为秒；重送次数不包含首次发送。只重试失败邮件，不重发 `Success`。
- 告警触发时保存层级配置快照，不把后续配置修改直接应用到运行中告警。
- 优先权数字越大，待发送邮件越优先；优先权不改变层级和 ACK 规则。
- 单笔 ACK 校验当前账号、层级、处理状态及成功通知记录，每人每层只能确认一次。打开邮件链接或 GET 详情不确认告警。
- ACK 达标完成；超时升级，无下一层为 `NoNextLevel`。零 ACK 的层级需等待全部邮件发送成功，不能提前宣告完成。
- `Success` 仅表示 SMTP 服务器接受，不代表最终送达或已阅读；未配置或失败必须如实记录 `Fail`。当前队列不承诺邮件恰好发送一次。

### 前端交互

- 使用 Vue `<script setup>` 和现有按组件导入的 Ant Design Vue；沿用 `App.vue` 的主题／语言配置，复用 `state.js` 的 `api`、`act`、`notify`。
- 复用 `UiCheckbox` 适配 `Y/N` 和人员数组，不能把 API 字符串标记误转为布尔值。
- 复用 `RecordDialog`，保持 `mask-closable=false`；不能因外部点击或拖拽关闭并丢失表单。取消和最终保存的语义要明确。
- 事件编辑锁定代码、厂别、子系统；层级先确认到草稿，最终储存才落库，取消丢弃，不自动重排错误层级。
- 新增使用者密码必填；编辑留空保持原密码，复制不携带密码，导出和履历不泄露密码。
- 处理／历史报表首次等待主动查询，未启用条件禁用输入，取消不改变已应用条件；日期精确到秒，列过滤和查询条件取交集。
- 报表导出使用当前查询并过滤后的结果；历史详情使用所选交易快照，不用当前状态冒充历史。
- 设备模拟默认仅预览；实际触发复用测试告警 API，温度恢复不等于 ACK，也不停止已受理告警。

## 5. 验证方式

根据改动选择相关验证。测试数量会变化，以实际输出为准；纯文档修改核对路径、命令和差异即可。

| 验证 | 命令／位置 |
|---|---|
| 后端单元和集成 | `cd backend && mvn test` |
| 前端单元 | `cd frontend && npm ci && npm run test:unit` |
| 前端构建 | `cd frontend && npm run build` |
| 含前端的完整构建 | `bash scripts/build-java-vue.sh` |
| 后端 HTTP E2E | `bash scripts/run-java-e2e.sh` |
| 前端浏览器 E2E | 首次 `cd e2e && npm ci && npm run install:browsers`；回到根目录执行 `AMS_E2E_REBUILD=1 bash scripts/run-frontend-e2e.sh` |
| 差异检查 | `git diff --check`；已暂存时另执行 `git diff --cached --check` |

- 默认 `mvn test` 运行单元／集成测试，HTTP E2E 需显式启用 `ams.e2e.enabled=true`，由脚本完成；不要依据旧文档注释认为默认会运行全部 E2E。
- 后端单元测试在 `unit/`；集成测试为 `WorkflowIntegrationTest` 和 `ManualAlignmentIntegrationTest`，使用内存 H2 和本机 `SmtpCapture`。
- 后端接口 E2E 使用随机端口和临时 H2。前端 E2E 使用临时后端（默认 18180）、静态服务（4173）及 Chromium；设置 `AMS_E2E_REBUILD=1` 避免复用旧产物。
- 前端 E2E 脚本不读取 `.env.local`，但会继承调用 shell 的环境；如果已导出真实 SMTP 变量，测试前显式清空 `AMS_SMTP_HOST` 和 `AMS_SMTP_FROM`。
- 改动跨层级通知时，验证去重、失败重试、超时升级、ACK 权限及配置快照；改动历史查询时，覆盖快照和秒级条件；改动共享组件时，检查使用它的页面。
- E2E 用例 ID 与 `docs/e2e/` 文本保持对应。区分已通过、未执行和环境受阻，不把构建成功等同于端到端验证。

## 6. 本地数据与交付

- `.env.local` 保存本地真实 SMTP 配置且被 Git 忽略，不打印或提交密码、授权码、token；`.env.example` 只保留示例。
- 不覆盖、删除或提交 `backend/data/` 的业务数据库；数据迁移前需备份，文件级备份在服务停止后执行，避免复制写入中的 H2 文件。
- 自动测试使用隔离数据库和测试 SMTP。不要通过真实 SMTP 的本地业务实例反复创建测试告警；“实际触发”可能向所有层级人员发送真实邮件。
- `AMS_PUBLIC_URL` 是邮件 ACK 的站点根地址；远程收件人需要能访问它。465 隐式 TLS 通常设置 `AMS_SMTP_SSL=true`、`AMS_SMTP_STARTTLS=false`，其余按服务商配置。
- 不将 `node_modules`、`frontend/dist`、`backend/target`、`backend/.runtime`、数据库、测试报告或日志加入版本控制；锁文件需要随依赖改动一起维护。
- 修改前检查暂存区和工作区，保留已有改动；只有用户明确要求时才暂存、提交或推送。
- 交付说明写清修改内容、验证结果、尚未完成的验证，以及是否重启／提交／推送；按需要更新 README、页面映射和手册核对清单。
