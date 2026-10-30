// ASCII 图 -> 内联 SVG（架构图 / 流程图 / 分层图）。
// 硬约束：文字仍写成 <text> 节点，可 Ctrl+F、可选中复制（ADR-0006 / ADR-0008）。
// 只解析能被可靠识别的四种写法；识别不了就返回 null，调用方退回文本图示。

const VERT = /^[\s\u3000]*[\u2193\u2191][\s\u3000]*(.*)$/;      // ↓
const BRANCH = /^[\s\u3000]*[\u251c\u2514][\s\u3000]*[\u2500-]*[\s\u3000]*(.+)$/; // ├── └──
const GUTTER = /^[\s\u3000]*[\u2502|][\s\u3000]*$/;             // │
const CHAIN = /[\u2192]|->/;                                      // →
const ARROW_ANY = /[\u2193\u2191\u2192\u2190]/;

/** 显示宽度：CJK 与全角符号按 2 计 */
export function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.codePointAt(0) > 0x2e80 ? 2 : 1;
  return w;
}

const clean = s => String(s).trim().replace(/[。；;]$/, '').trim();
const MAX_NODE_W = 56;   // 显示宽度上限（CJK 按 2 计）；超了就不画，交给文本图示
const bad = s => !s || textWidth(s) > MAX_NODE_W || /[，,。；;=＝÷×]/.test(s);

/** 校验：节点数与重复节点 */
function validate(layers) {
  const nodes = layers.flat();
  if (layers.length < 2) return null;
  if (layers.some(l => !l.length)) return null;
  if (nodes.length < 2 || nodes.length > 24) return null;
  if (nodes.some(bad)) return null;
  if (layers.some(l => new Set(l).size !== l.length)) return null;
  return { layers };
}

/** 写法一：竖向箭头分层（可带 ├── 分支） */
function parseVertical(lines) {
  /** @type {string[][]} */ const layers = [];
  /** @type {string[]} */ let cur = [];
  let curHasBranch = false;
  const push = () => { if (cur.length) { layers.push(cur); cur = []; } curHasBranch = false; };

  for (const line of lines) {
    if (GUTTER.test(line)) continue;
    if (VERT.test(line)) { push(); continue; }
    const b = BRANCH.exec(line);
    if (b) {
      if (!curHasBranch && cur.length) push();   // 头节点自成一层的父节点
      // 允许分支文本以箭头开头：`├──→ Replica1`
      cur.push(clean(b[1]).replace(/^(?:→|->)\s*/, ''));
      curHasBranch = true;
      continue;
    }
    if (CHAIN.test(line)) return null;           // 混了横向箭头，不归这类处理
    cur.push(clean(line));
  }
  push();
  return layers.length >= 2 ? layers : null;
}

/** 写法二：树形（头节点 + ├── 子节点），没有箭头 */
function parseTree(lines) {
  const head = [];
  const kids = [];
  let inKids = false;
  for (const line of lines) {
    if (GUTTER.test(line)) continue;
    const b = BRANCH.exec(line);
    if (b) { inKids = true; kids.push(clean(b[1])); continue; }
    if (inKids) return null;                     // 分支之后又出现普通行：结构不明确
    head.push(clean(line));
  }
  if (head.length !== 1 || kids.length < 2) return null;
  return [head, kids];
}

/** 写法三：横向链条   A → B → C   或   A 换行 → B 换行 → C */
function parseChain(lines) {
  /** @type {string[][]} */ const layers = [];
  let current = null;
  let chains = 0;

  for (const line of lines) {
    if (GUTTER.test(line)) continue;
    const t = line.trim();
    if (!CHAIN.test(t)) {
      if (current) return null;                  // 链条中间插了无关行
      current = [clean(t)];
      continue;
    }
    const segs = t.split(/\s*(?:\u2192|->)\s*/).map(clean).filter(Boolean);
    const startsWithArrow = /^(?:\u2192|->)/.test(t);
    if (startsWithArrow) {
      if (!current) return null;                 // 没有起点的续行
      current.push(...segs);
      continue;
    }
    if (current) {                               // 上一条链没收口 -> 多条链，放弃
      chains++;
      if (chains > 1) return null;
      layers.push(...current.map(n => [n]));
      current = null;
    }
    current = segs;
  }
  if (!current) return null;
  layers.push(...current.map(n => [n]));
  const flat = layers.map(l => l[0]);
  if (new Set(flat).size !== flat.length) return null;   // 环或重复节点
  return layers.length >= 2 ? layers : null;
}

/**
 * @param {string} src
 * @returns {{layers:string[][]}|null}
 */
export function parseLayered(src) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 1) return null;   // 单行也可能是合法链条：A → B → C

  const hasVert = lines.some(l => VERT.test(l));
  const hasBranch = lines.some(l => BRANCH.test(l));
  const hasChain = lines.some(l => CHAIN.test(l));

  // 注意：分支行里也可能带箭头（`├──→ Replica1`），所以"有箭头"不能排除分支写法。
  // 早先这里写成 `hasVert && !hasChain`，导致 `Master ├──→ R1` 直接落空。
  let layers = null;
  if (hasVert || hasBranch) layers = parseVertical(lines) || parseTree(lines);
  else if (hasChain) layers = parseChain(lines);
  if (!layers) return null;
  return validate(layers);
}

// ---------- 布局 ----------

const CHAR_W = 7.4;
const PAD_X = 14;
const BOX_MIN = 96;
const MARGIN = 18;

const boxWidth = text => Math.max(BOX_MIN, Math.ceil(textWidth(text) * CHAR_W) + PAD_X * 2);

function esc(s) {
  return String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 生成 SVG。布局确定性：同一输入必得同一串字节。
 * 层数 ≤5 竖向排（上→下），更多则横向排（左→右），避免一张图高过一屏。
 * @param {{layers:string[][]}} graph
 */
export function renderLayeredSvg(graph) {
  // 两种朝向都先量尺寸，再挑一个不会把正文列撑爆的
  const v = dimsVertical(graph);
  const h = dimsHorizontal(graph);
  const fits = w => w <= 820;                 // 正文列宽 800 + 余量
  if (fits(v.width)) return renderVertical(graph);
  if (fits(h.width) && h.height <= 820) return renderHorizontal(graph);
  // 都放不下：选最长边更短的那个，至少不会小到看不清
  return Math.max(v.width, v.height) <= Math.max(h.width, h.height)
    ? renderVertical(graph) : renderHorizontal(graph);
}

const BOX_H_V = 40, GAP_Y_V = 58, GAP_X_V = 22;
const BOX_H_H = 38, GAP_X_H = 60, GAP_Y_H = 16;

function dimsVertical({ layers }) {
  const rows = layers.map(layer => {
    const widths = layer.map(boxWidth);
    return widths.reduce((a, b) => a + b, 0) + GAP_X_V * (layer.length - 1);
  });
  return {
    width: Math.round(Math.max(...rows) + MARGIN * 2),
    height: Math.round(layers.length * BOX_H_V + (layers.length - 1) * GAP_Y_V + MARGIN * 2),
  };
}

function dimsHorizontal({ layers }) {
  const widths = layers.map(layer => Math.max(...layer.map(boxWidth)));
  const heights = layers.map(layer => layer.length * BOX_H_H + (layer.length - 1) * GAP_Y_H);
  return {
    width: Math.round(widths.reduce((a, b) => a + b, 0) + GAP_X_H * (layers.length - 1) + MARGIN * 2),
    height: Math.round(Math.max(...heights) + MARGIN * 2),
  };
}

const HEAD = '<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-head"/></marker></defs>';

function wrap(width, height, body) {
  return `<svg class="dg" role="img" aria-label="图示" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${HEAD}${body}</svg>`;
}

function box(b, rx = 8) {
  return `<rect class="dg-box" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="${rx}"/>` +
    `<text class="dg-text" x="${(b.x + b.w / 2).toFixed(1)}" y="${(b.y + b.h / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${esc(b.text)}</text>`;
}

function renderVertical({ layers }) {
  const BOX_H = BOX_H_V, GAP_Y = GAP_Y_V, GAP_X = GAP_X_V;
  const rows = layers.map(layer => {
    const widths = layer.map(boxWidth);
    const total = widths.reduce((a, b) => a + b, 0) + GAP_X * (layer.length - 1);
    return { layer, widths, total };
  });
  const contentW = Math.max(...rows.map(r => r.total));
  const width = Math.round(contentW + MARGIN * 2);
  const height = Math.round(rows.length * BOX_H + (rows.length - 1) * GAP_Y + MARGIN * 2);

  const boxes = [];
  let y = MARGIN;
  for (const row of rows) {
    let x = MARGIN + (contentW - row.total) / 2;
    boxes.push(row.layer.map((text, i) => {
      const w = row.widths[i];
      const b = { x, y, w, h: BOX_H, text };
      x += w + GAP_X;
      return b;
    }));
    y += BOX_H + GAP_Y;
  }

  const body = [];
  for (let i = 0; i < boxes.length - 1; i++) body.push(edges(boxes[i], boxes[i + 1], 'down'));
  for (const row of boxes) for (const b of row) body.push(box(b));
  return { svg: wrap(width, height, body.join('')), width, height };
}

function renderHorizontal({ layers }) {
  const BOX_H = BOX_H_H, GAP_X = GAP_X_H, GAP_Y = GAP_Y_H;
  const cols = layers.map(layer => {
    const w = Math.max(...layer.map(boxWidth));
    const h = layer.length * BOX_H + (layer.length - 1) * GAP_Y;
    return { layer, w, h };
  });
  const contentH = Math.max(...cols.map(c => c.h));
  const width = Math.round(cols.reduce((a, c) => a + c.w, 0) + GAP_X * (cols.length - 1) + MARGIN * 2);
  const height = Math.round(contentH + MARGIN * 2);

  const boxes = [];
  let x = MARGIN;
  for (const col of cols) {
    let y = MARGIN + (contentH - col.h) / 2;
    boxes.push(col.layer.map(text => {
      const b = { x, y, w: col.w, h: BOX_H, text };
      y += BOX_H + GAP_Y;
      return b;
    }));
    x += col.w + GAP_X;
  }

  const body = [];
  for (let i = 0; i < boxes.length - 1; i++) body.push(edges(boxes[i], boxes[i + 1], 'right'));
  for (const col of boxes) for (const b of col) body.push(box(b));
  return { svg: wrap(width, height, body.join('')), width, height };
}

/** 相邻两层之间的连线；边数过多时走"总线"，避免糊成一团 */
function edges(upper, lower, dir) {
  const out = [];
  const dense = upper.length * lower.length > 9;
  const cX = b => b.x + b.w / 2;
  const cY = b => b.y + b.h / 2;

  if (dir === 'down') {
    const y1 = b => b.y + b.h, y2 = b => b.y;
    if (!dense) {
      for (const a of upper) for (const b of lower) {
        const x1 = cX(a), ya = y1(a), x2 = cX(b), yb = y2(b), my = (ya + yb) / 2;
        out.push(`<path class="dg-edge" marker-end="url(#dg-arrow)" d="M${x1.toFixed(1)},${ya.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${yb.toFixed(1)}"/>`);
      }
      return out.join('');
    }
    const busY = (y1(upper[0]) + y2(lower[0])) / 2;
    const xs = [...upper.map(cX), ...lower.map(cX)];
    out.push(`<path class="dg-edge" d="M${Math.min(...xs).toFixed(1)},${busY.toFixed(1)} L${Math.max(...xs).toFixed(1)},${busY.toFixed(1)}"/>`);
    for (const a of upper) out.push(`<path class="dg-edge" d="M${cX(a).toFixed(1)},${y1(a).toFixed(1)} L${cX(a).toFixed(1)},${busY.toFixed(1)}"/>`);
    for (const b of lower) out.push(`<path class="dg-edge" marker-end="url(#dg-arrow)" d="M${cX(b).toFixed(1)},${busY.toFixed(1)} L${cX(b).toFixed(1)},${y2(b).toFixed(1)}"/>`);
    return out.join('');
  }

  const x1 = b => b.x + b.w, x2 = b => b.x;
  if (!dense) {
    for (const a of upper) for (const b of lower) {
      const ya = cY(a), xa = x1(a), yb = cY(b), xb = x2(b), mx = (xa + xb) / 2;
      out.push(`<path class="dg-edge" marker-end="url(#dg-arrow)" d="M${xa.toFixed(1)},${ya.toFixed(1)} C${mx.toFixed(1)},${ya.toFixed(1)} ${mx.toFixed(1)},${yb.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}"/>`);
    }
    return out.join('');
  }
  const busX = (x1(upper[0]) + x2(lower[0])) / 2;
  const ys = [...upper.map(cY), ...lower.map(cY)];
  out.push(`<path class="dg-edge" d="M${busX.toFixed(1)},${Math.min(...ys).toFixed(1)} L${busX.toFixed(1)},${Math.max(...ys).toFixed(1)}"/>`);
  for (const a of upper) out.push(`<path class="dg-edge" d="M${x1(a).toFixed(1)},${cY(a).toFixed(1)} L${busX.toFixed(1)},${cY(a).toFixed(1)}"/>`);
  for (const b of lower) out.push(`<path class="dg-edge" marker-end="url(#dg-arrow)" d="M${busX.toFixed(1)},${cY(b).toFixed(1)} L${x2(b).toFixed(1)},${cY(b).toFixed(1)}"/>`);
  return out.join('');
}
