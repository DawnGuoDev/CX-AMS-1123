# 警报强制中断 · 静态检查结果

- 节点：E2E测试用例编写（只做不运行测试的编译/类型检查）
- 本节点提交：`ba2ce8b`（分支 `feat/0ae13b26-ka7z`）
- 结论：**E2E 类型检查通过；前端新增单测语法通过；后端 Java 编译与前端 Vitest 因环境缺件未执行**。以下未执行项均需下游执行节点复核。

## 1. 已执行

| # | 检查对象 | 命令 | 结果 |
| - | --- | --- | --- |
| 1 | `e2e/frontend/**/*.spec.ts` + `support/ams.js` + `tsconfig.check.json`（8 个仓库文件） | `tsc -p /tmp/e2e-check/tsconfig.check.json`（`strict:false, allowJs, checkJs, noEmit`；依赖从 npm 临时安装的 `typescript@5.9.3`、`@playwright/test@1.56.0`，未写入仓库） | **通过**，exit 0；`--listFiles` 确认 8 个仓库文件均参与检查（79 个文件含 lib 与类型声明） |
| 2 | `e2e/frontend/06-alarm-terminate.spec.ts` 转译 | `ts.transpileModule`（ES2022 / ESNext） | 0 diagnostics |
| 3 | `frontend/src/__tests__/legacy-i18n.test.js` 语法 | `node --check` | **通过** |
| 4 | 契约核对（只读） | `git show 4b0ca35 -- AlarmEngine/ApiController/Masters/metadata/seed/AlarmDetail` 与 `grep` 比对断言用文案、选择器、状态选项顺序 | 一致：错误文案、`500` 上限、`alarmStatus` 顺序、`ALARM_LIST` 函数名均与实现相同 |
| 5 | 分支与远端可见性 | `git log`、`git push` 后 `git status -sb` | `feat/0ae13b26-ka7z` 与 `origin` 同步，HEAD=`ba2ce8b` |

## 2. 未执行（含原因与补测条件）

| 检查 | 未执行原因 | 补测条件 / 由谁执行 |
| --- | --- | --- |
| `cd backend && mvn -q -DskipTests test-compile`（含新增 `AlarmTerminateE2ETest#shouldLocateTheAlarmByAlarmIdAsWellAsByAlarmKey`、集成用例修正） | 本机无 JDK 21 与 Maven（`java`、`mvn` 命令不存在） | 执行节点 `mvn test` 前先编译；或用 JDK 21 + Maven 3.9 运行 `test-compile` |
| `cd frontend && vitest` 的类型/模块解析（`vite build` 静态构建可验证 import 链） | `frontend/node_modules` 不存在，`npm ci` 需要网络与安装时间 | 执行节点 `npm ci && npm run test:unit` |
| 仓库自带 `e2e/tsconfig.check.json` 路径下的 tsc | 仓库未安装 `node_modules`（无 `@playwright/test` 类型包） | 执行节点 `cd e2e && npm ci` 后 `npx tsc -p tsconfig.check.json` |
| 远端 `origin/release` 基线核对 | 本次 GitHub 访问 TLS 中断（`GnuTLS recv error (-110)`） | 影响范围文档已按本地 `release=13c8434` 计算，如需最新基线可重算 |

## 3. 未运行任何测试的自检记录

- 未执行 `mvn test`、`vitest`、`playwright test`、`cypress run`、`go/pytest` 等任何测试运行、dry-run 或测试收集命令。
- 未执行 `playwright install chromium` 或任何浏览器安装命令。
- 未修改任何被测业务代码；本节点仅改动测试与测试文档（见「变更与交接说明」）。

## 4. 静态检查覆盖不到的已知风险

- 选择器真实性（Ant Design 关闭图标按 `title` 命名、`.terminate-modal` 容器、`data-test="terminated-banner"`）只能由执行阶段验证；已在 6-1/6-2 中给出替代定位（`.ant-modal-close`）。
- 6-5 与 6-5 复原用例依赖共享后端库的顺序执行，类型检查无法发现时序依赖问题。
