// 守门测试（ADR-0005 / ADR-0002）：
// 1) 同一真源 + 无偏好 => 逐字节相同
// 2) 产物零网络依赖（无 <link>、无 @font-face、无外链 script）
// 3) 目录与导航是静态写入的（不依赖 JS 生成）
// 4) 图形化不得吞掉文字：正文里的每个标题文本都必须出现在产物里
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  ok('同源 .md 出口存在', /href="research\.md"/.test(html));
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

  // ---- 组件映射自检（合成样本）----
  const fix2 = new URL('./fixtures/features.md', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1');
  const f2 = await renderFile(fix2, { outDir: join(dir, 'f2') });
  const h2 = await readFile(f2.outHtml, 'utf8');
  ok('note 提示块', /class="callout note"/.test(h2));
  ok('warning 提示块', /class="callout warning"/.test(h2));
  ok('danger 提示块', /class="callout danger"/.test(h2));
  ok('无语义引用保持 blockquote', /<blockquote>/.test(h2));
  ok('数值列右对齐', /class="num"/.test(h2));
  // 数值表：3 个数值列 × 3 行 = 9；文本列一个都不该被标
  ok('非数值列不误判', (h2.match(/class="num"/g) || []).length === 9 &&
    /<td class="num">16,180<\/td>/.test(h2) && !/<td class="num">HTML 更适合 LLM<\/td>/.test(h2),
    String((h2.match(/class="num"/g) || []).length));
  // 确定性图形化（ADR-0006）
  ok('表格 -> 对比卡片', /class="cmp-grid"/.test(h2) && /class="cmp-card"/.test(h2));
  ok('列表 -> 定义卡片', /<dl class="defs">/.test(h2));
  ok('有序列表 -> 步骤流', /<ol class="steps">/.test(h2) && /class="step-n"/.test(h2));
  ok('<!-- md: table --> 可强制保留表格', /<table>/.test(h2));
  ok('<!-- md: no-visual --> 可关闭图形化',
    /这一条不应被转成定义卡片/.test(h2) && /class="defs">[\s\S]*恢复/.test(h2.split('这一条不应被转成定义卡片')[1] || ''));
  ok('图形化后文字仍完整',
    ['真源', '阅读面', '制品', '解析 markdown', '输出单文件 HTML'].every(t => h2.includes(t)));
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

  await rm(dir, { recursive: true, force: true });
} catch (err) {
  console.error('测试异常:', err);
  failures++;
}

console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
