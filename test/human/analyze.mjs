// 分析人因测试结果：读 test/human/results/*.json，输出中位数/正确率/配对比较。
// 只有一名被试时也能跑——但必须在报告里如实标注样本量与局限。

import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, 'results');

const median = xs => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const mean = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
const s = ms => (ms / 1000).toFixed(1) + 's';

let files = [];
try { files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort(); } catch { /* 目录不存在 */ }

if (!files.length) {
  console.log('还没有结果。先跑 npm run human:build && npm run human:serve，做完把 JSON 放进 test/human/results/。');
  process.exit(0);
}

const all = [];
for (const f of files) {
  const data = JSON.parse(await readFile(join(dir, f), 'utf8'));
  for (const r of data.rows) all.push({ ...r, subject: f.replace(/\.json$/, '') });
}
const subjects = [...new Set(all.map(r => r.subject))];

console.log(`被试 ${subjects.length} 人，试次 ${all.length}，每题×条件 ${all.length / 2}。\n`);

const conds = ['md', 'html'];
const label = c => (c === 'md' ? 'MD 纯文本' : 'HTML 阅读面');

console.log('| 条件 | 完成试次 | 中位耗时 | 平均耗时 | 正确 | 正确率 | 跳过 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const c of conds) {
  const rows = all.filter(r => r.condition === c);
  const done = rows.filter(r => !r.skipped);
  const ok = rows.filter(r => r.correct).length;
  console.log(`| ${label(c)} | ${rows.length} | ${s(median(done.map(r => r.ms)))} | ${s(mean(done.map(r => r.ms)))} | ${ok}/${rows.length} | ${rows.length ? Math.round(ok / rows.length * 100) : 0}% | ${rows.length - done.length} |`);
}

// 配对比较：同一题在两种条件下的耗时差
console.log('\n同一题的条件差（正数=HTML 更快）：');
console.log('| 题 | MD | HTML | 差 |');
console.log('| --- | ---: | ---: | ---: |');
const ids = [...new Set(all.map(r => r.taskId))];
let htmlFaster = 0, mdFaster = 0;
for (const id of ids) {
  const md = all.find(r => r.taskId === id && r.condition === 'md' && !r.skipped);
  const ht = all.find(r => r.taskId === id && r.condition === 'html' && !r.skipped);
  if (!md || !ht) { console.log(`| ${id} | — | — | 数据不全 |`); continue; }
  const diff = md.ms - ht.ms;
  if (diff > 0) htmlFaster++; else mdFaster++;
  console.log(`| ${id} | ${s(md.ms)} | ${s(ht.ms)} | ${diff > 0 ? '+' : ''}${s(Math.abs(diff))} |`);
}

const mdAll = all.filter(r => r.condition === 'md' && !r.skipped).map(r => r.ms);
const htAll = all.filter(r => r.condition === 'html' && !r.skipped).map(r => r.ms);
const ratio = htAll.length && mdAll.length ? (median(mdAll) / median(htAll)) : 0;

console.log(`\n配对胜负：HTML 更快 ${htmlFaster} 题，MD 更快 ${mdFaster} 题。`);
console.log(`中位耗时之比：MD / HTML = ${ratio.toFixed(2)}×`);
console.log('\n注意：样本量小（尤其单人自测），学习效应与题目-条件耦合未完全抵消；');
console.log('这里的数字只用于判断"方向"和"量级"，不足以宣称普适结论。');
