# AMS E2E（Playwright）

本目录是 **前端 E2E** 子项目：用 Playwright 驱动 Chromium，访问 `frontend` 的生产构建，并真实调用后端 `/api/**`。
文本用例（git 维护）见 [`docs/e2e/`](../docs/e2e/)：`backend-api-e2e.md`、`frontend-e2e.md`、`unit-tests.md`。

## 结构

```
e2e/
├─ playwright.config.js   # 测试目录、报告、浏览器、同源测试服务
├─ serve.mjs              # 静态服务 frontend/dist + 反代 /api、/health
└─ frontend/
   ├─ 01-login.spec.ts            TC-FE-E2E-001
   ├─ 02-navigation.spec.ts       TC-FE-E2E-002
   ├─ 03-master-data.spec.ts      TC-FE-E2E-003
   ├─ 04-alarm-workflow.spec.ts   TC-FE-E2E-004
   ├─ 05-alarm-list.spec.ts       TC-FE-E2E-005
   ├─ 06-invalid-alarm-query.spec.ts  TC-FE-E2E-006（AVPA014 汇出用例需系统 `unzip` 读取 xlsx）
   └─ support/ams.js             登录、菜单路由、API token、唯一数据标记
```

## 一键执行（推荐）

```bash
# 仓库根目录；需要 JDK 21 + Maven + Node 20.19+
bash scripts/run-frontend-e2e.sh                    # 全部
bash scripts/run-frontend-e2e.sh frontend/03-master-data.spec.ts
```

脚本会按需构建 `backend/target/ams-1.0.0.jar` 与 `frontend/dist`，用**临时 H2 文件库**启动后端（默认 18180 端口，
不写仓库内 `./data`、不配置 SMTP），再在 4173 端口启动同源测试服务并执行 Playwright，结束后清理进程与临时目录。

## 分步执行

```bash
cd e2e
npm ci
npx playwright install chromium          # 首次
AMS_API_TARGET=http://127.0.0.1:8180 node serve.mjs &   # 或让 Playwright 自动启动（webServer）
npx playwright test
npx playwright show-report               # HTML 报告
```

`AMS_E2E_BASE_URL` 指向已存在的同源站点时，Playwright 将直接使用该地址、不再启动内置服务：

```bash
AMS_E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test
```

## 构建产物与失败证据

| 产物 | 位置 |
| ---- | ---- |
| HTML 报告 | `e2e/playwright-report/index.html` |
| JUnit | `e2e/test-results/junit.xml` |
| 失败截图/视频/trace | `e2e/test-results/**` |

以上目录均被 `.gitignore` 忽略。

## 已知约束

- 种子账号 `E0043258 / 123456`；SMTP 未配置，测试告警的邮件记录为 `Fail`，因此“待我确认”为空、ACK 按钮不出现，
  这是产品规则（送达后才可确认）的正常表现。
- 服务端对同一账号只保留一个会话：浏览器登入会使之前 API 取得的 token 失效，需要时在测试中重新获取。
- 用例以简体中文文案选择元素；切换语言的用例显式断言英文/中文菜单。
