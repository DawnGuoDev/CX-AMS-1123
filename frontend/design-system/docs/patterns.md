# 业务组合规范

三类组合对应生产页面的真实结构，既是设计系统的验收样本，也是新页面复用的起点。所有示例都以 `PageShell` 渲染完整应用壳，并在 `PatternFrame` 中以 1440px 桌面视口缩放展示。

## 1. 主档编辑

生产对应：`frontend/src/pages/MasterPage.vue`（示例为 `SBRM_USER` 使用者设定与管理）。

### 结构

```
PageShell(activePath="/page/SBRM_USER")
├─ page-heading：使用者设定与管理 / 维护使用者基本资料与 Email 通知地址
├─ toolbar
│   ├─ 主操作：新增
│   ├─ 选中操作：复制、修改（单选启用）、隐藏、取消隐藏（多选启用）
│   ├─ 显示选项：显示已隐藏资料（UiCheckbox）
│   ├─ 刷新：重新整理
│   └─ 右侧：汇出、汇出范本、汇入
├─ AmsTabs：资料｜履历
├─ DataGrid
│   ├─ columns 来自 metadata（USER_ID、USER_NAME、GENDER、E_MAIL、TITLE、SHIFT_KEY、ORGAN_KEY、HIRE_DATE、ACTIVE）
│   ├─ selectable + rowKey="USER_KEY"
│   └─ actions 插槽：复制
└─ RecordDialog wide(1120)
    ├─ FieldForm(fields=masterMeta.fields, editing, options)
    └─ form-actions：取消｜储存
```

### 规则

- 主档代码 `USER_ID` 新增必填、编辑只读；不要把只读字段用 `disabled` 之外的视觉手段伪装。
- 新增与复制走同一弹窗：复制时清除主键，编辑时 `editing=true`。
- 工具栏按钮的可用性由选中数量决定，单笔与批量操作分开表达。
- 保存校验先在前端做必填检查，再更新本地 runtime；真实后端由生产页面负责。
- 履历 Tab 与资料 Tab 共用表格密度；履历列由 `historyColumns` 提供。

### 验收

| 步骤 | 期望 |
| --- | --- |
| 打开页面 | 侧栏高亮"使用者设定与管理"，表格 12 笔本地主档、20 笔/页分页器可见 |
| 未选择点击修改 | 按钮禁用 |
| 选择一行点击修改 | 打开 1120px 弹窗，使用者代码禁用，其余字段可编辑 |
| 清空使用者名称点储存 | 提示名称为必填，弹窗不关闭 |
| 正常储存 | 弹窗关闭、message 提示"储存成功（仅本地演示）"，表格数据更新 |
| 刷新页面 | 数据恢复 fixtures 初始值 |

## 2. 条件查询与结果表格

生产对应：`frontend/src/pages/ReportPage.vue`（示例为 `AVPA004` 警报处理查询）。

### 结构

```
PageShell(activePath="/page/AVPA004")
├─ page-heading：警报处理查询 / 查询时间区间内所有警报的处理状况
├─ toolbar：查询｜重新整理｜自动更新提示｜（右）汇出
├─ DataGrid（结果）
│   ├─ 列：ALARM_ID、CREATE_DT、TITLE、STATUS、FACTORY、SUB_SYS、EQP、CURRENT_LEVEL、PRIORITY
│   ├─ 列过滤 + 排序 + 全局搜索 + 分页
│   └─ 操作列"查看" → RecordDialog 单笔详情
└─ Modal 1120「查询条件」
    ├─ 每行：UiCheckbox 启用 ｜ 运算符 ｜ 值 / 日期区间
    ├─ 日期条件：datetime-local step=1（精确到秒），介于时显示起止
    └─ footer：清除｜取消｜查询
```

### 规则

- 查询条件用**草稿对象** `draft`：打开时从已应用条件克隆，取消或关闭丢弃草稿。
- 未勾选的字段不参与查询；运算符与字段类型绑定（文本：包含/等于/不等于；日期：介于/等于/小于/大于）。
- 结果表格自身还带搜索与列过滤，两者与查询条件取交集；状态标签沿用统一映射。
- 汇出使用 DataGrid 的 `filtered` 结果，而不是原始 `rows`。
- 查询弹窗 1120px、`footer=null`，按钮在表单内部，保持"取消在左、查询在右"。

### 验收

| 步骤 | 期望 |
| --- | --- |
| 打开页面 | 默认展示 4 笔本地告警结果 |
| 点击查询 | 打开 1120px 查询条件弹窗，7 个条件未勾选 |
| 勾选"警报标题"输入"机台"后查询 | 结果缩小到 1 笔（ALM202611261001），弹窗关闭并提示笔数 |
| 再次打开并取消 | 已应用条件与结果不变 |
| 清空标题条件后查询 | 结果恢复 4 笔 |
| 在结果表列头输入过滤值 | 结果进一步缩小，分页同步 |
| 刷新页面 | 条件与结果复位 |

## 3. 告警详情

生产对应：`frontend/src/pages/AlarmDetail.vue`（入口 `AVPA013` 待确认列表）。

### 结构

```
PageShell(activePath="/page/AVPA013")
├─ page-heading：警报处理 / 待我确认
├─ DataGrid（待确认告警，selectable=false，操作"查看"）
└─ RecordDialog wide(1120)「警报详情」
    ├─ 标题 + 状态标签 + 四要素（厂别 / 子系统 / 机台 / 警报识别码）
    ├─ AmsTabs：基本资讯｜详细内容｜回应备注
    ├─ DataGrid：通知发送记录、交易履历、事件层级、回应记录
    └─ footer：关闭｜确认处理（本地 acknowledgeAlarm）
```

### 规则

- 详情弹窗只展示已加载的记录；设计系统不触发 `openAlarm` 网络请求，历史上下文由 fixtures 提供。
- 顶部四要素使用 2×2 或 4 列栅格，与表格列同宽对齐；状态标签使用统一映射。
- 确认处理只改本地 runtime 中的状态；生产侧在 `CAN_ACK` 为真且用户有权限时显示该操作。
- 通知/交易/层级/回应四段都使用 DataGrid 的同一密度；空段显示"查无资料"。
- 关闭时 `destroy-on-close`，避免上一笔告警内容残留。

### 验收

| 步骤 | 期望 |
| --- | --- |
| 打开页面 | 待确认表格展示本地告警，状态标签颜色正确 |
| 点击"查看" | 打开 1120px 详情弹窗，标题、四要素、Tabs 完整 |
| 切换 Tabs | 基本资讯/详细内容/回应备注内容切换，不发生网络请求 |
| 查看记录表 | 通知/交易/层级/回应均有列头与 20 笔分页密度 |
| 点击确认处理 | 弹窗关闭、状态更新、message 提示（仅本地） |
| 刷新页面 | 告警状态恢复 fixtures |

## 组合之间的共性

- 同一应用壳、同一页头节奏、同一工具栏左右分工。
- 同一 DataGrid 密度与状态色；表格是列表和历史的唯一呈现方式。
- 同一弹窗体系：单笔 640，宽资料 1120；主操作固定在页脚或表单底部。
- 同一离线数据源；任何组合都可以单独打开验收，不需要先登录或启动后端。
