# AMS Design System

从 `DawnGuoDev/CX-AMS-1123` 当前实现提取，采用**三层结构**：

1. **基础组件**：Ant Design Vue `4.2.6`，与生产同版本，按项目入口实际引入 `reset.css`；不在 AMS 内复制原生控件。
2. **产品规范**：由生产 `App.vue` 的 ConfigProvider 与 `style.css` 提取的主题、布局、状态颜色、表格密度和弹窗节奏。
3. **业务组合**：主档编辑、条件查询与结果表格、告警详情三类可验收的页面模式。

所有预览数据来自 `mock/fixtures.json`，不连接 Java 后端，不经过登录。

---

## 1. Design Tokens

| Token | 值 | 来源 | 用途 |
| --- | ---: | --- | --- |
| Primary | `#167d92` | `frontend/src/App.vue` ConfigProvider `colorPrimary` | 主按钮、链接、选中态、焦点边框 |
| Primary hover/active | Ant 自动派生 | `colorPrimary` | 不手写，交给 Ant Design Vue |
| Border | `#dde5ed` | `frontend/src/style.css` `--border` | 表格、卡片、工具条分割线 |
| Page background | `#f3f6fa` | `style.css` `body` 背景 | 内容区底色 |
| Surface | `#ffffff` | `style.css` `--panel` / 卡片 | 面板、弹窗、表格 |
| Text primary | `#23364a` | `style.css` 根文字 | 标题、正文、表头 |
| Text secondary | `#7a8998` | `style.css` `--muted` | 说明、辅助信息、占位 |
| Radius | `6px` | `App.vue` ConfigProvider `borderRadius` | 按钮、输入、卡片；大容器 8px |
| Base font size | `13px` | `style.css` 根字号 | 全站基准 |
| Font stack | Inter / PingFang SC / Microsoft YaHei | `style.css` | 中英文混排 |
| Sider width | `248px`，折叠 `72px` | `AppSidebar.vue` `ALayoutSider` | 导航 |
| Topbar height | `68px` | `style.css` `.topbar` | 应用壳顶栏 |
| Main padding | `26px 28px 40px` | `style.css` `main` | 页面内容内边距 |
| Modal widths | `640px` / `1120px` | `RecordDialog.vue` | 单笔记录 / 宽资料、查询条件、告警详情 |
| Record body max height | `75vh` | `style.css` `.dialog-body` | 弹窗内部滚动 |

主题由 `ConfigProvider` 统一下发，令牌在 `src/styles/tokens.css` 中只读；修改主题必须回到生产 `App.vue` 与设计系统 `App.vue` **同时**修改，避免漂移。

### 字体与间距

- 正文 13px / 行高 1.55；表头 12px、中性偏粗；辅助说明 11–12px。
- 页面标题 20–22px；区块标题 14px；卡片内标题 13px。
- 常用间距：4 / 8 / 12 / 16 / 20 / 24 / 28 / 40px；页面左右统一 28px，卡片内边距 16–20px。
- 数字与编码使用 `font-variant-numeric: tabular-nums`，表格中代码列可用等宽字体。

---

## 2. 布局与应用壳

```
┌──────────── 248 / 72 ────────────┬──────────────────────────────────────┐
│ sidebar-brand                    │ topbar 68px                          │
│ environment / search             ├──────────────────────────────────────┤
│ 警报作业   (AVPA013, ACK_LIST)   │ page-heading（eyebrow / h1 / 描述）  │
│ 基础资料   (SBRM_USER …)         │ toolbar（主操作左，汇出类右）        │
│ 通知配置   (AVMA007, AVMA009)    │ tabs                                 │
│ 查询报表   (AVPA004, AVPA007)    │ 面板 / DataGrid / 表单               │
│ 其他功能                         │ footer（AMS · 本地演示）             │
│ [折叠按钮]                       │                                      │
└──────────────────────────────────┴──────────────────────────────────────┘
```

- 侧栏底色 `#122337`，选中项 `#1C5063` 并带左侧 3px `#52B9C6` 指示条；图标模式 72px，仅保留图标与 tooltip。
- 侧栏断点 `lg`，窄屏自动折叠；折叠偏好保存在 localStorage（设计系统内每个示例独立 key）。
- 顶栏左侧为系统标识，右侧为待办、头像、用户名、登出；顶栏不承载页面操作。
- 页面操作顺序：主操作（新增/查询）在左，批量操作与显示选项居中，汇出/汇入类在右，以 `spacer` 拉开。
- 页头包含 `DESIGN SYSTEM · PATTERN` 小标签、页面标题与一句说明；业务页面正文不重复放面包屑。
- 内容区使用白色面板 + `1px #dde5ed` 边框，页面底色 `#f3f6fa`。

设计系统里用 `PageShell` 渲染完整应用壳，`PatternFrame` 固定 1440px 桌面视口并等比缩放，保证组合预览与真实桌面布局一致。

---

## 3. 状态颜色

状态映射保留生产 `DataGrid.vue` 的 `tagColor` 与 `style.css` `.tag`，业务页不应另写一套。

| 语义 | 生产值 | 文字 | 背景 | Ant Tag |
| --- | --- | ---: | ---: | --- |
| 成功 / 完成 | `Completed`、`Success`、`OK`、`Y` | `#178779` | `#E4F5EF` | `success` |
| 处理中 / 未知 | `Process`、`Unknown` | `#A0710B` | `#FFF5DC` | `warning` |
| 失败 / 无下一层 | `NoNextLevel`、`Fail`、`Error`、`NG` | `#C14848` | `#FCECEC` | `error` |
| 中性 / 终止 / 否 | `Terminated`、`N`、其他默认 | `#788491` | `#ECEFF3` | `default` |

约定：

- 标签用浅底深字，不使用高饱和实底；同一屏内状态色只表达状态，不表达优先级。
- 告警详情顶部状态、表格状态列、KPI 说明使用同一映射；KPI 数字本身保持正文色。
- 新增状态枚举必须先扩展 `DataGrid` 的映射与本节表格，再在业务页使用。

---

## 4. 表格密度

| 项 | 值 |
| --- | --- |
| Ant Table size | `middle`（唯一密度） |
| 默认每页 | `20` 笔 |
| 可选页大小 | `20 / 25 / 50 / 100 / 200 / 500` |
| 分页文案 | `共 N 笔` |
| 单元格 | 单行不换行，超出省略；表头可排序 |
| 选中行 | `.selected` 背景（Ant 行选中色） |
| 隐藏资料 | 降低透明度，不删除筛选状态 |
| 空表 | "查无资料"，配有列过滤/搜索时可提示调整条件 |

- DataGrid 固定 `size="middle"`，业务页不得用 `small` 或 `large` 覆盖；超大数据集通过分页而不是压缩行高。
- 表格上方的工具条与搜索框属于 DataGrid，页面只在其上方加业务工具栏。
- 代码/编号列左对齐，数量列右对齐，状态列居中；操作列固定在最右侧，只放"查看"及少量链接按钮。
- 列过滤与全局搜索可叠加；汇出使用过滤后的当前画面结果。

---

## 5. 弹窗与交互节奏

- 单笔记录：640px；主档编辑、查询条件、告警详情：1120px。
- 弹窗居中，主体 `75vh` 内滚动；页脚固定"取消 / 主操作"。
- 关闭即销毁内容（`destroy-on-close`），父层负责重置表单对象，避免脏数据回流。
- 破坏性操作（删除、终止）用红色按钮 + 二次确认；本设计系统不提供真实删除，仅保留交互位。
- 成功/失败反馈用 Ant `message`，错误详情可放在 `a-alert`；不要用自定义 toast 层覆盖全局层级。

---

## 6. 组件分层与生产映射

### 基础层（Ant Design Vue 4.2.6）

Button、Input、Select、Checkbox、Radio、Table、Tag、Modal、Alert、Tabs、Empty、Pagination、Form、Layout / Menu、Descriptions、Tooltip、DatePicker、Message 等。项目入口 `frontend/src/main.js` 全量注册 `Antd` 并引入 `ant-design-vue/dist/reset.css`，设计系统保持一致。

### 产品层（五件套）

| 组件 | 生产路径 | 设计系统路径 | 说明 |
| --- | --- | --- | --- |
| DataGrid | `frontend/src/components/DataGrid.vue` | `src/components/DataGrid.vue` | 前端过滤/排序/分页，`middle` + 20 笔 |
| FieldForm | `frontend/src/components/FieldForm.vue` | `src/components/FieldForm.vue` | metadata 驱动的两列字段表单 |
| UiCheckbox | `frontend/src/components/UiCheckbox.vue` | `src/components/UiCheckbox.vue` | `Y/N` 与人员数组适配 |
| RecordDialog | `frontend/src/components/RecordDialog.vue` | `src/components/RecordDialog.vue` | 640 / 1120 双宽弹窗 |
| AppSidebar | `frontend/src/components/AppSidebar.vue` | `src/components/AppSidebar.vue` | Sider + Menu、分组搜索、72px 图标模式 |

生产版本中的 `state` / `api` / `vue-router` 在设计系统版本中被替换为 props + emits，DOM 结构与类名保留。契约细节见 [components.md](./components.md)。

### 设计系统辅助组件（不属于生产组件）

| 组件 | 用途 |
| --- | --- |
| `PageShell` | 组合 AppSidebar + 68px 顶栏 + 内容 + 页脚，供业务示例复用 |
| `PatternFrame` | 以 1440px 视口渲染应用壳，再等比缩放到画廊宽度 |
| `AmsTabs` | 生产 Tabs 的轻量受控封装 |
| `PayloadTable` | 展示通知/履历 JSON 的辅助表格 |

---

## 7. 三类业务组合

### 7.1 主档编辑（SBRM_USER）

```
PageShell
 └─ page-heading
 └─ toolbar：新增 | 复制 | 修改 | 隐藏 | 取消隐藏 | 显示已隐藏 | 重新整理 || 汇出 | 范本 | 汇入
 └─ AmsTabs：资料 / 履历
 └─ DataGrid（selectable, rowKey=USER_KEY, 20/页）
      └─ 操作列：复制、查看
 └─ RecordDialog wide(1120)
      └─ FieldForm（2 列；必填、编辑只读、级联清空）
      └─ form-actions：取消 / 储存
```

验收清单：

- [ ] 新档默认 `ACTIVE=Y`、班别/性别有默认值，使用者代码在新增时必填、编辑时只读。
- [ ] 单选一行才启用"复制/修改"；未选时禁用并给出可读状态。
- [ ] 必填校验失败有反馈，成功储存只更新本地 store，刷新恢复 fixtures。
- [ ] 履历 Tab 使用同一 DataGrid 密度与列风格。
- [ ] 侧栏当前项为"使用者设定与管理"，折叠后仍可通过 tooltip 识别。

### 7.2 条件查询与结果表格（AVPA004）

```
PageShell
 └─ toolbar：查询 | 重新整理 | 自动更新提示 || 汇出
 └─ DataGrid（结果；列过滤、排序、20/页）
 └─ Modal 1120「查询条件」
      └─ 每个条件：UiCheckbox 启用 → 运算符 Select → 值 / 秒级日期区间
      └─ form-actions：清除 / 取消 / 查询
 └─ RecordDialog wide：单笔结果详情
```

验收清单：

- [ ] 未勾选的条件不参与查询；日期支持介于/等于/小于/大于，精确到秒。
- [ ] 清除只重置草稿，不影响已应用的查询；取消不改变当前结果。
- [ ] 查询后结果数量变化，DataGrid 列过滤与查询条件取交集。
- [ ] 状态列沿用统一状态色；空结果提示"查无资料"。
- [ ] 汇出提示使用当前画面过滤后的结果（演示不生成文件）。

### 7.3 告警详情（AVPA013）

```
PageShell
 └─ 待确认 DataGrid（状态/机台/层级/计数）
 └─ RecordDialog wide(1120)「警报详情」
      └─ 标题 + 状态标签 + 四要素（厂别/子系统/机台/警报识别码）
      └─ Tabs：基本资讯 / 详细内容 / 回应备注
      └─ DataGrid：通知发送记录 / 交易履历 / 事件层级 / 回应记录
      └─ footer：关闭 / 确认处理（本地 acknowledge）
```

验收清单：

- [ ] 只读历史上下文，不触发后端刷新；无权限时不显示确认按钮。
- [ ] 标题与四要素对齐；长内容在弹窗内滚动，不撑破 1120px。
- [ ] 通知/履历/层级/回应四类记录共用 DataGrid 密度与空状态。
- [ ] 确认处理更新本地状态并给出 message 反馈，刷新恢复。
- [ ] 关闭后不残留上一笔告警的任何内容（`destroy-on-close`）。

---

## 8. 离线约束

设计系统的核心承诺是"**只靠本地数据就能验收视觉与交互**"：

- 不允许 `/api`、`fetch`、`/bootstrap`、登录 Token、`sessionStorage`。
- 不引入 `vue-router`；使用 hash 路由手写，便于静态托管。
- 不出现外网 URL（图片、字体、CDN 一律本地或系统字体）。
- `npm run verify:offline` 扫描 `src/`、`mock/` 与入口 HTML，违反即失败。

---

## 9. 变更规则

1. **令牌优先**：新颜色/圆角/字号先判断能否复用现有令牌；确需新增时同步生产与设计系统，并更新本文与 `tokens.css`。
2. **基础组件不复制**：Ant Design Vue 已有能力直接使用；产品层只封装跨页面复用的行为。
3. **组件契约向后兼容**：props/emits 变更需同时更新 `docs/components.md`、组件页示例与单测。
4. **业务组合是验收样本**：改动布局或表格密度后，必须重跑三类组合的浏览器验收。
5. **版本锁定**：`ant-design-vue` 与生产 `frontend/package.json` 保持一致；升级时一并验证 14 个基础组件示例和五件套。
