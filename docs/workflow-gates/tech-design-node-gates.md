---
gate_id: gate-tech-design
title: 技术设计节点完成门禁（含技术设计 Spec 必交付要求）
status: ready-to-apply
target_workflow_id: workflow-yf09hv9wjkwbz10fsv0o
target_workflow_name: 典型研发流程
target_node_key: node-2
target_node_name: 技术设计
target_config_version_at_authoring: 20
created_at: 2026-11-26T11:55:00Z
updated_at: 2026-11-26T11:55:00Z
---

# 技术设计节点完成门禁

> 应用方式：本文件正文（`---` front matter 之后的部分）整体写入产品流程模板
> `workflow-yf09hv9wjkwbz10fsv0o` 的 `node-2 技术设计` 节点 `GatesMarkdown` 字段。
> 本文件不做节点执行的运行时输入，只作为可评审、可版本化的门禁源文件维护。

以下任一项缺失或仅有计划而无可验证内容时，本节点不得通过。

## 1. 技术设计 Spec（必交付）

1. **格式**：产出 `spec.md`，严格采用 9 节机检格式——背景与目标 / 用户与场景 / 行为定义 / 接口与数据契约 / 边界与反例 / Non-goals / 验收标准 / NFR 档位声明 / 开放问题；节标题必须为 `## N. 标题`。
2. **Front matter**：必须包含合法 `spec-id` 与 `spec-tier`。
   - `spec-id` 格式 `^[A-Z][A-Z0-9]*-<需求编号>$`，本产品约定为 `AMS-<需求编号>`（例：`AMS-1123`）。
   - `spec-tier` 取 `full | light | micro`；新功能或变更面大取 `full`，bugfix/小改取 `micro`，拿不准取高一档。
3. **行为写法**：行为条目用 EARS 句式 `WHEN <触发> THE <系统> SHALL <响应>`；反例用 `IF <条件> THEN THE <系统> SHALL <拒绝响应>`；不变行为用 `SHALL CONTINUE TO`。行为编号 `B1 B2…`、反例编号 `N1 N2…`、验收编号 `AC1 AC2…`。
4. **双向映射**：每条 B/N 至少被一条 AC 覆盖，每条 AC 必须回指存在的 B/N，不得出现孤儿条目。
5. **溯源**：关键结论必须标注来源，可用 `PRD-§x`、`代码:<文件路径>`、`KB:<文档名>`。无证据的约定不得写成既定事实，只能进入第 9 节开放问题并标注阻塞级别（阻塞开工 / 阻塞合入 / 不阻塞）。
6. **门禁自检**：交付前必须执行
   `python3 <spec-authoring 技能目录>/scripts/spec-lint.py <spec.md> --strict`，
   必须达到 **0 error、0 warning**；执行命令与结论须写入交付说明。
7. **产物登记**：以 `artifact_type=spec`、固定名称 **`技术设计Spec`** 推送至本节点
   （`agentnative workflow artifact push spec`）。修订、重做或迭代必须复用同一名称，
   不得追加版本号、日期或“修订版”。

## 2. 技术设计文档（必交付）

1. 严格遵循产品空间模板 `技术设计模板.md` 的章节结构，不新增或省略一级章节与必填字段。
2. 必须包含：方案概述与影响范围、关键决策、文件清单、接口变更、核心流程、状态变化、配置、兼容性与迁移、上线与回滚、风险、测试要点。
3. 不涉及的小节须写明“无”及原因，不得直接删除字段。

## 3. 任务清单（必交付）

1. 严格遵循 `任务拆分规范.md` 结构，任务按依赖顺序分组，每条任务聚焦一个可观察结果。
2. 每条任务必须回指技术设计文档章节与 Spec 中的 B/N/AC 编号。
3. 任务范围只覆盖本次需求直接需要的文件与模块，不得纳入历史债清理、无关重构或抽象化改造。

## 4. 一致性要求

1. Spec 回答 What/Why，Design 回答 How；二者冲突时以 Spec 为准，并在 Design 中记录冲突点。
2. Design 与 Task 引用条目时必须使用 Spec 的 B/N/AC 编号，不得另起编号体系。
3. 三份交付物的需求范围、非目标与验收口径必须一致。

## 5. 与既有节点规则的关系

1. 本门禁不替代节点补充提示词中的「知识库检索要求」与「技术设计反问与暂停规则」，二者同时生效。
2. Spec 中的非功能要求以第 8 节 NFR 档位声明为准，具体档位由 nfr-dispatch 按代码触点核验；声明 `N/A` 但代码存在相触点时按默认档位强制激活。
