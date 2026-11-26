# 验收记录

环境：Node.js v22.21.0（满足 `>=20.19`），Linux，无 Java 后端，无登录。

## 自动验证

| 命令 | 结果 |
| --- | --- |
| `npm ci` | 通过（178 个包；仅 devDependency 的 engine 警告） |
| `npm run test:unit` | 12/12 通过（组件行为 + 文档契约） |
| `npm run verify:offline` | `OFFLINE CHECK PASSED: 30 files` |
| `npm run build` | 通过（存在 chunk > 500kB 的体积提示，不影响产物） |

单测覆盖（`tests/design-system.test.js` 8 项、`tests/docs.test.js` 4 项）：

- `UiCheckbox` 的 `Y/N` 适配与人员数组去重。
- `DataGrid` 的 `middle` 密度、20 笔/页默认值与筛选事件。
- `FieldForm` 的新增必填、编辑只读和说明文字。
- `RecordDialog` 的 1120px 宽弹窗、关闭事件。
- fixtures 完整性（无密码哈希、状态枚举、导航链接）。

## 浏览器验收（构建产物）

使用 `npm run preview` 打开构建后的静态文件，逐页确认：

| 路由 | 结果 |
| --- | --- |
| `#/` | 概览与 KPI 正常，无外链资源 |
| `#/foundation/tokens` | 主题、状态色、密度对比表渲染正常 |
| `#/components/catalog` | 基础 14 项 + AMS 5 项清单；预览弹窗正常、无外链 |
| `#/components/table` | `middle` 密度、分页、状态标签正常 |
| `#/components/form` | 字段表单、必填与只读状态正常 |
| `#/components/feedback` | Alert / Empty / Modal 正常，空状态图不裂 |
| `#/components/ams` | 五件套展示与交互正常 |
| `#/business/master` | 工具栏、分页 12 笔、1120px 新增弹窗、必填校验正常 |
| `#/business/query` | 查询条件弹窗、按"机台"过滤后 1 笔结果正常 |
| `#/business/alarm` | 待确认表格、1120px 详情、Tabs 与记录表正常；确认处理只更新本地状态 |
| `#/routes` | 路由映射表正常 |

## 已知限制

- 所有写操作只修改内存，刷新即恢复初始 fixtures；这是设计系统的预期行为。
- 大体积 chunk 来自 Ant Design Vue 全量注册，与生产入口一致；如后续按需引入，需同步评估视觉回归。
- 未包含真实权限、登录、汇出文件生成与后端校验，这些属于生产前端职责。

## 关键交互复核（构建产物）

- 主档编辑：点击"新增"打开 1120px `RecordDialog`；修改一行时标题为"修改使用者"，使用者代码禁用。
- 条件查询：打开查询弹窗→勾选"警报标题"→输入"机台"→查询，结果从 4 笔收敛为 1 笔（ALM202611261001），弹窗关闭。
- 告警详情：点击"查看"打开 1120px 详情，状态标签 Process；点击"确认处理"后弹窗关闭，待确认列表首行变为 Completed，其余行不变。
- 逐页切换 11 条 hash 路由后刷新，均能独立加载，无控制台可见的资源裂图或外链请求。
