// 「映射图」：多行 A → B 的对应关系（主从映射、强弱一致读路由…）。
// 这是第二份真实文档里最常见的形状，也是分层解析器明确拒绝的那一类（多链）。
// 硬约束不变：文字全部是 <text>，可搜可选中（ADR-0006 / 0008）。

import { textWidth, boxWidth, wrap, label, path, MARGIN, BOX_H, CHAR_W } from './svg.mjs';

const clean = s => String(s).trim();
const ARROW = /\s*(?:\u2192|->)\s*/;
const MAX_NODE_W = 40;

/**
 * 解析：空行分组，组内每行 `左边 → 右边`；以 `→` 开头的行继承上一行的左边。
 * 只接受"每行最多一个箭头"的形状，其他一律返回 null。
 * @returns {{groups:{left:string,right:string}[][]}|null}
 */
export function parseMapping(src) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  /** @type {{left:string,right:string}[][]} */
  const groups = [];
  /** @type {{left:string,right:string}[]} */ let cur = [];
  let lastLeft = '';
  let pending = '';   // 上一行没有箭头，等下一行的 `→` 来接
  let arrows = 0;

  const flush = () => { if (cur.length) { groups.push(cur); cur = []; } };

  for (const raw of lines) {
    if (!raw.trim()) { flush(); lastLeft = ''; continue; }
    const t = clean(raw).replace(/\uFEFF/g, '');
    const parts = t.split(ARROW);
    if (parts.length === 1) {
      // 无箭头的一行：可能是下一条映射的"左侧"（`读压力大` 换行 `→ Replica`），先记下
      pending = t;
      continue;
    }
    if (parts.length > 2) return null;                // 一行多个箭头：交给分层解析器
    arrows++;
    const [a, b] = parts;
    if (!clean(b)) return null;
    if (!clean(a)) {                                  // 右侧单独成行：左边来自上一行
      const left = lastLeft || pending;
      if (!left) return null;
      lastLeft = left;
      pending = '';
      cur.push({ left, right: clean(b) });
      continue;
    }
    lastLeft = clean(a);
    pending = '';
    cur.push({ left: lastLeft, right: clean(b) });
  }
  flush();

  const rows = groups.flat();
  if (rows.length < 2 || rows.length > 24) return null;
  if (groups.length < 1) return null;
  if (arrows < 2) return null;
  if (rows.some(r => textWidth(r.left) > MAX_NODE_W || textWidth(r.right) > MAX_NODE_W)) return null;
  return { groups };
}

const ROW_H = 36, ROW_GAP = 10, GROUP_GAP = 20, ARROW_W = 46;

export function renderMappingSvg(graph) {
  const rows = graph.groups.flat();
  const wLeft = Math.max(...rows.map(r => boxWidth(r.left, 90)));
  const wRight = Math.max(...rows.map(r => boxWidth(r.right, 90)));
  const width = MARGIN * 2 + wLeft + ARROW_W + wRight;

  const body = [];
  let y = MARGIN;
  for (const group of graph.groups) {
    for (const row of group) {
      body.push(`<rect class="dg-box" x="${MARGIN}" y="${y.toFixed(1)}" width="${wLeft}" height="${BOX_H}" rx="8"/>`);
      body.push(label(MARGIN + wLeft / 2, y + BOX_H / 2, row.left));
      const x2 = MARGIN + wLeft + ARROW_W;
      body.push(`<rect class="dg-box" x="${x2}" y="${y.toFixed(1)}" width="${wRight}" height="${BOX_H}" rx="8"/>`);
      body.push(label(x2 + wRight / 2, y + BOX_H / 2, row.right));
      const ax = MARGIN + wLeft + 6, ay = y + BOX_H / 2;
      body.push(path(`M${ax.toFixed(1)},${ay.toFixed(1)} L${(x2 - 6).toFixed(1)},${ay.toFixed(1)}`));
      y += BOX_H + ROW_GAP;
    }
    y += GROUP_GAP - ROW_GAP;   // 组间多留一点空隙
  }

  const height = Math.round(y - ROW_GAP + MARGIN);
  return { svg: wrap(width, height, body.join(''), '映射图'), width: Math.round(width), height };
}

export { CHAR_W };
