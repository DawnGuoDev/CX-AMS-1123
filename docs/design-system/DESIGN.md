# AMS Design System

本设计系统从当前前端实现提取，采用 **Ant Design Vue 4.2.6 基础组件 + AMS 产品规范 + 业务组合**。基础控件不加壳重造；AMS 规范负责主题、布局、状态颜色、表格密度和主从业务节奏。本地预览不依赖 Java 后端，也不需要登录。

## 使用范围

- 基础组件：Ant Design Vue `4.2.6`，按项目入口实际引入 `reset.css`。
- 产品组件：`DataGrid`、`FieldForm`、`UiCheckbox`、`RecordDialog`、`AppSidebar`。
- 代表组合：主档编辑、条件查询与结果表格、告警详情。
- 预览数据：`frontend/src/design-system/data.js`。

## Design Tokens

| Token | 值 | 来源 |
| --- | ---: | --- |
| Primary | `#167d92` | `App.vue` 的 `ConfigProvider.theme` |
| Border | `#dde5ed` | `style.css` 的 `--border` |
| Page Background | `#f3f6fa` | `style.css` 根背景 |
| Text Primary | `#23364a` | `style.css` 根文字 |
| Muted Text | `#7a8998` | `style.css` 的 `--muted` |
| Radius | `6px` | `App.vue` `borderRadius` |
| Base Font Size | `13px` | `style.css` 根字号 |
| Primary Font Stack | Inter / PingFang SC / Microsoft YaHei | `style.css` |
| Sider Width | `248px`，折叠 `72px` | `AppSidebar.vue` |
| Topbar Height | `68px` | `style.css` `.topbar` |
| Main Padding | `26px 28px 40px` | `style.css` `main` |

## 状态颜色

状态映射保留 `DataGrid.vue` 与 `.tag` 的现行语义：

| 语义 | 值 | 文字 / 背景 |
| --- | --- | --- |
| 成功 | `Completed`、`Success`、`OK`、`Y` | `#178779` / `#e4f5ef` |
| 处理中 / 未知 | `Process`、`Unknown` | `#a0710b` / `#fff5dc` |
| 失败 / 终止无下一层 | `NoNextLevel`、`Fail`、`Error`、`NG` | `#c14848` / `#fcecec` |
| 中性 / 否 | `Terminated`、`N` | `#788491` / `#eceff3` |

## 布局与表格密度

- Shell：`Layout.Sider` + 主内容；侧栏品牌区、搜索、菜单、底部折叠按钮均为 `AppSidebar` 现行结构。
- 侧栏折叠偏好保存到 `localStorage`，窄屏断点使用 `lg`。
- 表格：Ant Table `size="middle"`，默认分页 20，页大小候选 `20 / 25 / 50 / 100 / 200 / 500`。
- 列内容默认不换行，隐藏资料降低透明度，选中行使用现有 `.selected` 背景。
- 弹窗：一般 `640px`，宽业务弹窗 `1120px`；`RecordDialog` 主体最大高度 `75vh`。

## 组件规则

### DataGrid

`frontend/src/components/DataGrid.vue`。保留本地过滤、列过滤、排序、分页、状态 Tag、行选择和“查看”操作。页面通过 `filtered` 事件得到当前结果，用于汇出等业务动作。

### FieldForm

`frontend/src/components/FieldForm.vue`。使用 Ant Input / Textarea / Select 和 `UiCheckbox`，保留必填星号、说明文字、编辑期只读和级联清理。

### UiCheckbox

`frontend/src/components/UiCheckbox.vue`。在组件边界统一适配后端 `Y/N` 与人员数组选择，不把 API 标志扩散到表单逻辑。

### RecordDialog

`frontend/src/components/RecordDialog.vue`。保留居中弹窗、宽弹窗差异和销毁重建行为；主从编辑复用同一容器。

### AppSidebar

`frontend/src/components/AppSidebar.vue`。保留深色导航、分组、图标、搜索、空结果、折叠、当前路由展开和键盘 / 弹层行为。导航可见性仍由传入的菜单节点控制。

## 代表组合

### 主档编辑

Toolbar 提供新增、复制、修改、隐藏 / 恢复；`DataGrid` 选择行后进入 `RecordDialog`；`FieldForm` 表达主档字段；`UiCheckbox` 承接 `Y/N`。主档代码在编辑时保持只读，履历与资料切换由页面 Tabs 承担。

### 条件查询与结果表格

先开启条件并组合文本 / 日期运算符，日期精确到秒；查询后结果进入 `DataGrid`。列过滤与查询条件取交集，汇出始终使用当前画面过滤后的结果。

### 告警详情

使用 `RecordDialog wide`；顶部显示警报标题、状态与四要素；主体分为基本资讯、详细内容、回应备注；下方用 `DataGrid` 展示通知发送记录、交易履历、事件层级和回应记录。只读历史上下文不显示确认与刷新操作。

## 本地预览

```bash
cd frontend
npm run dev
# 打开 http://127.0.0.1:5173/design-system.html
```

预览入口：`frontend/design-system.html`；实现入口：`frontend/src/design-system/DesignSystemApp.vue`。预览挂载独立的 Vue Router 与本地 `state.nav` / `state.user`，不调用 `/api`、`/login`、`/bootstrap`。告警详情预览携带历史上下文，因此不触发 `openAlarm` 刷新请求。

## 构建与验证

```bash
cd frontend
npm run test:unit
npm run build
```

`vite.config.js` 已把 `design-system.html` 纳入构建输入。构建后可在静态前端内打开 `/design-system.html`；其数据仍是本地模块，不含登录逻辑。
