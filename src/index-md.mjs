// 目录索引：与渲染同源生成，不解析 HTML（ADR-0002：索引与目录不得漂移）
import { writeFile } from 'node:fs/promises';

/**
 * @param {{name:string,title:string,category?:string,updated?:string}[]} docs
 * @param {string} outPath
 */
export async function writeIndex(docs, outPath) {
  const sorted = [...docs].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const lines = [
    '# 文档索引',
    '',
    '> 本文件由 `md2html --index` 生成。HTML 是阅读面，markdown 是真源；两者同源，不得分叉维护。',
    '',
    '| 文档 | 分类 | 更新 | 阅读面 |',
    '| --- | --- | --- | --- |',
    ...sorted.map(d =>
      `| ${d.title} | ${d.category || '—'} | ${d.updated || '—'} | [${d.name}.html](./${d.name}.html) |`),
    '',
    `共 ${sorted.length} 篇。`,
    '',
  ];
  await writeFile(outPath, lines.join('\n'), 'utf8');
  return outPath;
}
