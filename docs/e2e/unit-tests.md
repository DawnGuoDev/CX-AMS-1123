# 单元测试清单

## 后端（JUnit 5）

位置：`backend/src/test/java/com/changxin/ams/`

| 类 | 类型 | 覆盖内容 |
| -- | ---- | -------- |
| `unit/JsonHelpersTest` | 纯单元 | `m/obj/rows/list` 类型归一化；`s/n/str` 空值安全；`eq/active`；`time` 解析与回退；`require` 业务异常；`clean` 去除密码字段；`encode/parse` 往返与错误 JSON |
| `unit/AuthPasswordTest` | 纯单元 | SHA-256 六十四位十六进制、固定盐前缀、确定性、不同密码不同摘要、种子初始密码与存储哈希一致 |
| `unit/ReportConditionsTest` | 单元（Mockito） | 报表查询：至少一个条件；contains/notContains/starts/ends/eq/neq 大小写不敏感；日期 between/eq/neq/lt/lte/gt/gte（按秒）；空日期不匹配；非法查询字段被拒绝 |
| `WorkflowIntegrationTest`（既有） | Spring 集成 | 认证单会话、真实 SMTP 与 ACK 闭环、重复告警抑制、失败重送、层级升级、Excel 汇入导出、页面 API 契约 |
| `ManualAlignmentIntegrationTest`（既有） | Spring 集成 | 使用者字段与审计、事件层级校验、报表时间运算、可见快照汇出、基础主档唯一性等 |

执行：

```bash
cd backend && mvn test            # 40 个：单元 + 集成（不含 HTTP E2E）
bash ../scripts/run-java-e2e.sh   # 额外跑 4 个后端接口 E2E（真实进程）
```

## 前端（Vitest + @vue/test-utils + jsdom）

位置：`frontend/src/**/__tests__/*.test.js`

| 文件 | 覆盖内容 |
| ---- | -------- |
| `__tests__/filters.test.js` | 日期列识别、空过滤器、文本/日期运算符、大小写不敏感匹配、日期按秒比较、非法日期不匹配、服务端条件 ISO 转换 |
| `__tests__/state.test.js` | `api()` 方法/请求头/JSON 体；401 清除会话而登录失败保留会话；无 message 时回退 `HTTP <status>`；`act()` 忙碌计数与错误显示；`clone` 深拷贝；toast 5 秒自动关闭 |
| `__tests__/simulator.test.js` | 参数校验（场景/阈值/轮数/间隔）；一次超温的 crossing/recovered 各一次；持续超温不重复触发；串行采样（等待上一条提交后才调度下一条）；提交失败停止并回调；暂停/恢复/停止 |
| `__tests__/legacy-i18n.test.js` | 已知词条与未知词条回退；**切换语言后缓存失效**（回归）；`html lang`；日期时间格式化与非法值透传 |
| `components/__tests__/DataGrid.test.js` | 表头/行数/记录数；空值占位与隐藏行样式；搜索与“查无资料”；排序与升降序；列过滤；本页全选与选择事件；行操作/链接触发 open |
| `components/__tests__/RecordDialog.test.js` | Teleport 渲染、标题、插槽；头部关闭；遮罩点击关闭而内容点击不关闭；wide 样式 |
| `components/__tests__/FieldForm.test.js` | 跳过 readOnly 字段；必填星号；各类型输入；`readOnlyOnEdit` 仅编辑态禁用；子系统随厂别变化、切厂清空依赖；事件按厂别/子系统过滤 |
| `pages/__tests__/MasterPage.test.js` | 列表加载参数（`showHidden=0/1`）；新增走 POST、修改走 PUT；复制去掉主键与 ID；隐藏前确认（标题为问句）；层级草稿未确认时阻止保存并提示 |

执行：

```bash
cd frontend && npm run test:unit        # 58 个用例
cd frontend && npm run test:unit:watch  # 监听模式
```

依赖（新增，仅 devDependencies）：`vitest`、`@vue/test-utils`、`jsdom`；测试配置直接写在 `vite.config.js` 的 `test` 段，复用应用的 Vue 插件。

## 本次修复（由测试驱动发现）

1. `frontend/src/legacy-i18n.js`：`setLang()` 未清空翻译缓存，切换语言后侧栏等文本仍显示旧语言。修复为切换时 `cache.clear()`，并由单测 `legacy-i18n.test.js` 与 E2E `TC-FE-E2E-002` 双重守护。
2. `frontend/src/pages/MasterPage.vue`：确认弹窗标题固定为“确认”，无法从无障碍名称区分“隐藏/取消隐藏”。改为以问句作为标题，单测与 E2E 据此断言。
3. `backend/src/main/java/com/changxin/ams/Masters.java`：唯一键校验跳过“第一条同键记录”，导致重复 `FACTORY_ID` 可被创建（第二次之后才被拒）。E2E `TC-API-E2E-002` 暴露该缺陷后修复。
