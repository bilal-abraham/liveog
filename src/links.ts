// Link kinds: which paths are which kind, the words and generic cover each shows, and which are
// private. A private link's preview never holds its path (the code or token in it), and its answers
// keep it out of search, Referers and caches.
import { inject, tags, type Card } from './og.js';

export interface Kind {
  name: string;
  /** Is this path this kind? */
  match: (path: string) => boolean;
  title: string;
  description: string;
  alt?: string;
  /** The generic cover's path on your site, e.g. /og/join.png. */
  cover?: string;
  /** A link that holds a secret (an invite code, a share token). */
  private?: boolean;
}

/** A link's own cover, when one has been drawn for it: its path and, maybe, its own title. */
export interface Own {
  image: string;
  title?: string;
}

/** Headers for every answer at a private link, found or not. */
export const PRIVATE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'no-store',
});

export interface Links {
  /** The kind a path is; the fallback for any path no kind matches. */
  of(path: string): Kind;
  /** The card for a path: its own cover and title when given, else the kind's. */
  card(path: string, origin: string | null, own?: Own | null): Card;
  /** The headers this path's answers should carry. */
  headers(path: string): Record<string, string>;
  /** The page with the path's tags in its head. */
  page(html: string, path: string, origin: string | null, own?: Own | null): string;
}

/** Your site's links: its name, its kinds (first match wins), and the kind for everything else. */
export function links(site: string, kinds: readonly Kind[], fallback: Omit<Kind, 'match'>): Links {
  const rest: Kind = { ...fallback, match: () => true };
  const of = (path: string) => kinds.find((k) => k.match(path)) ?? rest;
  function card(path: string, origin: string | null, own?: Own | null): Card {
    const k = of(path);
    const title = own?.title || k.title;
    const image = own?.image || k.cover;
    const c: Card = { site, title, description: k.description };
    if (origin && image) {
      c.image = origin + image;
      c.alt = own?.title ? `${site}: ${own.title}` : (k.alt ?? title);
    }
    return c;
  }
  return {
    of,
    card,
    headers: (path) => (of(path).private ? { ...PRIVATE_HEADERS } : {}),
    page: (html, path, origin, own) => inject(html, tags(card(path, origin, own))),
  };
}
