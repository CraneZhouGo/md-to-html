# Research：长文档单文件 HTML 渲染器的真实设计参数

**方法说明**：全部数字来自直接读取源文件（`<style>` 块、`assets/docs.css`、`assets/docs.js`），不是从截图或二手文章推测。凡是无法读到源码的单元格一律写「未确定」。标注 `computed` 的对比度是我用 WCAG 相对亮度公式根据源码里的 hex 值算出来的，标注 `inference` 的是我根据 CSS 行为推断的结论，不是源码里的原话。

来源可达性说明：本环境下 `raw.githubusercontent.com` 与 `cdn.jsdelivr.net` 均不可达；改用 `github.com/<owner>/<repo>/blob/<branch>/<path>` 与各项目 `github.io` 静态部署页读取源文件，均拿到完整原始 HTML/CSS/JS。

---

## 1. 对比表

### 1A. Measure（正文宽度）与断点

| 项目 | 正文最大宽度 | 外层容器 | 断点行为 | 来源 |
|---|---|---|---|---|
| html-effectiveness `16-implementation-plan` | 无单一正文列；`.page` = **1120px**，标题区 `.page-head` = **820px**，节导语 `.sec-intro` = **720px**，里程碑段落 = **620px** | 居中 `.page{max-width:1120px}`，body padding `56px 32px 120px` | 900px（4→2 列）、980px（2→1 列）、780px（风险表 3→1 列） | `16-implementation-plan.html` `<style>` |
| html-effectiveness `14-research-feature-explainer` | 正文列 = `1fr`，但 `p{max-width:680px}`、`dd{max-width:640px}`；侧栏固定 **200px** | `.page{max-width:1100px; grid-template-columns:200px minmax(0,1fr); gap:48px}` | **920px**：单列且 `nav{display:none}` | `14-research-feature-explainer.html` |
| html-effectiveness `17-pr-writeup` | `p.lede{max-width:680px}`，`.tldr{max-width:760px}`；TOC 列 **240px** | `.page{max-width:1040px}`；`.layout{grid-template-columns:1fr 240px; gap:48px}` | **900px**：单列且 `.toc{display:none}` | `17-pr-writeup.html` |
| md-reader | `#article{max-width:var(--art-w,800px)}`，内边距 `48px 56px 64px` → 内容区 ≈688px | `#main` 左移 `--toc-w:288px` | 1024px→`40px 48px`；860px→`32px 28px` + `--toc-w:260px`；768px→`--toc-w:0`、侧栏变 280px 抽屉、`28px 24px`；375px→正文 15px | `md-reader.html` `#article` / `@media` |
| onedoc | `--content-max:780px`（`.content-inner`），`.content` padding `40px 48px 96px` | `.layout{grid-template-columns:268px minmax(0,1fr) 220px; max-width:1360px}` | **1100px**：去掉右侧 TOC（剩 2 列）；**820px**：单列 + 汉堡抽屉（`82%`，`max-width:320px`），`padding:28px 20px 72px` | `assets/docs.css` |
| xdossier `demo/pedagogy.html` | `main{max-width:760px}`；expert 档 `main{max-width:640px}` | `.layout{grid-template-columns:260px minmax(0,1fr); max-width:1240px; gap:56px; padding:48px 32px 96px}` | **1024px**：单列、TOC 变 fixed 抽屉（320px / `max-width:86vw`）+ `body[data-toc-open]{overflow:hidden}` | `demo/pedagogy.html` |
| answer-me-with-html | **未确定**（渲染器 CSS 打包在 `skills/answer-me-with-html/scripts/am.mjs` 里，仓库无独立 CSS 文件） | 未确定 | 未确定 | — |
| Tailwind Typography `prose`（canonical） | **65ch**（`prose` 自带 `max-width:65ch`，用 `max-w-none` 覆盖） | — | 由 `prose-sm/base/lg/xl/2xl` 修饰符换档，不是媒体查询 | `tailwindcss-typography/src/styles.js` + 生成物 `prose{max-width:65ch}` 的公开报告 |

### 1B. 字号 / 行高 / 段落间距 / 字体栈

| 项目 | body 字号 | 行高 | 段落间距 | 字体栈（原文） |
|---|---|---|---|---|
| he-16 | **未声明**（浏览器默认 16px） | **1.55** | 无全局 `p` 规则，组件内单独给（如 `margin-bottom:10px`） | `--serif: ui-serif, Georgia, 'Times New Roman', serif` / `--sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` / `--mono: ui-monospace, 'SF Mono', Menlo, Monaco, monospace` |
| he-14 | **15px** | **1.65** | `p{margin-bottom:12px}` | 同上（mono 用 `Consolas`） |
| he-17 | 未声明（16px） | **1.55** | `p.lede{margin-bottom:12px}` | 同 he-16 |
| md-reader | chrome **15px**；正文 `--art-fs` 默认 **16px**（`prefs.fs:16`） | 正文 `--art-lh` 默认 **1.85**（`prefs.lh:1.85`，CSS 兜底 1.8） | `#content p{margin:.9em 0}` ≈ **14.4px** @16px | `-apple-system,"PingFang SC","Hiragino Sans GB","Helvetica Neue",Arial,sans-serif`（注释写明 V1.6.1 **移除** Inter webfont，「字体回退系统字体栈」） |
| onedoc | **16px** | **1.65** | `.content p{margin:0 0 16px}` = **1em** | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` / mono `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` |
| xdossier | **16px** | **1.72**（expert 档 `1.5`） | 未确定（未读到通用 `main p` 规则） | `--font-display: Charter, "Source Serif Pro", "Iowan Old Style", Georgia, "Songti SC", "Noto Serif SC", serif` / `--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` / `--font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, ui-monospace` — **无 `@font-face`，无外链** |
| am | 未确定 | 未确定 | 未确定 | 未确定 |
| Tailwind prose | **1rem (16px)** | **1.75**（28/16） | `p{margin-top:1.25em; margin-bottom:1.25em}` = **20px** | 继承 `font-family`（插件不管字体） |

### 1C. 标题字阶（ratio / 实际尺寸）与 h1/h2/h3 处理

| 项目 | h1 | h2 | h3 | h4 | 比例/风格 |
|---|---|---|---|---|---|
| he-16 | **38px**/1.15，serif 500，`letter-spacing:-0.01em` | **26px** serif 500 | **19px** serif 500 | — | h1→h2 ≈ **1.46×**，h2→h3 ≈ **1.37×**；全 serif；h2 前有 mono 编号胶囊 `.num` |
| he-14 | **32px** serif 500 | **22px** serif 500，`margin:40px 0 14px`，`scroll-margin-top:24px` | 用 `<summary>` 16px serif 代替 | dt 16px serif | h1→h2 = **1.45×**；h2 上边距 40px 是页面主要节奏来源 |
| he-17 | **36px**/1.15 serif | **25px** serif，`margin-bottom:14px` | — | — | 1.44× |
| md-reader | **1.7em**（=27.2px@16）/1.4，700，下边框 2px | **1.4em**（22.4px），下边框 1px | **1.18em**（18.9px） | 1.05em | 1.21× / 1.19×；`margin:1.6em 0 .7em`，`scroll-margin-top:calc(56px + 16px)` |
| onedoc | **2.1rem = 33.6px**/1.2，`-0.025em` | **1.4rem = 22.4px**，`margin:44px 0 14px`，`padding-top:10px` | **1.13rem = 18.1px**，`30px 0 10px` | 0.98rem，`22px 0 8px` | 1.5× / 1.24×；h2 悬停显示 `#` 锚点；`scroll-margin-top:calc(56px+16px)` |
| xdossier | **38px**/1.18，display serif 600 | 语义块 h2 **24px**/1.2；节封面 `section-cover-title` **28px**、`section-cover-num` **54px** | 卡片 h3 17–18px | — | 1.58× / 1.33×；章节用「大号编号 + 标题」做封面；`section{margin-bottom:88px; scroll-margin-top:24px}` |
| am | 未确定 | 未确定 | 未确定 | 未确定 | 未确定 |
| Tailwind prose | **2.25em = 36px**，lh 40/36=1.111，mt 0，mb 0.889em | **1.5em = 24px**，mt **2em**，mb **1em**，lh 1.333 | **1.25em = 20px**，mt 1.6em，mb 0.6em，lh 1.6 | 1em，mt 1.5em，mb 0.5em，lh 1.5 | **1.5× / 1.2×** 严格等比；`h2+*,h3+*,h4+*{margin-top:0}`；`prose-lg` 档：18px/1.778，h1 48 / h2 30 / h3 24 |

### 1D. TOC 与当前章节高亮

| 项目 | 位置/粘性 | 宽度 | 生成方式 | 高亮技术 | 小屏 |
|---|---|---|---|---|---|
| he-14 | **左侧**，`position:sticky; top:32px; align-self:start` | 200px 栏 | **预先写死**在 HTML 里（含 `.l2` 二级、`Files read` 列表） | **无**（纯 `<a href="#id">`，无 JS 高亮） | <920px 直接隐藏 |
| he-17 | **右侧**，`sticky; top:32px`，左边框 1.5px | 240px 栏 | 预先写死 | **无** | <900px 隐藏 |
| he-16 | 无 TOC | — | — | — | — |
| md-reader | **左侧** fixed 全高侧栏（`top:56px; bottom:0`） | `--toc-w:288px` → 260 → 0 | **客户端生成**：`MD.parse()` 返回 `toc[]` 再渲染成 `#toc a`，按 `l1..l4` 缩进 24/38/52px | **滚动数学 + `getBoundingClientRect().top <= 90`**，`passive` 监听 + 120ms 去抖；同时把 active 链接 `scrollIntoView({block:'nearest'})`，并把章节名写进状态栏 | <768px 变 280px 抽屉 + 遮罩；`t` 键切换 |
| onedoc | **右侧** `sticky; top:56px` | `--toc-w:220px` | **客户端生成**：`buildToc()` 扫描当前 section 的 `h2,h3` | **滚动数学 + `getBoundingClientRect().top <= HEADER_OFFSET(88)`**，`passive` 滚动监听；无去抖 | ≤1100px `display:none`；仅收 h2/h3 |
| xdossier | **左侧** `sticky; top:32px; max-height:calc(100vh - 64px); overflow-y:auto` | 260px 栏 | **预渲染**在 HTML 内（`ol` + 编号列 `36px 1fr` grid），JS 只切 class | JS 按 `activeId` / `parentH2Id` 切换 `.active` 与 `.toc-section.is-current`（子级只对当前节点展开）；无 IntersectionObserver | ≤1024px → fixed 抽屉 320px + backdrop |
| am | 未确定 | 未确定 | 未确定 | 未确定 | 未确定 |
| Tailwind | 不提供导航组件 | — | — | — | — |

**共识点（硬事实）**：4 个有实现的项目里 **0 个用 IntersectionObserver**，全部用 `scroll` 事件 + `getBoundingClientRect().top <= 阈值`，阈值取 **88 / 90**，第二个用 **120ms 去抖**。

### 1E. 阅读位置辅助

| 项目 | 进度条 | 吸顶头部 | 当前章节名 | 回到顶部 | 其他 |
|---|---|---|---|---|---|
| he-14/16/17 | 无 | 无 | 无 | 无 | 只有 `html{scroll-behavior:smooth}`（he-12 也有） |
| md-reader | **有**：`#progress{position:fixed; top:56px; height:3px}`，`width` 过渡 80ms linear | 有：`#toolbar` 固定 56px | **有**：底部状态栏 `§ 章节名` | **有**：`scrollY > innerHeight*1.5` 时出现 | 按文档记忆滚动位置（localStorage，最多 200 条）；`j/k/g/G` 键；字号 / 行距 ±按钮 |
| onedoc | 无 | 有：`.site-header` sticky 56px + `backdrop-filter: saturate(140%) blur(8px)` | 无 | 无 | 面包屑 + 上/下一页 pager |
| xdossier | **有**：`.reading-progress{position:fixed; top:0; height:3px}` + `.reading-progress-fill{transition:width 80ms}` | 无（改用 `sticky; top:12px` 的阅读档位胶囊） | 无 | 无 | 阅读档位切换（beginner/intermediate/expert）本身就是最强的定位手段 |
| am | 未确定 | 未确定（成品页有可隐藏的 `.am-toolbar`） | 未确定 | 未确定 | — |

### 1F. 代码块

| 项目 | 背景 | 行号 | 换行 vs 横向滚动 | 复制按钮 | 字号/行高 |
|---|---|---|---|---|---|
| he-16 | **深色** `--slate #141413`，圆角 12px，padding `18px 20px` | 无 | **`white-space:pre` + `overflow-x:auto`** | 无 | `12.5px / 1.65` |
| he-14 | **浅色** `#fff` + 1.5px `--gray-300` 边框（3 个 tab 面板） | 无 | `overflow-x:auto` | 无 | `12.5px / 1.6` |
| he-12 | 深色 `--slate`，padding `18px 20px` | 无（用 `.diff-line.add/.del` 着色代替） | `white-space:pre` + `overflow-x:auto` | 无 | `13px / 1.7` |
| md-reader | **恒定深色**（light 主题 `#1e1e2e`，dark 主题 `#0f1115`，与页面主题解耦） | 无 | `overflow-x:auto` | **有**：`.copy` 绝对定位 `top:6px; right:8px`，语言标签 `right:74px` | `.86em`（≈13.8px）/ 1.6 |
| onedoc | 跟随主题（Solarized `--bg-code #eee8d5` / dark `#073642`） | 无 | `overflow-x:auto` | **有**：`.code-head` 头部条 + `Copy` 按钮（点击变 `Copied`，1.6s 复原） | `13.5px / 1.55` |
| xdossier | 浅色 `--code-bg #f4f2eb` + hairline 边框，圆角 6px，padding `18px 20px` | 无 | `overflow-x:auto` | **有**：`.code-copy` 30×30 绝对定位 | `12.5px / 1.6` |
| am | 未确定 | 未确定 | 未确定 | 未确定 | 未确定 |

### 1G. 表格

| 项目 | 横向溢出策略 | 表头 sticky | 字号 | 响应式 |
|---|---|---|---|---|
| he-16 | 不是 `<table>`，是 `div` grid：`1.6fr 90px 1.6fr` | 无 | `13.5px`（单元格 `14px 18px`） | <780px 变 1 列，`border-left` 换 `border-top:1px dashed` |
| he-12 | 真 `<table>`：`border-collapse:separate; border-spacing:0; max-width:460px` | 无 | `14px`（`12px 18px`） | 无 |
| md-reader | `.tbl-wrap{overflow:auto; max-height:480px}` | **有**：`#content th{position:sticky; top:0; z-index:1}` | `.9em` | 容器滚动；**打印时 `max-height:none; overflow:visible`** |
| onedoc | `.content table{display:block; overflow-x:auto}`（**始终**块级滚动，桌面也如此） | 无 | `14px` | 无专门断点 |
| xdossier | `<768px`: `display:block; overflow-x:auto`；`≥768px`: `display:table; overflow-x:visible` | 无 | `14px`；`th` 11.5px 大写字距 .05em | 显式媒体查询切换 `display` |
| am | 未确定 | 未确定 | 未确定 | 未确定 |
| Tailwind prose | 不管溢出 | 无 | `0.875em`（14px），lh 24/14 | — |

### 1H. 颜色系统 / 正文对比度 / 暗色模式 / 打印

| 项目 | 颜色 var 数量 | 正文对比度（computed） | Callout/着色背景 | 暗色模式实现 | 默认跟随系统？ | 打印 CSS |
|---|---|---|---|---|---|---|
| he-16 | 10 个 var + 5 个字面 hex | `#3D3D3A` on `#FAF9F5` ≈ **10.3:1** | `--gray-150` 面板、`border-left:4px solid --clay`、`.sev.high #F3D9CC/#8A3B1E` | **无** | — | **无** |
| he-14 | 10 个 var | ≈ **10.3:1** | `.callout{background:rgba(227,218,204,.35); border:1.5px solid --oat}` | **无** | — | **无** |
| md-reader | 13 个 var × 3 套主题（light / eye / dark） | light `#0F172A` on `#FFF` ≈ **17.9:1** | `--accent-soft`（`#DBEAFE`）做 TOC/表格 hover、AI 卡 | `html[data-theme="dark"]` 覆盖 CSS var；**3 档主题**（含「护眼」） | **否**：`prefs.theme:'eye'` 硬编码默认；全文件**无** `prefers-color-scheme` | **有**（完整）：强制 `--bg:#fff; --fg:#111`，隐藏 `#toolbar/#sidebar/#digest/#progress/#statusbar/#back-top/.h-fold/.code-wrap .copy`，`.tbl-wrap{max-height:none!important; overflow:visible!important}`，`th{position:static}`，`h1,h2{break-after:avoid}`，`.tbl-wrap,.code-wrap,blockquote{break-inside:avoid}`，`details.ai-noise{display:none!important}` |
| onedoc | 13 个 light + 10 个 dark 覆盖 + 7 个语法色 | `#586E75` on `#FDF6E3` ≈ **5.0:1**（Solarized 原色，偏灰） | `.note/blockquote`: `color-mix(in srgb, var(--accent) 7%, transparent)` + 28% 边框 | `:root[data-theme="dark"]` | **是**：JS `localStorage 'onedoc-theme'` → 否则 `matchMedia("(prefers-color-scheme: dark)")` → 写 `data-theme` | **有**（完整）：`:root, :root[data-theme="dark"]` 全部重设为黑白，隐藏 header/sidebar/toc/pager/code-head，`.layout{display:block}`，`pre,table,img,blockquote{break-inside:avoid}` |
| xdossier | 14 个 var（含 `--warn-soft/--ok-soft`） | `#1a1a1a` on `#faf9f6` ≈ **16.5:1** | `.callout.analogy{#eef2ff}`、`--accent-soft #f5e9e3` 做 TOC active | **无**（换成 `html[data-reader]` / `html[data-content-mode]` 两个数据属性） | — | **未找到**（`@media print` 在该 149KB 文件里 0 命中） |
| am | 未确定（主题是外部 JSON：`marketplace/themes/*.json`，如 `anthropic-clay.json` 14.4KB） | 未确定 | 未确定 | `data-theme`（blueprint/shadcn）+ `data-mode`（light/dark）双属性；营销站另有 `localStorage 'am-site-mode'` → `prefers-color-scheme` 兜底 | 成品页未确定；营销站**是** | 未确定 |
| Tailwind prose | 2 组语义 token（`--tw-prose-*` 28 个 + `-invert-*`） | slate-700 on white（≈10:1 量级，未逐个算） | 无内置 callout | `prose-invert` class（非媒体查询） | 否 | 无 |

### 1I. 体积与内联情况

| 项目 | 代表性成品体积 | 外链字体/图片 | JS 预算 |
|---|---|---|---|
| he-14 | **12,330 B**（≈12 KB） | 无（`<style>` 内联，无 `<link>`、无 `@font-face`） | **≈10 行 tab 切换脚本** |
| he-16 | **28,635 B** | 无 | 未读到 `<script>`（只读前 12KB 正文，**未完全确认**） |
| he-17 | **24,463 B** | 无 | 未完全确认 |
| he-index（20 个样张的索引页） | **38,912 B**（raw 模式实测） | 无；缩略图是**内联 SVG**（`.thumb svg .st{stroke:var(--g500)}` 等） | 无 scrollspy |
| md-reader | **80,074 B**（GitHub blob 实测；仓内 badge 自述 77KB） | **零外链**：CSP `default-src 'none'; connect-src 'none'`，注释明确「V1.6.1 移除 Inter webfont」 | 整文件含 CSS + markdown 解析器 + 搜索 + 阅读器逻辑，**未单独拆分测量**（可选外挂 `_md_bundle.js` 只装数据） |
| onedoc | 成品未测量 | 无（CSS/JS 内联进单文件，`templates/` + `assets/` 编译期 embed 进 Go 二进制） | `assets/docs.css` = **19,679 B**；`assets/docs.js` 未单独测字节 |
| xdossier | **152,820 B / 4,043 行**（`demo/pedagogy.html` raw 实测） | **无 `@font-face`、无外链**（字体全走本机回退链） | 内联（TOC 高亮 + 进度条 + 档位切换 + 弹窗），未单独拆分 |
| am | 未确定 | 未确定 | 未确定（CLI 运行 ~50ms，自述） |

### 1J. 渐进式披露（折叠）及其对 Ctrl+F / 打印的影响

| 项目 | 折叠机制 | Ctrl+F 影响 | 打印影响 |
|---|---|---|---|
| he-14 | 原生 `<details>/<summary>`，4 步里**第 1 步 `open`**，`summary::before` 用 `▸` + `rotate(90deg)` | **受影响**（inference）：关闭的 `<details>` 内容在 Chrome 查找里不可见/不可达 | **受影响**：无 `@media print`，打印出来的就是折叠态 → 步骤 2–4 全丢 |
| md-reader | `h2/h3` 悬停出现折叠按钮，折叠后 `.fold-hidden{display:none!important}`；另有「人读模式」把 AI 向内容包成 `<details class="ai-noise">` 并可批量 `open` | **受影响**（inference）：`display:none` 内容不参与查找 | **有真实风险**（inference）：打印 CSS 只处理 `details.ai-noise{display:none}`，**没有** `@media print{.fold-hidden{display:revert}}` → 被折叠的章节在 PDF 里直接消失 |
| onedoc | 每个文档是 `<section class="doc-section" hidden>`，由 hash router 显示一个 | **受影响**（inference）：`.doc-section[hidden]{display:none}` → 其他文档正文不可查找，与 README 宣称的「browser find searches everything at once」**矛盾** | 打印只出当前路由的那一篇（CSS 注释明写这是设计意图）；`<noscript>` 会把全部内容展开成一篇长页 |
| xdossier | 三档阅读模式，用 `html[data-reader="…"] [data-detail-level="…"]{display:none}` 隐藏教学层（prereq/analogy/checkpoint/section-summary）；术语弹窗是纯 CSS tooltip（`:hover`/`:focus`，无 JS） | **受影响**（inference），但语义上被隐藏的是「这一档读者不需要」的内容，可接受 | **未找到** `@media print`（inference：能打印，但会按当前档位的显隐状态打印） |
| he-16 | 无折叠 | — | — |
| Tailwind | 不涉及 | — | — |

---

## 2. 他们一致同意的（事实层面的 de-facto 共识）

1. **body 16px、行高 1.55–1.75**。实测：he-14 15/1.65、md-reader 16/1.85、onedoc 16/1.65、xdossier 16/1.72、Tailwind 16/1.75。15px 只出现在「工具外壳」或紧凑报告里（md-reader chrome、he-14）。
2. **正文列 680–800px，典型 760–800px**：he `p{max-width:680px}`、he-16 `.page-head 820px`、md-reader 800、onedoc 780、xdossier 760。1100–1240px 的容器宽度只在**有侧栏**时出现，且正文仍然靠 `max-width` 收窄。
3. **5/5 单文件实现都不用 webfont**，一律 `system-ui / -apple-system` + 本地 mono 回退；md-reader 与 xdossier 的注释/类名里能看到「为守离线而删掉字体导入」的痕迹。
4. **h1→h2 约 1.45–1.5×，h2→h3 约 1.2–1.4×**。绝对值收敛在 **h1 32–38px、h2 22–26px、h3 18–20px**。Tailwind 给出最严格的等比序列 36/24/20（1.5 / 1.2）。
5. **h2 的上外边距是页面唯一的大节奏**：30–48px（he-14 40px、onedoc 44px、Tailwind 2em=48px、xdossier `section{margin-bottom:88px}`）。段落下边距则统一很小：**12–16px**。
6. **代码块横向滚动、不换行、没有行号**（5/5）。外壳 12px 圆角、padding 16–20px，字号 **12.5–13.5px / 行高 1.55–1.7**。复制按钮 3/5（md-reader、onedoc、xdossier）。深色代码块是主流（he-16、he-12、md-reader 恒定深色），浅色只是 Solarized / 打印友好取向。
7. **表格一律「外层可滚动容器 + 13.5–14px 字号」**，sticky 表头只有 md-reader 做（并且它在打印时主动关掉）。
8. **一个强调色 + 一套暖中性灰**：clay `#D97757`、蓝 `#268BD2`/`#1E3A8A`、accent `#2563EB`。着色块一律走低透明度或 `-soft` token（`rgba(227,218,204,.35)`、`color-mix(...7%)`、`--accent-soft`）。
9. **TOC = 侧边 sticky 栏，1100px 以下直接隐藏或转抽屉**，从不做顶部横向标签。`scroll-margin-top` 取 **24px** 或 **header 高度 + 16px**。
10. **scrollspy 用「scroll 事件 + `getBoundingClientRect().top <= 88~90`」，没人用 IntersectionObserver**。
11. **打印 CSS 是可选项但一旦做就做全套**：强制浅色、隐藏全部 chrome、`break-inside:avoid`（md-reader、onedoc 都完整；he 全系没有）。
12. **成品体积 12–80KB 是常态**（he 12–29KB、md-reader 80KB、xdossier 149KB），前提是字体不内联、图片用内联 SVG。

---

## 3. 他们互相矛盾的（taste calls，需要你拍板）

| 议题 | 分歧 | 各自证据 |
|---|---|---|
| TOC 在左还是右 | 左：he-14、md-reader、xdossier；右：he-17、onedoc | 见 1D |
| 标题用 serif 还是 sans | serif：he 全系、xdossier（`--font-display: Charter, Georgia`）；sans：onedoc、md-reader | 见 1B/1C |
| 暗色默认值 | 跟系统：onedoc；**默认「护眼绿」**（`#064E3B` on `#ECFDF5`）：md-reader；完全不提供：he 全系、xdossier | 1H |
| 暗色开关机制 | `prefers-color-scheme` + localStorage → `data-theme`（onedoc）；只 `data-theme` + localStorage（md-reader）；`data-theme` + `data-mode` 双属性（am）；`data-reader` 语义档位代替（xdossier） | 1H |
| 行高 | 1.55（he-16/17）vs **1.85**（md-reader 默认，可 ± 调节） | 1B |
| measure 用 ch 还是 px | 只有 Tailwind 用 `65ch`；其余全是 px | 1A |
| h1 尺寸 | 27.2px（md-reader 1.7em）→ 38px（he-16、xdossier） | 1C |
| 表格是否始终横向滚动 | onedoc 桌面也 `display:block; overflow-x:auto`；xdossier 在 ≥768px 显式切回 `display:table` | 1G |
| 折叠的语义 | 原生 `<details>`（he-14）、标题级折叠按钮 + `display:none`（md-reader）、读者档位（xdossier）、路由器隐藏（onedoc） | 1J |
| 进度条 | 只有 2/5 有（md-reader 3px 在工具栏下、xdossier 3px 在窗口顶） | 1E |
| 是否记忆阅读位置 | 只有 md-reader 做（localStorage，200 条上限） | 1E |

---

## 4. 给我的建议取值（**这是我的推断/推荐，不是任何来源的原话**）

```
--measure: 780px;              /* md-reader 800 / onedoc 780 / xdossier 760 的中点 */
--body: 16px; --lh: 1.65;      /* 3/5 项目的组合 */
p { margin: 0 0 14px }         /* he-12 14px、onedoc 16px、md-reader 14.4px */
h1 34px / 1.2 ; h2 24px (mt 40px, mb 12px) ; h3 19px (mt 28px, mb 8px)   /* 1.42 / 1.26 */
code 13px / 1.6 ; pre{overflow-x:auto; white-space:pre} ; 无行号 ; 复制按钮
table{font-size:13.5px} inside .tbl-wrap{overflow:auto}
TOC: 左侧 sticky 240–260px，<1100px 隐藏；scrollspy = scroll + rect.top <= 88，120ms 去抖
progress: 3px 顶部条（成本 20 行 CSS + 3 行 JS，md-reader 与 xdossier 都做了）
print: 必做——强制浅色 + 隐藏 chrome + 展开 .tbl-wrap + break-inside:avoid
禁止: webfont、外链图片、IntersectionObserver 依赖
```
关于折叠的结论（inference，但很重要）：**任何用 `display:none` 实现的折叠都会同时破坏 Ctrl+F 和打印**。若必须做，抄 md-reader 的双保险思路，但补上它漏掉的一步：在 `@media print` 里把折叠容器重新 `display:revert`，并在页顶给一个「全部展开」按钮。

---

## 5. 矛盾与存疑（必须记录，不能悄悄抹平）

1. **onedoc README 声称「browser find (Ctrl/Cmd + F) searches everything at once」，但同一份 CSS 里写着 `.doc-section[hidden] { display: none }`。** 隐藏 section 里的文字在 Chrome 的页内查找中不可达。我相信 CSS 而非 README（标为 inference，未在浏览器实测）。README 同时提到的 `<noscript>` 全展开是另一回事。
2. **md-reader 的打印 CSS 没有把标题折叠（`.fold-hidden`）展开**；它只处理 `details.ai-noise` 与 `.tbl-wrap`。也就是说「折叠章节 → 导出 PDF 会缺章」（inference，基于 CSS 无对应规则）。
3. **md-reader 默认主题是「护眼」(`prefs.theme:'eye'`)，不是系统主题也不是白色**；但它对外宣传写的是「Light — clean white background」。这是默认值 vs 宣传口径的矛盾，以代码为准。
4. **onedoc 的正文字对比度 ≈5.0:1**（Solarized `#586E75` on `#FDF6E3`，computed）— 对「非技术同事在地铁上看」这个场景偏低；其他四个项目都在 10:1 以上。
5. **xdossier 的档位隐藏是 `display:none`**，因此「新手档」的 Ctrl+F 搜不到专家档才有的深度内容。这是设计意图还是副作用，源码没说明。

## 6. 未能确定的（Missing evidence）

- **answer-me-with-html 的全部排版数字**：measure、字号、行高、代码块、表格、打印 CSS 都未确定。其渲染器是一个打包过的 `scripts/am.mjs`（自述「generated by scripts/build.mjs, do not edit」），仓库里没有可读的独立样式表；`docs/demo/demo.html` 是宣传动画页，不是成品页。已确认的只有主题机制：成品 `<html>` 上同时有 `data-theme`（`blueprint`/`shadcn`）与 `data-mode`（`light`/`dark`），并且每份成品页自带一个 `.am-toolbar`（见 `docs/demo/demo.html` 里的 `prep()` 函数）。
- **xdossier 的段落间距、h3/h4 具体像素**：只读到 `main`/`section`/卡片级规则，通用 `main p` 未定位。
- **onedoc `docs.js` 的字节数**、以及一份真实成品 HTML 的总重量。
- **md-reader 里 CSS / JS / markdown 解析器各自占多少 KB**（只知道整文件 80,074 B）。
- **he-16 / he-17 是否有 `<script>`**：只读了前 12KB，未读到 `</body>`，故不做断言。
- **Stripe / Linear / GitHub Primer / MDN 的官方字阶**：时间预算内未取（它们的 CSS 是编译产物，提取成本高于收益）。本报告用 **Tailwind Typography `prose` 的 `src/styles.js`** 作为「被公开记录的字阶基准」，它的数字是源码里的 `rem()/em()` 调用，可直接复算。
- **Tailwind `65ch`** 我没能在 `src/styles.js` 的 base 块里直接看到 `maxWidth`（该切片只显示 `fontSize` 起头），所以这一格是「公开生成物报告 + 官方 `max-w-none` 覆盖说明」的二手证据，标 **medium** 置信度。

## 7. 来源

**保留（直接读了源码）**
- `anthropics/html-effectiveness` — `16-implementation-plan.html`、`14-research-feature-explainer.html`、`17-pr-writeup.html`、`12-incident-report.html`、`index.html`（https://github.com/anthropics/html-effectiveness ，镜像 https://thariqs.github.io/html-effectiveness/）— 20 个单文件样张里最像「长文档」的四份，CSS 全部内联可读。
- `andersyin/md-reader` — `md-reader.html`（https://github.com/andersyin/md-reader/blob/main/md-reader.html）— 唯一同时具备 TOC scrollspy + 全文搜索 + 折叠 + 完整打印 CSS 的样本，JS 与 CSS 都可读。
- `gnikyt/onedoc` — `assets/docs.css`、`assets/docs.js`、`templates/layout.tmpl`、`README.md`（https://github.com/gnikyt/onedoc/blob/master/assets/docs.css ，注意默认分支是 **master**，`main` 会 404）— 唯一「多文档 → 单文件 + 路由」样本，且打印 CSS 注释写明了设计意图。
- `xianfeng92/xdossier` — `demo/pedagogy.html`（https://xianfeng92.github.io/xdossier/demo/pedagogy.html）— 三档阅读模式 + 术语弹窗的真实成品页，152KB 全内联。
- `tailwindlabs/tailwindcss-typography` — `src/styles.js`（https://github.com/tailwindlabs/tailwindcss-typography/blob/main/src/styles.js）— 数字最干净的字阶基准（`rem()/em()` 可复算）。
- `QingYunA/answer-me-with-html` — `docs/demo/demo.html`、`README`、issue/theme 目录（https://github.com/QingYunA/answer-me-with-html）— 只用来确认主题属性机制，排版未取到。

**降级 / 排除**
- `thariqs.github.io/html-effectiveness` 首页本身 — 是画廊索引，不是长文档样本；仅用它取「38,912 B + 内联 SVG」这一条体积证据。
- `xianfeng92.github.io/xdossier/`（营销落地页）— 有 880px `main`、16px/1.6、`JetBrains Mono` h1 56px，但那是官网不是渲染器输出，**未计入对比表**。
- `answer-me-with-html.com`（营销站）— 只取「`prefers-color-scheme` + localStorage」这一条机制证据，样式不具代表性。
- `craig7351/bookMDViewer`、`Jefsky/markdown-viewer`、`md-reader.github.io` — 搜索结果里的同名/近似项目，与 `andersyin/md-reader` 无关，丢弃。

## 8. 下一步（若还要再补）

1. 解包 `am.mjs`（`scripts/build.mjs` 产出的 bundle）里内联的模板字面量 CSS，补齐 answer-me-with-html 的 measure / 字阶 / 代码块 —— 这是本报告唯一的整列空白。
2. 在 Chrome 里实测一次「onedoc 隐藏 section 能否被 Ctrl+F 命中」，把第 5 节第 1 条的 inference 变成实测结论（这直接决定我们要不要抄它的路由方案）。
3. 若要一个权威外部参照，抓 GitHub Primer 的 `primer-markdown` / `@primer/css` 的 `markdown-body` 规则（有明确 px 值，比 Stripe/Linear 的编译产物好提取）。
