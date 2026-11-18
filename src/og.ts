// The tags a chat app or a social site reads to show a link: Open Graph, and Twitter's large card.

/** What a link's preview shows. `image` is an absolute address, or left out for none. */
export interface Card {
  site: string;
  title: string;
  description: string;
  image?: string;
  /** The image's words for a screen reader; the title when left out. */
  alt?: string;
}

/** The size the large cards are drawn at, width by height. */
export const COVER_SIZE = [1200, 630] as const;

const ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Text made safe for HTML content or a quoted attribute. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITY[c] ?? c);

/** The meta tags for a card, one per line. */
export function tags(card: Card): string {
  const meta = (k: string, v: string, by = 'property') => `<meta ${by}="${k}" content="${esc(v)}">`;
  const out = [
    meta('og:type', 'website'),
    meta('og:site_name', card.site),
    meta('og:title', card.title),
    meta('og:description', card.description),
    meta('twitter:card', card.image ? 'summary_large_image' : 'summary', 'name'),
    meta('twitter:title', card.title, 'name'),
    meta('twitter:description', card.description, 'name'),
  ];
  if (card.image) {
    const alt = card.alt ?? card.title;
    out.push(
      meta('og:image', card.image),
      meta('og:image:width', String(COVER_SIZE[0])),
      meta('og:image:height', String(COVER_SIZE[1])),
      meta('og:image:alt', alt),
      meta('twitter:image', card.image, 'name'),
      meta('twitter:image:alt', alt, 'name'),
    );
  }
  return out.join('\n');
}

/** The page with the tags put in just before its </head>; the page as it was when it has none. */
export function inject(html: string, t: string): string {
  const at = html.search(/<\/head>/i);
  return at < 0 ? html : `${html.slice(0, at)}${t}\n${html.slice(at)}`;
}

const HOST = /^[A-Za-z0-9.-]{1,253}(:[0-9]{1,5})?$/;
const LOCAL = /^(localhost|127\.0\.0\.1)(:|$)/i;

/** A plain host (letters, digits, dots, hyphens, a port), lowercased, or null for anything else. */
export function cleanHost(x: unknown): string | null {
  const h = String(x ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return HOST.test(h) && !h.startsWith('.') && !h.startsWith('-') ? h.toLowerCase() : null;
}

/**
 * The origin an image address is made absolute with: the public site when it is set and plain,
 * else the Host a request came to when that is plain, else null. http for localhost only.
 */
export function originOf(host: unknown, site?: unknown): string | null {
  const h = cleanHost(site) ?? cleanHost(host);
  return h ? `${LOCAL.test(h) ? 'http' : 'https'}://${h}` : null;
}
