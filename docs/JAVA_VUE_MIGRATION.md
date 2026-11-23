# Java + Vue 迁移说明

## 实现依据和范围

本分支 `feat/java-vue` 基于原仓库 `src/`、`public/`、`PAGE_MAP.md` 及以下外发资料重写运行时：

- `AMS 背景介绍和名词解释.md`：厂别、子系统、事件、层级、通知群组、装置的业务概念。
- `AMS系统页面功能汇整.md`：页面代码及通用维护操作。
- `AMS使用者操作手冊.docx`：配置、发送、ACK、中断、报表和事件层级流程。
- `AMS系统需求.xlsx`：80 项业务、架构和非功能需求。
- `AMS_架構圖_V1.0.pptx`：Web、Server/Agent、通知渠道及数据流关系。

保留旧 Node.js 应用及其启动方式；新增 `backend/`、`frontend/`，两套运行时和数据独立。原 JSON 数据文件不会自动迁入 Java。种子数据、字段元数据已固化在 Java resources；`scripts/export-java-resources.cjs` 仅用于开发阶段重新导出，Java 启动不调用 Node.js。

版本：Java 21 LTS、Spring Boot 3.5.7、Vue 3.5.46、Vue Router 4.5.1、Vite 6.4.6、Apache POI 5.4.1。采用成熟版本线并更新前端安全补丁；没有升级至 Java 25、Spring Boot 4 或新版 Vite 主版本。

## 架构与目录

```text
Vue SFC / Vue Router
        │ /api/*（开发时由 Vite 代理，打包后同源）
Spring MVC ApiController
        ├── Auth              单会话登录、30 分钟滑动过期
        ├── Masters           主档、映射、主从档、审计
        ├── Configurations    事件树与各类定义
        ├── AlarmEngine       匹配、派发、ACK、重送、升级、切机况
        ├── Reports / Excel   查询、汇总、Excel
        └── Store             同步事务与 H2 持久快照
Scheduled tasks ──────────────┘
```

| 路径 | 用途 |
|---|---|
| `backend/src/main/java/com/changxin/ams/` | Spring Boot 后端 |
| `backend/src/main/resources/metadata.json` | 主档字段、关联、页面标题 |
| `backend/src/main/resources/seed.json` | 独立的演示数据 |
| `backend/src/test/java/com/changxin/ams/WorkflowIntegrationTest.java` | 集成测试 |
| `frontend/src/pages/` | Vue 页面实现 |
| `frontend/src/components/` | 表格、字段表单、对话框、定义编辑器 |
| `scripts/build-java-vue.sh` | 构建完整 JAR，默认执行测试 |
| `scripts/start-java.sh` | 从固定工作目录启动，保持数据路径一致 |
| `Dockerfile.java-vue` / `compose.java-vue.yml` | 多阶段镜像与单机容器配置 |

`Store` 用单 JVM 锁覆盖校验、变更和持久化；业务异常回滚内存快照，成功结果经 H2 单条事务提交；返回对象与内存数据分离。无效告警是正常业务拒绝，返回 422 并持久保留拒绝原因。H2 的 `AMS_STATE` 表存储完整 JSON 快照，**并非生产关系型业务表模型**，也不能作为多副本共享数据库使用。

登录 token 在服务端内存中保存，重启需重新登录；业务数据保留。密码兼容原演示的哈希方式，未实现生产身份认证、AD/OIDC 或租户隔离。

## 页面覆盖

原导航的 37 个入口（含首页），另有通知收件箱和 ACK 深链；均由 Vue 页面承载。下表中的“支持”指本地业务功能，不代表生产接口已接通。

| 页面代码 | 实现 |
|---|---|
| HOME | KPI、12 小时趋势、最新告警和快捷操作 |
| MCMS038 | 菜单树数据维护、父节点/重复代码/循环引用校验、保存后刷新导航 |
| MCMS040 / MCMS042 / MCMS041 | 一般、Mapping、MasterDetail 配置，结构化字段编辑，JSON 导入导出；SQL/验证类保存为定义 |
| SBRM_USER / SBRM_USER_GROUP | 使用者、使用者群组维护 |
| SBRM_FACTORY / SBRM_EQP / SBRM_EQP_GROUP | 厂别、机台、机台群组维护 |
| CVMA012 / CVMA013 / AVMA003 | 机台类型、机况、子系统维护 |
| SBRM_USER_GROUP_USER / SBRM_EQP_GROUP_EQP | 群组人员、机台群组对应 |
| AVMA004 / CVMA011 / CBRM_CHAMBER_ALARM_MAPPING | 厂别子系统、机况抑制、Chamber 警报对应 |
| AVMA006 / AVMA007 | 通知人员群组、事件与连续层级维护 |
| AVMA008 | 事件层级树、通知群组和各组渠道设定，JSON 导入导出 |
| AVMA009 | 四维度警报通知设定与事件关联校验 |
| AVMA010 | SQL 触发条件、标题/正文模板定义；不定时执行外部 SQL |
| MCMS051 | 批次操作元数据定义维护 |
| CVMA014 | 警报设定筛选和批次隐藏/恢复 |
| CVMA015 | 自动切机况规则，近 30 分钟告警扫描、去重日志、本地机况及 Chamber 联动 |
| AVPA015 | 本地通知装置启用/关闭 |
| AVPA002 / AVPA009 | 手动发送、警报补登 |
| AVPA003 / AVPA006 | 待确认列表、批量 ACK、强制中断 |
| AVPA013 | 厂别/子系统即时汇总及机台下钻，10 秒刷新 |
| AVPA004 / AVPA007 / AVPA005 | 处理记录、交易履历、无效警报查询与 Excel 导出 |
| AVPA008 | Server/Agent 汇总状态及装置明细 |
| RPTSET001 | 18 步报表定义维护；内建报表使用条件和栏位配置 |
| INBOX / `#/ack/:alarmKey` | 个人通知与告警详情/ACK |

一般主档支持新增、复制、修改、唯一性和关联校验、隐藏/恢复、履历及 Excel 模板、验证预览、选择导入。映射页支持选择、保存及 Excel；主从档在表单维护明细。Excel 提交时再次校验，不能绕过服务端规则；每批最多 5000 行，单行错误返回明细，其他有效行可导入。

共用表格提供关键词过滤、排序、分页和选择；选择型字段显示关联名称。支持简体、繁体和已有英文词条；新增提示尚未全部翻译。UI 是 Vue 重新组织后的表单/表格布局，不逐像素复刻旧页面。

## 核心告警行为

1. 校验厂别、子系统对应和机台，按厂别 + 子系统 + 机台 + 警报码匹配。
2. 优先指定机台，再匹配通配机台，最后回退到同机台群组的设定。
3. 校验设定、事件、LEVEL-1、发送方式与人员；应用重复抑制、BYPASS 与机况抑制。
4. 按**每个通知群组自身的渠道**生成派发记录，不把其他组渠道混给本组；装置停用或联络信息缺失记录失败。
5. 当前层级通知对象可 ACK 一次；达到所需人数完成，人数为 `*` 时按全员计算，零 ACK 直接完成。
6. 定时器每 2 秒处理未完成告警的重送/升级，无下一层时结束为 `NoNextLevel`。演示时钟支持倍率调整。
7. 手动通知支持指定人员/渠道和 ACK，同样进入待确认列表；不允许手动告警强制中断。
8. 自动切机况每 5 分钟扫描，也可立即扫描；规则与告警组合只执行一次。修正旧种子规则中的无效主键，并验证 Chamber 所属机台。

通知全部为本地模拟，没有 SMTP、短信、语音、企业 IM 或真实 MES 请求。重送逻辑覆盖当前层级未 ACK 人员，与原演示行为一致，并非运营商送达回执驱动的生产重试。

## 运行和配置

完整 JAR：

```bash
bash scripts/build-java-vue.sh
PORT=8080 bash scripts/start-java.sh
```

该脚本先构建 Vue，再以 `mvn -Pweb clean package` 将 `frontend/dist` 打入 JAR。直接执行普通 `mvn package` 仅面向后端开发，不保证包含最新前端；打包交付请使用上述脚本。

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| JAVA_HOME | 系统 Java | JDK 21 路径 |
| MAVEN_COMMAND | mvn | 构建使用的 Maven 命令/绝对路径 |
| HOST | 127.0.0.1 | Java 监听地址 |
| PORT | 8080 | Java HTTP 端口 |
| AMS_DB_URL | `jdbc:h2:file:./data/ams;DB_CLOSE_ON_EXIT=FALSE` | 相对 Java 工作目录的 H2 数据文件 |
| AMS_DB_PASSWORD | 空 | H2 密码，首次建立后保持一致 |
| AMS_SCHEDULING | true | 是否启用告警与切机况定时器 |
| API_TARGET | `http://127.0.0.1:8080` | 仅 Vite 开发代理 |
| AMS_HTTP_PORT | 8080 | 仅 Compose 宿主机端口 |

迁移已有 Node JSON 或切换到 Oracle 需要另外实现数据库迁移，不能仅替换 `AMS_DB_URL`。生产静态页面使用 Hash 路由，不需要配置 SPA history 回退。

## 验证记录

验证日期：2026-11-23。使用 JDK 21、Maven 3.9.9，本地 H2 临时数据库隔离测试资料。

- Spring Boot 集成测试 12 项通过：认证/单会话与密码字段隔离、精确匹配/重复拒绝/ACK、16 个并发重复提交、群组回退/机况抑制、零 ACK/BYPASS、重送/升级/终止、手动待确认、主从档回滚、Excel 重新校验、切机况幂等、快照重载、主档与报表查询接口。
- Vue 正式构建通过；完整 JAR 包含静态资源。
- 浏览器实际完成：登录、新增厂别、日期条件清除后查询、手动发送→查看发送记录→填写备注→ACK→Completed。
- 浏览器检查了三类主档定义、批次定义、报表定义和切机况规则页面加载；核心流程检查时无 console error。
- 实际停止并重启 Java 进程后，新增厂别和已 ACK 告警均保留；直接访问 JAR 的 8180 端口完成登录、首页加载及 Mapping 定义步骤检查，无需 Vite 进程。
- 最终锁定依赖执行 `npm audit --registry=https://registry.npmjs.org`，返回 0 项已知漏洞（仅 npm 依赖检查，不等同全系统安全验收）。
- Docker 配置提供可复现构建路径，当前环境未执行 Docker 构建，不宣称容器验证通过。

测试重点为业务流程，不代表 80 项需求全量验收或生产容量测试。

## 与生产需求的差距

| 需求 | 当前状态 / 后续工作 |
|---|---|
| Oracle、业务表与索引、千万级历史数据 | 当前 H2 单快照；需关系模型、迁移脚本、索引、分页及归档 |
| Redis、RocketMQ、微服务、集群协调 | 未集成；需分布式幂等、消费与重试、任务竞争和多副本一致性 |
| 真实设备/消息/邮件/短信/语音渠道 | 当前模拟；需渠道适配器、凭据管理、送达回执和故障补偿 |
| MES 自动切机况 | 当前仅本地机台/Chamber 数据变化；需 MES 协议与审计对接 |
| SQL 条件扫描、动态报表引擎、图表/枢纽渲染 | 当前保存定义、模拟 SQL 测试；仅内建报表运行固定查询逻辑 |
| 动态 BRM 配置即时生成新业务表/接口 | 当前维护定义，预置业务页使用打包元数据；需动态 schema/查询引擎 |
| RBAC、细粒度授权、跨租户隔离、统一认证 | 当前演示身份和单会话；已登录用户可访问维护接口，不能用于生产权限隔离 |
| 安全与治理 | 需生产密码方案、HTTPS/网关、限流、日志脱敏、审计保留与访问控制 |
| 5 万请求/分钟、SLA、高可用、灾备 | 未压测或验收；单机快照与全量内存查询不满足该架构目标 |

建议在本分支业务闭环确认后，分阶段替换存储、通知适配器、认证授权和消息调度，保留当前接口与 Vue 页面对照回归。
