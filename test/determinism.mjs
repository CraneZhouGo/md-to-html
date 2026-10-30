// 守门测试（ADR-0005 / ADR-0002）：
// 1) 同一真源 + 无偏好 => 逐字节相同
// 2) 产物零网络依赖（无 <link>、无 @font-face、无外链 script）
// 3) 目录与导航是静态写入的（不依赖 JS 生成）
// 4) 图形化不得吞掉文字：正文里的每个标题文本都必须出现在产物里
import { readFile, writeFile, mkdtemp, mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFile } from '../src/render.mjs';
import { renderMarkdown, splitFrontMatter } from '../src/markdown.mjs';
import { escapeHtml } from '../src/template.mjs';
import { highlight } from '../src/highlight.mjs';

const FIXTURE = new URL('../.scratch/html-vs-md/research.md', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failures++;
};

const dir = await mkdtemp(join(tmpdir(), 'md2html-'));
try {
  const a = await renderFile(FIXTURE, { outDir: join(dir, 'a') });
  const b = await renderFile(FIXTURE, { outDir: join(dir, 'b') });
  const ha = createHash('sha256').update(await readFile(a.outHtml)).digest('hex');
  const hb = createHash('sha256').update(await readFile(b.outHtml)).digest('hex');
  ok('无偏好时输出逐字节一致', ha === hb, `${ha} != ${hb}`);

  const html = await readFile(a.outHtml, 'utf8');
  ok('无外链样式表', !/<link[^>]+rel=["']?stylesheet/i.test(html));
  ok('无网络字体', !/@font-face|fonts\.googleapis/i.test(html));
  ok('无外链脚本', !/<script[^>]+src=/i.test(html));
  ok('无打印样式（ADR-0004）', !/@media\s+print/i.test(html));
  ok('目录静态写入（不靠 JS 生成）', /class="toc-list" id="tocList">\s*<li class="toc-group"/.test(html));
  ok('导航静态写入', /class="nav-list" id="navList">\s*<li><a /.test(html));
  // 左右两栏分工：左 = 章节(h2)，右 = 小节(h3)分组，不得互相重复
  const navHrefs = [...html.matchAll(/id="navList">([\s\S]*?)<\/ul>/g)][0][1].match(/href="#([^"]+)"/g) || [];
  const firstGroup = [...html.matchAll(/class="toc-group" data-owner="([^"]+)"/g)].map(m => m[1]);
  // 导航与目录必须单行 + 省略号 + 悬停看全文，不得换行撑高
  const navBlock = /id="navList">([\s\S]*?)<\/ul>/.exec(html)[1];
  const tocBlock = /id="tocList">([\s\S]*?)<\/ul>\s*<\/aside>/.exec(html)[1];
  const navAs = [...navBlock.matchAll(/<a\s[^>]*>/g)].map(m => m[0]);
  const tocAs = [...tocBlock.matchAll(/<a\s[^>]*>/g)].map(m => m[0]);
  ok('左栏每条都有 title（悬停看全文）', navAs.length > 0 && navAs.every(a => /\stitle="/.test(a)));
  ok('右栏每条都有 title（悬停看全文）', tocAs.length > 0 && tocAs.every(a => /\stitle="/.test(a)));
  ok('导航与目录单行省略（不换行）',
    (html.match(/text-overflow:ellipsis/g) || []).length >= 3 &&
    /\.nav-text\{[^}]*white-space:nowrap/.test(html) &&
    /\.toc-list a\{[^}]*white-space:nowrap/.test(html));
  ok('左栏条目与右栏分组一一对应（不重复也不漏）',
    navHrefs.length === firstGroup.length &&
    navHrefs.every(h => firstGroup.includes(h.replace('href="#', '').replace('"', ''))),
    `${navHrefs.length} vs ${firstGroup.length}`);
  // 真源只有一份：输出目录不留 .md 副本，页顶「原始 .md」出口指回真源
  const copies = (await readdir(join(dir, 'a'))).filter(f => f.toLowerCase().endsWith('.md'));
  ok('输出目录不复制 .md 副本', copies.length === 0, copies.join(', '));
  const srcHref = (/href="([^"]+)" title="查看原始 Markdown"/.exec(html) || [])[1] || '';
  const target = srcHref.startsWith('file:')
    ? fileURLToPath(srcHref)
    : resolve(join(dir, 'a'), decodeURIComponent(srcHref));
  ok('「原始 .md」出口指向真源',
    resolve(target).toLowerCase() === resolve(FIXTURE).toLowerCase(), srcHref);
  // 双重偏移回归：scroll-padding 与 scroll-margin 相加会让跳转落点偏一格，
  // 高亮随即判给上一节（点下面、弹回上面）
  // 强调色可自定义：色板 + 自定义取色 + 恢复默认，且只存本机（不写进文件）
  // 代码块底色必须跟随强调色与主题，不能是写死的黑
  ok('代码块底色由强调色推导', /--code-bg:color-mix\(in srgb, var\(--accent\)/.test(html));
  ok('没有写死的黑色代码块底', !/--code-bg:#[0-9a-f]{3,8}/i.test(html));
  ok('代码文字用主题前景色', /--code-text:var\(--text\)/.test(html));
  ok('顶栏有强调色入口', /id="toneBtn"/.test(html));
  ok('色板提供多个预设', (html.match(/class="tone-sw"/g) || []).length >= 5);
  ok('支持自定义取色', /type="color" id="toneInput"/.test(html));
  ok('支持恢复默认', /id="toneReset"/.test(html));
  ok('强调色只存 localStorage', /md2h-accent/.test(html));
  // 默认 --accent 写在 :root 里是正常的；不该出现的是「渲染时把某个人的颜色烧进产物」
  ok('无偏好时产物不含烧进文件的强调色覆盖', !/<html[^>]*style="[^"]*--accent/.test(html));
  ok('不同时设置 scroll-padding-top 与 scroll-margin-top',
    !(/scroll-padding-top/.test(html) && /scroll-margin-top/.test(html)));

  const src = await readFile(FIXTURE, 'utf8');
  const { body } = splitFrontMatter(src);
  const { headings } = renderMarkdown(body);
  // 标题文本在 HTML 里是转义过的，比较转义后的形态
  const missing = headings.filter(h => !html.includes(escapeHtml(h.text))).map(h => h.text);
  ok('所有标题文本都在产物里（图形化不得吞字）', missing.length === 0, missing.slice(0, 3).join(' | '));

  // ---- 图片内联（--embed）自检 ----
  const fix3 = new URL('./fixtures/embed.md', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1');
  const plainOut = await renderFile(fix3, { outDir: join(dir, 'e1') });
  const plainHtml = await readFile(plainOut.outHtml, 'utf8');
  ok('默认不内联', !/data:image/.test(plainHtml) && /src="assets\/dot\.png"/.test(plainHtml));

  const embOut = await renderFile(fix3, { outDir: join(dir, 'e2'), embed: true });
  const embHtml = await readFile(embOut.outHtml, 'utf8');
  ok('内联了 png/svg/jpg 三种', ['image/png', 'image/svg+xml', 'image/jpeg']
    .every(t => embHtml.includes('data:' + t)));
  ok('同一张图多处引用都替换', (embHtml.match(/data:image\/png;base64,/g) || []).length === 2);
  ok('外链图片不内联', /src="https:\/\/example\.com\/remote\.png"/.test(embHtml));
  ok('缺失文件保留原链接', /src="assets\/missing\.png"/.test(embHtml));
  ok('不支持的扩展名不内联', /src="assets\/weird\.bin"/.test(embHtml));
  ok('内联报告与实际一致', embOut.embed.inlined.length === 3 && embOut.embed.skipped.length === 3);

  const emb2 = await renderFile(fix3, { outDir: join(dir, 'e3'), embed: true });
  const h1x = createHash('sha256').update(await readFile(embOut.outHtml)).digest('hex');
  const h2x = createHash('sha256').update(await readFile(emb2.outHtml)).digest('hex');
  ok('内联后仍逐字节可复现', h1x === h2x);

  // ---- 个性化 profile（ADR-0005 的核心断言）----
  const profPath = join(dir, 'profile.json');
  await writeFile(profPath, JSON.stringify({
    accent: '#0b6bcb', content: '820px', fontSize: '17px',
    readerName: '张三', theme: 'dark', unknownKey: 'should-be-ignored',
  }), 'utf8');
  const prof1 = await renderFile(FIXTURE, { outDir: join(dir, 'p1'), profilePath: profPath });
  const prof2 = await renderFile(FIXTURE, { outDir: join(dir, 'p2'), profilePath: profPath });
  const pHtml = await readFile(prof1.outHtml, 'utf8');
  ok('profile: accent 覆盖生效', /--accent:#0b6bcb/.test(pHtml));
  ok('profile: 未知键被忽略', !/should-be-ignored/.test(pHtml));
  const badPath = join(dir, 'bad.json');
  await writeFile(badPath, JSON.stringify({ theme: 'blue' }), 'utf8');
  const badOut = await renderFile(FIXTURE, { outDir: join(dir, 'b1'), profilePath: badPath });
  const badHtml = await readFile(badOut.outHtml, 'utf8');
  ok('profile: 非法 theme 被丢弃',
    /<html lang="zh-CN" data-theme="light">/.test(badHtml) && !/data-theme="blue"/.test(badHtml));
  ok('profile: readerName 生成"个性化副本"标记', /个性化副本 · 张三/.test(pHtml));
  ok('profile: 带 profile 仍逐字节可复现',
    createHash('sha256').update(await readFile(prof1.outHtml)).digest('hex') ===
    createHash('sha256').update(await readFile(prof2.outHtml)).digest('hex'));
  ok('无 profile 时不写 profile 覆盖块', !/\/\* profile \*\//.test(html));

  // 控制字符守门：Python/shell 转义曾把 「退格符」 写进源码变成退格符，正则静默失效
  const hasCtrl = t => [...t].some(ch => {
    const c = ch.codePointAt(0);
    return c < 32 && c !== 9 && c !== 10 && c !== 13;
  });
  ok('产物不含控制字符', !hasCtrl(embHtml) && !hasCtrl(html));
  const fix2 = new URL('./fixtures/features.md', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1');
  const f2 = await renderFile(fix2, { outDir: join(dir, 'f2') });
  const h2 = await readFile(f2.outHtml, 'utf8');
  ok('note 提示块', /class="callout note"/.test(h2));
  ok('warning 提示块', /class="callout warning"/.test(h2));
  ok('danger 提示块', /class="callout danger"/.test(h2));
  ok('无语义引用保持 blockquote', /<blockquote>/.test(h2));
  ok('数值列右对齐', /class="num(?:\s|\")/.test(h2));
  // 数值表：3 个数值列 × 3 行 = 9；文本列一个都不该被标
  ok('文本单元格不被标成数值', !/<td class="num(?: bar)?"[^>]*>(?:正常|回落|第一条|HTML 更适合 LLM)</.test(h2));
  ok('数值单元格确实带数值标记', /<td class="num[^"]*"[^>]*>16,180</.test(h2));
  // 确定性图形化（ADR-0006）
  ok('两列表 -> 对比卡片', /class="cmp-grid"/.test(h2) && /class="cmp-card"/.test(h2));
  ok('三列表保持表格（对比矩阵不卡片化）',
    /<table>[\s\S]{0,400}对比矩阵不该被卡片化/.test(h2) || /对比矩阵不该被卡片化[\s\S]{0,600}<\/table>/.test(h2));
  ok('列表 -> 定义卡片', /<dl class="defs">/.test(h2));
  ok('有序列表 -> 步骤流', /<ol class="steps">/.test(h2) && /class="step-n"/.test(h2));
  // 数值列条形图（ADR-0006 P0 后半段）
  const f3 = await renderFile(fix2, { outDir: join(dir, 'bar') });
  const h3 = await readFile(f3.outHtml, 'utf8');
  ok('数值列画出条形并按列内最大值归一',
    /--w:100%/.test(h3) && /--w:72%/.test(h3) && /--w:43%/.test(h3));
  ok('有条形的表保留为表格（不被卡片化）',
    /<td class="num bar"/.test(h3) && !/class="cmp-grid"[\s\S]{0,200}Q4/.test(h3));
  ok('序号列不画条', !/--w:33%/.test(h3));
  ok('条形宽度都在 0-100 之间', [...h3.matchAll(/--w:(\d+)%/g)]
    .every(m => Number(m[1]) >= 0 && Number(m[1]) <= 100));
  ok('条形不吞数字原文', /16,180/.test(h3) && /22,600/.test(h3));

  ok('<!-- md: table --> 可强制保留表格', /<table>/.test(h2));
  ok('<!-- md: no-visual --> 可关闭图形化',
    /这一条不应被转成定义卡片/.test(h2) && /class="defs">[\s\S]*恢复/.test(h2.split('这一条不应被转成定义卡片')[1] || ''));
  ok('图形化后文字仍完整',
    ['真源', '阅读面', '制品', '解析 markdown', '输出单文件 HTML'].every(t => h2.includes(t)));
  // ASCII 架构图：按图示排版（文字仍是文字，可搜可复制）
  // mermaid 子集（ADR-0009）
  ok('mermaid 流程图', /data-diagram="flow"/.test(h2) && /<text class="dg-text"[^>]*>Nginx<\/text>/.test(h2));
  ok('mermaid 时序图', /data-diagram="sequence"/.test(h2) && /class="dg-lifeline"/.test(h2));
  ok('mermaid 状态机', /data-diagram="state"/.test(h2) && /class="dg-dot"/.test(h2));
  ok('mermaid ER 图', /data-diagram="er"/.test(h2) && /places/.test(h2) && /0\.\.N/.test(h2));
  ok('mermaid 类图（含继承与基数）',
    /data-diagram="class"/.test(h2) && /places/.test(h2) && /dg-tri/.test(h2));
  ok('用例图（本项目扩展语法 usecase）',
    /data-diagram="usecase"/.test(h2) && /class="dg-actor"/.test(h2) && /class="dg-box dg-usecase"/.test(h2));
  ok('排期图（甘特）',
    /data-diagram="gantt"/.test(h2) && /class="dg-bar"/.test(h2) && /2026-01/.test(h2));
  ok('排期图缺 dateFormat 时退回代码块',
    /<pre data-lang="mermaid"><code>gantt[\s\S]{0,80}没写日期格式/.test(h2));
  ok('不支持的 mermaid 语法原样退回代码块',
    /<pre data-lang="mermaid"><code>sequenceDiagram/.test(h2) && /这一段还不支持/.test(h2));
  ok('mermaid SVG 内无外链与脚本',
    [...h2.matchAll(/data-diagram="[^"]+">(<svg[\s\S]*?<\/svg>)/g)].every(m => !/href=|xlink|script/i.test(m[1])));

  // 新增两种 ASCII 形状（第二份真实文档暴露出来的）
  ok('分支带箭头（Master ├──→ Replica）',
    /<text class="dg-text"[^>]*>Replica1<\/text>/.test(h2) &&
    (h2.match(/data-diagram="layered"/g) || []).length >= 3);
  ok('多行映射（A → B）画成映射图',
    /data-diagram="mapping"/.test(h2) && /增加 Replica/.test(h2));
  ok('散文式箭头块保持普通代码块（不进图示）',
    /<pre data-lang="text"><code>Redis 为了避免单点/.test(h2));

  // 图示 -> SVG（文字仍是 <text>，可搜可选中）
  const svgFigs = (h2.match(/data-kind="svg"/g) || []).length;
  ok('四种写法都画成 SVG', svgFigs >= 4, String(svgFigs));
  ok('SVG 里的文字是真文本节点',
    /<text class="dg-text"[^>]*>Nginx<\/text>/.test(h2) && /<text class="dg-text"[^>]*>Harbor<\/text>/.test(h2));
  ok('识别不了的一律退回文本图示',
    /data-kind="ascii"/.test(h2) && /Redis Session/.test(h2));
  ok('SVG 不含外链与脚本', !/<svg[^>]*(href|script)/i.test(h2.match(/<svg[\s\S]*?<\/svg>/)?.[0] || ''));
  ok('图示宽度不超过正文列', [...h2.matchAll(/<svg class="dg"[^>]*width="(\d+)"/g)]
    .every(m => Number(m[1]) <= 820));
  ok('ASCII 架构图包成 figure.diagram',
    (h2.match(/<figure class="diagram" data-kind="ascii">/g) || []).length >= 1);
  ok('图示文字原样保留', /Nginx \/ 负载均衡器/.test(h2) && /单体实例 N/.test(h2));
  ok('命令行文本不会被误判成图示',
    !/class="diagram"[^>]*>(?:(?!<\/figure>)[\s\S]){0,400}npm install/.test(h2));
  ok('图示收紧行高（竖线才接得上）',
    /figure\.diagram pre\{[^}]*line-height:1\.16/.test(html));
  // 语法高亮：有 token 分类、转义安全、配色不含写死的十六进制
  ok('js 代码块有高亮 token', /class="tok-kw">const<\/span>/.test(h2));
  const inj = highlight('const s = "<script>alert(1)</script>";', 'js');
  ok('高亮后仍正确转义（不注入标签）',
    !/<(?!\/?span)/.test(inj.html) && /&lt;script&gt;/.test(inj.html));
  ok('未知语言退回纯文本', highlight('<b>x</b>', 'unknown-lang').highlighted === false);
  ok('sql 关键字大小写都能识别',
    /tok-kw">select</.test(highlight('select 1', 'sql').html));
  ok('高亮色板由强调色推导（无写死十六进制）',
    /--tok-kw:var\(--accent\)/.test(html) && !/--tok-kw:#/.test(html));
  ok('代码块带语言标记', /data-lang="js"/.test(h2));
  ok('不泄漏内部 data-col 属性', !/data-col=/.test(h2));
  ok('front-matter 进入 doc-info', /文档类型/.test(h2) && /组件自检/.test(h2));

  const profileOut = await renderFile(FIXTURE, {
    outDir: join(dir, 'c'),
  });
  ok('产物含 md-source 元信息', /name="md-source" content="research\.md"/.test(
    await readFile(profileOut.outHtml, 'utf8')));

  // 在原目录就地渲染（不传 --out）：出口就是旁边的同名 .md，目录里不多出东西
  const inPlace = join(dir, 'inplace');
  await mkdir(inPlace, { recursive: true });
  await copyFile(FIXTURE, join(inPlace, 'research.md'));
  const inPlaceOut = await renderFile(join(inPlace, 'research.md'));
  ok('就地渲染时出口是同名 .md',
    /href="research\.md" title="查看原始 Markdown"/.test(await readFile(inPlaceOut.outHtml, 'utf8')));
  const inPlaceFiles = (await readdir(inPlace)).sort().join(',');
  ok('就地渲染不产生额外文件', inPlaceFiles === 'research.html,research.md', inPlaceFiles);

  // --with-source：显式要求才复制真源，此时出口改为旁边那份副本
  const withSrc = join(dir, 'withsrc');
  const w = await renderFile(FIXTURE, { outDir: withSrc, withSource: true });
  ok('--with-source 复制原始 .md', (await readdir(withSrc)).includes('research.md'));
  ok('--with-source 时出口指向副本',
    /href="research\.md" title="查看原始 Markdown"/.test(await readFile(w.outHtml, 'utf8')));

  await rm(dir, { recursive: true, force: true });
} catch (err) {
  console.error('测试异常:', err);
  failures++;
}

console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);

// 源码自检：转义失误会把 「退格符」 之类的转义写成真正的控制字符（本项目踩过两次），
// 那种文件仍是合法 JS，只是 grep 变二进制、正则静默变义。
{
  const { readdir } = await import('node:fs/promises');
  const roots = ['src', 'test'];
  let dirty = [];
  for (const r of roots) {
    let names = [];
    try { names = await readdir(new URL('../' + r + '/', import.meta.url)); } catch { continue; }
    for (const n of names) {
      if (!/\.mjs$/.test(n)) continue;
      const buf = await readFile(new URL('../' + r + '/' + n, import.meta.url));
      for (const c of buf) if (c < 32 && c !== 9 && c !== 10 && c !== 13) { dirty.push(r + '/' + n); break; }
    }
  }
  ok('源码不含控制字符', dirty.length === 0, dirty.join(', '));
}
