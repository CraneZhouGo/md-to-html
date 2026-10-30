// markdown -> HTML 片段。此处只做"呈现层"改造，不改写任何文字（ADR-0003/0006）。
import MarkdownIt from 'markdown-it';
import { highlight } from './highlight.mjs';
import { installVisualize } from './visualize.mjs';
import { parseLayered, renderLayeredSvg } from './diagrams/layered.mjs';
import { parseMapping, renderMappingSvg } from './diagrams/mapping.mjs';
import { textWidth } from './diagrams/svg.mjs';
import { renderMermaid } from './diagrams/mermaid.mjs';

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
    // 允许带空格的键：Obsidian 会写 `date created:` / `date modified:`
    const kv = /^([A-Za-z_][\w-]*(?:\s+[A-Za-z_][\w-]*)*)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase().replace(/\s+/g, '-');
    meta[key] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  // 常见别名归一（Obsidian / 其他工具的字段名）
  if (meta['date-modified'] && !meta.updated) meta.updated = meta['date-modified'];
  if (meta['date-created'] && !meta.created) meta.created = meta['date-created'];
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
// ASCII 架构图识别：靠制表符/箭头/树形分支，且只在 text/plain/无语言 的块里判定。
// 目的不是"转换"，而是换个排版方式——文字必须原样保留（ADR-0006）。
const DIAGRAM_CHARS = /[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬↓↑→←↔]/;

export function looksLikeDiagram(text, lang) {
  const l = String(lang || '').toLowerCase();
  if (!(l === '' || l === 'text' || l === 'plain' || l === 'plaintext' || l === 'txt')) return false;
  const lines = text.split(/\r?\n/).filter(x => x.trim() !== '');
  if (lines.length < 2) return false;
  const hits = lines.filter(x => DIAGRAM_CHARS.test(x)).length;
  return hits >= 2 || hits / lines.length >= 0.3;
}

/** 语言别名归一，只用于 class 名 */
function aliasOf(lang) {
  return String(lang || '').toLowerCase();
}

export function renderMarkdown(markdown, env = {}) {
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
  // 表格语义：表头加 scope="col"，每行第一个单元格提升为行头 th scope="row"。
  // 屏幕阅读器靠这两条把"这个数字属于哪一行哪一列"读出来；我们 46% 的行是表格，
  // 没有 scope 的话长表格读到第三十行就彻底失去方位。
  md.core.ruler.push('table_headers', state => {
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'table_open') continue;
      let end = i;
      while (end < t.length && t[end].type !== 'table_close') end++;
      let seenBody = false;
      for (let j = i; j < end; j++) {
        if (t[j].type === 'tbody_open') { seenBody = true; continue; }
        if (t[j].type === 'th_open' && !seenBody) { t[j].attrSet('scope', 'col'); continue; }
        if (t[j].type !== 'tr_open' || !seenBody) continue;
        // 该行第一个 td 升为行头
        for (let k = j + 1; k < end; k++) {
          if (t[k].type === 'td_open') {
            t[k].tag = 'th';
            t[k].attrSet('scope', 'row');
            t[k].attrJoin('class', 'rowh');
            // 找到配对的 close，一起改标签
            let depth = 1;
            for (let m = k + 1; m < end; m++) {
              if (t[m].type === 'td_open' || t[m].type === 'th_open') depth++;
              if (t[m].type === 'td_close' || t[m].type === 'th_close') {
                if (--depth === 0) { t[m].tag = 'th'; break; }
              }
            }
            break;
          }
        }
      }
    }
  });

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
        /^[-+]?[\d][\d.,\s]*(%|\u00d7|x|\u500d)?$/u.test(x) && /\d/u.test(x);

      // 只有「纯数字（可含千分位）」才参与条形图；带 % / × / 倍的列只右对齐，不画条
      const toNumber = (/** @type {string} */ x) => {
        if (!isNum(x)) return null;
        const clean = x.replace(/[,\uFF0C\s]/g, '');
        if (!/^[-+]?\d+(?:\.\d+)?$/.test(clean)) return null;
        const n = Number(clean);
        return Number.isFinite(n) ? n : null;
      };

      for (const [c, texts] of byCol) {
        if (!texts.length) continue;
        const ratio = texts.filter(isNum).length / texts.length;
        // 保守阈值：低于 70% 就不当成数值列（ADR-0006：宁可不画）
        if (ratio < 0.7) continue;
        for (const [tokenIdx, tc] of colOf) {
          if (tc === c) t[tokenIdx].attrJoin('class', 'num');
        }

        // 条形图：只在该列 100% 可解析、≥3 行、无负数、且有真实差异时画
        const values = texts.map(toNumber);
        if (values.some(v => v === null)) continue;          // 有百分比/单位混排就不画
        if (values.length < 3) continue;
        if (values.some(v => v < 0)) continue;               // 负数需要零基线，本实现不做
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (max <= 0) continue;
        if (min > 0 && max / min < 1.2) continue;            // 差别太小，画出来是平的

        // 序号列（1,2,3 / 2020,2021,2022）画条没有意义：等差且步长为 1 时跳过
        const steps = values.slice(1).map((v, k) => v - values[k]);
        if (steps.length && steps.every(d => d === 1 || d === -1)) continue;

        // 逐行贴百分比；按行序对齐 texts
        const rowOrder = [...colOf.entries()]
          .filter(([, tc]) => tc === c)
          .map(([tokenIdx]) => tokenIdx);
        rowOrder.forEach((tokenIdx, k) => {
          const value = values[k];
          if (value === null) return;
          const pct = Math.max(2, Math.round(value / max * 100));
          t[tokenIdx].attrJoin('class', 'bar');
          t[tokenIdx].attrSet('style', `--w:${pct}%`);
        });
      }
    }
  });

  // 代码块：语言标签 + 轻量高亮 + 复制按钮。高亮颜色由强调色推导，不引入第三方主题。
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = (token.info || '').trim().split(/\s+/)[0] || '';
    const { html, highlighted } = highlight(token.content, lang);
    const cls = highlighted ? ` class="language-${md.utils.escapeHtml(aliasOf(lang))}"` : '';
    const pre = `<pre data-lang="${md.utils.escapeHtml(lang)}"><code${cls}>${html}</code></pre>
`;
    // 架构图：先试画成 SVG（文字仍是 <text>，可搜可选中）；画不出来再退回文本图示
    // mermaid 子集：解析成功就画成 SVG；失败就原样当代码块（绝不画错）
    // `usecase` 是 mermaid 没有的图型（本项目扩展），用独立语言标记避免污染 mermaid
    const isUsecase = /^use-?cases?$/i.test(lang);
    if (isUsecase || /^mermaid$/i.test(lang)) {
      const srcText = isUsecase ? `usecaseDiagram
${token.content}` : token.content;
      const r = renderMermaid(srcText);
      if (r) return `<figure class="diagram" data-kind="svg" data-diagram="${r.type}">${r.svg}</figure>
`;
    }
    if (/^mermaid$/i.test(lang)) {
      const r = renderMermaid(token.content);
      if (r) return `<figure class="diagram" data-kind="svg" data-diagram="${r.type}">${r.svg}</figure>
`;
      return `<pre data-lang="mermaid"><code>${md.utils.escapeHtml(token.content)}</code></pre>
`;
    }

    if (looksLikeDiagram(token.content, lang)) {
      const graph = parseLayered(token.content);
      if (graph) {
        const { svg } = renderLayeredSvg(graph);
        return `<figure class="diagram" data-kind="svg" data-diagram="layered">${svg}</figure>
`;
      }
      // 多行 A → B 的映射关系（分层解析器会明确拒绝这一类）
      const mapping = parseMapping(token.content);
      if (mapping) {
        const { svg } = renderMappingSvg(mapping);
        return `<figure class="diagram" data-kind="svg" data-diagram="mapping">${svg}</figure>
`;
      }
      // 画不出来时先判断这块到底是不是"图"：带箭头的中文长句（散文）用图示排版
      // （行高 1.16、等宽）会很难读，宁可当普通代码块。
      const NL = String.fromCharCode(10);
      const bodyLines = token.content.split(NL).map(x => x.trim()).filter(Boolean);
      const proseLike = bodyLines.some(l => /[。；]/.test(l)) || bodyLines.some(l => textWidth(l) > 46);
      if (proseLike) return pre;
      return `<figure class="diagram" data-kind="ascii">${pre}</figure>
`;
    }
    return pre;
  };

  const visual = installVisualize(md);   // ADR-0006：确定性图形化
  const html = md.render(markdown, env);
  return { html, headings, visual };
}
