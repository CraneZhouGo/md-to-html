# 分诊标签（Triage Labels）

各技能用五个规范化的分诊角色来沟通。本文件把角色映射到本仓库 issue 追踪器里实际使用的标签字符串。

| mattpocock/skills 中的标签 | 本仓库追踪器中的标签 | 含义                         |
| -------------------------- | -------------------- | ---------------------------- |
| `needs-triage`             | `needs-triage`       | 维护者需要先评估该 issue     |
| `needs-info`               | `needs-info`         | 等待报告者补充信息           |
| `ready-for-agent`          | `ready-for-agent`    | 已充分细化，可交给 AFK agent |
| `ready-for-human`          | `ready-for-human`    | 需要人工实现                 |
| `wontfix`                  | `wontfix`            | 不做处理                     |

当技能提到某个角色时（例如“打上 AFK-ready 分诊标签”），使用表中对应的标签字符串。

追踪器是本地 markdown，因此这些标签不会在任何地方被“创建” —— 它们就是写进 issue front-matter 的 `status` 与 `labels` 字段的字面值。

如需使用别的词汇，直接修改“本仓库追踪器中的标签”这一列。
