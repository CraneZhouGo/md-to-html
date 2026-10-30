// 文档即测试：把 examples/ 下的真实文档当作渲染器的回归集。
// 与 determinism.mjs 的分工：那边测"不变量"（确定性、零依赖、不吞字），
// 这边测"这批真实文档能渲染出什么"——某个解析器悄悄坏掉时，这里会先红。

import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { renderFile } from '../src/render.mjs';

const EXAMPLES = new URL('../examples/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failures++;
};
const count = (hay, re) => (hay.match(re) || []).length;

// 期望清单：这是"这批文档应该长什么样"的记录。文档改了、图型退化了，这里会报。
const EXPECT = {
  'diagrams.md': {
    diagrams: { flow: 2, sequence: 1, state: 1, er: 1, class: 1, usecase: 1, gantt: 1, layered: 1 },
    asciiFigure: 0,       // 退回"文本图示"的块数
    fallbacks: 1,         // 故意不支持的 mermaid（Note）退回代码块
    mustContain: ['用户请求', '待支付', '需求评审', '上架商品'],
  },
  'Java服务架构演进与部署实践总结.md': {
    diagrams: { layered: 9, mapping: 1 },
    asciiFigure: 2,
    minTables: 4,
    minCards: 4,
    mustContain: ['Nginx', 'Kubernetes', 'Redis Session'],
  },
  // 第二份真实文档：文风完全不同（表格几乎没有，131 个 text 代码块）
  'Redis集群与高可用_Java高级开发面试复习.md': {
    diagrams: { layered: 19, mapping: 9 },
    asciiFigure: 1,
    minTables: 1,
    mustContain: ['Sentinel', 'Hash Slot', '16384', 'quorum'],
  },
};

const dir = await mkdtemp(join(tmpdir(), 'md2html-examples-'));
try {
  const files = (await readdir(EXAMPLES)).filter(f => extname(f) === '.md').sort();
  ok('examples/ 下找到示例文档', files.length >= 2, String(files.length));

  for (const name of files) {
    const src = join(EXAMPLES, name);
    const a = await renderFile(src, { outDir: join(dir, 'a') });
    const b = await renderFile(src, { outDir: join(dir, 'b') });
    const rawA = await readFile(a.outHtml);
    const rawB = await readFile(b.outHtml);
    const hash = x => createHash('sha256').update(x).digest('hex');

    ok(`${name} 渲染成功`, a.size > 1000, `${a.size} B`);
    ok(`${name} 逐字节可复现`, hash(rawA) === hash(rawB));

    const html = rawA.toString('utf8');
    const exp = EXPECT[name];
    if (!exp) continue;

    // —— 全局不变量：所有示例都必须满足 ——
    ok(`${name} 零网络依赖`, !/<link[^>]+stylesheet|@font-face|<script[^>]+src=/i.test(html));
    const svgs = [...html.matchAll(/<svg class="dg"[\s\S]*?<\/svg>/g)].map(m => m[0]);
    ok(`${name} SVG 内无外链与脚本`,
      svgs.every(s => !/\b(href|xlink:href)=|<script/i.test(s)));
    ok(`${name} SVG 宽度都在正文列内`,
      svgs.every(s => Number(/width="(\d+)"/.exec(s)?.[1] || 0) <= 1100));
    ok(`${name} SVG 文字都是 <text> 节点`,
      svgs.every(s => s.includes('<text')));

    // —— 按文档记录的具体期望 ——
    // 只统计 <figure> 标签本身：CSS 里也有 [data-kind="svg"] 选择器，直接全文匹配会多算一个
    const figs = [...html.matchAll(/<figure class="diagram"([^>]*)>/g)].map(m => m[1]);
    const svgFigs = figs.filter(a => /data-kind="svg"/.test(a));
    for (const [type, n] of Object.entries(exp.diagrams || {})) {
      const got = figs.filter(a => a.includes(`data-diagram="${type}"`)).length;
      ok(`${name}：${type} 图 × ${n}`, got === n, `实际 ${got}`);
    }
    if (exp.asciiFigure !== undefined) {
      const n = figs.filter(a => /data-kind="ascii"/.test(a)).length;
      ok(`${name}：退回文本图示 × ${exp.asciiFigure}`, n === exp.asciiFigure, `实际 ${n}`);
    }
    if (exp.fallbacks !== undefined) {
      const fb = count(html, /<pre data-lang="mermaid">/g);
      ok(`${name}：不支持的语法退回代码块 × ${exp.fallbacks}`, fb === exp.fallbacks, `实际 ${fb}`);
    }
    if (exp.minDiagrams !== undefined) {
      const n = count(html, /<svg class="dg"/g);
      ok(`${name}：图不少于 ${exp.minDiagrams} 张`, n >= exp.minDiagrams, `实际 ${n}`);
    }
    if (exp.minTables !== undefined) {
      const n = count(html, /<table>/g);
      ok(`${name}：保留表格不少于 ${exp.minTables}`, n >= exp.minTables, `实际 ${n}`);
    }
    if (exp.minCards !== undefined) {
      const n = count(html, /class="cmp-grid"/g);
      ok(`${name}：卡片组不少于 ${exp.minCards}`, n >= exp.minCards, `实际 ${n}`);
    }
    for (const t of exp.mustContain || []) {
      ok(`${name} 含「${t}」`, html.includes(t));
    }
  }

  // 索引与真源同源：md2html --index 的产物必须能对上渲染出的文件
  const first = files[0];
  const idx = join(dir, 'index.md');
  const { writeIndex } = await import('../src/index-md.mjs');
  await writeIndex(files.map(f => ({
    name: f.replace(/\.md$/, ''),
    title: f.replace(/\.md$/, ''),
  })), idx);
  const idxText = await readFile(idx, 'utf8');
  ok('索引列出全部示例', files.every(f => idxText.includes(f.replace(/\.md$/, '') + '.html')));

  await writeFile(join(dir, 'noop.txt'), '');
  await rm(dir, { recursive: true, force: true });
} catch (err) {
  console.error('示例回归异常:', err);
  failures++;
}

console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
