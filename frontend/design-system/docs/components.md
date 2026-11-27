# AMS 公共组件规范

五个组件都从生产代码提取，**保留真实 DOM、类名和事件语义**，仅把全局 `state` / `api` / `vue-router` 改为 props + emits。它们不读取全局 store，也不发网络请求，可以直接放进设计系统或 Storybook 类环境。

## 通用约束

- 组件只消费传入的 props；父层负责数据获取、权限判断、路由和 i18n。
- 标签文本通过 `columns` / `fields` 传入，组件不内置业务文案表；少量固定文案（如"操作""查无资料"）使用中文默认值，可在 props 覆盖。
- 所有事件都是"意图"而非副作用：组件不写后端、不跳路由、不改 URL。
- 视觉尺寸来自令牌与小节中的固定值；不要为单个页面覆盖 `size`、`width` 或行高，否则会破坏主档/报表的一致性。

---

## DataGrid

生产：`frontend/src/components/DataGrid.vue`

AMS 的通用数据网格：搜索、列过滤、排序、行选择、状态标签、分页和操作列。

### Props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `rows` | `Array` | `[]` | 原始行数据；组件内部过滤，不修改数组 |
| `columns` | `Array` | `[]` | `{ field \| name, label, type?: 'date', ... }`；为空时取首行前 10 个字段 |
| `selectable` | `Boolean` | `false` | 显示勾选列；选中结果通过 `select` 返回 |
| `rowKey` | `String` | `''` | 稳定主键字段；建议始终传入 |
| `pageSize` | `Number` | `20` | 默认每页 20 笔 |
| `searchPlaceholder` | `String` | `过滤` | 网格内搜索框占位文案 |
| `pageSizeOptions` | `Array` | `[20,25,50,100,200,500]` | 与生产一致 |
| `emptyText` | `String` | `查无资料` | 空表文案 |
| `actionLabel` | `String` | `查看` | 操作列按钮文案 |
| `loading` | `Boolean` | `false` | 透传 Table loading |

### Events

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `select` | `rows` | 勾选变化，返回当前选中行 |
| `open` | `row` | 点击某行"查看"操作 |
| `filtered` | `rows` | 搜索/列过滤/排序后结果变化（含初始化） |

### 使用约束

- 密度固定 `size="middle"`、默认 20 笔/页；这是 AMS 表格密度的唯一来源，不要用 `size="small"` 提密。
- 搜索框在所有可见列上做不区分大小写的包含匹配；列过滤与搜索取交集，排序只影响展示顺序。
- 日期列以字段类型 `date` 或字段名 `_DT` / `_DATE` 结尾识别，运算符含介于/等于/小于/大于等，时间精确到秒。
- 状态标签由单元格值映射：`Completed/Success/OK/Y` 成功，`Process/Unknown` 处理中，`NoNextLevel/Fail/Error/NG` 失败，其余中性；不要在业务页另写状态色。
- 父层需要"汇出当前画面"时使用 `filtered` 事件的结果，而不是 `rows`。
- 可用 `#tools`、`#actions` 插槽扩展工具条与操作列；`#actions` 收到 `{ row }`。

### 不适用场景

- 树形/虚拟滚动超大表：请直接用 Ant `a-table` 或引入专业表格，不要改 DataGrid 内部。
- 需要服务端分页/排序：DataGrid 是前端过滤分页；服务端模式须另建组件，避免让本组件悄悄发请求。

---

## FieldForm

生产：`frontend/src/components/FieldForm.vue`

### Props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `fields` | `Array` | `[]` | metadata：`{ name, label, type, optionSet, required, requiredOnCreate, readOnlyOnEdit, hidden, help, disabled, min, integer }` |
| `model` | `Object` | 必填 | 可写的记录对象；组件通过 `v-model` 式赋值直接修改字段 |
| `editing` | `Boolean` | `false` | 编辑态；配合 `readOnlyOnEdit` |
| `options` | `Object` | `{}` | 由父层传入的选项集（`optionSet` → `[{ value, label }]`） |

### Events

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `change` | `{ field, value }` | 任一字段变化；用于级联与脏检查 |

### 使用约束

- 两列栅格（`.fields`），`textarea` / `sql` 跨两列；必填星号由 `required` 或"新增时必填"决定。
- `editing && readOnlyOnEdit` 的字段禁用（如使用者代码），不要用 CSS 伪装只读。
- 级联在组件内完成：`FACTORY_KEY` 变化清空 `SUB_SYS_KEY` / `EVENT_KEY`，`SUB_SYS_KEY` 变化清空 `EVENT_KEY`。新增级联字段请改这里，不要在页面里散落。
- `options` 必须由调用方传入；组件不会从 API 或全局 store 读取选项。
- 密码字段使用 `type: 'password'`，`autocomplete="new-password"`；**不要把真实密码写入 fixtures 或日志**。

### 不适用场景

- 复杂动态表单（步骤、条件显示、嵌套数组）建议用 Ant `a-form` + 业务表单组件；FieldForm 面向"元数据驱动的两列主档"。
- 需要整体表单校验状态时，请在外层用 `<a-form>` 包住并自行管理 rules；FieldForm 只表达字段与必填标记。

---

## UiCheckbox

生产：`frontend/src/components/UiCheckbox.vue`

### Props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `Boolean \| String \| Array` | `false` | 单值或数组 |
| `value` | `String \| Number` | `undefined` | 数组模式下当前选项的值 |
| `trueValue` | `Boolean \| String \| Number` | `true` | 单值勾选时的值，AMS 常用 `'Y'` |
| `falseValue` | `Boolean \| String \| Number` | `false` | 单值取消时的值，AMS 常用 `'N'` |
| `disabled` | `Boolean` | `false` | 禁用 |

### Events

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `update:modelValue` | 新值 | 勾选变化 |
| `change` | 原生 `Event` | 勾选变化 |

### 使用约束

- 后端 `Y/N` 一律在组件边界用 `true-value="Y" false-value="N"` 适配，不要把 `'Y'` 判断散落在页面。
- 人员数组选择用 `:value` 标识选项；组件会去重并保持原有顺序。
- 不做权限/禁用判断，`disabled` 由父层根据状态传入。

### 不适用场景

- 需要三态（全选/半选）的批量表格：使用 Ant `a-checkbox` 的 `indeterminate`，或在业务侧封装。不要在 UiCheckbox 上叠加多个语义。
- 布尔开关（即时开/关）：使用 Ant `a-switch`，不要用复选框模拟。

---

## RecordDialog

生产：`frontend/src/components/RecordDialog.vue`

### Props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `open` | `Boolean` | `true` | 受控开合；父层用 `v-model:open` |
| `title` | `String` | `''` | 标题 |
| `wide` | `Boolean` | `false` | `true` 时 1120px，否则 640px |
| `confirmLoading` | `Boolean` | `false` | 确认按钮 loading |
| `okText` / `cancelText` | `String` | `储存` / `取消` | 按钮文案 |
| `footer` | `Boolean \| Object \| Function` | `undefined` | 透传 Modal footer；`null` 表示无内置按钮 |

### Events

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `update:open` | `Boolean` | 关闭或受控更新 |
| `close` | — | 取消/关闭，父层通常在此清空编辑对象 |
| `ok` | — | 点击"储存"；父层负责校验与提交 |

### 使用约束

- 一律 `v-model:open` 受控，禁止在组件内部自行打开；关闭后 `destroy-on-close`，编辑对象由父层重置。
- 640px 用于单笔记录，1120px 用于宽资料/查询条件/告警详情；不要随意改宽度。
- 主体最大高度 75vh，内部滚动；页脚按钮由父层通过 `#footer` 或 `footer` prop 控制时，保持"取消在左、主操作在右"。
- 弹窗内表单按钮与弹窗 footer 二选一，避免出现两组"储存"。

### 不适用场景

- 全屏工作台或页面级任务：用页面布局，不要放大弹窗。
- 确认类短提示：用 `a-modal` 或 `Modal.confirm` 即可，不必套 RecordDialog。

---

## AppSidebar

生产：`frontend/src/components/AppSidebar.vue`

### Props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `links` | `Array` | `[]` | `{ id?, name, path }`；路径可用 `/page/CODE` 或 `#/path` |
| `activePath` | `String` | `''` | 当前高亮路径 |
| `startCollapsed` | `Boolean` | `false` | 初始 72px 图标模式 |
| `preferenceKey` | `String` | `ams.design-system.sidebar.collapsed` | 折叠偏好写入 localStorage 的 key |

### Events

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `navigate` | `path` | 点击菜单/品牌区，仅以 `/` 开头的内部路径触发 |

### 使用约束

- 分组由菜单编码决定（作业、基础资料、通知配置、查询报表、其他），新增菜单编码需同步 `groups` 映射。
- 导航以 `emit('navigate')` 表达，**不依赖 vue-router**；生产侧再把它接到 `router.push`。
- 搜索框匹配编码、名称与分组；无匹配时显示 Ant `Empty` 简单图。
- 折叠偏好写 `preferenceKey` 对应 localStorage；设计系统内每个业务示例使用独立 key，避免互相影响。
- 248px 展开 / 72px 折叠、`breakpoint="lg"` 自动折叠，不要另设宽度。

### 不适用场景

- 多级无限深度菜单或需要拖拽排序的后台：改为 Ant `a-menu` 自定义，并保留同样的视觉令牌。
- 移动端底部导航：应另做组件，折叠侧栏不是移动导航方案。
