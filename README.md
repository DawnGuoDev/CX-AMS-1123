# AMS · Java + Vue MVP

分支：`feat/java-vue`。按《AMS系统澄清》最后一列带 ✅ 的 11 项需求收敛为 **10 个业务页面 + Email 能力**，另外保留用户确认的测试触发与 ACK。

需求来源：[AMS系统澄清](https://bytedance.larkoffice.com/wiki/VY5jwU9ToiKDWwkdTaZcVPaonBh?fromScene=spaceOverview&sheet=0TbGHF)。业务操作参照 `外发资料/AMS使用者操作手冊.docx`。

## 保留范围

| 需求编号 | 功能 | 页面 / 实现 |
|---|---|---|
| 1 | 使用者管理 | SBRM_USER |
| 4 | 厂别管理 | SBRM_FACTORY |
| 5 | 机台管理 | SBRM_EQP |
| 13 | 子系统管理 | AVMA003；上游使用 Mock 测试触发 |
| 14 | 厂别子系统对应 | AVMA004 |
| 16 | 事件通知管理 | AVMA007；连续层级、直接选人员、ACK 人数、升级与失败重送 |
| 18 | 警报通知管理 | AVMA009；四要素、机台 `*`、重复抑制 |
| 25 | 即时警报汇总 | AVPA013；厂别/子系统汇总、机台下钻 |
| 26 | 警报处理查询 | AVPA004 |
| 27 | 历史记录查询 | AVPA007 |
| 34 | Email | 真实 SMTP，发送结果与邮件 ACK 链接 |
| 用户补充 | 测试告警、ACK | TEST、ACK_LIST、`#/ack/:alarmKey` |

通知人员直接在事件的每个层级勾选，人员群组和事件通知群组不在本次实现中。删除了旧 Node 运行时及 Java/Vue 中的群组管理、机况/机型规则、Chamber、自动切机况、BRM/菜单/报表设计器、通知装置管理、SQL 条件触发、手动自选渠道发送、独立强制中断和无效告警报表代码。旧接口返回 404。

## 本地运行

依赖：JDK 21、Maven 3.9、Node.js 20.19+（建议 22 LTS）。

```bash
export JAVA_HOME=/path/to/jdk-21
# 非标准 Maven 安装位置可设置 MAVEN_COMMAND
bash scripts/build-java-vue.sh
cp .env.example .env.local
# 修改 .env.local 中的 Java/SMTP 配置
bash scripts/start-java.sh
```

入口：<http://localhost:8180>。登录默认账号 `E0043258`，密码框为空；种子账号初始密码为 `123456`。其他示例账号使用同一初始密码；新增使用者必须自行填写密码。

构建脚本先编译 Vue，再运行 `mvn -Pweb clean package` 执行测试并生成包含前端的 JAR。启动脚本读取被 Git 忽略的 `.env.local`；默认使用 `backend/data/ams-mvp` H2 文件，重启保留业务数据，需要重新登录。旧版 H2/Node 数据不会自动迁移，避免旧模拟通知在启用 SMTP 后被意外发送。

启动时将构建产物复制为 `backend/.runtime/ams-<SHA256>.jar`，进程使用固定版本，避免后续打包覆盖运行中的 JAR。重新构建后需重启应用才会启用新版本。

## 设计系统预览

`frontend/design-system/` 是从当前实现提取的独立设计系统，采用「Ant Design Vue 4.2.6 + AMS 产品规范 + 业务组合」，包含真实主题、布局、状态颜色、表格密度，以及 `DataGrid`、`FieldForm`、`UiCheckbox`、`RecordDialog`、`AppSidebar` 五件套和主档编辑、条件查询与结果表格、告警详情三类组合。

```bash
cd frontend/design-system
npm ci
npm run dev      # 本地预览（Vite 输出地址）
npm run build    # 静态产物 dist/
```

预览使用 `mock/fixtures.json` 本地数据，不启动 Java、不登录、不访问 `/api`。规范见 `frontend/design-system/docs/DESIGN.md`；`npm run test:unit` 与 `npm run verify:offline` 用于校验组件契约与离线约束。

## 前端 UI

UI 使用固定版本 `ant-design-vue@4.2.6`（4.x），按组件导入，入口引入 `reset.css`。
`App.vue` 通过 `ConfigProvider` 统一主题和简体／繁体／英文组件文案。
登录、主档、查询、告警详情及设备模拟使用 Ant Design Vue 的按钮、输入框、下拉框、复选框、表格、分页、标签和弹窗。
侧栏使用 `Layout.Sider + Menu`，提供业务分组、图标、分组展开／收起、72px 图标模式及悬浮子菜单；折叠偏好保存在本机。搜索支持名称与功能代码、空结果提示和 Esc 清除；直接进入页面会展开所属分组，窄屏自动收起。菜单仅展示后端返回的功能。

`UiCheckbox` 在组件边界适配 API 的 `Y/N` 和人员数组，表格筛选后的数据继续用于 Excel 汇出。

前后端分开开发时，先按上文启动 Java 服务，再执行：

```bash
cd frontend
npm ci
API_TARGET=http://127.0.0.1:8180 npm run dev
```

开发入口：<http://127.0.0.1:5173>；`/api` 和 `/health` 由 Vite 转发到 Java。
一体化构建与启动命令不变，入口仍为 <http://localhost:8180>。

## 配置真实 SMTP

将 `.env.example` 复制到 `.env.local` 后填写：

```dotenv
AMS_PUBLIC_URL=https://your-ams.example.com
AMS_SMTP_HOST=smtp.example.com
AMS_SMTP_PORT=587
AMS_SMTP_FROM=ams@example.com
AMS_SMTP_USERNAME=ams@example.com
AMS_SMTP_PASSWORD=your-app-password
AMS_SMTP_AUTH=true
AMS_SMTP_STARTTLS=true
AMS_SMTP_SSL=false
```

修改后重启应用。465 隐式 TLS 通常使用 `AMS_SMTP_SSL=true`、`AMS_SMTP_STARTTLS=false`；具体参数以邮件服务商为准。`AMS_PUBLIC_URL` 必须是收件人能访问的站点根地址，不能在远程投递时保留 localhost。人员邮箱在“使用者管理”维护；种子数据使用保留域名 `example.invalid`，上线前需替换。

SMTP 未配置或发送失败会记录为 `Fail`，不会显示模拟成功。`Success` 表示 SMTP 服务器已接受邮件，不代表用户已阅读或最终投递成功。

集成测试使用本机 SMTP 接收器，不转发到外部。本地运行时使用 `.env.local` 中的 SMTP 配置；设备模拟的“实际触发”会发送真实邮件，请核对所有层级的收件人。

## 设备数据模拟

进入“测试告警触发 → 设备模拟”，选择已有厂别、子系统、机台和警报代码。默认“仅预览”，阈值 80 °C、每 5 秒采样、运行 1 轮；“一次超温”序列为 65 → 75 → 85 → 88 → 70 °C，约 25 秒完成。另提供正常波动、反复超温场景，最多运行 10 轮。

预览仅显示温度趋势、超温次数与日志，不创建告警。需要在即时警报汇总中看到数据时，切换“实际触发”，核对并勾选确认各层收件人，再开始；页面复用 `POST /api/alarms/test`，仅正常转超温时提交一次，持续超温不重复提交。恢复后再次超温仍受“警报通知管理”的忽略间隔约束，界面会显示重复抑制。

已受理告警可直接打开详情查看 SMTP 发送状态；BYPASS 仅记录，不发送邮件，也不进入处理中汇总。即时汇总仅统计 `Process` 告警。停止、切换页签、离开或刷新页面不再产生新采样；浏览器后台自动暂停，返回后继续且不补发。已提交请求及已建立告警仍继续发送、升级和等待 ACK；温度恢复不代表 ACK。

## 查看完整流程

1. 在“事件通知管理”选择事件，配置每层通知人员与所需 ACK 人数。
2. 在“警报通知管理”关联厂别、子系统、机台、警报码与事件。
3. 打开“测试告警触发”，选择四要素并填写标题和内容。示例：Fab01 / MES / PRT01 / PRT_NODYE。
4. 详情中刷新发送状态，查看 SMTP 记录；使用邮件链接登录，填写备注并点击“警报确认”。
5. 达到人数后变为 `Completed`；未达人数按分钟升级，无下一层时变为 `NoNextLevel`。只对失败邮件按秒重试，已发送成功但未 ACK 的邮件不重发。
6. 在处理查询和历史记录中查看结果；报表支持条件开关、文本/日期运算符组合及 Excel 导出。

一般主档提供复制清空代码、编辑代码只读、隐藏/恢复、履历。事件按“主要资讯／清单资讯”编辑，层级确认后进入暂存清单，最终保存才持久化；取消丢弃暂存。首页使用即时汇总。主档 Excel 保留既有入口与流程；事件主从档通过页面维护。待确认列表进入详情后逐笔确认。

处理／历史页面首次等待查询，列过滤与查询条件取交集；汇出使用画面当前结果。历史修改时间打开所选交易的详情。

## 验证与实现说明

本次 23 项集成测试通过，包含本机 SMTP 与邮件正文、单笔 ACK 授权与重复确认拦截、16 并发告警去重、失败重试、层级升级、配置与历史交易快照、秒级条件、过滤结果导出和旧持久数据兼容。逐项修复见 [手册核对清单](docs/MANUAL_ALIGNMENT.md)。

详细边界与设计见 [实现说明](docs/JAVA_VUE_MIGRATION.md)，页面清单见 [PAGE_MAP.md](PAGE_MAP.md)。Docker 配置保留，尚未在本次环境执行镜像构建。

## 测试

| 层级 | 命令 | 说明 |
| ---- | ---- | ---- |
| 后端单元 + 集成 | `cd backend && mvn test` | 40 个用例（`unit/` 纯逻辑 + 既有 `*IntegrationTest`） |
| 后端接口 E2E | `bash scripts/run-java-e2e.sh` | 打包后启动真实进程（随机端口、临时 H2），4 条 HTTP 用例 |
| 前端单元 | `cd frontend && npm run test:unit` | 60 个 Vitest 用例 |
| 前端 E2E | `bash scripts/run-frontend-e2e.sh` | 构建 + 临时后端 + Playwright Chromium，16 条用例 |

E2E 文本用例（先于代码编写，随代码提交）见 [docs/e2e](docs/e2e/README.md)；用例 ID 在文档、测试名称与报告中一致。
默认 `mvn test` 不启动后端 E2E（需要 `ams.e2e.enabled=true`，由脚本设置），也不会写仓库内数据库文件。
