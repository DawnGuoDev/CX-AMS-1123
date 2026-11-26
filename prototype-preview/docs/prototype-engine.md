# 原型工程说明

| 项 | 值 |
| --- | --- |
| 仓库 / 关联远端 | `DawnGuoDev/CX-AMS-1123` / `https://github.com/DawnGuoDev/CX-AMS-1123.git` |
| 原型分支 | `codex/prototype-preview` |
| 工程目录 | `prototype-preview/`（相对仓库根） |
| 已验证提交 | `6c9095242a8019605589a2968dbece9a69c9cca2` |
| 业务来源基线 | `release @ 13c84348c339d0acea9062954b043b1ec7e56e5d`（2026-11-26） |
| 构建入口 | `cd prototype-preview && npm install && npm run build` |
| 预览入口 | `cd prototype-preview && npm run dev`（5173）或 `cd prototype-preview/dist && python3 -m http.server 4173` |
| 迁移记录 | `prototype-preview/prototype-map.json` |
| 验收记录 | `prototype-preview/docs/design-notes.md`（截图在 `prototype-preview/docs/evidence/`） |

## 复用方式

原型任务开工前按本表分支与目录检出工程，以上方“已验证提交”为起点，对比业务基线只迁入本次需求缺失或变化的页面。工程内 `README.md` 说明已支持能力与宿主适配，`prototype-map.json` 记录逐文件来源。

## 已知限制

- 未迁入报表查询、设备模拟、其余主档、导入导出、真实登录/SMTP/Java 后端。
- 主档仅使用者/厂别/机台三类；数据只存在页面内存。
- `package-lock.json` 的 `resolved` 已指向公共 npm registry，依赖版本保持不变。
