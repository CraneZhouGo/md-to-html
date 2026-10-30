// 本地静态服务：file:// 下 iframe 是跨源，读不到 contentWindow，
// 也就没法在每题开始时把文档滚回顶部。起一个仅监听 127.0.0.1 的小服务解决这件事。

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join, normalize } from 'node:path';
import { exec } from 'node:child_process';

const root = resolve(process.cwd(), 'out/human');
const PORT = Number(process.env.PORT || 7788);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    const file = join(root, rel || 'harness.html');
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    const s = await stat(file).catch(() => null);
    const target = s && s.isDirectory() ? join(file, 'harness.html') : file;
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/harness.html`;
  console.log(`人因测试已启动：${url}`);
  console.log('（只监听 127.0.0.1，不对外。做完后 Ctrl+C 关掉。）');
  const open = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(open, () => {});
});
