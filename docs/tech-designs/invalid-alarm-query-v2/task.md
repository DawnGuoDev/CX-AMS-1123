# AMS 无效警报查询 V2 任务拆解

## Task 1：新增无效警讯数据模型与兼容补齐

**来源**：design.md §5、§6.1、§10  
**目标**：建立 `invalid_alarms` 数据集合、AVPA014 报表/菜单定义，并保证已有 checked-mvp-1 H2 数据升级可用。  
**变更点**：

- 修改 `backend/src/main/resources/seed.json`：
  - `meta.seq` 增加 `invalid_alarms`。
  - 新增 `invalid_alarms: []`。
  - 新增 AVPA014 `report_defs` 与 `functions` 定义；顺延受影响菜单 `SORT`。
- 修改 `backend/src/main/resources/metadata.json`：新增 AVPA014 page title。
- 修改 `backend/src/main/java/com/changxin/ams/Store.java`：在已保存 checked-mvp-1 数据加载后执行幂等补齐，只补无效警报表、序列、AVPA014 定义与菜单。

**交付**：新库启动带完整定义；旧持久库升级后可显示菜单且重复启动不重复插入。  
**验证**：`cd backend && mvn test`；如适用，补 Store 兼容性单测/集成测试。

## Task 2：AlarmEngine 失效分支落库

**来源**：design.md §5.1、§6.1  
**目标**：所有当前 `invalid(...)` 失效原因返回 422 前写入一条无效警报；成功与 BYPASS 不写。  
**变更点**：

- 修改 `backend/src/main/java/com/changxin/ams/AlarmEngine.java`：
  - 在 `invalid(...)` 中新增私有记录方法。
  - 生成 key、时间、原始入参四要素、标题/内容、原因、`RECEIVE_TYPE=Mock`、`SOURCE_TYPE=Test`。
  - 主档可匹配时补厂别/子系统名称，不可匹配时名称留空且代码保留。
  - 保持响应体与 HTTP 状态码不变。

**交付**：8 类失效原因只追加一条记录；成功/BYPASS 不追加。  
**验证**：新增集成测试覆盖逐类原因、字段留存、成功/BYPASS 不写。

## Task 3：Reports 接入 AVPA014

**来源**：design.md §6.2、§6.3  
**目标**：让新报表定义可通过现有查询/汇出链路返回。  
**变更点**：

- 修改 `backend/src/main/java/com/changxin/ams/Reports.java`：
  - definition 白名单加入 `AVPA014`。
  - query 针对 `AVPA014` 使用 `invalid_alarms`。
  - 保持既有条件交集、`CREATE_DT` 倒序、未知字段拒绝。
- 不新增 controller；`/api/reports/AVPA014/export` 复用现有导出路由。

**交付**：报表定义、查询、导出与现有契约一致。  
**验证**：复用/扩展 `ReportConditionsTest` 与集成测试，覆盖区间含端点、多条件交集、倒序、空态、导出列。

## Task 4：前端报表入口登记

**来源**：design.md §7  
**目标**：后端 functions 返回 AVPA014 后，用户能从「查询报表」进入通用报表页并汇出。  
**变更点**：

- 修改 `frontend/src/pages/Workspace.vue`：ReportPage code 白名单加入 `AVPA014`。
- 修改 `frontend/src/components/AppSidebar.vue`：
  - reports 分组 codes 加入 `AVPA014`。
  - icons 增加 `AVPA014: FileSearchOutlined`。
- 仅在现有翻译缺失时补充 `frontend/src/legacy-i18n.js`；预期无需新增。

**交付**：菜单、路由、页面、条件弹窗、表格分页、汇出均可使用。  
**验证**：`cd frontend && npm run test:unit && npm run build`；必要时执行前端 E2E。

## Task 5：失败留存与报表回归测试

**来源**：design.md §8  
**目标**：把 Spec 验收点固化为可重复验证。  
**变更点**：

- 新增/调整 backend 测试：
  - 8 类失效原因各写 1 条且字段/原因正确。
  - 主档不存在时代码留存、名称为空。
  - 成功/BYPASS 不写。
  - 报表条件、导出、鉴权。
- 新增/调整 frontend 或 E2E 文本/代码：
  - 菜单可见、进入 AVPA014、时间区间查询、空态、多条件、汇出。
  - 未登录 API 401。
- 同步更新 `docs/e2e` 下文本用例，若本轮实际新增自动化 E2E，则保持用例 ID 与代码一致。

**交付**：最小相关测试覆盖新增行为，现有主链路不回归。  
**验证**：`cd backend && mvn test`、`cd frontend && npm run test:unit`、`npm run build`；按变更范围运行 `bash scripts/run-java-e2e.sh` 与/或 `bash scripts/run-frontend-e2e.sh`。

## 执行顺序

1 → 2 → 3 → 4 → 5。  
Task 1–3 属后端链路，需先有数据模型与定义；Task 4 依赖 AVPA014 code；Task 5 汇总验证并回归。
