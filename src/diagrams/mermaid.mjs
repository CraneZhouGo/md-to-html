// mermaid 子集 -> 内联 SVG（自己解析，不打包运行时；ADR-0009）。
// 支持：flowchart/graph（TD/TB/LR/BT/RL）、sequenceDiagram、stateDiagram-v2、erDiagram。
// 任何一行解析不了就整体返回 null —— 画错图比不画更糟。

import {
  esc, textWidth, boxWidth, wrap, label, shape, path, haloLabel, clipLine,
  MARGIN, BOX_H, CHAR_W, layerize,
} from './svg.mjs';
import { parseClass, drawClass } from './class.mjs';
import { parseUsecase, drawUsecase } from './usecase.mjs';
import { parseGantt, drawGantt } from './gantt.mjs';

const clean = s => String(s ?? '').trim();
const isBlank = s => !clean(s) || clean(s).startsWith('%%');

// ---------------- flowchart / graph ----------------

const SHAPES = [
  { re: /^([\w\u4e00-\u9fa5-]+)\(\((.+)\)\)$/, kind: 'terminal' },
  { re: /^([\w\u4e00-\u9fa5-]+)\[\((.+)\)\]$/, kind: 'round' },
  { re: /^([\w\u4e00-\u9fa5-]+)\((.+)\)$/, kind: 'round' },
  { re: /^([\w\u4e00-\u9fa5-]+)\{(.+)\}$/, kind: 'diamond' },
  { re: /^([\w\u4e00-\u9fa5-]+)\[(.+)\]$/, kind: 'rect' },
  { re: /^([\w\u4e00-\u9fa5-]+)$/, kind: 'rect' },
];

/** 解析一个节点片段，返回 {id, text, kind} 或 null */
function parseNodePart(s) {
  const t = clean(s);
  for (const { re, kind } of SHAPES) {
    const m = re.exec(t);
    if (m) return { id: m[1], text: m[2] !== undefined ? m[2] : m[1], kind };
  }
  return null;
}

const EDGE_RE = /\s*(-->|---|-\.->|==>|-.->)\s*(?:\|([^|]*)\|\s*)?/g;

export function parseFlowchart(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const head = /^(flowchart|graph)\s*(TD|TB|BT|LR|RL)?/i.exec(clean(lines[0]));
  if (!head) return null;
  const dir = (head[2] || 'TD').toUpperCase();

  /** @type {Map<string,{id:string,text:string,kind:string}>} */
  const nodes = new Map();
  /** @type {{from:string,to:string,label:string,dashed:boolean}[]} */
  const edges = [];
  const note = n => { if (!nodes.has(n.id)) nodes.set(n.id, n); };

  for (const raw of lines.slice(1)) {
    if (isBlank(raw)) continue;
    const line = clean(raw).replace(/;+$/, '');
    if (/^(subgraph|end|style|classDef|class|click|linkStyle)\b/.test(line)) return null;

    // 按边切分：A --> B -->|x| C
    const parts = [];
    let last = 0, m;
    EDGE_RE.lastIndex = 0;
    while ((m = EDGE_RE.exec(line))) {
      parts.push({ node: line.slice(last, m.index), edge: m[1], label: clean(m[2]) });
      last = m.index + m[0].length;
    }
    if (!parts.length) {
      const n = parseNodePart(line);
      if (!n) return null;
      note(n);
      continue;
    }
    parts.push({ node: line.slice(last), edge: null, label: '' });

    for (let i = 0; i < parts.length; i++) {
      const n = parseNodePart(parts[i].node);
      if (!n) return null;
      note(n);
      if (i > 0) {
        const prev = parseNodePart(parts[i - 1].node);
        edges.push({
          from: prev.id, to: n.id, label: parts[i - 1].label,
          dashed: /-\.->$|--$/.test(parts[i - 1].edge) && parts[i - 1].edge !== '-->',
        });
      }
    }
  }
  if (!edges.length) return null;
  return { type: 'flow', dir, nodes: [...nodes.values()], edges };
}

// ---------------- stateDiagram-v2 ----------------

export function parseState(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^stateDiagram(-v2)?\s*$/i.test(clean(lines[0]))) return null;

  /** @type {Map<string,{id:string,text:string,kind:string}>} */
  const nodes = new Map();
  /** @type {{from:string,to:string,label:string,dashed:boolean}[]} */
  const edges = [];
  const NOTE = /^([\w\u4e00-\u9fa5-]+|\[\*\])\s*-->\s*([\w\u4e00-\u9fa5-]+|\[\*\])\s*(?::\s*(.*))?$/;

  for (const raw of lines.slice(1)) {
    if (isBlank(raw)) continue;
    const line = clean(raw);
    const m = NOTE.exec(line);
    if (!m) return null;                       // 不认识的语句一律整体放弃
    for (const id of [m[1], m[2]]) {
      if (id === '[*]') continue;
      if (!nodes.has(id)) nodes.set(id, { id, text: id, kind: 'round' });
    }
    edges.push({ from: m[1], to: m[2], label: clean(m[3]), dashed: false });
  }
  if (!edges.length) return null;
  return { type: 'state', dir: 'TD', nodes: [...nodes.values()], edges };
}

// ---------------- sequenceDiagram ----------------

export function parseSequence(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^sequenceDiagram\s*$/i.test(clean(lines[0]))) return null;

  /** @type {{id:string,text:string}[]} */
  const actors = [];
  const seen = new Set();
  /** @type {{from:string,to:string,text:string,dashed:boolean}[]} */
  const msgs = [];
  const add = (id, text) => { if (!seen.has(id)) { seen.add(id); actors.push({ id, text: text || id }); } return id; };

  const PART = /^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/;
  // 端点用非贪婪：`S-->>U` 要解成 S -- >> U，而不是 S- + ->> U
  const MSG = /^(\S+?)\s*(-->>|->>|-->|->|--x|-x)\s*(\S+?)\s*:\s*(.*)$/;

  for (const raw of lines.slice(1)) {
    if (isBlank(raw)) continue;
    const line = clean(raw);
    const p = PART.exec(line);
    if (p) { add(p[2], clean(p[3])); continue; }
    const m = MSG.exec(line);
    if (m) {
      add(m[1]);
      add(m[3]);
      msgs.push({ from: m[1], to: m[3], text: clean(m[4]), dashed: m[2].startsWith('--') });
      continue;
    }
    return null;                                // Note/loop/activate 等暂不支持，整体放弃
  }
  if (!msgs.length) return null;
  return { type: 'sequence', actors, msgs };
}

// ---------------- erDiagram ----------------

const CARD = { '||': '1', 'o|': '0..1', '|o': '0..1', '|{': '1..N', '}o': '0..N', 'o{': '0..N' };

export function parseEr(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^erDiagram\s*$/i.test(clean(lines[0]))) return null;

  /** @type {Map<string,{id:string,attrs:{type:string,name:string}[]}>} */
  const ents = new Map();
  const ent = id => { if (!ents.has(id)) ents.set(id, { id, attrs: [] }); return ents.get(id); };
  /** @type {{a:string,b:string,la:string,lb:string,label:string}[]} */
  const rels = [];

  let openAttr = null;
  for (const raw of lines.slice(1)) {
    if (isBlank(raw)) continue;
    const line = clean(raw);

    if (openAttr) {
      if (line === '}') { openAttr = null; continue; }
      const m = /^(\S+)\s+(\S+)$/.exec(line);
      if (!m) return null;
      openAttr.attrs.push({ type: m[1], name: m[2] });
      continue;
    }

    const attrHead = /^(\S+)\s*\{$/.exec(line);
    if (attrHead) { openAttr = ent(attrHead[1]); continue; }

    const rel = /^(\S+)\s+([|}{o]+)--([|}{o]+)\s+(\S+)\s*:\s*(.*)$/.exec(line);
    if (rel) {
      ent(rel[1]); ent(rel[4]);
      rels.push({
        a: rel[1], b: rel[4],
        la: CARD[rel[2]] || rel[2], lb: CARD[rel[3]] || rel[3],
        label: clean(rel[5]),
      });
      continue;
    }
    return null;
  }
  if (openAttr) return null;
  if (!rels.length) return null;
  return { type: 'er', entities: [...ents.values()], rels };
}

// ---------------- 布局与绘制 ----------------

const GAP_X = 44, GAP_Y = 62, GAP_NODE_X = 26, GAP_NODE_Y = 22;
const fitsColumn = w => w <= 820;

function drawGraph(graph, { terminalIds = new Set() } = {}) {
  const { nodes, edges } = graph;
  const horiz = graph.dir === 'LR' || graph.dir === 'RL';
  const layers = layerize(nodes, edges);

  // 每个节点：宽度按文字、高度固定
  const size = new Map();
  for (const n of nodes) {
    const kind = terminalIds.has(n.id) ? 'terminal' : (n.kind || 'rect');
    const w = boxWidth(n.text, kind === 'diamond' ? 132 : 96);
    const h = kind === 'diamond' ? 64 : BOX_H;
    size.set(n.id, { w, h, kind });
  }

  const pos = new Map();
  if (!horiz) {
    const rowW = layers.map(l => l.reduce((a, n) => a + size.get(n.id).w, 0) + GAP_NODE_X * (l.length - 1));
    const contentW = Math.max(...rowW);
    const height = layers.reduce((a, l) => a + Math.max(...l.map(n => size.get(n.id).h)), 0) + GAP_Y * (layers.length - 1);
    let y = MARGIN;
    layers.forEach((l, li) => {
      const rowH = Math.max(...l.map(n => size.get(n.id).h));
      let x = MARGIN + (contentW - rowW[li]) / 2;
      for (const n of l) {
        const s = size.get(n.id);
        pos.set(n.id, { x, y: y + (rowH - s.h) / 2, ...s });
        x += s.w + GAP_NODE_X;
      }
      y += rowH + GAP_Y;
    });
    const width = contentW + MARGIN * 2;
    return { width, height: height + MARGIN * 2, pos, horiz: false };
  }

  const colH = layers.map(l => l.reduce((a, n) => a + size.get(n.id).h, 0) + GAP_NODE_Y * (l.length - 1));
  const contentH = Math.max(...colH);
  const width = layers.reduce((a, l) => a + Math.max(...l.map(n => size.get(n.id).w)), 0) + GAP_X * (layers.length - 1);
  let x = MARGIN;
  layers.forEach((l, li) => {
    const colW = Math.max(...l.map(n => size.get(n.id).w));
    let y = MARGIN + (contentH - colH[li]) / 2;
    for (const n of l) {
      const s = size.get(n.id);
      pos.set(n.id, { x, y, ...s });
      y += s.h + GAP_NODE_Y;
    }
    x += colW + GAP_X;
  });
  return { width: width + MARGIN * 2, height: contentH + MARGIN * 2, pos, horiz: true };
}

function drawFlow(graph) {
  const term = new Set();
  const targets = new Set(graph.edges.map(e => e.to));
  const sources = new Set(graph.edges.map(e => e.from));
  for (const n of graph.nodes) if (graph.nodes.length > 2 && !sources.has(n.id) && /开始|结束|start|end/i.test(n.text)) term.add(n.id);
  void targets;

  const { width, height, pos } = drawGraph(graph, { terminalIds: term });
  const body = [];
  for (const e of graph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    if (e.from === e.to) { // 自环
      const x = a.x + a.w, y = a.y + a.h / 2;
      body.push(path(`M${x},${y - 10} C${x + 46},${y - 26} ${x + 46},${y + 26} ${x},${y + 10}`, { dash: e.dashed }));
      if (e.label) body.push(haloLabel(x + 52, y, e.label));
      continue;
    }
    const c = clipLine(a, b);
    if (!c) continue;
    const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
    body.push(path(`M${c.x1.toFixed(1)},${c.y1.toFixed(1)} L${c.x2.toFixed(1)},${c.y2.toFixed(1)}`, { dash: e.dashed }));
    if (e.label) body.push(haloLabel(mx, my, e.label));
  }
  for (const n of graph.nodes) {
    const p = pos.get(n.id);
    if (p) body.push(shape(p.kind, p.x, p.y, p.w, p.h, n.text));
  }
  return wrap(width, height, body.join(''));
}

function drawState(graph) {
  const nodes = [];
  const edges = [];
  const pos = new Map();
  const START = 18;
  let order = 0;
  const ids = new Map();

  // [*] 不画成框，画成实心圆（起点）或双圆环（终点）
  for (const n of graph.nodes) ids.set(n.id, `n${order++}`);
  const pending = [];
  for (const e of graph.edges) {
    if (e.from === '[*]') { pending.push({ kind: 'start', to: e.to, label: e.label }); continue; }
    if (e.to === '[*]') { pending.push({ kind: 'end', from: e.from, label: e.label }); continue; }
    edges.push({ from: e.from, to: e.to, label: e.label, dashed: false });
  }
  nodes.push(...graph.nodes);
  const drawn = drawGraph({ dir: 'TD', nodes, edges }, {});
  const { width, height, pos: base } = drawn;
  for (const [k, v] of base) pos.set(k, v);
  void order; void ids;

  const body = [];
  // 起点圆与终点环放在对应节点的上方/下方
  let extraTop = 0;
  for (const p of pending) {
    if (p.kind === 'start') {
      const t = pos.get(p.to);
      if (!t) continue;
      const cx = t.x + t.w / 2, cy = t.y - 26;
      body.push(`<circle class="dg-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/>`);
      body.push(path(`M${cx.toFixed(1)},${(cy + 7).toFixed(1)} L${cx.toFixed(1)},${t.y.toFixed(1)}`));
      extraTop = Math.max(extraTop, 26);
    } else {
      const f = pos.get(p.from);
      if (!f) continue;
      const cx = f.x + f.w / 2, cy = f.y + f.h + 26;
      body.push(`<circle class="dg-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/>`);
      body.push(`<circle class="dg-dot-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11"/>`);
      body.push(path(`M${cx.toFixed(1)},${(f.y + f.h).toFixed(1)} L${cx.toFixed(1)},${(cy - 7).toFixed(1)}`));
    }
  }
  for (const e of edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    if (e.from === e.to) {
      const x = a.x + a.w, y = a.y + a.h / 2;
      body.push(path(`M${x},${y - 10} C${x + 40},${y - 24} ${x + 40},${y + 24} ${x},${y + 10}`));
      if (e.label) body.push(haloLabel(x + 46, y, e.label));
      continue;
    }
    const c = clipLine(a, b);
    if (!c) continue;
    body.push(path(`M${c.x1.toFixed(1)},${c.y1.toFixed(1)} L${c.x2.toFixed(1)},${c.y2.toFixed(1)}`));
    if (e.label) body.push(haloLabel((c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2, e.label));
  }
  for (const n of graph.nodes) {
    const p = pos.get(n.id);
    if (p) body.push(shape('round', p.x, p.y, p.w, p.h, n.text));
  }
  return wrap(width + MARGIN * 2, height + extraTop + 30, body.join(''));
}

function drawSequence(graph) {
  const { actors, msgs } = graph;
  const colW = actors.map(a => Math.max(96, boxWidth(a.text)));
  const gap = 56;
  const width = colW.reduce((x, w) => x + w, 0) + gap * (actors.length - 1) + MARGIN * 2;
  const cx = new Map();
  let x = MARGIN;
  actors.forEach((a, i) => { cx.set(a.id, x + colW[i] / 2); x += colW[i] + gap; });

  const top = MARGIN;
  const headH = 38;
  const step = 46;
  const lifeTop = top + headH;
  const lifeBottom = lifeTop + step * (msgs.length + 1) + 10;

  const body = [];
  // 生命线
  for (const a of actors) {
    body.push(`<path class="dg-lifeline" d="M${cx.get(a.id).toFixed(1)},${lifeTop} L${cx.get(a.id).toFixed(1)},${lifeBottom}"/>`);
  }
  // 参与者头
  actors.forEach((a, i) => {
    const w = colW[i], h = headH;
    body.push(`<rect class="dg-box" x="${(cx.get(a.id) - w / 2).toFixed(1)}" y="${top}" width="${w}" height="${h}" rx="6"/>`);
    body.push(label(cx.get(a.id), top + h / 2, a.text));
  });
  // 消息
  msgs.forEach((m, i) => {
    const y = lifeTop + step * (i + 1);
    const x1 = cx.get(m.from), x2 = cx.get(m.to);
    if (x1 === x2) {
      body.push(path(`M${x1.toFixed(1)},${y} C${(x1 + 54).toFixed(1)},${(y - 16).toFixed(1)} ${(x1 + 54).toFixed(1)},${(y + 16).toFixed(1)} ${x1.toFixed(1)},${(y + 18).toFixed(1)}`, { dash: m.dashed }));
      body.push(label(x1 + 62, y, m.text, 'dg-label', 'start'));
      return;
    }
    body.push(path(`M${x1.toFixed(1)},${y} L${x2.toFixed(1)},${y}`, { dash: m.dashed, marker: 'url(#dg-arrow-open)' }));
    body.push(label((x1 + x2) / 2, y - 12, m.text, 'dg-label'));
  });

  return wrap(width, lifeBottom + MARGIN, body.join(''), '时序图');
}

function drawEr(graph) {
  const { entities, rels } = graph;
  const box = new Map();
  const padX = 14, headH = 34, rowH = 20;
  for (const e of entities) {
    const titleW = boxWidth(e.id, 90);
    const attrW = e.attrs.length ? Math.max(...e.attrs.map(a => textWidth(`${a.type} ${a.name}`) * CHAR_W + padX * 2)) : 0;
    const w = Math.max(titleW, attrW, 120);
    const h = headH + (e.attrs.length ? e.attrs.length * rowH + 10 : 12);
    box.set(e.id, { w, h });
  }

  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(entities.length))));
  const colW = [];
  for (let c = 0; c < cols; c++) {
    colW[c] = Math.max(0, ...entities.filter((_, i) => i % cols === c).map(e => box.get(e.id).w));
  }
  const rowH2 = [];
  entities.forEach((e, i) => {
    const r = Math.floor(i / cols);
    rowH2[r] = Math.max(rowH2[r] || 0, box.get(e.id).h);
  });

  const pos = new Map();
  let y = MARGIN;
  entities.forEach((e, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const b = box.get(e.id);
    const x = MARGIN + colW.slice(0, c).reduce((a, w) => a + w + 40, 0);
    pos.set(e.id, { x, y, w: b.w, h: b.h, r });
    if (c === cols - 1 || i === entities.length - 1) {
      y += (rowH2[r] || b.h) + 52;
    }
  });

  const width = MARGIN * 2 + colW.reduce((a, w) => a + w, 0) + 40 * (cols - 1);
  const height = y - 52 + MARGIN;

  const body = [];
  for (const rel of rels) {
    const a = pos.get(rel.a), b = pos.get(rel.b);
    if (!a || !b) continue;
    const c = clipLine(a, b);
    if (!c) continue;
    body.push(path(`M${c.x1.toFixed(1)},${c.y1.toFixed(1)} L${c.x2.toFixed(1)},${c.y2.toFixed(1)}`, { marker: null, cls: 'dg-edge dg-rel' }));
    const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
    if (rel.label) body.push(haloLabel(mx, my - 10, rel.label));
    body.push(haloLabel(c.x1 + (c.x2 - c.x1) * 0.2, c.y1 + (c.y2 - c.y1) * 0.2, rel.la));
    body.push(haloLabel(c.x1 + (c.x2 - c.x1) * 0.8, c.y1 + (c.y2 - c.y1) * 0.8, rel.lb));
  }
  for (const e of entities) {
    const p = pos.get(e.id);
    body.push(`<rect class="dg-box" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="7"/>`);
    body.push(`<path class="dg-rule" d="M${p.x.toFixed(1)},${(p.y + headH).toFixed(1)} L${(p.x + p.w).toFixed(1)},${(p.y + headH).toFixed(1)}"/>`);
    body.push(label(p.x + p.w / 2, p.y + headH / 2, e.id));
    e.attrs.forEach((a, k) => {
      body.push(label(p.x + padX, p.y + headH + 12 + k * rowH, `${a.type} ${a.name}`, 'dg-attr', 'start'));
    });
  }
  return wrap(width, height, body.join(''), 'ER 图');
}

// ---------------- 入口 ----------------

/**
 * @param {string} src mermaid 源码
 * @returns {{svg:string}|null} 解析失败返回 null
 */
export function renderMermaid(src) {
  const first = clean(String(src).split(/\r?\n/)[0]);
  let graph = null;
  let drawer = null;

  if (/^(flowchart|graph)\b/i.test(first)) { graph = parseFlowchart(src); drawer = drawFlow; }
  else if (/^sequenceDiagram\b/i.test(first)) { graph = parseSequence(src); drawer = drawSequence; }
  else if (/^stateDiagram(-v2)?\b/i.test(first)) { graph = parseState(src); drawer = drawState; }
  else if (/^erDiagram\b/i.test(first)) { graph = parseEr(src); drawer = drawEr; }
  else if (/^classDiagram\b/i.test(first)) { graph = parseClass(src); drawer = drawClass; }
  else if (/^usecaseDiagram\b/i.test(first)) { graph = parseUsecase(src); drawer = drawUsecase; }
  else if (/^gantt\b/i.test(first)) { graph = parseGantt(src); drawer = drawGantt; }
  if (!graph) return null;

  const svg = drawer(graph);
  if (!svg) return null;
  // 太宽的图不画（宁可不画）：交给代码块原样显示
  const m = /width="(\d+)"/.exec(svg);
  if (m && Number(m[1]) > 1100) return null;
  return { svg, type: graph.type };
}

export { esc };
