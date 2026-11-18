// A default cover, as an HTML page drawn at 1200 x 630: the site (or its mark) at the top, the
// title large at the bottom, a line under it. Black, white and grey unless you give it a look.
import { esc } from './og.js';

export interface Look {
  /** Background, text and quiet-text colours: hex, rgb(), hsl() or oklch(). */
  bg?: string;
  fg?: string;
  muted?: string;
  /** A CSS font-family list. */
  font?: string;
  /** The site's mark as inline SVG, shown in place of the site's name. Your own file: it is not cleaned. */
  mark?: string;
}

export interface CoverWords {
  title: string;
  site?: string;
  line?: string;
}

const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-z.,%/ +-]{1,60}\)|[a-z]{3,20})$/i;
const FONT = /^[\w\s,"'.-]{1,200}$/;
const pick = (x: string | undefined, ok: RegExp, d: string) => (x && ok.test(x.trim()) ? x.trim() : d);
const SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

/** The HTML of a 1200 x 630 cover, ready for draw(). */
export function coverHtml(w: CoverWords, look: Look = {}): string {
  const bg = pick(look.bg, COLOR, '#0a0a0a');
  const fg = pick(look.fg, COLOR, '#f2f2f2');
  const muted = pick(look.muted, COLOR, '#8a8a8a');
  const font = pick(look.font, FONT, SANS);
  const n = w.title.length;
  const size = n <= 18 ? 104 : n <= 36 ? 80 : n <= 70 ? 60 : 48;
  const top = look.mark ? `<div class="mark">${look.mark}</div>` : w.site ? `<div class="site">${esc(w.site)}</div>` : '<div></div>';
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: ${bg}; color: ${fg};
  font-family: ${font}; -webkit-font-smoothing: antialiased; }
.c { position: absolute; inset: 88px 96px; display: grid; grid-template-rows: auto 1fr; }
.site { font-size: 32px; line-height: 40px; font-weight: 500; letter-spacing: -.01em; }
.mark svg { display: block; height: 48px; width: auto; fill: currentColor; }
.words { align-self: end; }
h1 { margin: 0; font-size: ${size}px; line-height: 1.08; font-weight: 600; letter-spacing: -.03em;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
p { margin: 28px 0 0; font-size: 32px; line-height: 42px; color: ${muted};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body><div class="c">${top}<div class="words"><h1>${esc(w.title)}</h1>${w.line ? `<p>${esc(w.line)}</p>` : ''}</div></div></body></html>
`;
}
