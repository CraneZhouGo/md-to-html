// markdown -> HTML 片段。此处只做"呈现层"改造，不改写任何文字（ADR-0003/0006）。
import MarkdownIt from 'markdown-it';
import { highlight } from './highlight.mjs';

const CALLOUT_KINDS = [
  { kind: 'danger', re: /^(危险|严重|禁止|danger)/ },
  { kind: 'warning', re: /^(注意|警告|小心|待确认|需要确认|warning|caution)/ },
  { kind: 'note', re: /^(提示|说明|信息|结论|note|tip|info)/ },
];

/** 确定性 slug：保留 Unicode 字母数字，其余折叠为 '-'。 */
export function slugify(text, seen = new Map()) {
  const base = String(text).normalize('NFKC').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/** 极简 front-matter：只认 `key: value`，不引入 YAML 依赖。 */
export function splitFrontMatter(src) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  /** @type {Record<string,string>} */
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

/**
 * @typedef {{level:number, text:string, id:string, chapter:number}} Heading
 * @typedef {{html:string, headings:Heading[]}} Parsed
 */

/**
 * @param {string} markdown
 * @returns {Parsed}
 */
/** 语言别名归一，只用于 class 名 */
function aliasOf(lang) {
  return String(lang || '').toLowerCase();
}

export function renderMarkdown(markdown) {
  const seen = new Map();
  /** @type {Heading[]} */
  const headings = [];

  const md = new MarkdownIt({
    html: false,        // 真源里的裸 HTML 不执行：产物必须可复现、可审查
    linkify: true,
    typographer: false, // 关闭智能标点：中文标点不应被改写
    breaks: false,
  });

  // 标题：生成确定性 id，并记录层级与所属章节，供左右两栏分工使用
  let currentChapter = -1;
  md.renderer.rules.heading_open = (tokens, idx) => {
    const inline = tokens[idx + 1];
    const text = inline && inline.type === 'inline' ? inline.content : '';
    const level = Number(tokens[idx].tag.slice(1));
    const id = slugify(text, seen);
    // h3 归属于它上方最近的 h2（用 h2 在 headings 数组里的下标标识）
    const chapter = level === 2 ? headings.length : currentChapter;
    headings.push({ level, text: text.trim(), id, chapter });
    if (level === 2) currentChapter = headings.length - 1;
    return `<h${level} id="${md.utils.escapeHtml(id)}">`;
  };

  // 引用块 -> 提示块（ADR-0006 P3：按首词判定；判不出则保持普通 blockquote，不臆造语义）
  const bq = [];
  // 注意：renderer 规则的首个参数是 tokens 数组，不是单个 token
  md.renderer.rules.blockquote_open = (tokens, idx) => {
    const kind = tokens[idx].meta;
    bq.push(kind || null);
    if (!kind) return '<blockquote>';
    const icon = kind === 'warning' ? '!' : kind === 'danger' ? '×' : 'i';
    return `<div class="callout ${kind}"><span class="callout-icon">${icon}</span><div>`;
  };
  md.renderer.rules.blockquote_close = () =>
    (bq.pop() ? '</div></div>' : '</blockquote>');

  md.core.ruler.push('callout_kind', state => {
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'blockquote_open') continue;
      const inline = t[i + 2];
      const text = inline && inline.type === 'inline' ? inline.content.trim() : '';
      const hit = CALLOUT_KINDS.find(k => k.re.test(text));
      // 只给有语义的引用块加提示块形态；其余保持引用原貌
      t[i].meta = hit ? hit.kind : null;
    }
  });

  // 表格：横向滚动容器 + 数值列右对齐（ADR-0006 P0 的保守部分）
  md.renderer.rules.table_open = () => '<div class="tbl-wrap"><table>';
  md.renderer.rules.table_close = () => '</table></div>';
  md.core.ruler.push('numeric_columns', state => {
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'table_open') continue;
      let end = i;
      while (end < t.length && t[end].type !== 'table_close') end++;

      /** @type {Map<number,string[]>} */
      const byCol = new Map();
      const colOf = new Map(); // token index -> column
      let col = 0;
      for (let j = i; j < end; j++) {
        if (t[j].type === 'tr_open') col = 0;
        if (t[j].type !== 'td_open') continue;
        const inline = t[j + 1];
        const text = inline && inline.type === 'inline' ? inline.content.trim() : '';
        if (!byCol.has(col)) byCol.set(col, []);
        byCol.get(col).push(text);
        colOf.set(j, col);
        col++;
      }

      const isNum = (/** @type {string} */ x) =>
        /^[-+−]?[\d][\d.,\s]*(%|\u00d7|x|\u500d)?$/u.test(x) && /\d/u.test(x);

      for (const [c, texts] of byCol) {
        if (!texts.length) continue;
        const ratio = texts.filter(isNum).length / texts.length;
        // 保守阈值：低于 70% 就不当成数值列（ADR-0006：宁可不画）
        if (ratio < 0.7) continue;
        for (const [tokenIdx, tc] of colOf) {
          if (tc === c) t[tokenIdx].attrJoin('class', 'num');
        }
      }
    }
  });

  // 代码块：语言标签 + 轻量高亮 + 复制按钮。高亮颜色由强调色推导，不引入第三方主题。
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = (token.info || '').trim().split(/\s+/)[0] || '';
    const { html, highlighted } = highlight(token.content, lang);
    const cls = highlighted ? ` class="language-${md.utils.escapeHtml(aliasOf(lang))}"` : '';
    return `<pre data-lang="${md.utils.escapeHtml(lang)}"><code${cls}>${html}</code></pre>
`;
  };

  return { html: md.render(markdown), headings };
}
