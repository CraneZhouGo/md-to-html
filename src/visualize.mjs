// 确定性图形化（ADR-0006）：只重排结构的呈现，不改写任何文字。
// 硬约束：输出的每个字符都来自真源，仍可 Ctrl+F 搜到、可复制。
// 门槛策略：宁可不画 —— 任一严格条件不满足，就原样保留 markdown 的标准形态。

const MARKER = /^<!--\s*md:\s*(no-visual|visual|table|cards|steps)\s*-->$/;

const plain = s => String(s).replace(/\s+/g, ' ').trim();
const len = s => [...plain(s)].length;

/** 读取一张表：表头与数据行的纯文本 + 原始 inline 内容 */
function readTable(t, start, end) {
  /** @type {string[]} */ const headText = [];
  /** @type {string[]} */ const headRaw = [];
  /** @type {{text:string[], raw:string[]}[]} */ const rows = [];
  let cur = null;

  for (let i = start; i < end; i++) {
    const type = t[i].type;
    if (type === 'tr_open') { cur = { text: [], raw: [] }; continue; }
    if (type === 'th_open' || type === 'td_open') {
      const inline = t[i + 1];
      const content = inline && inline.type === 'inline' ? inline.content : '';
      if (type === 'th_open') { headText.push(plain(content)); headRaw.push(content); }
      else if (cur) { cur.text.push(plain(content)); cur.raw.push(content); }
      continue;
    }
    if (type === 'tr_close' && cur && cur.text.length) { rows.push(cur); cur = null; }
  }
  return { headText, headRaw, rows };
}

/**
 * 表格 -> 卡片：只做「键 -> 属性」型，即 **正好 2 列**。
 * 3 列以上一律保留表格——真实文档里的 3/4 列表几乎都是对比矩阵
 * （Jenkins vs GitLab、1 台×10 Pod vs 10 台×1 Pod），卡片会把横向对比打散成纵排。
 */
function tableToCards(state, i, end) {
  // 有可画条形图的数值列时保留表格：条形比卡片更能承载横向对比（同为 ADR-0006 P0）
  for (let k = i; k < end; k++) {
    const cls = state.tokens[k].attrGet && state.tokens[k].attrGet('class');
    if (cls && /(^|\s)bar(\s|$)/.test(cls)) return null;
  }
  const { headText, headRaw, rows } = readTable(state.tokens, i, end);
  if (!headText.length || !rows.length) return null;
  if (headText.length !== 2) return null;        // 只转两列表：键 -> 属性
  if (rows.length > 12) return null;             // 两列可以稍长，超过 12 行仍保留表格
  const cells = rows.flatMap(r => r.text).concat(headText);
  if (cells.some(c => len(c) > 60)) return null; // 两列表允许更长的说明文字

  const md = state.md;
  const cards = rows.map(r => {
    const key = md.renderInline(r.raw[0] || '');
    const pairs = r.raw.slice(1).map((raw, k) => {
      const label = headRaw[k + 1] || '';
      return `<div class="cmp-row"><dt>${md.renderInline(label)}</dt><dd>${md.renderInline(raw)}</dd></div>`;
    }).join('');
    const sub = pairs
      ? `<dl class="cmp-list">${pairs}</dl>`
      : `<p class="cmp-plain">${md.renderInline(r.raw.slice(1).join(' ') || r.raw[0])}</p>`;
    return `<div class="cmp-card"><p class="cmp-key">${key}</p>${sub}</div>`;
  });

  return `\n<div class="cmp-grid">\n${cards.join('\n')}\n</div>\n`;
}

/** 无序列表 -> 定义卡片：每一项都是「术语：定义」，且术语 ≤18 字 */
function listToDefs(state, i, end) {
  const items = collectItems(state.tokens, i, end);
  if (!items || items.length < 2) return null;
  if (items.some(it => it.nested)) return null;
  const pairs = [];
  for (const it of items) {
    const m = /^([^：:]{1,18})[：:]\s*(\S[\s\S]*)$/.exec(plain(it.content));
    if (!m) return null;
    pairs.push({ term: m[1].trim(), def: m[2].trim(), rawTerm: null, rawDef: null, item: it });
  }
  const md = state.md;
  // 定义部分保留行内格式：从原始内容里切掉「术语：」前缀
  const rows = pairs.map(p => {
    const raw = p.item.content;
    const mm = /^[\s\S]*?[：:]/.exec(raw);
    const def = mm ? raw.slice(mm[0].length) : raw;
    return `<div class="def"><dt>${md.renderInline(p.term)}</dt><dd>${md.renderInline(def)}</dd></div>`;
  });
  return `\n<dl class="defs">\n${rows.join('\n')}\n</dl>\n`;
}

/** 有序列表 -> 步骤流：3–8 项、每项 ≤100 字、无嵌套、无代码块 */
function listToSteps(state, i, end) {
  const items = collectItems(state.tokens, i, end);
  if (!items || items.length < 3 || items.length > 8) return null;
  if (items.some(it => it.nested || it.code)) return null;
  if (items.some(it => len(it.content) > 100)) return null;
  // 读起来是「可选项」而不是「先后步骤」：条件式/可选式措辞过半就不转步骤流
  const optional = items.filter(it => /如果|若|当.+时|或者|可以选择|可以选用|也可以/.test(it.content)).length;
  if (optional * 2 >= items.length) return null;
  const md = state.md;
  // 真源里常写成「1、xxx」「（1）xxx」「第一步：xxx」，它们与步骤流自带的编号重复，先去掉
  const stripEnum = t => {
    const stripped = t.replace(
      /^\s*(?:\(?\d+\)?[、.．)）:：]|（\d+）|第[一二三四五六七八九十]+步[:：]?)\s*/, '');
    return stripped.trim() ? stripped : t;
  };
  const rows = items.map((it, k) =>
    `<li><span class="step-n">${k + 1}</span><div class="step-b">${md.renderInline(stripEnum(it.content))}</div></li>`);
  return `\n<ol class="steps">\n${rows.join('\n')}\n</ol>\n`;
}

/** 收集列表项：每项的原始 inline 内容、是否有嵌套列表、是否含代码块 */
function collectItems(t, start, end) {
  /** @type {{content:string, nested:boolean, code:boolean}[]} */ const items = [];
  let depth = 0;
  let cur = null;
  for (let i = start + 1; i < end; i++) {
    const type = t[i].type;
    if (type === 'list_item_open') {
      depth++;
      if (depth === 1) cur = { content: '', nested: false, code: false, parts: [] };
      else if (cur) cur.nested = true;
      continue;
    }
    if (type === 'list_item_close') {
      if (depth === 1 && cur) {
        cur.content = cur.parts.join('\n\n');
        items.push({ content: cur.content, nested: cur.nested, code: cur.code });
        cur = null;
      }
      depth--;
      continue;
    }
    if (type === 'fence' || type === 'code_block') { if (cur) cur.code = true; continue; }
    if (type === 'inline') {
      if (cur && depth === 1) cur.parts.push(t[i].content);
      else if (cur && depth > 1) cur.nested = true;
    }
  }
  return items.length ? items : null;
}

/**
 * 安装图形化规则。返回一个统计对象，供 CLI 报告"画了什么、没画什么"。
 * @param {import('markdown-it')} md
 */
export function installVisualize(md) {
  const stats = { cards: 0, defs: 0, steps: 0, skipped: 0 };

  md.core.ruler.push('visualize', state => {
    const t = state.tokens;
    if (state.env && state.env.visual === 'off') return;

    const mark = (from, to, html) => {
      // 用一段 html_block 替换整段结构
      const tok = new state.Token('html_block', '', 0);
      tok.content = html;
      tok.level = t[from].level;
      t[from] = tok;
      for (let k = from + 1; k <= to; k++) drop.add(k);
    };

    /** @type {Set<number>} */ const drop = new Set();
    let off = false;
    /** @type {string|null} */ let pending = null;

    for (let i = 0; i < t.length; i++) {
      if (drop.has(i)) continue;

      // 标记段落：`<!-- md: no-visual -->` 之类
      if (t[i].type === 'paragraph_open') {
        const inline = t[i + 1];
        const m = inline && inline.type === 'inline' ? MARKER.exec(inline.content.trim()) : null;
        if (m) {
          drop.add(i); drop.add(i + 1); drop.add(i + 2);
          const cmd = m[1];
          if (cmd === 'no-visual') off = true;
          else if (cmd === 'visual') off = false;
          else pending = cmd;      // 强制下一个块的处理方式
          continue;
        }
      }

      if (off) continue;

      if (t[i].type === 'table_open') {
        let end = i;
        while (end < t.length && t[end].type !== 'table_close') end++;
        if (pending === 'table') { pending = null; i = end; continue; }
        pending = null;
        const html = tableToCards(state, i, end);
        if (html) { mark(i, end, html); stats.cards++; } else stats.skipped++;
        i = end;
        continue;
      }

      if (t[i].type === 'bullet_list_open' || t[i].type === 'ordered_list_open') {
        let end = i;
        let depth = 0;
        for (let k = i; k < t.length; k++) {
          if (t[k].type === 'bullet_list_open' || t[k].type === 'ordered_list_open') depth++;
          if (t[k].type === 'bullet_list_close' || t[k].type === 'ordered_list_close') {
            depth--;
            if (depth === 0) { end = k; break; }
          }
        }
        const want = pending;
        pending = null;
        const isOrdered = t[i].type === 'ordered_list_open';
        const kind = want || (isOrdered ? 'steps' : 'cards');
        const html = kind === 'steps' ? listToSteps(state, i, end) : listToDefs(state, i, end);
        if (html) {
          mark(i, end, html);
          if (kind === 'steps') stats.steps++; else stats.defs++;
        } else stats.skipped++;
        i = end;
        continue;
      }
    }

    if (drop.size) {
      const kept = t.filter((_, idx) => !drop.has(idx));
      t.length = 0;
      t.push(...kept);
    }
  });

  return stats;
}
