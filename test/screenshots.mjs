// README 截图：由 out/ 里的真实渲染产物截出 docs/assets/*.png。
// 用系统 Chrome（playwright-core 只带驱动，不下载浏览器），所以只在本机跑、不进 CI。
// 用法：npm run shots   （会先重新渲染 examples/）

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'assets');
const VIEW = { width: 1280, height: 820 };
const SCALE = 2; // 2× 缩放，GitHub 上缩放显示仍然清晰

const url = rel => pathToFileURL(path.join(ROOT, rel)).href;

function renderExamples() {
  const files = fs.readdirSync(path.join(ROOT, 'examples'))
    .filter(f => f.endsWith('.md'))
    .map(f => path.join('examples', f));
  execFileSync(process.execPath, ['src/cli.mjs', ...files, '--out', 'out/examples', '--index'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
}

// 首屏：连点两次截图，用同一份文档的白天/夜间对照
async function shootReadingSurface(page) {
  await page.goto(url('out/examples/Java服务架构演进与部署实践总结.html'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.screenshot({ path: path.join(OUT, 'reading-surface.png') });

  // 只切 data-theme，不动访问者的 localStorage
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: path.join(OUT, 'reading-surface-dark.png') });
}

// 图示：裁一段「用例图 + 排期图」，比单张 SVG 更能说明问题
async function shootDiagrams(page) {
  await page.goto(url('out/examples/diagrams.html'), { waitUntil: 'load' });
  const box = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(e => e.textContent.includes('用例图'));
    const figs = [...document.querySelectorAll('figure.diagram')];
    const last = figs[figs.length - 2];
    if (!h || !last) return null;
    const a = h.getBoundingClientRect();
    const b = last.getBoundingClientRect();
    return { x: a.left - 24, y: a.top + window.scrollY - 16, width: a.width + 48, height: b.bottom - a.top + 32 };
  });
  if (!box) throw new Error('没找到用例图/排期图，检查 examples/diagrams.md');
  await page.screenshot({ path: path.join(OUT, 'diagrams.png'), clip: box, fullPage: true });
}

renderExamples();
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  await shootReadingSurface(page);
  await shootDiagrams(page);
} finally {
  await browser.close();
}

for (const f of fs.readdirSync(OUT).sort()) {
  const kb = fs.statSync(path.join(OUT, f)).size / 1024;
  console.log(`✓ docs/assets/${f}  ${kb.toFixed(0)} KB`);
}
