# 预览路由与生产映射

设计系统用 `window.location.hash` 手写路由，不依赖 `vue-router`。所有页面可独立打开，互不要求前置登录。

| 设计系统路由 | 页面 | 生产对应 | 主要组件 |
| --- | --- | --- | --- |
| `#/` | 概览 | — | 状态 KPI 卡片、Ant Statistic 风格 |
| `#/foundation/tokens` | Design tokens | `App.vue` ConfigProvider、`style.css` | `ConfigProvider`、`a-tag`、`a-table` |
| `#/components/catalog` | 组件目录 | `frontend/src/components/` | Ant 基础组件 + 五件套 |
| `#/components/table` | Table / 表格 | `DataGrid.vue` 使用页 | `DataGrid`、`a-table` |
| `#/components/form` | Form / 表单 | `FieldForm.vue` 使用页 | `FieldForm`、`a-form` |
| `#/components/feedback` | Feedback / 反馈 | 全局 message / alert / modal | `a-alert`、`a-empty`、`a-modal` |
| `#/components/ams` | 五件套公共组件 | `frontend/src/components/` | 五个 AMS 组件 |
| `#/business/master` | 主档编辑 | `frontend/src/pages/MasterPage.vue`（`SBRM_USER`） | `PageShell`、`DataGrid`、`RecordDialog`、`FieldForm` |
| `#/business/query` | 条件查询与结果表格 | `frontend/src/pages/ReportPage.vue`（`AVPA004`） | `PageShell`、`DataGrid`、`Modal`、`UiCheckbox` |
| `#/business/alarm` | 告警详情 | `frontend/src/pages/AlarmDetail.vue`（`AVPA013`） | `PageShell`、`RecordDialog`、`AmsTabs`、`DataGrid` |
| `#/routes` | 路由与映射 | — | 索引表 |

## 生产组件到设计系统组件的映射

| 生产 | 设计系统 | 差异 |
| --- | --- | --- |
| `App.vue`（ConfigProvider + Sidebar + RouterView） | `App.vue`（ConfigProvider + 自写 hash 路由） | 无 vue-router、无登录、无 bootstrap |
| `DataGrid.vue`（依赖 `state`、`t`） | `DataGrid.vue`（props 传 `columns/label`） | 过滤/排序/分页逻辑保留 |
| `FieldForm.vue`（依赖 `state.options`） | `FieldForm.vue`（`options` prop） | 级联逻辑保留 |
| `RecordDialog.vue` | `RecordDialog.vue` | 不改 DOM，父层控制 |
| `AppSidebar.vue`（router.push） | `AppSidebar.vue`（emit `navigate`） | 导航由宿主决定 |
| `pages/MasterPage.vue` | `views/MasterEditView.vue` | 仅保留样本字段，真实 CRUD 由生产承接 |
| `pages/ReportPage.vue` | `views/QueryTableView.vue` | 查询在本地 fixtures 执行 |
| `pages/AlarmDetail.vue` | `views/AlarmDetailView.vue` | 详情来自 fixtures，不发 `openAlarm` 请求 |

## 新增页面时的做法

1. 先在 `src/views/` 新建页面，复用 `PageShell` + `PatternFrame`（业务组合）或画廊布局（组件页）。
2. 在 `src/App.vue` 的 `routes` 与左侧 `links` 中登记。
3. 更新本文件与 `docs/README.md` 的路由索引。
4. 运行 `npm run test:unit && npm run verify:offline && npm run build`，并至少在构建预览中打开一次新路由。
