# 本地 Mock 数据

`fixtures.json` 是设计系统唯一的演示数据源：

- 主档：12 笔使用者（`SBRM_USER`），字段元数据来自生产 `metadata.json`。
- 告警：4 笔（`Process` / `Completed` / `NoNextLevel` / `Terminated` 等状态），以及一整套告警详情（通知、交易、层级、回应）。
- 报表：`AVPA004` 的查询条件与结果列定义。
- 选项：性别、班别、部门等 `optionSet`。
- 令牌快照：与生产 `App.vue` / `style.css` 对应的颜色与尺寸。

安全约束：

- 不含 `PASSWORD_HASH`、真实邮箱、Token 或任何凭证。
- 邮箱统一为 `name@example.invalid`，仅用于展示格式。
- 所有时间字段为固定的演示日期，不读取系统时钟。

`index.js` 暴露 `previewRuntime`，在内存副本上模拟：

| 方法 | 行为 |
| --- | --- |
| `saveMaster(path, model)` | 新增/更新主档，刷新后恢复 |
| `queryReport(conditions)` | 按启用条件过滤本地告警 |
| `acknowledgeAlarm(key)` | 将告警标记为已确认 |
| `deleteTestUser(key)` | 演示删除测试账号 |
| `restoreFixtures()` | 恢复初始 fixtures（单测使用） |

更新数据时覆盖 `fixtures.json` 并保持 `meta.mock === true`，然后运行 `npm run test:unit`。
