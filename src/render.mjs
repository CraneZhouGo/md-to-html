// 渲染编排：markdown -> 静态目录 -> 单文件 HTML + 同源 .md 出口
import { readFile, writeFile, mkdir, stat, copyFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, extname, isAbsolute } from 'node:path';
import { renderMarkdown, splitFrontMatter } from './markdown.mjs';
import { renderPage, escapeHtml } from './template.mjs';
import { normalizeProfile, profileCss } from './profile.mjs';

const SIZE_WARN = 2 * 1024 * 1024; // ADR-0002：超过 2MB 告警，不自动切分

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
};

/**
 * 把相对路径的图片内联成 data URI。
 * 规则：外链与已是 data URI 的跳过；未知扩展名跳过（宁可留原链接，也不内联成打不开的图）；
 * 同一张图被引用多次时全部替换，不是只换第一处。
 * @param {string} html
 * @param {string} baseDir
 * @returns {Promise<{html:string, inlined:string[], skipped:{src:string,reason:string}[]}>}
 */
export async function inlineImages(html, baseDir) {
  const srcs = [...new Set([...html.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/g)].map(m => m[1]))];
  let out = html;
  const inlined = [];
  const skipped = [];

  for (const src of srcs) {
    if (/^(https?:|data:)/i.test(src)) { skipped.push({ src, reason: 'external' }); continue; }
    const file = isAbsolute(src) ? src : resolve(baseDir, src);
    const ext = extname(file).slice(1).toLowerCase();
    const mime = MIME[ext];
    if (!mime) { skipped.push({ src, reason: `unsupported:${ext || 'none'}` }); continue; }
    try {
      const buf = await readFile(file);
      const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
      out = out.split(`src="${src}"`).join(`src="${dataUri}"`);
      inlined.push(src);
    } catch {
      skipped.push({ src, reason: 'not-found' });
    }
  }
  return { html: out, inlined, skipped };
}

/**
 * @param {string} inputPath
 * @param {{outDir?:string, profilePath?:string, embed?:boolean}} [opts]
 */
export async function renderFile(inputPath, opts = {}) {
  const abs = resolve(inputPath);
  const raw = await readFile(abs, 'utf8');
  const { meta: fm, body } = splitFrontMatter(raw);

  // 正文里已有的 H1 作为标题；有 front-matter title 时优先用它
  const { html, headings, visual } = renderMarkdown(body, { visual: fm.visual || 'on' });
  const firstH1 = headings[0] && headings[0].level === 1 ? headings[0] : null;
  const title = fm.title || (firstH1 ? firstH1.text : basename(abs, extname(abs)));

  let bodyHtml = html;
  if (firstH1) {
    // 模板已经用 <h1> 呈现标题，正文里的同一行不重复出现
    bodyHtml = bodyHtml.replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>\s*/, '');
  }

  let embedInfo = null;
  if (opts.embed) {
    const r = await inlineImages(bodyHtml, dirname(abs));
    bodyHtml = r.html;
    embedInfo = { inlined: r.inlined, skipped: r.skipped };
  }

  // 左栏 = 章节（h2）全文档导航；右栏 = 当前章的小节（h3）。两者不重叠。
  const chapters = headings.filter(h => h.level === 2);
  const cls = (...parts) => {
    const v = parts.filter(Boolean).join(' ');
    return v ? ` class="${v}"` : '';
  };
  const navHtml = chapters.map((h, i) =>
    `      <li><a href="#${escapeHtml(h.id)}"${cls(i === 0 && 'active')}` +
    ` title="${escapeHtml(h.text)}">` +
    `<span class="nav-dot"></span><span class="nav-text">${escapeHtml(h.text)}</span></a></li>`).join('\n');

  // 右栏按章分组：静态写入全部分组（无 JS / Ctrl+F 仍完整），JS 只切换显隐
  const tocHtml = chapters.map((c, i) => {
    const chapterIdx = headings.indexOf(c);
    const subs = headings.filter(h => h.level === 3 && h.chapter === chapterIdx);
    const body = subs.length
      ? `<ul>
${subs.map(s =>
          `        <li><a href="#${escapeHtml(s.id)}" title="${escapeHtml(s.text)}">${escapeHtml(s.text)}</a></li>`).join('\n')}\n      </ul>`
      : `      <p class="toc-empty">本章无小节</p>`;
    // 无小节的章只留一句说明，不重复章名（否则右栏就成了左栏的副本）
    const head = subs.length
      ? `        <p class="toc-chapter" title="${escapeHtml(c.text)}">${escapeHtml(c.text)}</p>\n` : '';
    return `      <li class="toc-group" data-owner="${escapeHtml(c.id)}"${i === 0 ? '' : ' hidden'}>\n` +
           head + body + `\n      </li>`;
  }).join('\n');

  /** @type {import('./profile.mjs').Profile} */
  let profile = {};
  if (opts.profilePath) {
    profile = normalizeProfile(JSON.parse(await readFile(resolve(opts.profilePath), 'utf8')));
  }

  const outDir = resolve(opts.outDir || dirname(abs));
  await mkdir(outDir, { recursive: true });
  const outHtml = join(outDir, basename(abs, extname(abs)) + '.html');
  const outMd = join(outDir, basename(abs, extname(abs)) + '.md');

  const page = renderPage({
    title,
    description: fm.description || fm.lead || '',
    crumb: [fm.category, title].filter(Boolean).join(' / '),
    meta: {
      category: fm.category, status: fm.status, updated: fm.updated, version: fm.version,
      type: fm.type, strength: fm.strength, conclusion: fm.conclusion, lead: fm.lead,
    },
    navHtml, tocHtml, bodyHtml,
    profileCss: profileCss(profile),
    theme: profile.theme,
    badge: profile.readerName ? `个性化副本 · ${profile.readerName}` : null,
    sourceName: basename(outMd),
  });

  await writeFile(outHtml, page, 'utf8');
  if (resolve(outMd) !== abs) await copyFile(abs, outMd);

  const size = (await stat(outHtml)).size;
  return { outHtml, outMd, size, warn: size > SIZE_WARN, chapters: chapters.length,
           title, category: fm.category, updated: fm.updated, visual, embed: embedInfo };
}
