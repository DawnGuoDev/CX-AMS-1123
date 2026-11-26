# AMS 设计系统 · 使用与维护

本目录是一个**独立的 Vite 预览应用**，把 AMS 前端的真实视觉规范与公共组件抽成可浏览、可验证的设计系统。它不引入 Java 后端、不经过登录页、不读取浏览器里的业务 Token。

- 基础组件：`ant-design-vue@4.2.6`（与生产完全同版本，不加壳重造）
- 产品层：`DataGrid`、`FieldForm`、`UiCheckbox`、`RecordDialog`、`AppSidebar`
- 业务组合：主档编辑、条件查询与结果表格、告警详情
- 数据：`mock/fixtures.json`，由仓库 `backend/src/main/resources/seed.json` 与 `metadata.json` 裁剪而来，已去除密码哈希，邮箱统一为 `example.invalid`

规范正文见 [DESIGN.md](./DESIGN.md)，组件契约见 [components.md](./components.md)，业务组合见 [patterns.md](./patterns.md)。

## 环境要求

- Node.js `>= 20.19`（生产前端同要求；Node 22 会在安装时提示部分 devDependency 的 engine 警告，不影响构建）
- npm 10+

## 本地运行

```bash
cd frontend/design-system
npm ci                  # 或 npm install
npm run dev             # http://127.0.0.1:5173/
```

`vite.config.js` 中 `base: './'` 且 `server.port: 5273`；`npm run dev` 时以终端输出为准，默认可用 `http://127.0.0.1:5273/`。没有 proxy，也没有 `VITE_API_BASE` 一类配置。

> 该应用与生产前端 `frontend/` 是并列的两个 npm 项目：设计系统有自己的 `node_modules`，不会改动生产依赖。`package-lock.json` 已提交，CI 使用 `npm ci`。

## 构建与静态预览

```bash
npm run build           # 产物在 dist/，base 为相对路径，可直接放到任意静态目录
npm run preview         # 用构建产物起本地静态服务（建议验收时用这个而不是 dev）
```

`dist/` 不纳入 Git。构建产物是纯前端静态文件，可离线直接打开 `index.html`（hash 路由，不依赖服务端 rewrite）。

## 验证

```bash
npm run test:unit       # vitest：公共组件行为 + fixtures 约束
npm run verify:offline  # 静态扫描：不得出现 /api、fetch、sessionStorage、登录、外网 URL、vue-router
npm run build           # 生产构建必须通过
```

建议提交前三条全跑；`verify:offline` 是设计系统"可脱离 Java 后端"的硬性守卫。

## 目录结构

```
frontend/design-system/
├─ index.html              # 预览入口
├─ src/
│  ├─ App.vue              # ConfigProvider（真实主题）+ hash 路由 + 左侧目录
│  ├─ styles/
│  │  ├─ tokens.css        # 由生产 App.vue / style.css 提取的令牌
│  │  ├─ ams.css           # 业务布局样式（去登录/去 API）
│  │  └─ gallery.css       # 设计系统外壳与示例框架
│  ├─ components/          # 五件套 + PageShell / PatternFrame 等预览辅助
│  ├─ views/               # 令牌、组件目录、组件页、三类业务组合
│  └─ composables/useMockData.js
├─ mock/
│  ├─ fixtures.json        # 本地演示数据（不含 PASSWORD_HASH）
│  └─ index.js             # previewRuntime：查询/储存/确认均只改内存
├─ tests/                  # vitest 单测
├─ scripts/check-offline.mjs
└─ docs/                   # 规范文档（本文件、DESIGN/components/patterns）
```

## 路由索引

| Hash | 页面 | 用途 |
| --- | --- | --- |
| `#/` | 概览 | 设计系统定位、令牌摘要、状态统计 |
| `#/foundation/tokens` | Design tokens | 主题、状态色、表格密度、间距字体 |
| `#/components/catalog` | 组件目录 | 14 个 Ant Design Vue 基础组件 + 5 个 AMS 公共组件清单与预览 |
| `#/components/table` | Table / 表格 | 数据网格、空状态、密度 |
| `#/components/form` | Form / 表单 | 校验、字段布局 |
| `#/components/feedback` | Feedback / 反馈 | Alert、Empty、Modal、message |
| `#/components/ams` | 五件套公共组件 | 五个组件的 props/emits 与交互演示 |
| `#/business/master` | 主档编辑 | 工具栏 + DataGrid + RecordDialog + FieldForm |
| `#/business/query` | 条件查询与结果表格 | 条件弹窗 + 结果 DataGrid |
| `#/business/alarm` | 告警详情 | 宽弹窗、Tabs、历史记录表格 |
| `#/routes` | 路由与映射 | 预览路由与生产页面/组件的对应关系 |

## 数据同步

`mock/fixtures.json` 是**快照**，不是运行时接口。生产数据模型变化时按以下步骤更新：

1. 从 `backend/src/main/resources/seed.json` 取演示主档、告警与明细；从 `metadata.json` 取字段元数据与报表列定义。
2. 保留字段名、状态枚举、列顺序与日期格式；删除 `PASSWORD_HASH`，邮箱替换为 `example.invalid`。
3. 覆盖 `mock/fixtures.json`，`meta.mock` 必须为 `true`；跑 `npm run test:unit` 与 `npm run verify:offline`。
4. 只在 `mock/index.js` 里扩展本地行为，不新增网络调用；`previewRuntime` 的所有写操作都只修改内存副本，刷新即恢复。

## 与生产前端的边界

- 共同来源：`frontend/src/components/*`、`frontend/src/App.vue`（主题）、`frontend/src/style.css`（布局与状态色）。
- 本目录组件是**纯展示版**：`state`、`api`、`vue-router` 均被替换为 props + emits，DOM 结构与类名保留，便于视觉回归。
- 不在本目录复制 Ant Design Vue 原生组件，也不引入业务页面的请求、权限与登录逻辑。
- 设计系统升级基础库版本时，必须与生产 `frontend/package.json` 的 `ant-design-vue` 同步修改；当前两边都是 `4.2.6`。
