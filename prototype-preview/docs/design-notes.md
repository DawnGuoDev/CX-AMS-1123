# AMS 原型工程：来源与验收记录

## 来源

- 仓库/远端：`DawnGuoDev/CX-AMS-1123` / `https://github.com/DawnGuoDev/CX-AMS-1123.git`
- 业务基线：`release @ 13c84348c339d0acea9062954b043b1ec7e56e5d`（2026-11-26 核对 `git ls-remote`）
- 原型分支：`codex/prototype-preview`；工程目录：`prototype-preview/`
- 技术栈：Vue 3.5.46、Vue Router 4.5.1、Ant Design Vue 4.2.6、`@ant-design/icons-vue` 7.0.1、Vite 6.4.6（与 `frontend/package.json` 一致）
- 设计系统：产品知识库 `CX AMS Ant Design Vue 4.2.6`（`knowledge/design-system/ams-design-system/DESIGN.md`）；主色 `#167d92`、边框 `#dde5ed`、正文 `#23364a`、侧栏 `#122337`、13px 基准字号均来自业务 `style.css` 与 `App.vue`

逐文件来源/适配见 `../prototype-map.json`。

## 本次迁入（提前准备的最小范围）

| 业务源码 | 原型位置 | 处理 |
| --- | --- | --- |
| `frontend/src/style.css` | `src/style.css` | 原样复制；隐藏规则问题在 `src/style.js` 以覆盖方式修正 |
| `AppSidebar.vue`、`DataGrid.vue`、`FieldForm.vue`、`RecordDialog.vue`、`UiCheckbox.vue` | `src/components/` | 原样复用，仅把 state import 指向 Mock 宿主 |
| `AlarmDetail.vue` | `src/components/` | 保留弹窗/分页签/DataGrid 结构；去掉历史交易分支，ACK 走 Mock |
| `Workspace.vue`、`MasterPage.vue`、`OperationsPage.vue` | `src/pages/` | 页面结构与真实组件组合；主档持久化换成预览 store；去掉设备模拟 |
| `state.js` | `src/state.js` | 同名导出；`api()`/`bootstrap()` 指向 `src/mock/api.js` |
| `filters.js`、`legacy-i18n.js` | `src/` | 原样复制；繁中字典按需加载 OpenCC |
| `App.vue` 外壳、`ReportPage.vue` 的 KPI/DataGrid 组合 | `src/App.vue`、`src/pages/HomePage.vue` | 去掉登录，自动 bootstrap Mock 用户；首页为预览组合页 |

## 未纳入

- 报表页 AVPA013/AVPA004/AVPA007 的查询、汇出与下钻（首页仅复用 KPI 布局和警报列表）
- 设备模拟、其余主档（AVMA003/AVMA004/AVMA007/AVMA009）、导入导出、交易履历
- 真实登录、会话、权限、SMTP 发送与 Java 后端；所有状态只在内存中

## 构建

```
cd prototype-preview && npm install
npm run build      # vite build，输出 dist/
cd dist && python3 -m http.server 4173
```

`package-lock.json` 中的 `resolved` 已统一为 `https://registry.npmjs.org/`（原锁文件使用 `bnpm.byted.org`，在当前沙箱 DNS 不可达）。依赖版本未改。

## 浏览器验收（2026-11-26）

环境：Chromium 135，playwright-core 1.56.0（headless），1440×900；`python3 -m http.server 4173` 托管 `dist/`；URL `http://127.0.0.1:4173/index.html`。

| 场景 | 预期 | 实际 |
| --- | --- | --- |
| 首页加载 | AMS 主题外壳、侧栏 9 项、KPI 与警报表格 | 通过：KPI `1 / 0 / 2 / 1`，表格 1 笔，主题色/侧栏/字体一致（`evidence/01-home.png`） |
| 点击警报识别码 | 打开“警报详情”宽弹窗，基本资讯/详细内容/回应备注 | 通过：弹窗 1120px，Tab 可切换，通知记录空态（`evidence/02-detail.png`） |
| 警报确认 | 成功提示；已回应人数 0→1 | 通过：Toast“警报确认成功（预览仅保存在本页内存）”，LEVEL-1 · 1/2（`evidence/final-03-ack.png`） |
| 主档新增（SBRM_USER） | 真实 RecordDialog + FieldForm；保存后列表 2→3 笔 | 通过（`evidence/04-create.png`） |
| 测试告警触发 | 选择四要素后触发，打开新警报详情 | 通过：ALM-PREVIEW-4 / 预览测试：温度超限（`evidence/06-triggered.png`） |
| 未迁入页面（AVMA007） | 显示“此页面尚未迁入原型工程” | 通过 |
| 资源加载 | 无失败请求 | 通过；唯一控制台 404 为 `favicon.ico`（仓库本身无 favicon） |

截图使用 Playwright `animations: 'disabled'` + 固定 clip 采集，截图瞬间的 Ant 浮层过渡不参与判断。

## 平台发布与回读（2026-11-26）

- 制品 ID：`workflow-node-artifact-yf0c4mb11c5718wxjicx`，名称 `CX-AMS-1123原型工程演示`，类型 `prototype`，入口 `index.html`，版本 1
- 源码 revision：`codex/prototype-preview @ 283c0930c025782863c7ffd14624f3f548412809`
- 包内容：10 个文件（`index.html`、JS、CSS、`vendor/opencc.js`、`design-notes.md`、5 张验收截图），2,657,755 字节，`sha256:8ec780293a838d54c04b30b1e82662826d827d97d562c95007e1bb5668977f33`
- 回读：`agentnative artifacts pull prototype` 还原 10 个文件，与发布包 `diff -r` 完全一致；以静态 HTTP 托管回读副本后，入口/JS/CSS/OpenCC 均 200，浏览器打开首页与警报详情弹窗正常、无失败请求
- 在线平台预览入口：本次沙箱不支持端口暴露，CLI 未返回公开预览 URL，**未在平台在线预览页实测**；平台内由制品 ID 打开
