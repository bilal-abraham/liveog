// A default cover, as an HTML page drawn at 1200 x 630. One grid on even 96px sides: the site (or
// its mark) top left, a short tag top right, the title and a quiet line bottom left, and a
// picture bottom right whose foot sits on the line's. One font, two weights, three sizes.
// Black, white and grey unless you give it a look.
import { esc } from './og.js';

export interface Look {
  /** Background, text and quiet-text colours: hex, rgb(), hsl() or oklch(). */
  bg?: string;
  fg?: string;
  muted?: string;
  /** A CSS font-family list. */
  font?: string;
  /** The site's mark as inline SVG, shown before the site's name (or alone). Your own file: it is not cleaned. */
  mark?: string;
}

export interface CoverWords {
  title: string;
  site?: string;
  line?: string;
  /** A word or two, top right: "Live", "Sold", "Friday 8pm". */
  tag?: string;
  /** A picture for the bottom right, as inline SVG drawn in currentColor. Your own file: it is not cleaned. */
  art?: string;
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
  const size = n <= 16 ? 96 : n <= 30 ? 80 : n <= 56 ? 62 : 50;
  const site = look.mark || w.site ? `<div class="site">${look.mark ?? ''}${w.site ? `<span>${esc(w.site)}</span>` : ''}</div>` : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: ${bg}; color: ${fg};
  font-family: ${font}; -webkit-font-smoothing: antialiased; }
.c { position: absolute; inset: 80px 96px; display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr; column-gap: 64px; }
.site { grid-area: 1 / 1; display: flex; align-items: center; gap: 16px; font-size: 34px; line-height: 44px; font-weight: 600; letter-spacing: -.03em; }
.site svg { display: block; height: 44px; width: auto; fill: currentColor; }
.tag { grid-area: 1 / 2; justify-self: end; align-self: center; font-size: 22px; line-height: 1; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: ${muted}; }
.words { grid-area: 2 / 1; align-self: end; min-width: 0; }
h1 { margin: 0; font-size: ${size}px; line-height: 1.06; font-weight: 500; letter-spacing: -.035em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
p { margin: 24px 0 0; font-size: 34px; line-height: 44px; color: ${muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.art { grid-area: 2 / 2; align-self: end; height: 300px; }
.art svg { display: block; height: 100%; width: auto; }
</style></head><body><div class="c">${site}${w.tag ? `<div class="tag">${esc(w.tag)}</div>` : ''}<div class="words"><h1>${esc(w.title)}</h1>${w.line ? `<p>${esc(w.line)}</p>` : ''}</div>${w.art ? `<div class="art">${w.art}</div>` : ''}</div></body></html>
`;
}
