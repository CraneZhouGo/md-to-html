// gantt 子集 -> 内联 SVG（路线图 / 排期）。
// 支持：title、dateFormat YYYY-MM-DD、section、任务行 `名称 :[id,] [after id | 日期,] 工期`
// 工期单位：d（天）/ w（周）。不支持 axisFormat/tickInterval/excludes 等，遇到即整体退回。

import { esc, wrap, label, MARGIN } from './svg.mjs';

const clean = s => String(s ?? '').trim();
const blank = s => !clean(s) || clean(s).startsWith('%%');

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const parseDate = s => {
  const m = DATE.exec(s);
  if (!m) return null;
  const d = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d) ? d : null;
};
const DAY = 86400000;
const DUR = /^(\d+)([dw])$/i;

export function parseGantt(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  if (!/^gantt\s*$/i.test(clean(lines[0]))) return null;

  let title = '';
  let dateFormat = null;
  let section = '';
  /** @type {{name:string,id:string,start:string,after:string,dur:string,section:string,line:number}[]} */
  const tasks = [];

  for (const raw of lines.slice(1)) {
    if (blank(raw)) continue;
    const line = clean(raw);
    if (/^title\s+/i.test(line)) { title = clean(line.slice(6)); continue; }
    if (/^dateFormat\s+/i.test(line)) {
      const f = clean(line.slice(11));
      if (f !== 'YYYY-MM-DD') return null;
      dateFormat = f;
      continue;
    }
    if (/^section\s+/i.test(line)) { section = clean(line.slice(8)); continue; }
    if (/:/.test(line)) {
      const [rawName, rawSpec] = line.split(/:(.+)/);
      const name = clean(rawName);
      const spec = clean(rawSpec).split(',').map(clean).filter(x => x !== '');
      if (!name || !spec.length) return null;
      let id = '', after = '', start = '', dur = '';
      for (const part of spec) {
        if (/^after\s+/i.test(part)) { after = clean(part.slice(6)); continue; }
        if (DUR.test(part)) { dur = part; continue; }
        if (DATE.test(part)) { start = part; continue; }
        if (/^[\w-]+$/.test(part) && !id) { id = part; continue; }
        return null;
      }
      if (!dur || (!start && !after)) return null;
      tasks.push({ name, id, after, start, dur, section, line: tasks.length });
      continue;
    }
    return null;
  }
  if (!tasks.length) return null;
  if (!dateFormat) return null;   // mermaid 允许省略，但省略后语义不清，这里要求写明
  return { type: 'gantt', title, tasks };
}

/** 采纳 after 依赖，算出每个任务的起止（天偏移） */
function schedule(tasks) {
  const byId = new Map(tasks.filter(t => t.id).map(t => [t.id, t]));
  const done = new Map();
  const span = t => {
    const m = DUR.exec(t.dur);
    const n = Number(m[1]);
    return m[2].toLowerCase() === 'w' ? n * 7 : n;
  };
  const resolve = (t, seen = new Set()) => {
    if (done.has(t)) return done.get(t);
    if (seen.has(t)) return null;              // after 成环
    seen.add(t);
    let start;
    if (t.start) start = parseDate(t.start);
    else {
      const dep = byId.get(t.after);
      if (!dep) return null;
      const r = resolve(dep, seen);
      if (!r) return null;
      start = r.end;
    }
    if (start === null) return null;
    const end = start + span(t) * DAY;
    const v = { start, end };
    done.set(t, v);
    return v;
  };
  const rows = [];
  for (const t of tasks) {
    const v = resolve(t);
    if (!v) return null;
    rows.push({ ...t, ...v });
  }
  return rows;
}

const ROW_H = 30, BAR_H = 14, LABEL_W = 168, PAD = 16;

export function drawGantt(graph) {
  const rows = schedule(graph.tasks);
  if (!rows) return null;

  const min = Math.min(...rows.map(r => r.start));
  const max = Math.max(...rows.map(r => r.end));
  const totalDays = Math.max(1, Math.round((max - min) / DAY));
  const scale = Math.max(3, Math.min(9, Math.floor(720 / totalDays)));   // px / 天
  const chartW = totalDays * scale;
  // 条形右侧还要写「20d」，不留这一段最后一个标签会出血被裁掉
  const BAR_LABEL_ROOM = 34;
  const width = MARGIN * 2 + LABEL_W + PAD + chartW + BAR_LABEL_ROOM;

  const x0 = MARGIN + LABEL_W + PAD;
  const y0 = MARGIN + 34;

  // 分区标题独占一段高度：否则它会压在上一行的任务名上（中文字形比英文高，视觉上直接叠字）
  const SECTION_H = 20;
  let extra = 0;
  const yOf = rows.map((r, i) => {
    if (i > 0 && r.section && r.section !== rows[i - 1].section) extra += SECTION_H;
    return y0 + i * ROW_H + extra;
  });
  const chartBottom = yOf[yOf.length - 1] + ROW_H;
  const height = MARGIN * 2 + 34 + rows.length * ROW_H + extra + 26;
  const dayX = d => x0 + Math.round((d - min) / DAY) * scale;

  const body = [];

  // 月份刻度：每遇到新的月份画一条竖线 + 标注
  let cursor = new Date(min);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const ticks = [];
  while (cursor.getTime() <= max) {
    const t = cursor.getTime();
    const text = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    // 起点所在月份：月初早于 min 时把刻度画在 min 上，否则轴上看不到第一个月
    ticks.push({ t: t < min ? min : t, text });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  for (const tick of ticks) {
    const x = dayX(tick.t);
    // 贴近右边界时刻度改写左对齐，不然文字会被 viewBox 裁掉
    const anchor = x > x0 + chartW - 60 ? 'end' : 'start';
    body.push(`<path class="dg-grid" d="M${x.toFixed(1)},${(y0 - 18).toFixed(1)} L${x.toFixed(1)},${chartBottom.toFixed(1)}"/>`);
    body.push(label(x, y0 - 24, tick.text, 'dg-attr', anchor));
  }

  // 分区底色
  let lastSection = null, startRow = 0;
  const flush = end => {
    if (lastSection === null) return;
    const y = yOf[startRow] + 2;
    const h = yOf[end - 1] + ROW_H - yOf[startRow] - 4;
    if (h > 0) body.push(`<rect class="dg-band" x="${x0}" y="${y.toFixed(1)}" width="${chartW}" height="${h.toFixed(1)}" rx="6"/>`);
  };
  rows.forEach((r, i) => {
    if (lastSection === null) { lastSection = r.section; startRow = i; return; }
    if (r.section !== lastSection) { flush(i); lastSection = r.section; startRow = i; }
  });
  flush(rows.length);

  // 任务条 + 名称
  rows.forEach((r, i) => {
    const y = yOf[i];
    body.push(label(MARGIN, y + ROW_H / 2, r.name, 'dg-attr', 'start'));
    const x = dayX(r.start);
    const w = Math.max(4, Math.round((r.end - r.start) / DAY) * scale);
    body.push(`<rect class="dg-bar" x="${x.toFixed(1)}" y="${(y + (ROW_H - BAR_H) / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${BAR_H}" rx="4"/>`);
    const dur = Math.round((r.end - r.start) / DAY);
    body.push(label(x + w + 8, y + ROW_H / 2, `${dur}d`, 'dg-attr', 'start'));
  });

  // 左侧分区名
  let prev = null;
  rows.forEach((r, i) => {
    if (!r.section || r.section === prev) return;
    prev = r.section;
    body.push(label(MARGIN, yOf[i] - 10, r.section, 'dg-strong', 'start'));
  });

  return wrap(width, height, body.join(''), graph.title || '排期图');
}

export { esc };
