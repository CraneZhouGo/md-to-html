# markdown 为真源，单文件 HTML 为阅读面

## Status

accepted

## 决定

文档的真源永远是 markdown；HTML 只作为**阅读面**由程序确定性渲染出来，且渲染为**单文件自包含制品**（样式与脚本内联，双击即开、可离线转发）。同一份内容保持**双表示**：HTML 给人看，`.md` 给 agent 读。

## 为什么

2026 年确有一场"agent 产出用 HTML 而非 markdown"的讨论（Thariq Shihipar / Anthropic Claude Code，Cursor Canvas，Claude Code artifacts，Google Antigravity），但它主张的是**输出面**，不是**存储层**。检索到的全部可信信源都落在同一个模式上：给人读的那层往 HTML 走，给模型吃的那层继续 markdown。

- 没有任何可信信源主张"HTML 取代 markdown 作为真源"；主张者本人也承认放弃手编是**代价**（需要"copy as prompt"把 UI 操作导回文本）。
- 反方向证据同样硬：`llms.txt` v2 建议每页另配 `.md`；Cloudflare 实测同一页 HTML 16,180 tokens vs markdown 3,150（−80%）；`AGENTS.md` 已有 6 万+ 项目、内容就是 markdown。
- 成本差在**谁写 HTML**：模型手写 HTML 是 markdown 的 **1.9–2.2 倍** token、账单 $0.16→$0.30；而"模型只写 markdown 草稿 + 工具渲染"是手写 HTML 的 **约 1/8**。确定性渲染把 HTML 的表现力变成近乎免费。

## Considered Options

- **HTML 作真源**：无任何证据支持，且同时失去 diff、协作编辑、agent 可读性与跨模型可移植性。拒绝。
- **让模型直接手写单文件 HTML**：效果上限最高，但成本 2 倍上下、输出不稳定、样式随模型漂移；且交付物无法被 diff 评审。拒绝作为默认路径，仅保留为个别场景的一次性产出。
- **只做 markdown 阅读器（不产出 HTML）**：无法把文档转发给不装工具的人，"别人不看"这个真实痛点没被解决。拒绝。

## Consequences

- 渲染器必须保持确定性，样式与导航不得依赖模型的临时发挥；同一真源重复渲染应得到同一份制品。
- 制品是**可丢弃产物**：删掉重建是正常操作；任何时候都不许手工修补渲染出的 HTML（本仓库 `docs/agents/issue-tracker.md` 已有相同规则）。
- 需要同时产出 `.md` 出口，双表示同源，不得分叉维护。
- **导航是承重件，不是装饰**：Mintlify 的 2,400 次基准显示，真正降低 agent 找路失败率的是索引地图（404/任务 2.23 → 0.11），不是标记格式。没有内嵌导航的 HTML 等于没做。
- 本项目默认服务"要发给别人读"的场景；纯自用的长文阅读，市面工具已足够，不是本仓库的目标。
