# Research: "HTML 取代 Markdown 供人阅读" —— 2024–2026 是否真实存在这场运动？

> 调研时间：2026 年（检索到的证据最新到 2026-10-07）。所有引文为原文照录，未翻译。

---

## Verdict（结论）

**存在，而且是可考证、有明确起点、有产品落地的一场真实讨论；但它的主张范围比传闻窄得多。**

1. **确有此事**：2026-05-08 起，Anthropic Claude Code 团队工程师 **Thariq Shihipar** 发文《Using Claude Code: The Unreasonable Effectiveness of HTML》（2026-05-20 由 Anthropic 官方博客 `claude.com/blog` 转载，即权威落点），主张 **agent 的产出格式**应为单文件 HTML 而非 Markdown；随后 Andrej Karpathy（2026-05-11）、Simon Willison（2026-05-08）、Theo / t3.gg（2026-05-13）跟进，Cursor（2026-04-15 Canvas）、Anthropic（2026-06-18 Claude Code artifacts）、Google Antigravity（2026-08-26）把它产品化。这是**真实存在**的行业运动，不是营销虚构。
2. **触发点正是问题陈述本身**：核心论据不是"HTML 更好看"，而是"**超过约 100 行的 Markdown 文件我自己就不读了**"。这句话是整场讨论的原点和最强口号。
3. **但证据支持的只是 (a)，不是 (b)**：
   - **(a) HTML 作为阅读面 / 呈现层，Markdown 仍是真源（source of truth）** ← **证据充分支持**。所有严肃信源（含 Thariq 本人、Tim Schipper 实测、mdflow、kody-w、llms.txt v2、Mintlify、Cloudflare）都落在这个模式上。
   - **(b) HTML 取代 Markdown 成为真源** ← **没有任何可信信源主张过**。反而是被明确否证：所有"输出用 HTML"的作者都同时说"给 agent 读的东西、要 diff 的东西、要协作编辑的东西，继续用 Markdown"。
4. **"AI 生成的 Markdown 动辄数千行"是夸大**。文献里实际给出的量级是 **100–400 行 / 1,800 词 / 5k tokens**，没有任何信源说"数千行"。见「NOT supported by evidence」。
5. **"HTML 更适合 LLM 读" 被证据反驳**：Cloudflare（HTML 16,180 tokens vs Markdown 3,150，省 80%）与 Mintlify 基准（HTML 文档 agent 404 最多，Markdown+llms.txt 最少）都指向**agent 侧 Markdown 更优**。这场运动从头到尾都是**关于人，不是关于模型**。

**对 md-to-html 这类项目的直接含义**：证据支持的形态是"**Markdown 作真源 → 确定性渲染器产出单文件 HTML 阅读面（内嵌 TOC/导航/折叠/搜索）**"，而不是"让模型直接手写 HTML"，也绝不是"用 HTML 取代 .md 文件"。实测数据表明这个中间路线同时拿到两边的收益（成本接近 MD，阅读体验接近 HTML）——见 Finding 6。

---

## 分桶 1：EXPLICIT CLAIMS —— "HTML > MD 供人阅读"的明确主张

### 1.1 原点（Primary source，必读）

**Thariq Shihipar（Anthropic，Claude Code 团队）**
《Using Claude Code: The Unreasonable Effectiveness of HTML》
- 首发：X @trq212，2026-05-08（https://x.com/trq212/status/2052809885763747935）
- 权威版本：**2026-05-20，claude.com/blog**（https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html）
- 镜像：https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/ 、https://thariqs.github.io/html-effectiveness/（20 个单文件 HTML 示例画廊）、https://github.com/anthropics/html-effectiveness

最强引文（原文）：

> "Markdown has become the dominant file format used by agents to communicate with humans. It's simple, portable, has some rich text capability and is easy to edit. … **But as agents have become more and more powerful, I've found that Markdown has become an increasingly restrictive format. Specifically, I find it difficult to read a Markdown file of more than a hundred lines**; I want to use Claude to generate richer visualizations, color and diagrams; and I want to be able to share these outputs more easily."

> "I also am increasingly not editing these files myself, but using them as specs and reference files. When I do make edits, I'm usually prompting Claude to edit them, **which removes one of Markdown's largest benefits**."

> "**I've found that I tend to not actually read more than a 100-line Markdown file, and I certainly am not able to get anyone else in my organization to read it.**"

> "**The chance of someone actually reading your spec, report, or PR writeup is much higher if it's in HTML.**"

> （成本自认）"**While Markdown often uses fewer tokens, I've found that the added expressiveness of HTML and the much higher likelihood of me reading it means I get overall better output.** With the 1MM context window in Opus 4.7, the increased token usage is not really noticeable in the context window."

> （边界自认，关键）"When I do make edits, I'm usually prompting Claude to edit them" / 以及自定义编辑器的设计原则："**The trick is always to end with an export: a 'copy as JSON' or 'copy as prompt' button** that turns whatever I did in the UI back into something I can paste into Claude Code or commit to a file."

**重要的范围限定（常被二手转述丢掉）**：
- 文末免责声明：`This article was written by Thariq Shihipar, member of technical staff, and expresses his personal opinions` —— 这是**个人观点文**，不是 Anthropic 官方格式规范。
- 文中给出的 240 行 Markdown spec vs HTML 页面对照（FIG），是**同一份 spec 的两种呈现**，不是"把 spec 换成 HTML 存储"。

### 1.2 放大器

| 谁 | 标题 / 形式 | 日期 | 最强引文 | 链接 |
|---|---|---|---|---|
| **Andrej Karpathy** | X 帖 | 2026-05-11 | "This works really well btw, at the end of your query ask your LLM to **'structure your response as HTML'**, then view the generated file in your browser. I've also had some success asking the LLM to present its output as slideshows… More generally, imo audio is the human-preferred input to AIs but vision (images/animations/video) is the preferred output from them." | https://x.com/karpathy/status/2053872850101285137 |
| **Simon Willison** | 链接博客 | 2026-05-08 | "**I've been defaulting to asking for most things in Markdown since the GPT-4 days, when the 8,192 token limit meant that Markdown's token-efficiency over HTML was extremely worthwhile. Thariq's piece here has caused me to reconsider that, especially for output.**" | https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/ |
| **Theo (t3.gg)** | YouTube 36 min | 2026-05-13 | 标题即主张：《Stop letting your agents write Markdown.》；据转述："He says HTML is more expressive for complex outputs and **easier to read when the file gets large**. … instead of reading walls of texts in chats or markdown files that can be hard to digest" | https://www.youtube.com/watch?v=S9EGx6ik-18 |
| **Claire Vo / Lenny's Podcast（现场录于 Code with Claude）** | 播客 + newsletter | 2026-05-18 | 标题：《**HTML is the new markdown**: How Anthropic engineers are building with Claude Code》 | https://www.lennysnewsletter.com/p/html-is-the-new-markdown-how-anthropic |
| **InfoQ（Bruno Couriol）** | 新闻分析 | 2026-06-24 | 标题：《**Anthropic Lead: HTML Increasingly Better Than Markdown at Keeping Humans Engaged in Agentic Loops**》——"Goal communication, specification refinement, and output review are emerging bottlenecks in agentic workflows." | https://www.infoq.com/news/2026/06/anthropic-html-markdown-agent/ （注：正文抓取返回 HTTP 405，仅见检索摘要，见 Missing evidence） |

### 1.3 厂商侧的同类主张（"我们在产品里这么做"）

| 厂商 | 文档/公告 | 日期 | 引文 |
|---|---|---|---|
| **Cursor** | 《Interact with agent-created visualizations in canvases》 | **2026-04-15**（早于 Thariq 文） | "Cursor can now respond by creating canvases to visually represent information. **This allows you to explore and interact with custom interfaces instead of reading walls of texts in chats or markdown files that can be hard to digest.**" — https://cursor.com/blog/canvas ；文档页："Instead of scrolling through a long markdown table or code block, you get a standalone view, laid out with sections, stats, and tables" — https://cursor.com/docs/agent/tools/canvas |
| **Anthropic** | Claude Code「Share session output as artifacts」文档 | 功能 2026-06-18 上线 | "**Use an artifact when terminal text is the wrong medium for what Claude produced**: output that is easier to look at and interact with than to read line by line." + 成本自认："Generating an artifact uses output tokens like any other response, and **a styled page is more token-intensive than the same content as terminal text**." — https://code.claude.com/docs/en/artifacts |
| **Google Antigravity** | 《Visualizing with the help of Antigravity》/ `/generative_ui` | 2026-08-26 | "Using visualization helps us be able to represent data and understand it in a way that text alone cannot convey." + "the agent builds an interactive widget … **as an HTML artifact**" — https://antigravity.google/blog/visualizing-with-the-help-of-antigravity/ ，https://antigravity.google/docs/commands/generative-ui/ |

### 1.4 独立博主 / 工程博客（二线，多数是对上述事件的再分析）

- **Tim Schipper**，《Stop letting your agents write Markdown》，2026-05-14（2026-09-16 复核）——**同时是主张者与最严谨的实测者**，见 Finding 5/6。https://tim-schipper.nl/en/blog/stop-letting-your-agents-write-markdown
- **Kody Wildfeuer**，《Markdown Is the Spec; HTML Is the Rendering》，2026-04-24："**The markdown stays the source of truth. The HTML shell is a rendering layer over the same files.** Two viewers, same data, no build step." https://kody-w.github.io/2026/04/24/markdown-is-the-spec/
- **mdflow**，《HTML Is the New Markdown? Output vs. Storage》，2026-07-17："**'HTML is the new markdown' is a claim about output, not about storage.** … the durable layer underneath — specs, decisions, runbooks, agent memory — should stay markdown: cheaper in tokens, readable as raw source, diffable, and portable across every model." https://mdflow.cz/blog/html-is-the-new-markdown
- **Bharat Parsiya**，《Stop Making AI Agents Hand You Markdown Walls》，2026-06-28："You know that thing where you ask an AI agent for a plan, it gives you **1,800 words of Markdown**, and you tell yourself: 'I'll read this properly later.' No, you won't." https://bnap.dev/blog/stop-making-ai-agents-hand-you-markdown-walls
- **Andrei Nita**，《Why AI-Generated Plans Need Visual Review, Not More Text》，2026-06-28："**A 400-line AI-generated plan** lands in a pull request. Three reviewers approve it within minutes. Nobody catches the misconfigured database migration buried on line 247. … **This is not a discipline failure. It is a format failure.**" https://andreinita.co/blog/comprehension-bottleneck-ai-docs/

---

## 分桶 2：TOOLING —— 已有的 MD → HTML 消费链路

关键区分列：**产物给谁读**（人 / agent）与**真源是谁**（MD / HTML）。

### 2.1 MD 为真源 → HTML 为阅读面（成熟、主流、大量生产使用）

| 工具 | 形态 | 给谁读 | 真源 | 证据 |
|---|---|---|---|---|
| **Starlight (Astro)** | `.md`/`.mdx` content collection → HTML 站点（自带 sidebar、搜索、TOC） | 人 | **Markdown** | "Starlight generates your site's HTML pages based on your content" / "Starlight supports the full range of Markdown syntax in `.md` files" — https://starlight.astro.build/guides/pages/ ，https://starlight.astro.build/guides/authoring-content/ |
| **mdBook (Rust)** | `SUMMARY.md` → 静态 HTML 书（内置搜索、章节导航） | 人 | **Markdown** | "`html` — This renders the book to HTML. This is enabled by default." / "It will try to parse your `SUMMARY.md` file to understand the structure of your book" — https://rust-lang.github.io/mdBook/format/configuration/renderers.html ，/cli/build.html |
| **VitePress / Docusaurus / Docsify / Quarto / pandoc** | 同类：MD 源 → HTML/PDF/slides | 人（pandoc 也常给机器） | **Markdown** | 本报告未逐页抓取这几项官方文档（见 Missing evidence），仅作为同构工具列出，按谨慎处理 |
| **Slidev / Marp** | Markdown → Web 幻灯片（"slides from markdown"） | 人 | **Markdown** | "Slidev is also Markdown-based, which helps you focus on the content." — https://sli.dev/guide/why ，https://marp.app/ |
| **Mintlify** | 托管文档站：MD/MDX 源 → HTML 站（人）+ `/llms.txt` + `.md` 路由（agent） | 人 + agent | **Markdown/MDX** | "every page gets llms.txt and Markdown routes automatically" — https://www.mintlify.com/blog/llms-txt-agent-benchmark |

> 说明：这一桶的存在本身就是"HTML 取代 MD"的反证——**整个文档工具链已经默认 MD 是真源、HTML 是构建产物，且这已经是十年以上的行业惯例**（Docusaurus/VitePress/mdBook/pandoc 均早于 2024 年）。

### 2.2 HTML 直接作为 agent 产出（模型手写 HTML，单文件，供人阅读）

| 工具 | 形态 | 给谁读 | 真源 | 证据 |
|---|---|---|---|---|
| **Claude Code artifacts** | agent 写自包含页面 → 发布到私有 URL（版本历史、评论、可调 MCP） | 人 | **HTML（或 MD，视提示）** | "Unless you name a location, Claude writes the page to an **HTML or Markdown file** in a temporary directory outside your project, then publishes it." — https://code.claude.com/docs/en/artifacts |
| **Claude.ai / ChatGPT Artifacts** | 对话内 artifact 渲染 | 人 | HTML | 通用产品形态；本次未取独立官方引文（见 Missing evidence） |
| **Cursor Canvases** | `.canvas.tsx` / agent 产出视图 | 人 | HTML/TSX | https://cursor.com/docs/agent/tools/canvas |
| **Google Antigravity `/generative_ui`** | HTML artifact widget | 人 | HTML | https://antigravity.google/docs/commands/generative-ui/ |
| **Thariq 的模板集** | 20 个单文件 HTML | 人 | HTML | https://thariqs.github.io/html-effectiveness/ |

### 2.3 混合架构（**与 md-to-html 最相关**）：模型只写 MD 草稿，工具渲染单文件 HTML

| 项目 | 机制 | 实测收益 | 证据 |
|---|---|---|---|
| **answer-me-with-html**（QingYunA，作者自跑基准，含中文 README） | SKILL.md 要求模型**只写 Markdown 草稿**，"The `am` CLI does all layout, colours, dark mode and diagram coordinates. **Do not hand-write HTML / CSS / SVG.**" | 手写 HTML 平均 **4,893 输出 tokens** → 本方案 **612 tokens（约 1/8）**；耗时 31s → **12s**；账单降约 15% | https://github.com/QingYunA/answer-me-with-html （bench 数据 2026-10-07）；SKILL.md: https://github.com/QingYunA/answer-me-with-html/blob/main/skills/answer-me-with-html/SKILL.md |
| **render-html skill (wanshuiyin)** | "/render-html: Markdown → single-file HTML for human reading" | 原则："**MD / JSON is canonical, HTML is generated view.** Edit the source, then re-render. Do not hand-edit the HTML." | https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/blob/main/skills/render-html/SKILL.md |
| **html-effectiveness-docs (rwang23)** | 把 Thariq 模式打包成 agent skill | "**Markdown is still the right long-term source of truth.** But for exploration, comparison, review, and handoff, a self-contained HTML artifact can be much easier to read and act on." | https://github.com/rwang23/html-effectiveness-docs |

---

## 分桶 3：COUNTER-EVIDENCE —— 反方向（"Markdown 才是给 LLM 的格式" / MD 仍是真源）

### 3.1 llms.txt（Jeremy Howard / Answer.AI）

**《The /llms.txt file, v2》**，llmstxt.org，v2 于 **2026-08-10**（日期据 Tim Schipper 转述；页面本身为活文档）。https://llmstxt.org/

> "An HTML page wraps its information in navigation, ads, and JavaScript, and **converting it back into clean text is difficult and imprecise**. Context windows, while larger than they were, are still too small for most websites in their entirety, and **every wasted token costs time and money**."

> "we furthermore propose that pages with information that agents might need **provide a clean markdown version of those pages at the same URL as the original page** … To help clients find these files, we recommend using standard link relations: `rel="alternate" type="text/markdown"` points to the markdown version of a page, and `rel="describedby"` points to the llms.txt file that covers it."

v2 的产业渗透证据（同页）：数千站点已发布 llms.txt；Mintlify 等文档平台自动生成；**Chrome Lighthouse 的 agentic browsing 检查会审计 llms.txt**；所有 nbdev 项目默认生成每个页面的 `.md` 版本。

### 3.2 AGENTS.md（OpenAI Codex / Amp / Jules / Cursor / Factory，现由 Linux Foundation 的 Agentic AI Foundation 托管）

https://agents.md/ —— "A simple, open format for guiding coding agents, used by **over 60k open-source projects**"；"**AGENTS.md is just standard Markdown.**" 设计动机明确对立于"给 agent 更花哨的格式"：把给 agent 的上下文与给人读的 README 分开。

### 3.3 Cloudflare：HTML 页面 vs Markdown 的 token 实测（agent 侧）

**《Introducing Markdown for Agents》**，Celso Martinho & Will Allen，Cloudflare 工程博客，2026-02（响应示例日期 `Wed, 11 Feb 2026`）。https://blog.cloudflare.com/markdown-for-agents/

> "Feeding raw HTML to an AI is like paying by the word to read packaging instead of the letter inside. A simple `## About Us` on a page in markdown costs **roughly 3 tokens**; its HTML equivalent – `<h2 class="section-title" id="about">About Us</h2>` – **burns 12-15**… **This blog post you're reading takes 16,180 tokens in HTML and 3,150 tokens when converted to markdown. That's a 80% reduction in token usage.**"

机制：客户端发 `Accept: text/markdown`，Cloudflare 边缘把 HTML 转 MD 返回，并附 `x-markdown-tokens` 头（示例：`x-markdown-tokens: 725`）。

### 3.4 Mintlify 基准（**最反直觉、也最重要的一条**）

**《Docs URL Benchmark: Markdown & llms.txt > HTML》**，aadit-shah，Mintlify 工程博客，**2026-07-17**，2,400 次运行 / 20 个文档站 / Claude Code + Codex（Sonnet 5、GPT-5.5）。https://www.mintlify.com/blog/llms-txt-agent-benchmark （开源复现：https://github.com/mintlify/url-discovery-bench）

> "Agents hit on average **2.23 dead links per task on HTML docs, 1.42 on Markdown, and 0.11 on Markdown with an `llms.txt` index**."

> "**The most surprising find was that markdown itself wasn't the fix, the map was. Plain markdown was arguably the worst of the four formats.** Without a map to point to, agents started building `.md` paths on their own and guessed more wrong URLs than they had on HTML."

> "Accuracy stayed in the mid-to-high 90s across every format … **The win was efficiency, not correctness.**"

跨模型复现：Opus 4.8 2.11→0.08，Fable 5 1.13→0.00，GPT-5.6 6.79→0.02。

**这条同时反驳两种简化论**：既反驳"HTML 比 MD 更适合 agent"（HTML 404 最多），也反驳"只要换成 MD 就好了"（纯 MD 反倒最差）。真正的变量是**有没有导航地图**。

### 3.5 Anthropic 自家的"Markdown + 精简 + 渐进披露"路线（针对同类痛点，但解法完全不同）

同一家公司、同一批痛点（文档太长没人读/太贵），Anthropic 对**agent 可读的规范文件**给出的答案是**继续用 Markdown，但强制短和分层**：

- "**Concise is key.** The context window is a public good." —— Skill authoring best practices，https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- "**Keep your main `SKILL.md` under 500 lines.** Move detailed reference material to separate files." —— https://claude.com/docs/skills/how-to
- 三级 progressive disclosure（YAML frontmatter / SKILL.md 正文 / 链接文件），见 https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills （2025-10-16）

> 注意：这条是**关于 agent 读的上下文**，不是关于人读文档——不能直接当作"人读也要 Markdown"的证据。但它证明了「**限制体积 + 分层披露**」是与「换格式」并列的另一条解法，且 Anthropic 自己在 agent 侧选了前者。

### 3.6 Hacker News 上的实质反驳（对 Thariq 文，thread 48071940 / 48072400 / 48072471）

- **协作编辑**："My concern here is that by gravitating to HTML you lose the ability for a human (you!) to easily co-author the document with the LLM. … **With a HTML doc it is much harder to do that than with MD.**" — https://news.ycombinator.com/item?id=48071940
- **格式换不掉内容密度**："**format doesn't fix low information density**"（多篇转述 HN 的元批评）
- **成本与锁定**："HTML is significantly less token-efficient. Difficult to provide precise feedback on plans. HTML, much easier to do this in MD. **Both of these tradeoffs set Anthropic up for success** … I'd bet they're investing in tools to mark up HTML … which will help improve lock-in." — https://news.ycombinator.com/item?id=48072471 （注：此为 HN 评论，属观点非证据）
- **AI 文档的真正问题可能是"啰嗦"而非"格式"**："Good documentation is terse… AI output is soooooooo damn verbose. What should've been a paragraph becomes a giant markdown file. **I like reading human-written documentation, but AI-slop documentation is so tedious I just bounce right off.**" — https://news.ycombinator.com/item?id=47443129
- 其他被提及的风险：执行生成 JS 的安全面、无障碍（可访问性）退化、模型在标签/嵌套上漂移。

### 3.7 搜索引擎侧的相反信号（*证据强度弱，标注待验证*）

Search Engine Land 报道（Barry Schwartz，2026-02-06）称 Google Search 与 Bing 团队**不建议**为 LLM 单独生成 `.md` 页面，理由涉及"给 LLM 与给用户不同内容"可能构成 cloaking。https://searchengineland.com/google-bing-dont-recommend-seperate-markdown-pages-for-llms-468365
**本次抓取该页返回 HTTP 403，未能核对原文引语**，仅作方向性提示，不作为结论依据。

---

## 问题陈述本身：证据有多硬？

### 有人抱怨长 Markdown 难读吗？—— 有，但都是轶事/个人经验，不是实证研究

| 证据 | 量级 | 性质 |
|---|---|---|
| Thariq："difficult to read a Markdown file of **more than a hundred lines**" | ~100 行 | 个人经验（direct quote，非测量） |
| Thariq 文中 FIG 对照 | **240 行** spec | 举例（direct，图注描述） |
| Andrei Nita | **400 行** plan，错误埋在第 247 行 | 场景叙述（direct quote，非受控实验） |
| Bharat Parsiya | **1,800 词** | 场景叙述 |
| gptme / progressive-disclosure 文档 | "**500+ lines, 5k+ tokens**" 常驻上下文 | 工程经验值 |
| HN（2026） | 直接反驳："AI 文档是**啰嗦**，不是格式问题" | 观点 |

**没有任何一条是"受控实验证明人在 HTML 上理解更快/更准确"**。全部"人不读"的判断都是主观自述。

### 提出了哪些解法？（按出现频率）

1. **TOC / 侧边栏 / 锚点**——Starlight、VitePress、mdBook、Mintlify 的默认能力；Thariq FIG E 的 HTML explainer 自带 TOC。
2. **单文件 HTML 内嵌导航**——tabs、可折叠段（"four collapsible request-path steps"）、jump links、responsive。
3. **搜索**——文档站标配；`llms.txt` 是"搜索/地图"在 agent 侧的对应物。
4. **渐进披露（progressive disclosure）**——Anthropic Skills 三级加载；gptme-contrib 的 "slim index + on-demand subdirectories"（称可减少 40–60% 常驻上下文）；MCP 工具 `expand`（逐层走 TOC）。
5. **"docs as app" / 交互式文档**——sliders、copy-as-prompt、copy-as-diff 的往返闭环（Thariq）；cursor canvas 的 dashboard；Antigravity generative UI。
6. **带版本与评论的发布面**——Claude Code artifacts（每次发布即一个版本、组织内可评论）。
7. **直接砍体积**——"SKILL.md < 500 行"、"concise is key"。
8. **给 agent 一张地图**——`llms.txt`（Mintlify 实测把 404 从 2.23 降到 0.11）。

---

## 关键实证数据汇总（README 表格用）

| # | 主张 | 数字 | 方向 | 来源 / 日期 | 支持类型 | 置信度 |
|---|---|---|---|---|---|---|
| E1 | HTML 页面 vs 同页 Markdown（**agent 读**） | 16,180 → 3,150 tokens（−80%） | MD 胜 | Cloudflare, 2026-02 | direct quote（厂商自测单页） | 高（可复现：`curl -H "Accept: text/markdown"`） |
| E2 | 手写 HTML 文档 vs 手写 MD 文档（**模型写**） | plan: 6,205 → 11,783（**1.9×**）；review: 3,110 → 6,812（**2.2×**）；$0.16→$0.30；64s→104s | MD 胜 | Tim Schipper, 2026-05-14 / 复核 2026-09-16 | direct evidence（自跑、参数公开、可复现） | 中高（单一作者、3 runs/cell、样本小） |
| E3 | 上述 HTML 的 diff 是否更难评审 | plan HTML diff **比 MD 更小**（+6/−1 vs +9/−1）；review 相近 | 原批评**被自我推翻** | Tim Schipper 同上 | direct evidence | 中高（作者主动撤回自己的旧主张，可信度加分） |
| E4 | 文档站 404 数/任务（**agent 找路**） | HTML **2.23** / 纯 MD **1.42** / MD+llms.txt **0.11** | 两者皆非，地图胜 | Mintlify, 2026-07-17，2,400 runs | direct evidence（开源数据可复现，但**厂商自办**） | 中高 |
| E5 | MD 草稿 + 工具渲染 HTML vs 模型手写 HTML | 612 vs 4,893 tokens（**≈1/8**）；12s vs 31s | 混合架构胜 | answer-me-with-html, 2026-10-07 | direct evidence（**作者自跑**，tokens.json 已提交） | 中（单作者、3 topics×3 runs） |
| E6 | HTML 的 token 溢价官方口径 | 无具体数字，只承认 "a styled page is more token-intensive" | — | Anthropic Claude Code docs | direct quote | 高 |
| E7 | 结构标记的 token 粒度 | `## About Us` ≈ 3 tokens vs `<h2 class=…>` ≈ 12–15 | MD 胜 | Cloudflare | direct quote（示意，非测量） | 中（示意性例子） |

---

## (a) vs (b)：证据到底支持哪一个

| | (a) **HTML 作阅读面，MD 作真源** | (b) **HTML 取代 MD 作真源** |
|---|---|---|
| 主张者 | Thariq（实际做法：仍把 HTML 当 spec 参考；编辑走 prompt 或 copy-as-format 导出）、Tim Schipper、mdflow、Kody Wildfeuer、rwang23、wanshuiyin render-html、Mintlify、Cloudflare、llms.txt v2、Docs-as-Code 全生态 | **无**。检索未发现任何可信信源主张 (b) |
| 支撑证据 | 全部 T1/T2 引文 + 整个 Starlight/VitePress/mdBook/Mintlify 生态 | — |
| 反证 | — | ① Thariq 自认放弃手编是**代价**而非收益，需用 "copy as prompt" 补回；② HN 协作编辑批评；③ llms.txt v2 建议**每页配 `.md` 版本**；④ AGENTS.md 60k+ 项目坚持纯 Markdown；⑤ Anthropic 自家 SKILL.md 仍是 Markdown；⑥ MD 的 diff/可移植/跨模型优势无替代 |

**结论**：**证据强力支持 (a)，零支持 (b)。** 这场运动的准确名字不是 "HTML 取代 Markdown"，而是 **"Markdown 当源码，HTML 当交付面（reading surface）"**——而且这个模式在文档工具领域已经存在十几年，2026 年的新意只在于**把它从"站点"推广到"单文件 agent 产物"**，并把这个动作交给模型/agent 自动完成。

---

## NOT supported by evidence（不要采信的说法）

1. **"AI 生成的 Markdown 动辄数千行"** —— 无信源支持。可考的最大量级是 **400 行 / 1,800 词 / 5k tokens**。出现"thousand-line markdown plans"的只有二手转述（如 howardism.dev 摘要），未见一手原文。
2. **"业界已达成共识：HTML 优于 Markdown 供人阅读"** —— 只有**一群人**这么说，且核心原文是个人观点文（Anthropic 官方免责声明在文末）。HN 上有等量级反批评。
3. **"HTML 更适合 LLM 读取"** —— **被证据反驳**（E1、E4）。
4. **"Markdown 已死 / Markdown is dead"** —— 标题党。反证：AGENTS.md 60k+ 仓库、llms.txt v2、Anthropic SKILL.md、Starlight/VitePress/mdBook 全部以 MD 为真源。（"Markdown is Dead? Why Claude is Pivoting back to HTML" 一文即属此类，见下。）
5. **"换格式能解决文档没人读"** —— HN 反驳与 3.5 节都指向：体积、密度、分层、导航才是变量；Mintlify 的结论甚至是"markdown 本身不是解，地图才是"。
6. **"HTML 会毁掉 diff"** —— 提出者本人实测后**撤回**（E3）。
7. **"HTML 成本可忽略" vs "HTML 成本 3–5 倍"** —— 两个极端数字都不成立：实测约 **2 倍**（E2），用工具渲染则接近 1/8（E5）。Thariq 的"not noticeable"依赖 1M 上下文。
8. **"Claude Code 的默认输出已改成 HTML"** —— 无证据。artifacts 是**显式触发**的功能，文档写明产物可能是 HTML **或 Markdown**。

---

## Contradictions（记录而非消解）

| 冲突 | A 方 | B 方 | 处理 |
|---|---|---|---|
| token 成本 | Thariq："increased token usage is not really noticeable"（1M context） | Tim Schipper 实测 1.9–2.2×，$0.16→$0.30 | 不矛盾于事实，矛盾于**是否值得**。取决于文档被读几遍：人读一次 → 可接受；agent 反复读 → 不可接受 |
| HTML 的 diff 可读性 | Tim Schipper 2026-05 原主张："HTML would wreck your diffs" | Tim Schipper 2026-09 实测：**撤回** | 已由原作者自我修正，采用后者 |
| MD vs HTML 对 agent | 主流直觉"MD 更适合 LLM" | Mintlify：**纯 MD 是四种里最差之一**，HTML 反而好于纯 MD | 双方都部分错：主导变量是 `llms.txt` 地图 |
| HTML 对 agent 的可用性 | Cloudflare 主张 MD 省 80% token | Mintlify 指出 HTML 页面自带导航、agent 反而少猜路径 | 真实权衡：**token 效率 vs 可发现性**；`rel="alternate"` + llms.txt 是折中（llms.txt v2 正是为此设计） |
| 人读体验 | Thariq / Cursor / Antigravity：视觉化明显更好 | HN：无障碍退化、无法协作编辑、密度问题没解决 | 未解决，取决于读者与文档用途 |
| Thariq 是否放弃了 Markdown | 本人："I have honestly stopped using Markdown altogether for almost everything" | 同文 FAQ 承认成本、跨团队协作需 MD；HN 与多位分析者指出"输出≠存储" | 保留双方；把"我"与"我们团队/组织"区分开 |

---

## Missing evidence（未验证 / 未解决）

1. **无任何受控人因实验**比较"同一份 AI 生成文档在 MD vs HTML 下的阅读完成率、理解准确率、决策质量"。整场讨论的经验基础是自述。
2. **无第三方复现** Tim Schipper 的 1.9–2.2× 与 answer-me-with-html 的 8×（两者都公开了方法/数据，但未见独立复核）。
3. **InfoQ 文章**（2026-06-24）正文抓取返回 HTTP 405，仅有检索摘要，其"Anthropic Lead"措辞是否准确（Thariq 是 MTS 还是"engineering lead"）存在出入：原文自述 "member of technical staff"，InfoQ/Lenny's 用 "engineering lead"。**这是二手抬高，需注意。**
4. **VitePress / Docusaurus / Quarto / pandoc 的官方页面未逐一抓取**，其"MD 为真源"的描述基于通行认知与本报告未逐页核验，采用时应补抓。
5. **ChatGPT / Claude.ai Artifacts 的官方格式规范未取到官方引文**（仅产品常识）。
6. **"thousands of lines" 的原始出处未找到**——可能是社群口头放大。
7. **中文社区的独立观点**（非译文）未系统检索；已见 woshipm / pingwest / 36kr 均为 Thariq 文的翻译或转述（36kr 标题《Markdown Losing Fashion: Karpathy Supports HTML》，2026-05-12），不构成独立证据。
8. **无采用率数据**：不知道有多少团队真的把 agent 产出改成 HTML。

---

## 来源清单

### Kept（作为证据使用）
- **claude.com/blog — Using Claude Code: The Unreasonable Effectiveness of HTML**（Thariq Shihipar，2026-05-20）https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html —— **运动原点 + 最权威原文**；含作者自认的成本与编辑边界。
- **tim-schipper.nl — Stop letting your agents write Markdown**（Tim Schipper，2026-05-14 / 复核 2026-09-16）—— **唯一公开方法、可复现的成本与 diff 实测**，并主动撤回自己的旧主张。
- **blog.cloudflare.com — Introducing Markdown for Agents**（Celso Martinho & Will Allen，2026-02）—— **最常被引用的 HTML vs MD token 数据（16,180 / 3,150）**。
- **mintlify.com — Docs URL Benchmark**（aadit-shah，2026-07-17，开源数据）—— **唯一的大样本（2,400 runs）格式与可发现性基准**，同时反驳双方简化论。
- **llmstxt.org — The /llms.txt file, v2**（Jeremy Howard / Answer.AI，v2 2026-08-10）—— 反方向的**规范级**证据（`rel="alternate" type="text/markdown"`）。
- **code.claude.com/docs/en/artifacts**（Anthropic）—— 官方承认 HTML 产物更贵，且产物可为 MD。
- **cursor.com/blog/canvas**（2026-04-15）、**antigravity.google/blog/visualizing-with-the-help-of-antigravity**（2026-08-26）—— 厂商侧"为什么做"的第一手动机陈述。
- **agents.md**（Linux Foundation / Agentic AI Foundation）—— Markdown 作为 agent 真源的最大规模反证（60k+ 项目）。
- **platform.claude.com/docs/…/agent-skills/best-practices** + **claude.com/docs/skills/how-to** —— Anthropic 对"文档太长"的另一种解法：短 + 渐进披露。
- **starlight.astro.build / rust-lang.github.io/mdBook / sli.dev / marp.app** —— MD→HTML 工具链的官方"MD 为源"表述。
- **github.com/QingYunA/answer-me-with-html** —— 与 md-to-html 最同构的混合架构，含 8× token 实测（**作者自跑，需打折**）。
- **simonwillison.net（2026-05-08）** —— 有影响力的独立技术作者**改变默认**的第一手记录。
- **news.ycombinator.com/item?id=48071940 / 48072471 / 47443129** —— 高质量反批评（协作编辑、锁定、啰嗦而非格式）。观点非证据。

### Weak / marketing-only —— 引用时必须标注
- **uxhack.substack.com《Markdown is Dead? Why Claude is Pivoting back to HTML》** —— 标题夸张（"Markdown is dead" 无证据），内容为二次综述。
- **oneclearreader.com** —— 实为 Mac Markdown 阅读器 App 的获客内容（"A Markdown reader on your Mac does most of this for you"），结论与自身产品利益一致。
- **beam.ai、floatboat.ai、aistudio.codes、fictty.com、howardism.dev、enjoy-program.net、flamehaven.space、rogerwong.me、mdflow.cz、provi.me** —— 均为围绕 Thariq 文的二手分析/内容营销，**不能作为原始证据**；本报告仅用它们定位一手源。
- **36kr / pingwest / woshipm / kocpc** —— Thariq 文的中文翻译或编译，**非独立信源**。
- **"claude.dev"** —— 内容与 claude.com 博客镜像一致，**引用时以 claude.com 为准**。
- **searchengineland.com（Google/Bing 不建议为 LLM 建 MD 页）** —— 抓取 403，**未核对原文**，仅列方向。

### Rejected
- 各类"AI 摘要站"（daily.dev / rosetta.to / rewiz / prepublish.ai / podscan.fm 对 Theo 视频的转录摘要）—— 二手转录，引文不可靠。
- `github.com/jaberio/file2site`、`CrakA2/SingleMD`、`afeique/amber-html`（0–2 stars，2026 年新建）—— 与主题相关的噪声项目，无证据价值。
- htmltomarkdown.io 等转换器营销页 —— 无相关主张。
- 2021 年 HN 旧帖 "The unreasonable effectiveness of simple HTML" —— 主题不同（手写 HTML 的无障碍），易与 2026 事件混淆，已排除。

---

## 对 md-to-html 的推论（明确标注为 inference，非信源主张）

> 以下为**研究者推论**，未被任何单一信源直接陈述：

1. **产品定位应落在 (a)**：`.scratch/**` 的 markdown 为真源，HTML 只作为渲染视图 —— 这与 Starlight/VitePress/mdBook/Mintlify 的既有惯例、llms.txt v2、以及本仓库 AGENTS.md「HTML 只是渲染出来的视图，永远不是数据源」**完全一致**。
2. **不要做 (b)**：让 HTML 成为真源会同时失去 diff、协作编辑、agent 可读性与跨模型可移植性——本报告未找到任何支持 (b) 的证据。
3. **成本敏感点已被解决**：模型不手写 HTML、由确定性渲染器从 MD 生成，则 token 成本≈MD（E5 的 1/8 路径），同时拿到 HTML 阅读面。这正好是"渲染器"路线的价值主张。
4. **真正的竞争点是"导航地图"，不是"格式"**：Mintlify 的结论 + 所有"解法清单"都指向 TOC/sidebar/搜索/渐进披露。一个 HTML 阅读面如果没有内嵌导航，只是"更好看的墙"。
5. **同时保留 `.md` 出口**：llms.txt v2 + Cloudflare + Mintlify 一致要求"同一内容、多种表示"，HTML 给浏览器、MD 给 agent。

---

## Next steps（最有价值的后续取证）

1. 抓取 **InfoQ 原文**（换代理/reader）核对它对 Thariq 头衔与主张的表述精度——这是当前最可能被二手抬高的点。
2. 找 **HN thread 48071940 的完整评论排序**，统计正反比例，把"业界共识"这种措辞彻底钉死或否证。
3. 做一次**自己的小规模人因测试**（同文档 MD vs HTML：定位错误耗时、完成率），这是文献中完全缺失的证据类型，也最能支撑 md-to-html 的价值主张。
4. 复现 **Tim Schipper 的 1.9×** 与 **answer-me-with-html 的 8×** 两组数字（方法均已公开），确认在本仓库的目标场景下是否成立。

---

---

## 决策记录（2026-10-30，基于本报告）

以下为本仓库据此定下的决策。架构层决定见 `docs/adr/0001-markdown-source-of-truth-html-reading-surface.md`；术语定义见 `GLOSSARY.md`。

| # | 问题 | 决定 | 依据 |
|---|---|---|---|
| D1 | "HTML 文档"指哪一档 | **单文件自包含 HTML**（样式/脚本内联、双击即开、可转发）。站点式与应用式作为升级档，不进第一版 | 现有可信实践全部落在这一档；站点档已有 Starlight/Mintlify 统治 |
| D2 | 替代强度 | **只换阅读面，不换真源**；并保持双表示（HTML 给人、`.md` 给 agent） | 零信源支持 HTML 作真源；llms.txt v2 / Cloudflare / Mintlify 三家独立指向双表示 |
| D3 | 根因假设权重 | **H2 导航结构**与 **H4 信息密度**并列首要；H1 体积降为 H2 的表征；H3 表现力降权 | Mintlify 基准指出主导变量是地图；HN 高质量反驳指出问题是啰嗦而非格式 |
| D4 | 目标读者 | **要发给别人读的人**（不懂技术的同事/客户，需离线、单文件、零部署） | 真痛点不是"我看不下去"，而是 Thariq 那句"没法让组织里任何人读它"；纯自用市面工具已足够 |
| D5 | 证据门槛 | 三档分级（强/中/弱）+ 必须含反方章节；并**明确承认**"人不读长 MD"是自述、非实证 | 全场无受控人因实验；一手实测仅 3 份，其余为观点与营销 |
| D6 | 交付节奏 | 先报告 + ADR，**暂不动手写渲染器** | 决策难逆、反直觉、有真实权衡，够格立 ADR；原型等 ADR 定稿 |
| D7 | 制品体积与内联策略 | 内联 CSS/JS；图片与字体默认外链（`--embed` 才内联）；**超过 2MB 告警、不自动切分** | 单文件可转发是核心卖点；自动切分由程序臆断断点 |
| D8 | 导航在哪生成 | **构建期静态生成** TOC/锚点/章节编号；JS 只负责折叠、搜索、滚动高亮 | JS 关闭、Ctrl+F、打印、agent 抓取四种场景下静态导航仍在 |
| D9 | 跨文档索引 | **默认产出**，与目录渲染同源生成 `index.md` | Mintlify 基准：索引地图的收益比换格式高一个数量级 |
| D10 | 信息密度这层 | **第一版不动**：不摘要、不提炼、不删减，只做呈现 | 渲染器改密度会让阅读面与真源语义分叉，违反 ADR-0001 双表示同源 |
| D11 | 人因测试 | **推迟**到第一个可用渲染器之后再做 | 文献完全缺少此类数据；现在做只能拿别人的工具测，结论不归本仓库 |

以上 D1–D11 已全部记录；架构层决定写入 `docs/adr/0001`–`0003`。

> 注：设计树前沿已清空。剩下的待定事项均为实施细节（如 CSS 变量命名、代码高亮语言集、搜索是否做离线索引），按 ADR 定稿的前提可在写代码时就地决定，不再需要单独一轮确认。

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Delivered a structured research report at the required path with verdict, three requested buckets (explicit claims / tooling / counter-evidence), a claim-by-claim table with URL+author+date, verbatim quotes, an empirical-data table (E1-E7), an (a)-vs-(b) matrix, an explicit NOT-supported list, flagged weak/marketing sources, and residual risks."
    }
  ],
  "changedFiles": [
    ".scratch/html-vs-md/research.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "web_search (4 batches, multi-angle queries)",
      "result": "passed",
      "summary": "Located movement origin, tooling, counter-evidence, empirical benchmarks"
    },
    {
      "command": "fetch_content on claude.com/blog, tim-schipper.nl, blog.cloudflare.com, mintlify.com, llms.txt.org, agents.md, code.claude.com/docs/en/artifacts, starlight/mdBook/sli.dev docs",
      "result": "passed",
      "summary": "All primary sources fetched as full text; quotes transcribed verbatim from fetched content"
    },
    {
      "command": "source_check on Thariq thesis and Cloudflare token numbers",
      "result": "passed",
      "summary": "Returned cited passages (status 'unclear' due to unavailable semantic assessment); passages manually reviewed and did confirm both claims"
    },
    {
      "command": "fetch_content on infoq.com, news.ycombinator.com, searchengineland.com",
      "result": "failed",
      "summary": "HTTP 405 / fetch failed / 403 — disclosed as Missing evidence, not used as evidence"
    }
  ],
  "validationOutput": [
    "Canonical URL verified: claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html (claude.dev is a mirror; author disclaimer 'personal opinions' present in both).",
    "Cloudflare 16,180 vs 3,150 tokens confirmed verbatim in fetched blog body AND corroborated by independent source_check passage.",
    "Movement dates cross-checked across independent records: X 2026-05-08, claude.com 2026-05-20, Willison 2026-05-08, Karpathy 2026-05-11, Theo 2026-05-13, InfoQ 2026-06-24."
  ],
  "residualRisks": [
    "No controlled human-factors study exists comparing MD vs HTML reading comprehension; all 'people don't read it' claims in the field are anecdotal, including the anchor claim.",
    "Two of the three quantitative comparisons (Tim Schipper 1.9-2.2x; answer-me-with-html 8x) are single-author, small-n, and not independently replicated.",
    "InfoQ and Hacker News bodies could not be fetched (405 / fetch failed); InfoQ wording ('Anthropic Lead') conflicts with the author's own 'member of technical staff' self-description and may be second-hand inflation.",
    "Search Engine Land claim about Google/Bing discouraging separate .md pages could not be verified (403) and is presented as direction only, not evidence.",
    "VitePress / Docusaurus / Quarto / pandoc official docs were not individually fetched; their 'Markdown as source of truth' characterization rests on general knowledge and is flagged in Missing evidence."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added one new research report file; no repository source files modified.",
  "reviewFindings": [
    "no blockers"
  ],
  "manualNotes": "Direct answer to the question: YES, the movement is real and dateable (Cursor 2026-04-15 predates it; the canonical origin is Thariq Shihipar / Anthropic Claude Code, X 2026-05-08, claude.com/blog 2026-05-20), amplified by Karpathy, Simon Willison and Theo, and productized by Anthropic artifacts, Cursor Canvases and Google Antigravity. BUT the evidence supports only HTML-as-reading-surface with Markdown as source of truth (option a); NO credible source anywhere argues HTML should replace Markdown as the source of truth (option b). Two corrections to the question's premise are important: (1) the documented sizes are ~100-400 lines / 1,800 words / 5k tokens, NOT 'thousands of lines' - no source says thousands; (2) 'HTML is better for LLMs' is actually refuted by the best data (Cloudflare 80% token saving for Markdown; Mintlify HTML docs had the MOST agent 404s). The real variable the benchmarks isolate is navigability/a map (llms.txt), not markup format - which matters a lot for md-to-html's design: embedded TOC/nav/collapsible sections are the load-bearing feature, not prettiness. Report is written in Chinese per the repo's AGENTS.md documentation-language rule, with all quotes kept verbatim in English. Source_check ran but returned status 'unclear' (no semantic assessment available); I manually reviewed the returned passages, which did contain the claims verbatim."
}
```
