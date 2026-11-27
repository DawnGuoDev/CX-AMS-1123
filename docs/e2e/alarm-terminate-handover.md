# 警报强制中断 · 变更与交接说明

## 1. 目标分支与提交

| 项 | 值 |
| --- | --- |
| 仓库 | `DawnGuoDev/CX-AMS-1123` |
| 工作分支 | `feat/0ae13b26-ka7z`（基线 `release` @ `13c8434`） |
| 节点 commit | `ba2ce8b` — `test(e2e): 修正中断 E2E 选择器并补齐 REQ-003/REQ-006 覆盖` |
| 父提交 | `92fb816` |
| 远端 | 已推送，`git status -sb` 与 `origin/feat/0ae13b26-ka7z` 同步 |

## 2. 本节点改动文件（8 个，均为测试或测试文档）

| 文件 | 改动 |
| --- | --- |
| `e2e/frontend/06-alarm-terminate.spec.ts` | 关闭对话框改用 `.ant-modal-close`；作业列表改为遍历数据行断言 `Process`；新增 6-1b 既有状态报表口径回归 |
| `backend/src/test/java/com/changxin/ams/e2e/AlarmTerminateE2ETest.java` | 新增 `shouldLocateTheAlarmByAlarmIdAsWellAsByAlarmKey` |
| `backend/src/test/java/com/changxin/ams/AlarmTerminateIntegrationTest.java` | 调度停止用例只回拨本警报；主档编辑按页面行为回传整行并断言口令哈希不被覆盖 |
| `frontend/src/__tests__/legacy-i18n.test.js` | 新增中断三语文案用例 |
| `docs/e2e/alarm-terminate-coverage.md`（新增） | 用例 ↔ 设计条目映射、覆盖缺口 |
| `docs/e2e/README.md`、`docs/e2e/backend-api-e2e.md`、`docs/e2e/frontend-e2e.md` | 同步 6-1b 与新接口用例 |

未改动：任何被测业务代码（`backend/src/main`、`frontend/src` 下的 .vue/.js 业务文件）、种子数据、构建脚本。

## 3. 前置提交中与测试相关的部分（需知晓，非本节点改动）

- `4b0ca35` 已自带：`AlarmTerminateIntegrationTest`、`AlarmDetail.test.js`、`06-alarm-terminate.spec.ts` 初版、文档增补。
- `582fb41`、`a6f7e3b`：E2E 用例扩充与 helper、`tsconfig.check.json`。
- `92fb816`：`AlarmTerminateE2ETest`、`OperationsPage.test.js`、`00-app-entry.spec.ts`。
- 上述文件的**最终状态**已在 `ba2ce8b`，下游只需以分支 HEAD 为准。

## 4. 用例清单（最终状态）

| 层级 | 数量 | 位置 |
| --- | --- | --- |
| 后端集成 | 8 | `AlarmTerminateIntegrationTest` |
| 后端接口 E2E | 6 | `AlarmTerminateE2ETest` |
| 前端单元 | 13（AlarmDetail 9 / OperationsPage 4）+ 1 i18n | `frontend/src/**/__tests__` |
| 前端 E2E | 10（6-1、6-1b、6-2、6-3×2、6-4、6-5、6-5 复原、6-5b、6-6、6-7） | `e2e/frontend/06-alarm-terminate.spec.ts` |

## 5. 已知缺口（不等于通过）

| 缺口 | 原因 | 现覆盖 |
| --- | --- | --- |
| E2E 中 Completed/NoNextLevel 的「禁用 + 仅处理中可中断」分支 | E2E 后端关闭调度、无 SMTP，无法自然产生该状态 | `AlarmDetail.test.js` |
| 中断事务异常时整体回滚 | 生产代码无故障注入点 | 未覆盖（以拒绝分支 `store.data()` 全等间接锁定无副作用） |
| 中断瞬间已发出的邮件 | Spec 明确不回撤（非目标） | 不做断言 |
| 中断广播通知、撤销中断、批量中断 | Spec 非目标 | 不做 |
| 后端 Java 编译、前端 Vitest 实跑 | 本机缺 JDK/Maven 与 node_modules | 下游执行节点补跑 |

## 6. 下游执行注意事项

1. 以**分支 HEAD**（本节点为 `ba2ce8b`，后续节点可能再前进）为准执行，不要只取单个文件。
2. 最小集：`mvn test` → `run-java-e2e.sh` → `npm run test:unit` → `run-frontend-e2e.sh 06-alarm-terminate`。
3. 6-5 与复原用例顺序敏感，勿拆分并行；6-5b 超时 120s。
4. `Excel.java` 的空白单元格跳过是**全主档通用改动**，建议顺带回归 `MasterImportExportE2ETest`。
5. 失败时保留 `e2e/test-results/` 与后端日志尾部，并区分产品缺陷 / 测试缺陷 / 环境问题 / 数据问题再下结论。
