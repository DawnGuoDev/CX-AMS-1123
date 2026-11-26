# AMS 原型工程（prototype-preview）

与业务仓库 `DawnGuoDev/CX-AMS-1123` 同源的前端独立预览工程。它复用 `release` 上真实的 Vue 3.5.46 + Ant Design Vue 4.2.6 + Vite 6.4.6 源码、`style.css` 主题、`ConfigProvider` token、侧栏/顶栏外壳与产品组件；所有后端调用由本地 Mock 承接，不启动 Java、H2、SMTP 或定时调度。

> 这是“工程能力演示”，不是已批准的业务需求。页面上的资料、ACK 结果与新增记录只保存在当前页面内存，刷新即恢复初态。

## 运行

要求 Node.js >= 20.19。

```bash
cd prototype-preview
npm install          # 独立依赖与锁文件，不继承业务根工程安装链
npm run dev          # http://127.0.0.1:5173
npm run build        # 产出 dist/，base 为相对路径，可放在任意静态路径
cd dist && python3 -m http.server 4173   # 独立网页验收构建产物
```

## 已迁入能力

| 路由 | 内容 |
| --- | --- |
| `#/home` | 即时警报汇总 KPI + 真实 `DataGrid`，点击警报识别码打开详情 |
| `#/page/AVPA013` | 与首页相同的汇总视图（完整报表页未迁入） |
| `#/page/ACK_LIST` | 待我确认列表（真实 `DataGrid`） |
| `#/page/TEST` | 测试告警触发表单，触发后打开真实 `AlarmDetail` 弹窗 |
| `#/page/SBRM_USER`、`SBRM_FACTORY`、`SBRM_EQP` | 主档列表 + 编辑弹窗（`DataGrid` + `RecordDialog` + `FieldForm`） |
| 其他菜单 | 显示“尚未迁入”空态，按后续需求增量迁入 |

真实组件：`AppSidebar`、`DataGrid`、`FieldForm`、`RecordDialog`、`UiCheckbox`、`AlarmDetail`（结构保留，数据源改为 Mock）。导航、表格过滤/排序/分页、主档新建、警报详情 Tab、ACK、测试触发、繁简/英文语言切换均在浏览器中验证过。

## 目录与宿主适配

```
prototype-preview/
  src/main.js            路由（hash 模式，静态托管无 404）
  src/App.vue            外壳：ConfigProvider 主题 + 侧栏 + 顶栏 + AlarmDetail
  src/state.js           与业务 state.js 同名的导出，api() 指向 mock
  src/mock/api.js        本地 Mock（bootstrap/options/alarms/alarms-test/master store）
  src/mock/data.js       固定初态资料，仅预览用，不是接口契约
  src/style.js           预览覆盖样式（见下方“已知限制”）
  src/components / pages 迁入的真实组件与页面
  docs/                  prototype-engine.md（工程登记）、design-notes.md、evidence/
```

## 已知限制与适配说明

- `release` 的 `frontend/src/style.css` 末尾包含未裁剪的 Ant 重置规则 `[hidden]{display:none!important}`。页面外壳是 `body` 的最后一个元素，直接复用会被整体隐藏；`src/style.js` 将隐藏规则限定在 `.app-shell` 和 Ant 浮层容器，**不改业务 CSS**。
- `frontend/public/vendor/opencc.js`（约 1.2MB UMD）保留为静态资源，Vite 不打包该 UMD script；繁中切换时按需加载。
- 主档资料模型为预览简化（使用者/厂别/机台三类），业务 `MasterPage` 的导入、导出、历史与其余主档未迁入。
- 报表查询与汇出、设备模拟、真实登录/权限、SMTP 发送结果均未迁入；详情弹窗的通知/交易/层级/回应表格为空态。
- 数据不会跨刷新保存；预览 Mock 的结果不代表后端能力。

更多来源映射见 `prototype-map.json`，验收记录见 `docs/design-notes.md`。
