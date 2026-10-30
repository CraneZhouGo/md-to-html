// 单文件制品的外壳：CSS 与 JS 全部内联，零网络请求（ADR-0002）。
// 视觉契约见 ADR-0007（用户钉住的 engineering docs 模板）。

/** @param {{title:string}} p */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CSS = String.raw`
:root{
  --bg:#f7f8fa; --surface:#fff; --surface-2:#f1f4f8; --text:#182230;
  --muted:#667085; --border:#e3e8ef; --accent:#5268e8; --accent-soft:#eef0ff;
  /* 代码块跟随强调色与主题，而不是固定黑底：亮色下是极淡的强调色底，暗色下是强调色混合的深底 */
  --code-bg:color-mix(in srgb, var(--accent) 7%, #ffffff);
  --code-border:color-mix(in srgb, var(--accent) 26%, var(--border));
  --code-text:var(--text); --success:#16805d; --warning:#a15c07;
  /* 语法高亮色板：全部由强调色 + 前景色推导，换强调色即整套跟着变 */
  --tok-kw:var(--accent);
  --tok-str:color-mix(in srgb, var(--accent) 45%, var(--text));
  --tok-num:color-mix(in srgb, var(--accent) 70%, var(--text));
  --tok-com:var(--muted);
  --tok-fn:color-mix(in srgb, var(--accent) 28%, var(--text));
  --tok-var:color-mix(in srgb, var(--accent) 60%, var(--text));
  --tok-punct:color-mix(in srgb, var(--text) 68%, transparent);
  --danger:#b42318; --shadow:0 8px 28px rgba(16,24,40,.05);
  --sidebar:252px; --toc:220px; --content:800px;
  --body-size:16px; --body-lh:1.78;
}
html[data-theme="dark"]{
  --bg:#0d1117; --surface:#141a23; --surface-2:#1b2430; --text:#e6edf3;
  --muted:#9aa7b5; --border:#2a3442; --accent:#9aa7ff; --accent-soft:#252947;
  --code-bg:color-mix(in srgb, var(--accent) 16%, #0b0d10);
  --code-border:color-mix(in srgb, var(--accent) 30%, var(--border));
  --code-text:var(--text); --success:#63d6a4; --warning:#f4bf75;
  --danger:#ff938b; --shadow:0 8px 28px rgba(0,0,0,.16);
}
*{box-sizing:border-box}
/* 只保留标题上的 scroll-margin-top；不要再加滚动容器的 padding 偏移，两者会相加变成 176px，跳转会落偏一格 */
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);
  font:var(--body-size)/var(--body-lh) Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
button,input{font:inherit}
button{cursor:pointer}
.topbar{height:60px;position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:18px;padding:0 24px;
  background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px;min-width:220px;font-weight:750;letter-spacing:-.02em}
.brand-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;
  background:var(--accent);color:#fff;font-size:13px;font-weight:800}
.crumb{color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
.icon-btn,.menu-btn{height:34px;min-width:36px;padding:0 10px;border:1px solid var(--border);
  border-radius:8px;background:var(--surface);color:var(--text);display:inline-flex;align-items:center}
.icon-btn:hover,.menu-btn:hover{background:var(--surface-2)}
.search{width:min(260px,25vw);height:35px;padding:0 12px;border:1px solid var(--border);
  border-radius:9px;background:var(--bg);color:var(--text);outline:none}
.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
.progress{position:fixed;top:59px;left:0;height:2px;background:var(--accent);width:0;z-index:30}
.tone-btn{padding:0 10px}
.tone-dot{display:block;width:14px;height:14px;border-radius:50%;background:var(--accent);
  box-shadow:inset 0 0 0 1px #00000024}
.tone-menu{position:absolute;right:70px;top:54px;z-index:40;width:238px;padding:12px;
  border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}
.tone-menu[hidden]{display:none}
.tone-title{margin:0 0 9px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.tone-swatches{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.tone-sw{height:22px;border-radius:6px;border:1px solid #0000001f;background:var(--sw);cursor:pointer}
.tone-sw[aria-pressed="true"]{outline:2px solid var(--text);outline-offset:2px}
.tone-custom{display:flex;align-items:center;gap:8px;margin:12px 0 9px;font-size:12px;color:var(--muted)}
.tone-custom input{width:36px;height:24px;padding:0;border:1px solid var(--border);border-radius:6px;background:none}
.tone-reset{width:100%;padding:6px;border:1px solid var(--border);border-radius:7px;
  background:var(--surface-2);color:var(--text);font-size:12px}
.tone-reset:hover{background:var(--border)}
.layout{display:grid;grid-template-columns:var(--sidebar) minmax(0,1fr) var(--toc);min-height:calc(100vh - 60px)}
.sidebar{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:28px 16px 36px 22px;
  border-right:1px solid var(--border);background:var(--surface)}
.nav-label{margin:0 0 12px 10px;color:var(--muted);font-size:11px;font-weight:800;
  letter-spacing:.12em;text-transform:uppercase}
.nav-list{list-style:none;padding:0;margin:0}
.nav-list li{margin:3px 0}
.nav-list a{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;
  color:var(--muted);font-size:13px;line-height:1.45;min-width:0;overflow:hidden}
.nav-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-list a:hover{background:var(--surface-2);color:var(--text);text-decoration:none}
.nav-list a.active{background:var(--accent-soft);color:var(--accent);font-weight:650}
.nav-list a:focus-visible,.toc-list a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.nav-dot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.6;flex:none}
.side-note{margin:30px 8px 0;padding:13px;border:1px solid var(--border);border-radius:10px;
  color:var(--muted);font-size:12px;line-height:1.6}
.side-note strong{display:block;color:var(--text);margin-bottom:3px}
main{min-width:0;padding:46px clamp(22px,5vw,72px) clamp(90px,42vh,520px)}
.article{max-width:var(--content);margin:0 auto}
.doc-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:18px;
  color:var(--muted);font-size:12px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid var(--border);
  border-radius:999px;background:var(--surface);font-size:11px;font-weight:650}
.pill.status{color:var(--success);border-color:color-mix(in srgb,var(--success) 30%,var(--border));
  background:color-mix(in srgb,var(--success) 7%,var(--surface))}
.pill.copy{color:var(--warning)}
h1,h2,h3,h4{line-height:1.3;letter-spacing:-.035em;scroll-margin-top:88px}
h1{font-size:clamp(30px,4vw,40px);margin:0 0 14px;font-weight:780}
.lead{font-size:17px;color:var(--muted);line-height:1.8;margin:0 0 25px;max-width:720px}
.doc-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:26px 0 34px}
.info-card{padding:13px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.info-label{font-size:11px;color:var(--muted);margin-bottom:3px}
.info-value{font-size:13px;font-weight:650;overflow-wrap:anywhere}
hr{border:0;border-top:1px solid var(--border);margin:32px 0}
h2{font-size:25px;margin:42px 0 15px;padding-top:5px}
h3{font-size:19px;margin:28px 0 10px}
h4{font-size:16px;margin:22px 0 8px}
p{margin:0 0 16px}
ul,ol{padding-left:24px;margin:10px 0 20px}
li{padding-left:3px;margin:5px 0}
blockquote{margin:20px 0;padding:14px 18px;border-left:3px solid var(--accent);
  border-radius:0 8px 8px 0;background:var(--accent-soft);color:var(--text)}
blockquote p:last-child{margin-bottom:0}
.callout{display:flex;gap:12px;margin:20px 0;padding:15px 17px;border:1px solid var(--border);
  border-radius:10px;background:var(--surface);border-left-width:1px}
.callout>div{min-width:0}
.callout p:last-child{margin-bottom:0}
.callout .callout-icon{font-weight:800;color:var(--accent)}
.callout.warning .callout-icon{color:var(--warning)}
.callout.danger .callout-icon{color:var(--danger)}
.tbl-wrap{overflow-x:auto;margin:18px 0 24px;border:1px solid var(--border);border-radius:10px}
table{width:100%;border-collapse:separate;border-spacing:0;margin:0;font-size:13.5px}
th,td{padding:11px 13px;text-align:left;vertical-align:top;
  border-bottom:1px solid var(--border);border-right:1px solid var(--border)}
th{background:var(--surface-2);font-weight:700}
tr:last-child td{border-bottom:0}
td:last-child,th:last-child{border-right:0}
tr:nth-child(even) td{background:color-mix(in srgb,var(--surface) 55%,var(--bg))}
td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
/* 数值列条形：贴在单元格底部，文字仍在上层，可选中可搜索 */
td.bar{background-image:linear-gradient(to right,
  color-mix(in srgb, var(--accent) 52%, transparent) 0 var(--w, 0%),
  transparent var(--w, 0%));
  background-repeat:no-repeat;background-size:100% 4px;background-position:0 100%}
tr:nth-child(even) td.bar{background-image:linear-gradient(to right,
  color-mix(in srgb, var(--accent) 52%, transparent) 0 var(--w, 0%),
  transparent var(--w, 0%)),none;background-color:color-mix(in srgb,var(--surface) 55%,var(--bg))}
.cmp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:18px 0 24px}
.cmp-card{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:14px 16px}
.cmp-key{margin:0 0 10px;font-size:14px;font-weight:700;overflow-wrap:anywhere}
.cmp-list{margin:0;display:grid;gap:7px}
.cmp-row{display:flex;gap:10px;align-items:baseline;font-size:13px}
.cmp-row dt{flex:none;min-width:74px;color:var(--muted);font-size:11px;letter-spacing:.04em}
.cmp-row dd{margin:0;overflow-wrap:anywhere}
.cmp-plain{margin:0;font-size:13.5px}
.defs{margin:18px 0 24px;border-top:1px solid var(--border)}
.def{display:grid;grid-template-columns:minmax(88px,158px) 1fr;gap:16px;
  padding:11px 2px;border-bottom:1px solid var(--border)}
.def dt{font-weight:650;overflow-wrap:anywhere}
.def dd{margin:0;overflow-wrap:anywhere}
.steps{list-style:none;padding:0;margin:18px 0 24px}
.steps li{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)}
.steps li:last-child{border-bottom:0}
.step-n{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
  background:color-mix(in srgb,var(--accent) 14%,var(--surface));
  color:var(--accent);font-size:11px;font-weight:700;margin-top:3px}
.step-b{min-width:0}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:.88em;
  padding:.16em .38em;border-radius:5px;
  background:color-mix(in srgb, var(--accent) 9%, var(--surface-2));overflow-wrap:anywhere}
pre{position:relative;overflow:auto;margin:18px 0 24px;padding:19px 20px;
  border:1px solid var(--code-border);
  border-radius:11px;background:var(--code-bg);color:var(--code-text);font-size:13px;
  line-height:1.7;tab-size:2}
/* ASCII 架构图：按"图"排版，不按"代码"排版。
   关键是行高——竖线/箭头是逐字符对齐的，行高一大就断成一节一节。 */
figure.diagram{margin:20px 0 26px}
figure.diagram pre{line-height:1.16;font-size:12.5px;padding:16px 18px;letter-spacing:0;
  background:color-mix(in srgb, var(--accent) 4%, var(--surface));
  border:1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
  color:var(--text)}
figure.diagram pre code{font-family:"Cascadia Mono","SFMono-Regular",Menlo,Consolas,
  "DejaVu Sans Mono","Microsoft YaHei",monospace}
/* 图示不需要 "TEXT" 这种语言标签（它本来就是文字画的图） */
figure.diagram pre[data-lang]::before{display:none}
figure.diagram pre[data-lang] code{margin-top:0}
figure.diagram pre code{color:var(--text)}
/* 内联 SVG 图示：颜色全部来自变量，跟随强调色与明暗主题 */
figure.diagram svg.dg{display:block;max-width:100%;height:auto;margin:0 auto}
.dg-box{fill:color-mix(in srgb, var(--accent) 7%, var(--surface));
  stroke:color-mix(in srgb, var(--accent) 30%, var(--border));stroke-width:1.25}
.dg-text{fill:var(--text);font-size:13px;
  font-family:"Cascadia Mono","SFMono-Regular",Menlo,Consolas,"Microsoft YaHei",monospace}
.dg-edge{fill:none;stroke:color-mix(in srgb, var(--accent) 45%, var(--border));stroke-width:1.25}
.dg-head{fill:color-mix(in srgb, var(--accent) 60%, var(--text))}
.dg-head-open{fill:none;stroke:color-mix(in srgb, var(--accent) 60%, var(--text));stroke-width:1.4}
.dg-round,.dg-terminal{fill:color-mix(in srgb, var(--accent) 4%, var(--surface))}
.dg-diamond{fill:color-mix(in srgb, var(--accent) 10%, var(--surface))}
.dg-dash{stroke-dasharray:5 4}
.dg-lifeline{stroke:color-mix(in srgb, var(--accent) 30%, var(--border));stroke-width:1;stroke-dasharray:4 5}
.dg-label{fill:var(--text);font-size:11px;stroke:var(--surface);stroke-width:3.5;paint-order:stroke}
.dg-attr{fill:var(--muted);font-size:11px;
  font-family:"Cascadia Mono","SFMono-Regular",Menlo,Consolas,"Microsoft YaHei",monospace}
.dg-rule{stroke:color-mix(in srgb, var(--accent) 25%, var(--border));stroke-width:1}
.dg-dot{fill:color-mix(in srgb, var(--accent) 70%, var(--text))}
.dg-dot-ring{fill:none;stroke:color-mix(in srgb, var(--accent) 70%, var(--text));stroke-width:1.2}
.dg-rel{stroke-width:1.4}
figure.diagram[data-kind="svg"]{padding:6px 0}
pre[data-lang]:not([data-lang=""])::before{content:attr(data-lang);position:absolute;top:9px;left:14px;
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
pre[data-lang]:not([data-lang=""]) code{display:block;margin-top:16px}
pre code{padding:0;background:transparent;color:inherit;font-size:inherit;overflow-wrap:normal}
.tok-kw{color:var(--tok-kw);font-weight:600}
.tok-str{color:var(--tok-str)}
.tok-num{color:var(--tok-num)}
.tok-com{color:var(--tok-com);font-style:italic}
.tok-fn{color:var(--tok-fn)}
.tok-var{color:var(--tok-var)}
.tok-punct{color:var(--tok-punct)}
.copy-code{position:absolute;right:9px;top:9px;padding:4px 8px;
  border:1px solid var(--code-border);border-radius:6px;
  background:color-mix(in srgb, var(--surface) 78%, transparent);color:var(--text);font-size:11px}
.copy-code:hover{background:var(--surface)}
.toc{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:32px 18px 30px 16px}
.toc-title{font-size:11px;font-weight:800;color:var(--muted);letter-spacing:.1em;margin-bottom:12px}
.toc-list{list-style:none;padding:0;margin:0;border-left:1px solid var(--border)}
.toc-list a{display:block;padding:5px 0 5px 13px;margin-left:-1px;border-left:2px solid transparent;
  color:var(--muted);font-size:12px;line-height:1.5;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toc-list a.level-3{padding-left:25px;font-size:11px}
.toc-list a.active{border-left-color:var(--accent);color:var(--accent);font-weight:650}
.toc-list>li{padding-top:12px}
.toc-list>li:first-child{padding-top:0}
.toc-group[hidden]{display:none}
.toc-group>ul{list-style:none;padding:0;margin:0}
.toc-chapter{margin:0 0 6px 13px;font-size:10px;letter-spacing:.08em;line-height:1.5;color:var(--muted);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toc-empty{margin:0 0 0 13px;font-size:11px;color:var(--muted)}
.doc-footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:58px;
  padding-top:18px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}
.mobile-menu{display:none}
@media(max-width:1180px){:root{--toc:185px;--sidebar:220px}.brand{min-width:190px}.toc{padding-right:10px}}
@media(max-width:900px){.layout{grid-template-columns:minmax(0,1fr)}.sidebar{display:none;position:fixed;
  z-index:25;left:0;top:60px;width:270px;height:calc(100vh - 60px);box-shadow:var(--shadow)}
  .sidebar.open{display:block}.toc{display:none}main{padding:32px 22px clamp(70px,40vh,420px)}
  .brand{min-width:auto}.crumb{display:none}.mobile-menu{display:inline-block}
  .doc-info{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.topbar{padding:0 12px;gap:8px}.brand-name{display:none}
  .search{width:36px;padding:0 8px}.search:focus{width:150px}.top-actions{gap:5px}
  main{padding:26px 17px clamp(60px,36vh,360px)}.doc-info{grid-template-columns:1fr}
  h2{font-size:22px}.lead{font-size:15px}}
`;

// 交互：只做四件事，且都不产生内容（ADR-0006：文字必须来自真源）
const JS = String.raw`
(() => {
  const article = document.getElementById('article');
  const tocList = document.getElementById('tocList');
  const navList = document.getElementById('navList');
  const headings = [...article.querySelectorAll('h2, h3')];

  // 锚点里的 hash 在浏览器里是 percent-encoded 的，必须解码后才能与元素 id 比较
  const decode = v => { try { return decodeURIComponent(v); } catch { return v; } };
  const fragOf = a => decode((a.hash || '').slice(1));

  const byId = new Map(headings.map(h => [h.id, h]));
  const chapterOf = new Map();
  let cur = null;
  headings.forEach(h => { if (h.tagName === 'H2') cur = h; chapterOf.set(h, cur || h); });

  const tocLinks = [...tocList.querySelectorAll('a')];
  const navLinks = [...navList.querySelectorAll('a')];
  const groups = [...tocList.querySelectorAll('.toc-group')];

  const THRESHOLD = 92;
  let ticking = false, lockedUntil = 0;

  // 右栏只显示当前章的小节分组；分组是静态写入的，这里只切换显隐
  const showGroup = ownerId => {
    groups.forEach(g => { g.hidden = g.dataset.owner !== ownerId; });
  };

  const setActive = id => {
    const h = byId.get(id);
    if (!h) return;
    const owner = chapterOf.get(h) || h;
    navLinks.forEach(a => a.classList.toggle('active', fragOf(a) === owner.id));
    showGroup(owner.id);
    tocLinks.forEach(a => a.classList.toggle('active', fragOf(a) === h.id));
  };

  const spy = () => {
    ticking = false;
    if (performance.now() < lockedUntil) return;
    let current = headings[0];
    for (const h of headings) if (h.getBoundingClientRect().top <= THRESHOLD) current = h;
    if (current) setActive(current.id);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, {passive:true});
  spy();

  const onClick = e => {
    const a = e.target.closest('a');
    if (!a || !a.hash) return;
    e.preventDefault();
    const id = fragOf(a);
    setActive(id);
    lockedUntil = performance.now() + 900;
    const t = byId.get(id);
    if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
    setTimeout(spy, 940);
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    history.replaceState(null, '', '#' + encodeURIComponent(id));
  };
  navList.addEventListener('click', onClick);
  tocList.addEventListener('click', onClick);

  // 代码复制
  article.querySelectorAll('pre').forEach(pre => {
    const b = document.createElement('button');
    b.className = 'copy-code'; b.type = 'button'; b.textContent = '复制代码';
    b.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      if (!code) return;
      try { await navigator.clipboard.writeText(code.innerText); b.textContent = '已复制'; }
      catch { b.textContent = '请手动复制'; }
      setTimeout(() => { b.textContent = '复制代码'; }, 1200);
    });
    pre.appendChild(b);
  });

  // 轻量查找：回车跳到下一处匹配
  const search = document.getElementById('search');
  let lastQuery = '', lastIndex = -1;
  search.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    const q = search.value.trim().toLocaleLowerCase();
    if (!q) return;
    if (q !== lastQuery) { lastQuery = q; lastIndex = -1; }
    const nodes = [...article.querySelectorAll('h1,h2,h3,h4,p,li,td,blockquote')];
    const hits = nodes.filter(n => n.textContent.toLocaleLowerCase().includes(q));
    if (!hits.length) { search.setCustomValidity('未找到匹配内容'); search.reportValidity(); return; }
    search.setCustomValidity('');
    lastIndex = (lastIndex + 1) % hits.length;
    hits[lastIndex].scrollIntoView({behavior:'smooth', block:'center'});
    hits[lastIndex].animate(
      [{backgroundColor:'color-mix(in srgb, var(--accent) 22%, transparent)'}, {backgroundColor:'transparent'}],
      {duration:1300});
  });

  // 强调色：token 层个性化，只存本机、不写进文件（ADR-0005）
  const toneBtn = document.getElementById('toneBtn');
  const toneMenu = document.getElementById('toneMenu');
  const swatches = [...document.querySelectorAll('.tone-sw')];
  const toneInput = document.getElementById('toneInput');
  const ACCENT_KEY = 'md2h-accent';

  const markSwatches = accent => {
    const v = String(accent || '').toLowerCase();
    swatches.forEach(b => b.setAttribute('aria-pressed',
      String(b.dataset.accent.toLowerCase() === v)));
  };
  const applyAccent = accent => {
    const el = document.documentElement;
    if (!accent) {
      el.style.removeProperty('--accent');
      el.style.removeProperty('--accent-soft');
    } else {
      el.style.setProperty('--accent', accent);
      el.style.setProperty('--accent-soft', 'color-mix(in srgb, ' + accent + ' 12%, transparent)');
    }
    markSwatches(accent);
    if (toneInput) toneInput.value = accent || '#5268e8';
  };
  let savedAccent = null;
  try { savedAccent = localStorage.getItem(ACCENT_KEY); } catch {}
  markSwatches(savedAccent);

  const closeTone = () => {
    toneMenu.hidden = true;
    toneBtn.setAttribute('aria-expanded', 'false');
  };
  toneBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    const willOpen = toneMenu.hidden;
    toneMenu.hidden = !willOpen;
    toneBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen && toneInput) toneInput.focus();
  });
  document.addEventListener('click', ev => {
    if (toneMenu.hidden) return;
    if (ev.target.closest('#toneMenu') || ev.target.closest('#toneBtn')) return;
    closeTone();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !toneMenu.hidden) { closeTone(); toneBtn.focus(); }
  });
  swatches.forEach(b => b.addEventListener('click', () => {
    applyAccent(b.dataset.accent);
    try { localStorage.setItem(ACCENT_KEY, b.dataset.accent); } catch {}
  }));
  if (toneInput) toneInput.addEventListener('input', () => {
    applyAccent(toneInput.value);
    try { localStorage.setItem(ACCENT_KEY, toneInput.value); } catch {}
  });
  document.getElementById('toneReset').addEventListener('click', () => {
    applyAccent(null);
    try { localStorage.removeItem(ACCENT_KEY); } catch {}
  });

  // 主题：跟随系统，点过则记住
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('md2h-theme');
    if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
    else if (matchMedia('(prefers-color-scheme: dark)').matches && !root.dataset.locked) root.dataset.theme = 'dark';
  } catch {}
  document.getElementById('themeBtn').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('md2h-theme', root.dataset.theme); } catch {}
  });
  const menu = document.getElementById('menuBtn');
  if (menu) menu.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  // 阅读进度
  const progress = document.getElementById('progress');
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
  };
  addEventListener('scroll', update, {passive:true});
  addEventListener('resize', update);
  update();
})();
`;

/**
 * @param {{
 *   title:string, description?:string, crumb:string,
 *   meta:{category?:string,status?:string,updated?:string,version?:string,
 *         type?:string,strength?:string,conclusion?:string,lead?:string,sourceMd?:string},
 *   navHtml:string, tocHtml:string, bodyHtml:string,
 *   profileCss?:string, theme?:string, badge?:string|null, sourceName:string
 * }} p
 */
export function renderPage(p) {
  const m = p.meta;
  const pills = [
    m.category ? `<span class="pill">${escapeHtml(m.category)}</span>` : '',
    m.status ? `<span class="pill status">● ${escapeHtml(m.status)}</span>` : '',
    p.badge ? `<span class="pill copy">${escapeHtml(p.badge)}</span>` : '',
    m.updated ? `<span>更新于 ${escapeHtml(m.updated)}</span>` : '',
    m.version ? `<span>·</span><span>${escapeHtml(m.version)}</span>` : '',
  ].filter(Boolean).join('\n        ');

  const cards = [
    ['文档类型', m.type], ['证据强度', m.strength], ['结论', m.conclusion],
  ].filter(([, v]) => v);
  const infoHtml = cards.length
    ? `<div class="doc-info">${cards.map(([k, v]) =>
        `<div class="info-card"><div class="info-label">${escapeHtml(k)}</div>` +
        `<div class="info-value">${escapeHtml(v)}</div></div>`).join('')}</div>`
    : '';

  return `<!doctype html>
<html lang="zh-CN" data-theme="${escapeHtml(p.theme || 'light')}"${p.theme ? ' data-locked="1"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(p.title)} · Engineering Docs</title>
<meta name="description" content="${escapeHtml(p.description || '')}">
<meta name="generator" content="md-to-html">
<meta name="md-source" content="${escapeHtml(p.sourceName)}">
<style>${CSS}${p.profileCss ? `\n/* profile */\n${p.profileCss}` : ''}</style>
<script>
/* 首屏前应用本机偏好，避免颜色闪烁（只读 localStorage，不写进文件） */
try{
  var r=document.documentElement;
  var acc=localStorage.getItem('md2h-accent');
  if(acc){r.style.setProperty('--accent',acc);
    r.style.setProperty('--accent-soft','color-mix(in srgb, '+acc+' 12%, transparent)');}
  var th=localStorage.getItem('md2h-theme');
  if(th==='dark'||th==='light'){r.dataset.theme=th;}
}catch(e){}
</script>
</head>
<body>
<div class="progress" id="progress"></div>

<header class="topbar">
  <button class="menu-btn mobile-menu" id="menuBtn" aria-label="打开文档导航">☰</button>
  <a class="brand" href="#"><span class="brand-mark">M</span><span class="brand-name">md-to-html</span></a>
  <div class="crumb">${escapeHtml(p.crumb)}</div>
  <div class="top-actions">
    <input class="search" id="search" type="search" placeholder="查找本页内容…" aria-label="查找本页内容">
    <button class="icon-btn tone-btn" id="toneBtn" aria-label="自定义强调色" title="自定义强调色" aria-expanded="false"><span class="tone-dot"></span></button>
    <button class="icon-btn" id="themeBtn" aria-label="切换明暗主题" title="切换明暗主题">◐</button>
    <a class="icon-btn" href="${escapeHtml(p.sourceName)}" title="查看原始 Markdown">↓ 原始 .md</a>
  </div>
  <div class="tone-menu" id="toneMenu" hidden>
    <p class="tone-title">强调色</p>
    <div class="tone-swatches" id="toneSwatches">
      <button class="tone-sw" type="button" data-accent="#5268e8" style="--sw:#5268e8" title="靖蓝（默认）" aria-label="靖蓝"></button>
      <button class="tone-sw" type="button" data-accent="#0b6bcb" style="--sw:#0b6bcb" title="工程蓝" aria-label="工程蓝"></button>
      <button class="tone-sw" type="button" data-accent="#0e7c86" style="--sw:#0e7c86" title="青" aria-label="青"></button>
      <button class="tone-sw" type="button" data-accent="#16805d" style="--sw:#16805d" title="绿" aria-label="绿"></button>
      <button class="tone-sw" type="button" data-accent="#7c3aed" style="--sw:#7c3aed" title="紫" aria-label="紫"></button>
      <button class="tone-sw" type="button" data-accent="#b45309" style="--sw:#b45309" title="琥珀" aria-label="琥珀"></button>
    </div>
    <label class="tone-custom">自定义 <input type="color" id="toneInput" value="#5268e8" aria-label="自定义强调色"></label>
    <button class="tone-reset" id="toneReset" type="button">恢复默认</button>
  </div>
</header>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <p class="nav-label">文档导航</p>
    <ul class="nav-list" id="navList">
${p.navHtml}
    </ul>
    <div class="side-note">
      <strong>真源</strong>
      本页由 <code>${escapeHtml(p.sourceName)}</code> 渲染；导航与目录从正文标题生成，不额外写入内容。
    </div>
  </aside>

  <main>
    <article class="article" id="article">
      <div class="doc-meta">
        ${pills}
      </div>
${m.title !== undefined ? '' : ''}
      <h1 id="top">${escapeHtml(p.title)}</h1>
${m.lead ? `      <p class="lead">${escapeHtml(m.lead)}</p>\n` : ''}${infoHtml}
${p.bodyHtml}
      <div class="doc-footer">
        <span>由 <code>${escapeHtml(p.sourceName)}</code> 渲染 · 确定性输出</span>
        ${m.updated ? `<span>最后更新：${escapeHtml(m.updated)}</span>` : ''}
      </div>
    </article>
  </main>

  <aside class="toc">
    <div class="toc-title">本页目录</div>
    <ul class="toc-list" id="tocList">
${p.tocHtml}
    </ul>
  </aside>
</div>

<script>${JS}</script>
</body>
</html>
`;
}
