// 用例图（本项目扩展，mermaid 没有原生语法）。
// 语法：
//   usecaseDiagram
//   actor 用户
//   usecase 登录
//   用户 --> 登录
//   usecase 下单 : 含扩展说明   （冒号后是可选说明，暂只保留在标签里）

import { esc, textWidth, wrap, label, path, clipLine, MARGIN, CHAR_W } from './svg.mjs';

const clean = s => String(s ?? '').trim();
const blank = s => !clean(s) || clean(s).startsWith('%%');

const DECL = /^(actor|usecase)\s+(.+)$/i;
const LINK = /^(.+?)\s*-->\s*(.+?)$/;

export function parseUsecase(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^usecaseDiagram\s*$/i.test(clean(lines[0]))) return null;

  /** @type {Map<string,{id:string,text:string,kind:'actor'|'usecase'}>} */
  const items = new Map();
  const links = [];
  const add = (id, kind) => {
    const key = clean(id);
    if (!key) return null;
    if (!items.has(key)) items.set(key, { id: key, text: key, kind });
    const it = items.get(key);
    if (it.kind !== kind) it.kind = kind === 'actor' ? 'actor' : it.kind;
    return it;
  };

  for (const raw of lines.slice(1)) {
    if (blank(raw)) continue;
    const line = clean(raw);
    const d = DECL.exec(line);
    if (d) { add(d[2].split(':')[0], d[1].toLowerCase()); continue; }
    const l = LINK.exec(line);
    if (l) { add(l[1], 'usecase'); add(l[2], 'usecase'); links.push({ from: clean(l[1]), to: clean(l[2]) }); continue; }
    return null;
  }
  const actors = [...items.values()].filter(i => i.kind === 'actor');
  const cases = [...items.values()].filter(i => i.kind === 'usecase');
  // 只参与连线但没声明过的，按用例处理
  for (const l of links) {
    for (const id of [l.from, l.to]) {
      if (!items.has(id)) return null;
    }
  }
  if (!actors.length || !cases.length) return null;
  return { type: 'usecase', actors, cases, links };
}

const ROW_H = 44, GAP_Y = 16, GAP_X = 96;

function actorGlyph(cx, cy) {
  return `<circle class="dg-actor" cx="${cx.toFixed(1)}" cy="${(cy - 16).toFixed(1)}" r="7"/>` +
    `<path class="dg-actor-line" d="M${cx.toFixed(1)},${(cy - 9).toFixed(1)} L${cx.toFixed(1)},${(cy + 6).toFixed(1)}"/>` +
    `<path class="dg-actor-line" d="M${(cx - 12).toFixed(1)},${(cy - 3).toFixed(1)} L${(cx + 12).toFixed(1)},${(cy - 3).toFixed(1)}"/>` +
    `<path class="dg-actor-line" d="M${cx.toFixed(1)},${(cy + 6).toFixed(1)} L${(cx - 10).toFixed(1)},${(cy + 20).toFixed(1)}"/>` +
    `<path class="dg-actor-line" d="M${cx.toFixed(1)},${(cy + 6).toFixed(1)} L${(cx + 10).toFixed(1)},${(cy + 20).toFixed(1)}"/>`;
}

export function drawUsecase(graph) {
  const actorW = Math.max(...graph.actors.map(a => Math.max(84, textWidth(a.text) * CHAR_W + 24)));
  const caseW = Math.max(...graph.cases.map(c => Math.max(150, textWidth(c.text) * CHAR_W + 56)));

  const actorsH = graph.actors.length * (ROW_H + 14) + (graph.actors.length - 1) * GAP_Y;
  const casesH = graph.cases.length * ROW_H + (graph.cases.length - 1) * GAP_Y;
  const contentH = Math.max(actorsH + 40, casesH);
  const width = MARGIN * 2 + actorW + GAP_X + caseW;
  const height = contentH + MARGIN * 2 + 20;

  const pos = new Map();
  const ax = MARGIN + actorW / 2;
  let ay = MARGIN + 26 + Math.max(0, (contentH - actorsH) / 2);
  for (const a of graph.actors) {
    pos.set(a.id, { x: ax, y: ay, w: actorW, h: ROW_H, kind: 'actor' });
    ay += ROW_H + 14 + GAP_Y;
  }
  const cx = MARGIN + actorW + GAP_X;
  let cy = MARGIN + 20 + Math.max(0, (contentH - casesH) / 2);
  for (const c of graph.cases) {
    pos.set(c.id, { x: cx, y: cy, w: caseW, h: ROW_H, kind: 'usecase' });
    cy += ROW_H + GAP_Y;
  }

  const body = [];
  for (const l of graph.links) {
    const a = pos.get(l.from), b = pos.get(l.to);
    if (!a || !b) continue;
    const p1 = a.kind === 'actor' ? { x: a.x + a.w / 2 - 6, y: a.y, w: 12, h: a.h } : a;
    const c = clipLine(p1, b);
    if (!c) continue;
    body.push(path(`M${c.x1.toFixed(1)},${c.y1.toFixed(1)} L${c.x2.toFixed(1)},${c.y2.toFixed(1)}`, { marker: null }));
  }

  for (const a of graph.actors) {
    const p = pos.get(a.id);
    body.push(actorGlyph(p.x, p.y + ROW_H / 2));
    body.push(label(p.x, p.y + ROW_H + 6, a.text));
  }
  for (const c of graph.cases) {
    const p = pos.get(c.id);
    body.push(`<ellipse class="dg-box dg-usecase" cx="${(p.x + p.w / 2).toFixed(1)}" cy="${(p.y + p.h / 2).toFixed(1)}" rx="${(p.w / 2).toFixed(1)}" ry="${(p.h / 2 + 4).toFixed(1)}"/>`);
    body.push(label(p.x + p.w / 2, p.y + p.h / 2, c.text));
  }

  return wrap(width, height, body.join(''), '用例图');
}

export { esc };
