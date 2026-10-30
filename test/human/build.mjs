// 生成人因测试用的三份文件到 out/human/：
//   doc-html.html  —— 渲染后的阅读面（真实产物）
//   doc-md.html    —— 原始 markdown 纯文本（模拟"在编辑器里读原文"）
//   harness.html   —— 计时台：iframe 载入文档 + 任务卡 + 记录
// 题目与种子来自 tasks.mjs，注入到 harness 模板里（file:// 下不能 fetch）。

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFile } from '../../src/render.mjs';
import { TASKS, CONFIG } from './tasks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = resolve(root, 'out/human');
const srcMd = resolve(root, 'examples/Java服务架构演进与部署实践总结.md');

await mkdir(outDir, { recursive: true });

// 1) 阅读面：直接用渲染器产出，保证被测的就是真实产物
const rendered = await renderFile(srcMd, { outDir });
await copyFile(rendered.outHtml, resolve(outDir, 'doc-html.html'));

// 2) 原始 markdown：模拟编辑器里的纯文本视图（等宽、无目录、无样式）
const md = await readFile(srcMd, 'utf8');
const mdHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>doc-md（原始 markdown）</title>
<style>
  html,body{margin:0;background:#fff}
  body{font:13px/1.55 ui-monospace,Consolas,"Liberation Mono","Microsoft YaHei",monospace;
    color:#1b1b1b;padding:18px 22px 40px;white-space:pre-wrap;word-break:break-word}
</style></head>
<body>${md.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</body></html>`;
await writeFile(resolve(outDir, 'doc-md.html'), mdHtml, 'utf8');

// 3) 计时台：把题库与配置注入模板
const tpl = await readFile(resolve(here, 'harness.template.html'), 'utf8');
const harness = tpl
  .replace('/*__TASKS__*/[]', JSON.stringify(TASKS, null, 2))
  .replace('/*__CONFIG__*/{}', JSON.stringify(CONFIG, null, 2));
await writeFile(resolve(outDir, 'harness.html'), harness, 'utf8');

console.log('✓ 生成 out/human/');
console.log(`  doc-html.html  ${(await readFile(resolve(outDir, 'doc-html.html'))).length} B`);
console.log(`  doc-md.html    ${mdHtml.length} B`);
console.log(`  harness.html   ${harness.length} B（${TASKS.length} 题 × ${CONFIG.conditions.length} 条件）`);
console.log('\n下一步：npm run human:serve  然后打开打印出的地址');
