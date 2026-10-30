## Agent skills

### 文档语言

本仓库所有文档统一使用中文书写：`AGENTS.md`、`docs/**`（含 `docs/agents/` 与 `docs/adr/`）、`.scratch/**`、`GLOSSARY.md`。新生成的文档、issue、规格、ADR 一律照此执行。

以下内容保持英文原样，不得翻译：代码标识符与文件名、命令与 CLI 参数、标签字符串（如 `needs-triage`）、front-matter 字段名（`title` / `status` / `labels` / `created`）、结构关键字（`Type:`、`Status:`、`Blocked by:`）。

### Issue tracker（问题追踪）

issue 与规格文档以 markdown 文件形式存放在本仓库的 `.scratch/<feature-slug>/` 下；HTML 只是渲染出来的视图，永远不是数据源。详见 `docs/agents/issue-tracker.md`。

### Triage labels（分诊标签）

使用默认词汇：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs（领域文档）

单上下文布局：仓库根目录的 `GLOSSARY.md` 与 `docs/adr/`。详见 `docs/agents/domain.md`。
