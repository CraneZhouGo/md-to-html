#!/usr/bin/env node
// md2html <files...> [--out DIR] [--profile file.json] [--embed] [--index]
import { basename, dirname, extname, join, resolve } from 'node:path';
import { renderFile } from './render.mjs';
import { writeIndex } from './index-md.mjs';

function parseArgs(argv) {
  const files = [];
  const opts = { outDir: undefined, profilePath: undefined, embed: false, index: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') opts.outDir = argv[++i];
    else if (a === '--profile' || a === '-p') opts.profilePath = argv[++i];
    else if (a === '--embed') opts.embed = true;
    else if (a === '--index') opts.index = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else if (a.startsWith('-')) { console.error(`未知参数: ${a}`); process.exit(2); }
    else files.push(a);
  }
  return { files, opts };
}

function printHelp() {
  console.log(`md2html — markdown -> 单文件 HTML 阅读面

用法:
  md2html <file.md...> [选项]

选项:
  -o, --out <dir>      输出目录（默认与源文件同目录）
  -p, --profile <json> 个性化配置（只覆盖 token 层，见 docs/adr/0005）
      --embed          把相对路径的图片内联成 data URI
      --index          在输出目录额外生成 index.md
  -h, --help           显示帮助

约定:
  · 真源是 markdown，HTML 是可丢弃的阅读面（ADR-0001）
  · 无偏好时同一输入必得逐字节相同的输出（ADR-0005）
  · 不产出打印样式；需要纸面稿请用同目录下的 .md（ADR-0004）
`);
}

const { files, opts } = parseArgs(process.argv.slice(2));
if (!files.length) { printHelp(); process.exit(1); }

let failed = 0;
const rendered = [];
for (const f of files) {
  if (extname(f).toLowerCase() !== '.md') {
    console.error(`跳过（不是 .md）: ${f}`);
    failed++;
    continue;
  }
  try {
    const r = await renderFile(f, opts);
    const kb = (r.size / 1024).toFixed(1);
    const v = r.visual || {};
    const shape = [v.cards ? `卡片 ${v.cards}` : '', v.defs ? `定义 ${v.defs}` : '', v.steps ? `步骤 ${v.steps}` : '']
      .filter(Boolean).join(' · ');
    console.log(`✓ ${f} → ${r.outHtml}  (${kb} KB, ${r.chapters} 章${shape ? ', ' + shape : ''})`);
    if (r.warn) console.warn(`  ! 制品超过 2MB（${kb} KB）。ADR-0002：只告警，不自动切分。`);

    rendered.push({
      name: basename(f, extname(f)),
      title: r.title,               // front-matter title 优先，其次首个 h1，最后文件名
      category: r.category,
      updated: r.updated,
      dir: dirname(f),
    });
  } catch (err) {
    console.error(`✗ ${f}: ${err.message}`);
    failed++;
  }
}

if (opts.index && rendered.length) {
  const dir = opts.outDir || rendered[0].dir;
  const p = await writeIndex(rendered, join(resolve(dir), 'index.md'));
  console.log(`✓ 索引 → ${p}`);
}

process.exit(failed ? 1 : 0);
