# 警报强制中断：用例 ↔ 设计映射

需求：`SPEC-AMS-ALARM-TERMINATE-001`（B 类，1 WARN: safety）
技术设计：`docs/design`（Design 第 6 章「测试要点」）
文本用例：`frontend-e2e.md`（TC-FE-E2E-006）、`backend-api-e2e.md`（TC-API-E2E-005）、`unit-tests.md`

本文件记录每条设计测试条目落在哪个用例上，以及本轮**未覆盖 / 有歧义**的部分，供执行节点确定最小用例集。

## 1. 后端集成（`AlarmTerminateIntegrationTest`）

| 设计条目 | 用例方法 | 断言要点 |
| --- | --- | --- |
| 正常主流程：Terminated + COMPLETE_DT/TERMINATE_* + 一条 AlarmTerminate | `authorizedTerminationConvergesStateLevelsNotificationsAndTransaction` | 状态、中断人/时间/原因、`COMPLETE_DT=TERMINATE_DT`、交易 Process→Terminated、NOTE=原因 |
| 权限拒绝（N / 缺字段 / 停用 / 撤销后即时生效） | `permissionIsReadFromLiveMasterAndRejectionsHaveNoSideEffects` | 400 文案、`store.data()` 前后完全相等（无任何副作用） |
| 状态拒绝 + 原因边界（缺省/空白/501/500）+ 404 | `rejectsMissingAlarmNonProcessAlarmAndInvalidReasons` | 逐项 400/404，500 字成功且保存恰 500 字符，交易数不变 |
| 并发中断 | `concurrentTerminationsSucceedOnlyOnce` | 8 线程仅 1 成功、`AlarmTerminate` 恰 1 条 |
| 层级/Pending→Skipped 收敛 | 正常主流程用例 | 全部层级 Closed、全部通知 Skipped + 说明 + SEND_DT |
| 调度停止（≥2 周期不升级/不重送） | `schedulerStopsEscalationRetriesAndDeliveryAfterTermination` | 仅回拨**本警报**时间后 tick+dispatch×2：SMTP 数不变、无新交易、无 Pending、待确认列表为空 |
| 详情 `CAN_TERMINATE` 矩阵 + 历史只读 | `detailExposesTerminateMatrixAndTransactionViewIsReadOnly` | 有权限+Process=true；无权限/已中断/`?transaction=`=false；直接调接口成功且作业列表消失 |
| 报表口径 AVPA004/007/013 | `reportsDistinguishTerminatedAlarms` | AVPA013 为空、AVPA004 状态查询命中且 COMPLETE_DT 非空、AVPA007 交易类型命中且 NOTE=原因 |
| 主档字段 + 导航 + 状态选项顺序 | `masterFieldNavigationAndExcelRoundTrip` | 新用户默认 N、履历含 CAN_TERMINATE、Excel `是`→Y、`alarmStatus` 顺序追加 Terminated |

## 2. 后端接口 E2E（`AlarmTerminateE2ETest`，真实进程 + 真实 HTTP）

| 设计条目 | 用例方法 | 断言要点 |
| --- | --- | --- |
| 线上契约 + 收敛 + 报表 | `shouldTerminateOverHttpAndConvergeNotificationsAndReports` | 响应字段、CAN_ACK=false 时仍可中断、通知/层级/交易、process/pending 列表、三个报表 |
| 拒绝分支 + 原因边界 | `shouldRejectUnauthorizedStatusAndInvalidReasonWithoutSideEffects` | 无权限 400、空白/缺省 400、501 字 400、500 字 200、重复 400 且交易恰 1 |
| `:key` 支持 ALARM_ID（REQ-003） | `shouldLocateTheAlarmByAlarmIdAsWellAsByAlarmKey` | 用 ALARM_ID 中断成功，再以 ALARM_KEY 重复提交 400，交易仍 1 条 |
| 404 | `shouldReturnNotFoundForUnknownAlarm` | 404 `警报不存在` |
| 作业页 + 状态选项 | `shouldExposeTheTerminateWorkPageAndTheAlarmStatusOption` | `/api/alarms/process` 只含 Process 且 CAN_TERMINATE=true；nav 含 ALARM_LIST；状态顺序 |
| 主档权限即时生效 | `shouldReadThePermissionFromTheLiveMasterRecord` | 撤销后下一次请求即 false + 400；恢复后成功；finally 复原 Y |

## 3. 前端单元（Vitest）

| 设计条目 | 用例 |
| --- | --- |
| 有权限按钮可用 / 无权限禁用 + 说明 / 历史无入口 / 非 Process 说明 | `AlarmDetail.test.js`（4 个用例） |
| 空原因不可提交、提交前 trim、取消清空、失败保留原因 + 错误、中断横幅 | `AlarmDetail.test.js`（5 个用例） |
| 作业列表 `/alarms/process`、ACK_LIST 不受影响、行内打开详情、10 秒刷新 | `OperationsPage.test.js` |
| 三语文案（按钮/确认/菜单/无权限提示） | `legacy-i18n.test.js` → `translates the force-terminate copy in every supported language` |

## 4. 前端 E2E（`e2e/frontend/06-alarm-terminate.spec.ts`）

| 用例 | 对应文本条目 | 覆盖点 |
| --- | --- | --- |
| `terminates a processing alarm ...` | 6-1 | 作业菜单 → Pending 通知 → 二次确认（目标/风险/必填/空格/500 上限）→ Terminated + 横幅 → Skipped + 交易履历 → 作业/待确认列表消失 → AVPA007/004/013 + 详情 API |
| `keeps the existing report status semantics ...` | 6-1b | AVPA004 按 Process 命中且结果全为 Process；Completed/NoNextLevel 与 AVPA007 AlarmTerminate 在 Process 警报上为空（REQ-006 回归） |
| `keeps the confirmation open on cancel ...` | 6-2 | 关闭图标与「取消」均不发请求；重开时原因清空；API 仍 Process |
| `history detail is read-only ...` | 6-3（1-2） | ALARM_ID 展示、历史只读详情无中断入口、CAN_TERMINATE=false |
| `explains why an already terminated alarm ...` | 6-3（3） | 已中断警报详情与「流程已结束」说明 |
| `keeps previous acknowledgements visible ...` | 6-5b | 先 ACK 再中断，ACKS 记录不丢失 |
| `exposes the work entry in the sidebar ...` | 6-6 | 菜单归位、列表行全为 Process、bootstrap 去掉 ALARM_LIST 后菜单消失而既有导航仍在 |
| `grants the permission through the user master record ...` | 6-5（1-2） | 主档勾选 → 保存 → 列表 Y → API Y → 履历含 CAN_TERMINATE |
| `restores the permission to N ...` | 6-5（3） | 共享测试库复原，保证无权限分支可重复执行 |
| `keeps the dialog and the typed reason ...` | 6-4 | 网络层注入服务端 400，对话框/原因/错误保留，状态不变 |
| `disables termination for an account without the permission` | 6-7 | 无权限账号按钮禁用 + 文案；绕过前端直接调用 400 且无写入 |

## 5. 已知缺口（不是通过）

| 项 | 原因 | 现覆盖/建议 |
| --- | --- | --- |
| 前端 E2E 中「非 Process 时按钮**禁用+说明**」的 Completed/NoNextLevel 分支 | E2E 后端 `ams.scheduling=false`、无 SMTP，无法自然产生 Completed/NoNextLevel，且无只读改写接口 | 由 `AlarmDetail.test.js`「explains that only Process alarms can be terminated」覆盖；Terminated 分支由 E2E 6-3 覆盖 |
| 中断事务异常时整体回滚 | 需在 `store.write` 内注入故障（生产代码无注入点） | 未覆盖；集成测试以「拒绝分支 store.data() 前后相等」间接锁定无副作用 |
| 中断瞬间 SMTP 已发出的邮件 | Spec 明确「已发出不回撤」 | 非目标，不做断言 |
| 「中断广播通知」 | Spec 非目标（默认不发） | 不做 |
| 撤销中断 | Spec 非目标 | 不做 |
