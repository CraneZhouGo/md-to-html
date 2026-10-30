// classDiagram 子集 -> 内联 SVG。类图是"结构图"，节点带成员列表，边有四种语义：
// 继承（空心三角）、实现（空心三角 + 虚线）、组合（实心菱形）、聚合（空心菱形）、依赖（开放箭头）。

import { esc, textWidth, boxWidth, wrap, label, path, clipLine, layerize, MARGIN, CHAR_W } from './svg.mjs';

const clean = s => String(s ?? '').trim();
const blank = s => !clean(s) || clean(s).startsWith('%%');

const OPS = ['<|--', '--|>', '<|..', '..|>', '*--', '--*', 'o--', '--o', '..>', '<..', '-->', '<--', '..', '--'];
const OP_RE = new RegExp(`(${OPS.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);

const CARD = /^["']?([\w*.]+)["']?$/;

/**
 * 把一端拆成 id + 基数。基数可能在左（`Customer "1"`）也可能在右（`"*" Order`），
 * 两种都要认，否则 `A --> "*" B` 会被当成匿名节点而整块解析失败。
 */
function splitEnd(side) {
  const t = clean(side);
  const trailing = /^(.*?)\s*(["'][^"']*["'])$/.exec(t);
  if (trailing) return { id: clean(trailing[1]), card: trailing[2].replace(/["']/g, '') };
  const leading = /^(["'][^"']*["'])\s*(.*)$/.exec(t);
  if (leading) return { id: clean(leading[2]), card: leading[1].replace(/["']/g, '') };
  return { id: t.replace(/["']/g, '').trim(), card: '' };
}

/** @returns {{classes:Map<string,{id:string,members:string[]}>, rels:any[]}|null} */
export function parseClass(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^classDiagram\s*$/i.test(clean(lines[0]))) return null;

  /** @type {Map<string,{id:string,members:string[]}>} */
  const classes = new Map();
  const rels = [];
  const add = id => { if (!classes.has(id)) classes.set(id, { id, members: [] }); return classes.get(id); };

  let open = null;
  for (const raw of lines.slice(1)) {
    if (blank(raw)) continue;
    const line = clean(raw);

    if (open) {
      if (line === '}') { open = null; continue; }
      if (/^[{}]$/.test(line)) return null;
      open.members.push(line);
      continue;
    }

    const decl = /^class\s+([\w\u4e00-\u9fa5]+)\s*(\{)?\s*$/.exec(line);
    if (decl) {
      const c = add(decl[1]);
      if (decl[2]) open = c;
      continue;
    }

    const m = OP_RE.exec(line);
    if (!m) {
      // 单个标识符当作无内容的类声明
      if (/^[\w\u4e00-\u9fa5]+$/.test(line)) { add(line); continue; }
      return null;
    }
    const left = splitEnd(line.slice(0, m.index));
    const rest = line.slice(m.index + m[1].length);
    const colon = rest.indexOf(':');
    const rightRaw = colon >= 0 ? rest.slice(0, colon) : rest;
    const relLabel = colon >= 0 ? clean(rest.slice(colon + 1)) : '';
    const right = splitEnd(rightRaw);
    if (!left.id || !right.id) return null;
    if (!/^[\w\u4e00-\u9fa5]+$/.test(left.id) || !/^[\w\u4e00-\u9fa5]+$/.test(right.id)) return null;
    add(left.id); add(right.id);
    rels.push({ from: left.id, to: right.id, op: m[1], la: left.card, lb: right.card, label: relLabel });
  }
  if (open) return null;
  if (!classes.size) return null;
  return { type: 'class', classes, rels };
}

const HEAD_H = 32, ROW_H = 18, PAD = 12, GAP_X = 40, GAP_Y = 64;

function classSize(c) {
  const nameW = textWidth(c.id) * CHAR_W + PAD * 2 + 16;
  const memberW = c.members.length
    ? Math.max(...c.members.map(m => textWidth(m) * CHAR_W + PAD * 2))
    : 0;
  const w = Math.max(140, Math.ceil(Math.max(nameW, memberW)));
  const h = HEAD_H + (c.members.length ? c.members.length * ROW_H + 10 : 0) + (c.members.length ? 8 : 10);
  return { w, h };
}

const EDGE_STYLE = {
  '<|--': { marker: 'url(#dg-tri)', dash: false, dir: 'to' },
  '--|>': { marker: 'url(#dg-tri)', dash: false, dir: 'from' },
  '<|..': { marker: 'url(#dg-tri)', dash: true, dir: 'to' },
  '..|>': { marker: 'url(#dg-tri)', dash: true, dir: 'from' },
  '*--': { marker: 'url(#dg-diamond-f)', dash: false, dir: 'to' },
  '--*': { marker: 'url(#dg-diamond-f)', dash: false, dir: 'from' },
  'o--': { marker: 'url(#dg-diamond-o)', dash: false, dir: 'to' },
  '--o': { marker: 'url(#dg-diamond-o)', dash: false, dir: 'from' },
  '-->': { marker: 'url(#dg-arrow-open)', dash: false, dir: 'to' },
  '<--': { marker: 'url(#dg-arrow-open)', dash: false, dir: 'from' },
  '..>': { marker: 'url(#dg-arrow-open)', dash: true, dir: 'to' },
  '<..': { marker: 'url(#dg-arrow-open)', dash: true, dir: 'from' },
  '..': { marker: null, dash: true, dir: 'to' },
  '--': { marker: null, dash: false, dir: 'to' },
};

export function drawClass(graph) {
  const nodes = [...graph.classes.values()];
  const size = new Map(nodes.map(n => [n.id, classSize(n)]));
  const layers = layerize(nodes, graph.rels);

  const rowW = layers.map(l => l.reduce((a, n) => a + size.get(n.id).w, 0) + GAP_X * (l.length - 1));
  const contentW = Math.max(...rowW);
  const rowH = layers.map(l => Math.max(...l.map(n => size.get(n.id).h)));
  const width = contentW + MARGIN * 2;
  const height = rowH.reduce((a, b) => a + b, 0) + GAP_Y * (layers.length - 1) + MARGIN * 2;

  const pos = new Map();
  let y = MARGIN;
  layers.forEach((l, li) => {
    let x = MARGIN + (contentW - rowW[li]) / 2;
    for (const n of l) {
      const s = size.get(n.id);
      pos.set(n.id, { x, y: y + (rowH[li] - s.h) / 2, ...s });
      x += s.w + GAP_X;
    }
    y += rowH[li] + GAP_Y;
  });

  const body = [];

  // 边：按语义换 marker；继承/实现是虚线三角，组合实心菱形，聚合空心菱形
  for (const rel of graph.rels) {
    const a = pos.get(rel.from), b = pos.get(rel.to);
    if (!a || !b) continue;
    const c = clipLine(a, b);
    if (!c) continue;
    const st = EDGE_STYLE[rel.op] || { marker: 'url(#dg-arrow-open)', dash: false, dir: 'to' };
    // 反向的语义（--|>）把线翻过来，让 marker 落在父类一端
    const [x1, y1, x2, y2] = st.dir === 'to' ? [c.x1, c.y1, c.x2, c.y2] : [c.x2, c.y2, c.x1, c.y1];
    body.push(path(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`,
      { marker: st.marker, dash: st.dash }));
    const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
    if (rel.label) body.push(label(mx, my - 10, rel.label, 'dg-label'));
    if (rel.la) body.push(label(c.x1 + (c.x2 - c.x1) * 0.18, c.y1 + (c.y2 - c.y1) * 0.18, rel.la, 'dg-label'));
    if (rel.lb) body.push(label(c.x1 + (c.x2 - c.x1) * 0.82, c.y1 + (c.y2 - c.y1) * 0.82, rel.lb, 'dg-label'));
  }

  // 类框：标题带 + 成员区
  for (const n of nodes) {
    const p = pos.get(n.id);
    body.push(`<rect class="dg-box dg-class" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="6"/>`);
    body.push(`<path class="dg-rule" d="M${p.x.toFixed(1)},${(p.y + HEAD_H).toFixed(1)} L${(p.x + p.w).toFixed(1)},${(p.y + HEAD_H).toFixed(1)}"/>`);
    body.push(label(p.x + p.w / 2, p.y + HEAD_H / 2, n.id, 'dg-strong'));
    n.members.forEach((m, k) => {
      body.push(label(p.x + PAD, p.y + HEAD_H + 14 + k * ROW_H, m, 'dg-attr', 'start'));
    });
  }

  return wrap(width, Math.max(height, 120), body.join(''), '类图');
}

export { esc };
