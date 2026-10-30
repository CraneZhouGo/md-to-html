// 分析人因测试结果：读 test/human/results/*.json。
// 用法：
//   node test/human/analyze.mjs                 # 只用有效轮次
//   node test/human/analyze.mjs --all           # 连作废轮次一起算（对照用）
//   node test/human/analyze.mjs --exclude registry   # 剔除有歧义的题（敏感性分析）
// 标记 `"void": true` 的轮次默认不参与统计——作废数据照样留档，但不许影响结论。

import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, 'results');

const argv = process.argv.slice(2);
const useAll = argv.includes('--all');
const excludeArg = argv.find(a => a.startsWith('--exclude'));
const excludes = excludeArg
  ? (excludeArg.includes('=') ? excludeArg.split('=')[1] : argv[argv.indexOf(excludeArg) + 1] || '').split(',')
  : [];

const median = xs => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const mean = xs => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const s = ms => (ms / 1000).toFixed(1) + 's';

let files = [];
try { files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort(); } catch { /* 目录不存在 */ }
if (!files.length) {
  console.log('还没有结果。先 npm run human:build && npm run human:serve，做完把 JSON 放进 test/human/results/。');
  process.exit(0);
}

const rounds = [];
for (const f of files) {
  const data = JSON.parse(await readFile(join(dir, f), 'utf8'));
  rounds.push({ name: f.replace(/\.json$/, ''), void: !!data.void, reason: data.voidReason, rows: data.rows });
}

const valid = rounds.filter(r => useAll || !r.void);
const rows = valid.flatMap(r => r.rows.map(x => ({ ...x, round: r.name })))
  .filter(r => !excludes.includes(r.taskId));

console.log(`轮次：有效 ${valid.length}｜作废 ${rounds.length - valid.length}${useAll ? '（--all：作废的也算进来）' : ''}`);
if (excludes.length) console.log(`已剔除题目：${excludes.join(', ')}（敏感性分析）`);
for (const r of rounds) if (r.void) console.log(`  ⚠ ${r.name} 作废：${r.reason || '未注明原因'}`);
console.log('');

// 每轮一览：先看轮次之间的差异，避免把不同轮次混成一个数
console.log('| 轮次 | 有效 | MD 中位 | HTML 中位 | 比值 MD/HTML | 正确率 MD / HTML |');
console.log('| --- | --- | ---: | ---: | ---: | --- |');
for (const r of rounds) {
  const md = r.rows.filter(x => x.condition === 'md' && !x.skipped);
  const ht = r.rows.filter(x => x.condition === 'html' && !x.skipped);
  const ratio = ht.length && md.length ? (median(md.map(x => x.ms)) / median(ht.map(x => x.ms))) : 0;
  const acc = c => `${r.rows.filter(x => x.condition === c && x.correct).length}/${r.rows.filter(x => x.condition === c).length}`;
  console.log(`| ${r.name} | ${r.void ? '否' : '是'} | ${s(median(md.map(x => x.ms)))} | ${s(median(ht.map(x => x.ms)))} | ${ratio ? ratio.toFixed(2) + '×' : '—'} | ${acc('md')} / ${acc('html')} |`);
}

const mdAll = rows.filter(r => r.condition === 'md' && !r.skipped).map(r => r.ms);
const htAll = rows.filter(r => r.condition === 'html' && !r.skipped).map(r => r.ms);
const ratioAll = mdAll.length && htAll.length ? median(mdAll) / median(htAll) : 0;

console.log('\n## 合并（仅有效轮次）');
console.log('| 条件 | 完成试次 | 中位 | 平均 | 正确率 |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const c of ['md', 'html']) {
  const rs = rows.filter(r => r.condition === c);
  const done = rs.filter(r => !r.skipped);
  const ok = rs.filter(r => r.correct).length;
  console.log(`| ${c === 'md' ? 'MD 纯文本' : 'HTML 阅读面'} | ${rs.length} | ${s(median(done.map(x => x.ms)))} | ${s(mean(done.map(x => x.ms)))} | ${ok}/${rs.length} |`);
}

// 配对：按题聚合（多轮取中位），减小单次抖动
console.log('\n## 逐题配对（正数 = HTML 更快）');
console.log('| 题 | MD | HTML | 差 | 正确 MD/HTML |');
console.log('| --- | ---: | ---: | ---: | --- |');
const ids = [...new Set(rows.map(r => r.taskId))];
let htmlFaster = 0, mdFaster = 0;
for (const id of ids.sort()) {
  const md = rows.filter(r => r.taskId === id && r.condition === 'md' && !r.skipped).map(r => r.ms);
  const ht = rows.filter(r => r.taskId === id && r.condition === 'html' && !r.skipped).map(r => r.ms);
  if (!md.length || !ht.length) { console.log(`| ${id} | — | — | 数据不全 | — |`); continue; }
  const m = median(md), h = median(ht), diff = m - h;
  if (diff > 0) htmlFaster++; else mdFaster++;
  const acc = c => rows.filter(r => r.taskId === id && r.condition === c && r.correct).length;
  console.log(`| ${id} | ${s(m)} | ${s(h)} | ${diff > 0 ? '+' : ''}${s(Math.abs(diff))} | ${acc('md')} / ${acc('html')} |`);
}

console.log(`\n配对胜负：HTML 更快 ${htmlFaster} 题｜MD 更快 ${mdFaster} 题`);
console.log(`中位比 MD / HTML = ${ratioAll.toFixed(2)}×`);

// 离散度：如果题间差异远大于条件差异，说明"题目难度"才是主因
const spread = arr => Math.max(...arr) - Math.min(...arr);
console.log(`题间跨度：MD ${s(spread(mdAll))}｜HTML ${s(spread(htAll))}（跨度远大于条件差，说明难度主导）`);

console.log('\n判定（预注册）：≤0.8 支持｜0.8–1.0 不确定｜≥1.0 触发 ADR-0003 重开');
const verdict = ratioAll <= 0.8 ? '支持' : ratioAll >= 1.0 ? '触发重开' : '不确定';
console.log(`本轮：${ratioAll.toFixed(2)}× → ${verdict}`);
console.log('\n注意：N 很小（单人自测），题目难度差异远大于条件差异时，任何结论都只是方向性的。');
