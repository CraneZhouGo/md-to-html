# Issue 追踪器：本地 Markdown（HTML 渲染）

本仓库的 issue 与规格文档以 markdown 文件形式存放在 `.scratch/` 下。**markdown 文件是唯一数据源**；HTML 永远只是由它**渲染出来的视图**。不允许直接改 HTML 并把它当作更新。

没有远程 issue 追踪器，流程里也不涉及 `gh` / `glab` 命令行。

## 约定

- 一个特性一个目录：`.scratch/<feature-slug>/`
- 规格文档为 `.scratch/<feature-slug>/spec.md`
- 实现类 ticket 一个文件一条，路径为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 起；绝不使用单个合并的 tickets 文件
- 分诊状态记录在 issue 文件靠前的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论与对话历史追加到文件末尾的 `## 评论` 标题下

issue 文件开头带一小段 front-matter，方便人和 agent 都能机械地解析：

```markdown
---
title: 代码块渲染支持语法高亮
status: needs-triage
labels: [needs-triage]
created: 2025-10-30
---

## 问题

…

## 评论
```

保持 `status` 与 `labels` 一致：`labels` 的第一项即当前分诊角色。

## HTML 渲染

这些 markdown 可以由任何工具渲染成 HTML —— 本仓库自己的转换器、静态站点生成器，或编辑器预览。渲染规则：

- 渲染出的 issue 是**派生、可丢弃**的产物，任何时候删掉重新生成都安全。
- 渲染输出放到工具忽略的位置，例如 `.scratch/<feature-slug>/rendered/<NN>-<slug>.html`。绝不要把渲染后的 HTML 与 markdown 同名并排放在一起。
- 渲染不得丢失或改写 front-matter 字段。如果某个渲染工具无法保留 `status` / `labels`，就不要用它往 issue 目录里渲染。
- 技能更新 issue 时，改的是 `.md` 文件；若已存在渲染副本，则重新渲染一次。永远不要手工打补丁改 HTML。

## 当技能说“发布到 issue 追踪器”

在 `.scratch/<feature-slug>/issues/` 下新建一个文件（必要时创建目录），沿用编号命名约定和上面的 front-matter 结构。

## 当技能说“取出相关 ticket”

读取所引用路径的文件即可。用户通常会直接给出路径或 issue 编号。

## Wayfinding（寻路）操作

供 `/wayfinder` 使用。**map（地图）** 是一个文件，每条 ticket 对应一个**子文件**。

- **Map**：`.scratch/<effort>/map.md`（承载 Notes / 已定决策 / 迷雾 的正文）。
- **子 ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，编号从 `01` 起，正文写问题本身。`Type:` 行记录 ticket 类型（`research`/`prototype`/`grilling`/`task`）；`Status:` 行记录 `claimed`/`resolved`。
- **阻塞**：靠前的 `Blocked by: NN, NN` 行。当它列出的每个文件都是 `resolved` 时，该 ticket 即解除阻塞。
- **前沿（frontier）**：扫描 `.scratch/<effort>/issues/`，找出处于打开、未阻塞、未被认领状态的卡片；编号最小者优先。
- **认领**：先把 `Status:` 置为 `claimed` 并保存，再开始任何工作。
- **解决**：在 `## 答案` 标题下追加答案，把 `Status:` 置为 `resolved`，然后向 `map.md` 的“已定决策”追加一条上下文指针（要点 + 链接）。
