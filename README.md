# md-to-html

把写给 AI 的长篇 markdown，变成**能一口气读完、能直接发给别人**的单文件 HTML。

真源永远是 markdown；HTML 是随时可丢弃重建的阅读面。同一份内容保留两种表示：HTML 给人读，`.md` 给 agent 读。

## 用法

```bash
npm install

# 全局安装：把 md2html 放到 PATH 上（之后任何目录都能用）
npm link

# 渲染 examples/ 下的全部示例（输出到 out/examples/，并生成索引）
npm run render:examples

# 渲染单个文件，输出到 out/
node src/cli.mjs .scratch/html-vs-md/research.md --out out

# 批量（默认同时生成 index.md）
node src/cli.mjs docs/*.md --out out

# 个性化（只覆盖 token 层）
node src/cli.mjs doc.md --out out --profile me.json

# 把相对路径图片内联成 data URI（默认外链）
node src/cli.mjs doc.md --out out --embed
#   · 同一张图多处引用会全部替换
#   · 外链图片、缺失文件、未知扩展名都保留原链接并给出提示（宁可留坏链接，也不吞作者的内容）

# 把原始 .md 一并复制到输出目录（默认不复制）
node src/cli.mjs doc.md --out out --with-source
```

`--with-source` 是为**转发**准备的：默认输出目录里只有 HTML，顶栏「原始 .md」用相对路径指回你本机那份真源；制品一旦转到别人机器上，这个链接就是死链。加上它，真源副本落在 HTML 旁边，链接改指副本，收件人也能拿到原始稿。同一份 `.md` 因此只有在你显式要求时才变成两份。

配套的 agent skill 装在 `~/.agents/skills/md-to-html/`（全局，不进仓库）：它靠 `npm link` 出来的 `md2html` 调本渲染器，所以那层 symlink 断了 skill 也跟着失效（`npm link` 重跑一次即可）。

`me.json` 只接受这几个键，未知键会被忽略：

```json
{ "accent": "#0b6bcb", "content": "820px", "fontSize": "17px",
  "lineHeight": "1.8", "readerName": "张三", "theme": "dark" }
```

带 `readerName` 时，产物页眉会出现一枚"个性化副本"标记——这是唯一会写进文件的个人身份信息。

### 页面内自定义强调色

顶栏的色点按钮可以当场换强调色：6 个预设（靛蓝/工程蓝/青/绿/紫/琥珀）+ 任意取色 + 恢复默认。选择只存在本机 `localStorage`（键 `md2h-accent`），**不写进产物**；换台电脑用 `--profile` 烘进去，或再点一次。

只改 `--accent` 与 `--accent-soft` 两个变量，其余视觉不动——这是 ADR-0005 划的 token 层边界。

代码块底色、边框、行内代码底色，以及**语法高亮整套色板**（`--tok-kw` / `--tok-str` / `--tok-num` / `--tok-com` / `--tok-fn` / `--tok-var` / `--tok-punct`）都由 `color-mix(in srgb, var(--accent) …)` 推导，所以换强调色时它们一起变；不存在写死的黑色代码块，也不引入第三方高亮主题。

高亮支持 `js/ts/json/python/bash/html/css/sql`，未知语言退回纯文本转义——**高亮失败绝不能变成内容丢失**。

## 产物长什么样

- 三列布局：**左栏 = 章节导航（`h2`，全文档）/ 右栏 = 当前章的小节（`h3`）**，两者不重复；顶栏含搜索、明暗切换、"原始 .md"出口。
- 右栏分组是静态写入 DOM 的（无 JS、Ctrl+F 时内容仍在），JS 只切换显示哪一组。
- **目录与导航在构建期静态写入 HTML**：无 JS、被 agent 抓取、Ctrl+F 时都还在。
- 单文件自包含：CSS 与 JS 内联，零网络请求、零网络字体（系统字体栈）。
- 输出目录里默认只有 HTML：原始 `.md` 留在真源位置，顶栏出口用相对路径指回去；要连 `.md` 一起转发才加 `--with-source`。
- **没有打印样式**。需要纸面稿就拿真源那份 `.md`——它才是真源。
- 超过 2MB 只告警，不自动切分（切分会毁掉"单文件可转发"）。

## markdown 元素映射

| markdown | 渲染成 | 依据 |
| --- | --- | --- |
| `# 标题` | 页面 H1（正文里不重复出现） | 模板 |
| `## / ### 标题` | H2 / H3 + 确定性锚点 + 静态目录项 | ADR-0002 |
| `> 提示：…` / `> 注意：…` / `> 危险：…` | note / warning / danger 提示块 | ADR-0006 P3 |
| `> 其他引用` | 普通引用块（**不**改造成提示块） | ADR-0006：不确定就不画 |
| 表格（仅两列时） | **对比卡片**：行 ≤12、单元格 ≤60 字。三列以上一律保留表格 | ADR-0006 P0 |
| 表格（其他情况） | 横向滚动容器；数值列（≥70% 单元格可解析为数）右对齐 + 等宽数字 | ADR-0006 P0 |
| 数值列（纯数字、≥3 行、无负数、差别 ≥1.2×、非序号列） | 单元格底部**条形图**，按列内最大值归一，数字原文照旧 | ADR-0006 P0 |
| `- 术语：定义` 列表 | **定义卡片**（每一项都形如"术语：定义"，术语 ≤18 字，无嵌套） | ADR-0006 P1 |
| 有序列表（3–8 项） | **步骤流**：自动去掉「1、」「（1）」等重复编号；过半项含「如果/或者/可以选择」等可选措辞则不转 | ADR-0006 P2 |
| 代码块 | 底色由强调色推导（`color-mix`）+ 轻量语法高亮 + 语言标签 + 复制按钮 | ADR-0004 / 0007 |
| ` ```mermaid ` 代码块 | 六种图型的子集：`flowchart` / `sequenceDiagram` / `stateDiagram-v2` / `erDiagram` / `classDiagram` / `gantt` | ADR-0009 / 0010 |
| ` ```usecase ` 代码块 | 用例图（mermaid 无此语法，本项目扩展）：`actor` / `usecase` / `A --> B` | ADR-0010 |
| ASCII 图（```` ```text ```` + 制表符/箭头） | **画成内联 SVG**：竖向分层 / 树形 / 单行链 / 续行链 / **多行映射**（`A → B` 成列）。识别不了退回文本图示；带箭头的中文长句（散文）保持普通代码块 | ADR-0008 |
| front-matter | 页眉胶囊标签 + 文档信息卡 | 模板 |

front-matter 兼容 Obsidian 的 `date created` / `date modified`（带空格的键会归一为 `date-modified` 并映射到 `updated`）。

支持的键：`title` `category` `status` `updated` `version` `type` `strength` `conclusion` `lead` `description` `visual`（`off` 关闭全篇图形化）。

### 图形化的开关（写在 markdown 里）

```markdown
<!-- md: no-visual -->   从这行起关闭图形化
<!-- md: visual -->      重新打开
<!-- md: table -->       强制下一张表保留表格形态
<!-- md: cards -->       强制下一个列表转定义卡片
<!-- md: steps -->       强制下一个有序列表转步骤流
```

用 HTML 注释而不是新语法，因为注释在 GitHub、编辑器预览里原生不可见——真源必须仍是"普通 markdown"。**门槛一律保守**：条件不满足就原样保留，画错比不画更糟（ADR-0006）。

条形图的额外门槛：该列必须 100% 是可解析的纯数字（带 `%`/`×`/`倍` 的列只右对齐）、≥3 行、无负数、最大值/最小值 ≥1.2（否则画出来是平的）、且不是步长为 1 的序号列（`1,2,3` / `2020,2021,2022` 画条没有信息量）。**有条形图的表不会被卡片化**——条形比卡片更能承载横向对比。

## 测试

```bash
npm test            # 两套都跑
npm run test:examples   # 只跑"真实文档"回归
```

**第一套 `test/determinism.mjs`：不变量**


- 同一真源 + 无偏好 ⇒ **逐字节相同**的输出
- 产物零网络依赖：无 `<link>`、无 `@font-face`、无外链 `<script>`
- 无 `@media print`
- 目录与导航是静态写入的，不靠 JS 生成
- 图形化不得吞字：正文每个标题文本都必须出现在产物里
- 左右两栏分工不重复：左栏条目与右栏分组一一对应

> 锚点 id 是中文时，浏览器返回的 `a.hash` 是 percent-encoded 的，必须 `decodeURIComponent` 后再与元素 id 比较——这一条曾经让点击与滚动高亮全部静默失效。

**第三套（手动，已结束）`test/human/`：人因测试**

> 两轮数据已归档并得出结论（速度优势未复现），**实验已关闭、不再重跑**。详见 `test/human/README.md`。


同一问题在「原始 markdown 纯文本」与「渲染后的 HTML」两种条件下的定位耗时。协议、预注册判定标准、已知局限都在 `test/human/README.md`。

```bash
npm run human:build && npm run human:serve   # 做 16 题
npm run human:analyze                        # 出中位数/正确率/配对比较
```

**第二套 `test/examples.mjs`：文档即测试**

把 `examples/` 下的真实文档当回归集：逐一渲染并断言"这批文档应该长什么样"（各类图的张数、ASCII 转 SVG 的数量、故意不支持的语法是否仍退回代码块、SVG 宽度与文字节点、索引是否列出全部示例）。

期望值写在文件顶部的 `EXPECT` 里——**文档改了或某个解析器退化，这里会先红**。验证过它能抓到问题：把 gantt 解析关掉，立刻报 2 项失败（gantt 图 0 张、退回代码块从 1 变成 2）。

## 目录

```
examples/            真实示例文档（渲染器的活体回归集）
  Java服务架构演进与部署实践总结.md   604 行：10 张表 / 28 个代码块 / 12 张 ASCII 图
  diagrams.md        图型速查：八种图示各一例 + 一个"不支持"的对照
  Redis集群与高可用_Java高级开发面试复习.md   2364 行：另一种文体（几乎无表格、131 个 text 块）
src/                 渲染器
test/                守门测试 + 自检样本 + 人因测试装置
  human/             定位任务实验（题库、计时台、分析脚本）
docs/adr/            十条架构决策
out/                 渲染产物（git 忽略，可随时用 npm run render:examples 重建）
```

## 代码地图

| 文件 | 职责 |
| --- | --- |
| `src/cli.mjs` | 参数、批量、索引 |
| `src/render.mjs` | 编排：解析 → 静态目录 → 套模板 → 写 HTML（「原始 .md」出口指回真源，输出目录不留副本） |
| `src/markdown.mjs` | markdown-it 配置与全部映射规则（唯一需要改的地方） |
| `src/template.mjs` | 外壳：CSS、内联 JS（搜索/主题/复制/滚动定位/进度） |
| `src/profile.mjs` | 个性化白名单与 CSS 变量生成 |
| `src/index-md.mjs` | `index.md` 生成（与渲染同源，不解析 HTML） |
| `src/highlight.mjs` | 轻量语法高亮：固定关键字表 + 单遍扫描，颜色由强调色推导 |
| `src/visualize.mjs` | 确定性图形化：表格→卡片、列表→定义卡片/步骤流、注释开关 |
| `src/highlight.mjs` 里的 `looksLikeDiagram` | ASCII 架构图识别（仅 text/plain 块，靠制表符与箭头） |
| `src/diagrams/layered.mjs` | 四种 ASCII 写法 → 内联 SVG；布局确定性、朝向自动选、边多时走总线 |
| `src/diagrams/svg.mjs` | SVG 原语：形状、连线裁剪、标签光晕、marker |
| `src/diagrams/mermaid.mjs` | mermaid 子集解析 + 三种布局（分层 / 时序 / 网格 ER） |
| `src/diagrams/mapping.mjs` | 映射图：多行 `A → B`、`条件` 换行 `→ 结论`、空行分组 |
| `src/diagrams/class.mjs` | 类图：成员块、继承/实现/组合/聚合/依赖（不同 marker）、基数 |
| `src/diagrams/usecase.mjs` | 用例图：actor 线条人形 + 椭圆用例 + 两列布局 |
| `src/diagrams/gantt.mjs` | 排期图：`after` 依赖链、成环检测、月份刻度与分区底色 |

决策依据全部在 `docs/adr/`（10 条）：0001 真源与阅读面 · 0002 单文件与静态导航 · 0003/0006 不改内容与确定性图形化 · 0004/0007 视觉契约 · 0005 个性化边界 · 0008/0009/0010 图示体系。

## 项目状态（2026-10-30 收尾）

- **21 个提交**，全部在本地，未连远程。
- **143 项断言**（`npm test`：不变量 110 + 真实文档回归 33）。
- **三份真实示例**：Java 架构（表格型）· Redis 面试（ASCII 图型）· 图型速查（语料型）。
- **能力**：单文件 HTML 阅读面、构建期静态导航与目录、内嵌搜索、明暗主题、页面内自定义强调色、轻量语法高亮、表格→卡片/条形、列表→定义卡片/步骤流、ASCII 图→SVG、mermaid 子集六图、用例图扩展、`--profile` 个性化、`index.md` 索引。
- **人因实验已结束**：两轮 N=1，结论是"读得更快"未获证实（第一轮的 35% 是练习效应）。装置与数据留档在 `test/human/`，不再重跑。

## 继续时的入口

1. 先读 `README`（本文件）与 `docs/adr/` 十条决策——**不要重新讨论已经决定的事**；
2. 跑 `npm test`，绿了再动代码；
3. 新功能最小的验证方式是**再加一份真实文档**到 `examples/`，在 `test/examples.mjs` 的 `EXPECT` 里写下它应该长什么样；
4. 三条不能破的底线：文字必须可搜可选中（不许描字、不许 Canvas）· 同一真源无偏好时逐字节可复现 · 画不出来就退回，绝不画半对半错的图。

## 有意不做

打印样式（ADR-0004）· Canvas · 打包 mermaid 运行时（ADR-0009）· 结构层个性化（ADR-0005）· 远程仓库（本地开发）· 活动图/泳道、C4、部署拓扑、依赖图、思维导图、git graph（各自需要新布局引擎，按需再加）。
