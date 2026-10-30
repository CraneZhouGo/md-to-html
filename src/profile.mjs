// 个性化：只覆盖 token 层（ADR-0005）。
// 允许的键：accent, accentSoft, content, fontSize, lineHeight, readerName, theme
// 未知键一律忽略，不报错（ADR-0005 的向后兼容要求）。

const ALLOWED = new Set(['accent', 'accentSoft', 'content', 'fontSize', 'lineHeight', 'readerName', 'theme']);

/**
 * @typedef {{accent?:string, accentSoft?:string, content?:string, fontSize?:string,
 *   lineHeight?:string, readerName?:string, theme?:'light'|'dark'}} Profile
 */

/** @param {unknown} raw @returns {Profile} */
export function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Profile} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED.has(k) || typeof v !== 'string') continue;
    if (k === 'theme' && v !== 'light' && v !== 'dark') continue;
    out[k] = v;
  }
  return out;
}

/** 生成 :root 覆盖块。空 profile 返回空串——无偏好时产物必须逐字节一致。 */
export function profileCss(profile) {
  /** @type {Record<string,string>} */
  const vars = {};
  if (profile.accent) vars['--accent'] = profile.accent;
  if (profile.accentSoft) vars['--accent-soft'] = profile.accentSoft;
  if (profile.content) vars['--content'] = profile.content;
  if (profile.fontSize) vars['--body-size'] = profile.fontSize;
  if (profile.lineHeight) vars['--body-lh'] = profile.lineHeight;
  const keys = Object.keys(vars).sort();
  if (!keys.length) return '';
  return `:root{${keys.map(k => `${k}:${vars[k]}`).join(';')}}`;
}
