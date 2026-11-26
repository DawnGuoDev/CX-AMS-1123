# 警报强制中断 · 产品原型

- Spec：`SPEC-AMS-ALARM-TERMINATE-001`（`docs/spec/SPEC-AMS-ALARM-TERMINATE-001.md`）
- 入口：`index.html`（单文件，无后端 / 无外部依赖，双击或静态服务器均可打开）
- 设计依据：AMS 设计系统 `DESIGN.md`（Ant Design Vue 4.2.6 主题、主色 `#167d92`、`.tag.Terminated` 中立灰、6/8px 圆角、深色侧栏）

## 原型范围

以「警报强制中断作业」列表页 + 警报详情弹窗串联完整路径：查看处理中警报 → 打开详情 → 有权限/无权限两种可见态 → 强制中断二次确认（含不可逆风险提示、必填原因、字数计数与空值校验）→ 中断后详情（Terminated、中断人/时间/原因、通知 Skipped）→ 交易履历出现 `AlarmTerminate`。

原型为纯前端本地示例数据，所有交互仅在浏览器内模拟：**不登录、不调用后端、不发送 SMTP**。顶部可在「有中断权限 / 无中断权限」两种演示身份间切换，用于对比按钮可用态与说明文案。

## 状态截图

| 截图 | 内容 |
| --- | --- |
| `screenshots/01-有权限详情.png` | 有权限用户打开 Process 警报：`强制中断` 可用，工具区展示当前层级与回应人数，通知记录含 `Pending` |
| `screenshots/02-无权限详情.png` | 无权限用户打开同一警报：按钮禁用 + 「您没有强制中断权限，请联系具权限人员处理。」 |
| `screenshots/03-中断二次确认.png` | 二次确认对话框：警报识别码/标题/范围、不可逆风险提示、必填中断原因（含 500 字上限计数）、取消/确认中断 |
| `screenshots/04-中断后详情.png` | 中断成功：状态 `Terminated`、中断信息（时间/操作人/原因）、待发通知 `Skipped`、中断按钮禁用 |
| `screenshots/05-中断后交易履历.png` | 交易履历新增 `AlarmTerminate` 行（Process → Terminated，备注=中断原因） |
| `screenshots/00-作业总览.png` | 作业列表与 KPI、边界规则说明 |

## 交互核对点（与 Spec 对应）

| 核对点 | 对应需求 |
| --- | --- |
| 有权限 + Process 才可点击中断 | REQ-002 / REQ-005 |
| 无权限为禁用态并给出文字说明，不静默隐藏 | REQ-005 |
| 中断原因必填、500 字上限、空白拦截 | REQ-003 / 4.2 |
| 确认对话框展示不可逆提示，取消不发请求 | REQ-005 |
| 中断后：Terminated、层级 Closed、Pending→Skipped、新增 AlarmTerminate 交易 | REQ-004 / REQ-006 |
| 中断后按钮不可用，提示「警报已中断，流程已结束」 | REQ-005 |

## 复现校验（可选）

```bash
# 在本目录启动静态服务
python3 -m http.server 8097

# 需要 Node 与 playwright-core（以及本机 Chromium）
PLAYWRIGHT_CORE=<path-to>/playwright-core OUT=/tmp/proto-shots node verify.cjs
# 输出 VERIFY PASS 表示 4 个关键状态与中断后的数据变化均符合预期
```
