# 警报强制中断 · E2E 运行说明

依据：`docs/e2e/frontend-e2e.md`（TC-FE-E2E-006）、`docs/e2e/backend-api-e2e.md`（TC-API-E2E-005）、`docs/e2e/README.md`。

## 1. 环境依赖

| 组件 | 版本/要求 | 说明 |
| --- | --- | --- |
| JDK | 21 | 可用 `JAVA_HOME` 指定，脚本读取 `$JAVA_HOME/bin/java` |
| Maven | 3.9 | 非标准安装可设 `MAVEN_COMMAND` |
| Node.js | 20.19+（建议 22 LTS） | 前端构建与 Playwright |
| 浏览器 | Chromium（Playwright 管理） | `cd e2e && npm ci && npx playwright install chromium`；脚本不自动安装 |
| 操作系统资源 | 1440×900 视口；本地可监听 18180 / 4173 | 脚本会自检端口与后端 `/health` |

## 2. 浏览器选择方式

- 默认项目：`chromium`（`devices['Desktop Chrome']`），由 Playwright 自带 Chromium 驱动。
- 通过仓库既有 `e2e/serve.mjs` 起同源静态服务（`frontend/dist`）+ `/api`、`/health` 反代到临时后端，等价部署形态。
- 可用 `AMS_E2E_BASE_URL` 指向已有环境（此时不启动本地 webServer）；`AMS_E2E_API_PORT` 覆盖后端端口。
- 前缀：`AMS_E2E_REBUILD=1` 强制重新构建后端 jar 与前端 dist。

## 3. 账号与数据

| 账号 | 密码 | `CAN_TERMINATE` | 用途 |
| --- | --- | --- | --- |
| `E0043258`（陈柏睿） | `123456` | `Y` | 有权限中断、报表查询、主档维护 |
| `E0043260`（林彦廷） | `123456` | `N` | 无权限分支（6-7） |
| `E0043271`（许雅婷） | `123456` | `N` → 临时改 `Y` → 复原 `N` | 主档授权用例（6-5 / 6-5 复原） |

数据约定：
- 每个用例用唯一标题 `E2E-<场景>-<时间戳+随机>` 触发自己的警报，并在 `seed.json` 中预留**不同**的四要素（厂别/子系统/机台/警报代码）以规避触发接口的忽略期间去重。
- 后端 `ams.scheduling=false`、不配置 SMTP → 新警报停在 `Process` 且无人可 ACK，正是中断现场。
- H2 使用临时文件库，不写仓库 `./data`；实例停止后删除临时目录。

## 4. 执行命令

```bash
# 全部前端 E2E（先构建后端 jar 与前端 dist）
bash scripts/run-frontend-e2e.sh

# 仅本功能（推荐最小集）
bash scripts/run-frontend-e2e.sh 06-alarm-terminate

# 后端接口 E2E（真实进程 + 真实 HTTP）
bash scripts/run-java-e2e.sh

# 后端集成/单元
cd backend && mvn test

# 前端单元
cd frontend && npm run test:unit
```

## 5. 报告与证据

| 产物 | 路径 |
| --- | --- |
| HTML 报告 | `e2e/playwright-report/index.html`（`npm run report` 打开） |
| JUnit | `e2e/test-results/junit.xml` |
| 失败证据 | `e2e/test-results/`：截图、video、trace（`trace: retain-on-failure`） |
| 后端日志 | 脚本临时目录 `ams-fe-e2e.XXXXXX/backend.log`；失败时打印最后 40 行 |

## 6. 执行注意

- 6-5（授权）与 6-5 复原必须**同一次运行、按顺序**执行（共享库）；`workers: 1`、`fullyParallel: false` 已固定。
- 6-5b 需要等待 SMTP 失败重送收敛，最长 120s（用例内 `expect.poll` 超时）。
- 6-4 通过 `page.route` 注入服务端 400，不依赖后端真实竞态。
- 若浏览器缺失、端口占用或构建产物缺失，结论应为 `BLOCKED`，不得记为 PASS。
