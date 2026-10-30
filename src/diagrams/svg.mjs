// SVG 绘制原语：被 layered（ASCII 图）与 mermaid（子集）共用。
// 所有文字一律输出为 <text>，保证可 Ctrl+F、可选中复制（ADR-0006 / 0008）。

export const CHAR_W = 7.4;   // 13px 等宽字号的近似字宽
export const PAD_X = 14;
export const BOX_MIN = 96;
export const MARGIN = 18;
export const BOX_H = 40;

export function esc(s) {
  return String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 显示宽度：CJK 与全角符号按 2 计 */
export function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.codePointAt(0) > 0x2e80 ? 2 : 1;
  return w;
}

export const boxWidth = (text, min = BOX_MIN) =>
  Math.max(min, Math.ceil(textWidth(text) * CHAR_W) + PAD_X * 2);

const MARKERS = [
  ['dg-arrow', '<path d="M0,0 L10,5 L0,10 z" class="dg-head"/>'],
  ['dg-arrow-open', '<path d="M1,1 L9,5 L1,9" class="dg-head-open"/>'],
  ['dg-tri', '<path d="M1,1 L9,5 L1,9 z" class="dg-tri"/>'],
  ['dg-diamond-f', '<path d="M1,5 L5,1 L9,5 L5,9 z" class="dg-dia-f"/>'],
  ['dg-diamond-o', '<path d="M1,5 L5,1 L9,5 L5,9 z" class="dg-dia-o"/>'],
];

const DEFS = '<defs>' + MARKERS.map(([id, body]) =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">${body}</marker>`).join('') + '</defs>';

export function wrap(width, height, body, label = '图示') {
  const w = Math.round(width), h = Math.round(height);
  return `<svg class="dg" role="img" aria-label="${esc(label)}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${DEFS}${body}</svg>`;
}

export function label(x, y, text, cls = 'dg-text', anchor = 'middle') {
  return `<text class="${cls}" x="${Number(x).toFixed(1)}" y="${Number(y).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="central">${esc(text)}</text>`;
}

/** 节点形状：rect 直角 / round 圆角 / diamond 菱形 / terminal 起止 */
export function shape(kind, x, y, w, h, text) {
  const cx = x + w / 2, cy = y + h / 2;
  let node;
  if (kind === 'diamond') {
    node = `<polygon class="dg-box dg-diamond" points="${cx.toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(y + h).toFixed(1)} ${x.toFixed(1)},${cy.toFixed(1)}"/>`;
  } else if (kind === 'terminal') {
    node = `<rect class="dg-box dg-terminal" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}"/>`;
  } else if (kind === 'round') {
    node = `<rect class="dg-box dg-round" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="16"/>`;
  } else {
    node = `<rect class="dg-box" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="8"/>`;
  }
  return node + label(cx, cy, text);
}

export function path(d, { marker = 'url(#dg-arrow)', cls = 'dg-edge', dash = false } = {}) {
  return `<path class="${cls}${dash ? ' dg-dash' : ''}"${marker ? ` marker-end="${marker}"` : ''} d="${d}"/>`;
}

/** 带背景描边的标签（压在连线上也读得清） */
export const haloLabel = (x, y, text) => label(x, y, text, 'dg-label');

/** 中心到中心的直线，但收进两个矩形边界，避免线头压住文字 */
export function clipLine(a, b) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const dx = bx - ax, dy = by - ay;
  if (!dx && !dy) return null;
  const shrink = (cx, cy, w, h, sign) => {
    const tx = dx ? (w / 2) / Math.abs(dx) : Infinity;
    const ty = dy ? (h / 2) / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    return [cx + sign * dx * t, cy + sign * dy * t];
  };
  const [x1, y1] = shrink(ax, ay, a.w, a.h, 1);
  const [x2, y2] = shrink(bx, by, b.w, b.h, -1);
  return { x1, y1, x2, y2 };
}


/** 有向图分层：按最长入边深度，遇环不死循环（类图与流程图共用） */
export function layerize(nodes, edges) {
  const depth = new Map(nodes.map(n => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      if (!depth.has(e.from) || !depth.has(e.to)) continue;
      const want = depth.get(e.from) + 1;
      if (want > depth.get(e.to) && want <= nodes.length) { depth.set(e.to, want); changed = true; }
    }
    if (!changed) break;
  }
  const max = Math.max(0, ...depth.values());
  const layers = Array.from({ length: max + 1 }, () => []);
  for (const n of nodes) layers[depth.get(n.id)].push(n);
  return layers.filter(l => l.length);
}
