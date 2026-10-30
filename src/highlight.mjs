// 轻量语法高亮：固定关键字表 + 单遍扫描，不引入第三方着色器（保持零网络、确定性输出）。
// 产出 <span class="tok-*">，颜色由强调色推导（见 template.mjs 的 --tok-* 变量）。
// 不是完整语法分析：只求"读代码时能快速分辨结构"，错了也只是掉回普通文本。

const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** @typedef {{cls:string, re:RegExp}} Rule */
/** 规则按顺序尝试，第一个命中者胜出；全部不命中则前进一个字符 */
const LANG = {
  js: [
    { cls: 'com', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { cls: 'str', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y },
    { cls: 'num', re: /\b(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y },
    { cls: 'kw', re: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|class|new|extends|super|this|await|async|import|export|from|as|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|yield|static|get|set|null|undefined|true|false)\b/y },
    { cls: 'fn', re: /\b[A-Za-z_$][\w$]*(?=\s*\()/y },
    { cls: 'punct', re: /[{}()[\];,.:=+\-*/%<>!&|?~^]+/y },
  ],
  python: [
    { cls: 'com', re: /#[^\n]*/y },
    { cls: 'str', re: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y },
    { cls: 'num', re: /\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
    { cls: 'kw', re: /\b(?:def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|lambda|pass|global|nonlocal|assert|yield|del|not|and|or|in|is|None|True|False|self)\b/y },
    { cls: 'fn', re: /\b[A-Za-z_]\w*(?=\s*\()/y },
    { cls: 'punct', re: /[{}()[\];,.:=+\-*/%<>!&|?~^]+/y },
  ],
  bash: [
    { cls: 'com', re: /(?<![$\w])#[^\n]*/y },
    { cls: 'str', re: /"(?:[^"\\]|\\.)*"|'[^']*'/y },
    { cls: 'kw', re: /\b(?:if|then|elif|else|fi|for|in|do|done|while|until|case|esac|function|export|local|return|echo|cd|set|source|shift|exit|sudo|npm|node|git)\b/y },
    { cls: 'var', re: /\$\{[^}]*\}|\$[A-Za-z_]\w*|\$[0-9@*#?]/y },
    { cls: 'num', re: /\b\d+(?:\.\d+)?\b/y },
    { cls: 'punct', re: /[{}()[\];,.:=+\-*/%<>!&|?~^]+/y },
  ],
  json: [
    { cls: 'str', re: /"(?:[^"\\\n]|\\.)*"/y },
    { cls: 'num', re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
    { cls: 'kw', re: /\b(?:true|false|null)\b/y },
    { cls: 'punct', re: /[{}[\],:]+/y },
  ],
  html: [
    { cls: 'com', re: /<!--[\s\S]*?-->/y },
    { cls: 'kw', re: /<\/?[A-Za-z][\w:-]*|\/?>/y },
    { cls: 'fn', re: /\b[A-Za-z-]+(?==)/y },
    { cls: 'str', re: /"(?:[^"]*)"|'(?:[^']*)'/y },
  ],
  css: [
    { cls: 'com', re: /\/\*[\s\S]*?\*\//y },
    { cls: 'str', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y },
    { cls: 'kw', re: /@[\w-]+/y },
    { cls: 'fn', re: /[\w-]+(?=\s*:)/y },
    { cls: 'num', re: /-?\b\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b/y },
    { cls: 'var', re: /--[\w-]+|var(?=\()/y },
    { cls: 'punct', re: /[{}();:,]+/y },
  ],
  sql: [
    { cls: 'com', re: /--[^\n]*|\/\*[\s\S]*?\*\//y },
    { cls: 'str', re: /'(?:[^']|'')*'/y },
    { cls: 'kw', re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|ASC|DESC)\b/iy },
    { cls: 'num', re: /\b\d+(?:\.\d+)?\b/y },
    { cls: 'punct', re: /[(),;*=<>]+/y },
  ],
};

const ALIAS = {
  js: 'js', javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', mjs: 'js', cjs: 'js',
  py: 'python', python: 'python',
  sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  json: 'json', jsonc: 'json',
  html: 'html', xml: 'html', svg: 'html', vue: 'html',
  css: 'css', scss: 'css', less: 'css',
  sql: 'sql',
};

/**
 * @param {string} code 原始代码（未转义）
 * @param {string} lang 语言标记
 * @returns {{html:string, lang:string, highlighted:boolean}}
 */
export function highlight(code, lang) {
  const key = ALIAS[String(lang || '').toLowerCase()];
  if (!key) return { html: escapeHtml(code), lang: lang || '', highlighted: false };

  const rules = LANG[key];
  const src = code.replace(/\r\n/g, '\n');
  let out = '';
  let plain = '';
  let i = 0;

  const flush = () => { if (plain) { out += escapeHtml(plain); plain = ''; } };

  outer: while (i < src.length) {
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(src);
      if (m && m[0].length > 0) {
        flush();
        out += `<span class="tok-${rule.cls}">${escapeHtml(m[0])}</span>`;
        i += m[0].length;
        continue outer;
      }
    }
    plain += src[i];
    i++;
  }
  flush();
  return { html: out, lang: key, highlighted: true };
}
