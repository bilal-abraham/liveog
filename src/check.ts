// Checking a link's preview as an app would see it: the page's tags, then its image.
import { imageSize } from './cover.js';
import { COVER_SIZE } from './og.js';

const ATTR = /([A-Za-z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const UNESC: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'" };
const unesc = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (e) => UNESC[e] ?? e);

/** The og: and twitter: tags of a page (the first of each name), read from its <meta>s. */
export function readTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [m] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a: Record<string, string> = {};
    for (const x of m.matchAll(ATTR)) if (x[1]) a[x[1].toLowerCase()] = unesc(x[2] ?? x[3] ?? x[4] ?? '');
    const key = (a.property ?? a.name ?? '').toLowerCase();
    if (/^(og|twitter):/.test(key) && a.content !== undefined && !(key in out)) out[key] = a.content;
  }
  return out;
}

export interface Report {
  url: string;
  status: number;
  tags: Record<string, string>;
  image: { url: string; status: number; type: string | null; width?: number; height?: number; bytes: number } | null;
  problems: string[];
}

const PAGE_MAX = 2 * 1024 * 1024;
const IMAGE_MAX = 8 * 1024 * 1024;
const BIG = 5 * 1024 * 1024;

// a body read up to max bytes (more is cut off), so a huge answer is never held
async function body(res: Response, max: number): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let n = 0;
  const r = res.body?.getReader();
  while (r) {
    const { done, value } = await r.read();
    if (done) break;
    parts.push(value);
    n += value.length;
    if (n > max) { await r.cancel(); break; }
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const get = (url: string, f: typeof fetch) =>
  f(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'liveog (link preview check)' } });

/** Fetch a link as a preview bot would and say what its preview shows and what is wrong with it. */
export async function check(url: string, f: typeof fetch = globalThis.fetch): Promise<Report> {
  const problems: string[] = [];
  const res = await get(url, f);
  const html = new TextDecoder().decode(await body(res, PAGE_MAX));
  const tags = readTags(html);
  const r: Report = { url, status: res.status, tags, image: null, problems };
  if (!res.ok) problems.push(`The page answered ${res.status}.`);
  for (const k of ['og:title', 'og:description', 'og:image']) if (!tags[k]) problems.push(`No ${k}.`);
  const src = tags['og:image'] ?? tags['twitter:image'];
  if (!src) return r;
  if (tags['twitter:card'] !== 'summary_large_image') problems.push('twitter:card is not summary_large_image, so X shows a small card.');
  let abs: URL;
  try { abs = new URL(src); } catch { problems.push(`The image address is not absolute: ${src}`); return r; }
  if (abs.protocol !== 'https:') problems.push('The image is not on https: some apps will not show it.');
  const ir = await get(abs.href, f);
  const bytes = await body(ir, IMAGE_MAX);
  const size = imageSize(bytes);
  r.image = { url: abs.href, status: ir.status, type: size?.type ?? ir.headers.get('content-type'), bytes: bytes.length, ...(size ? { width: size.width, height: size.height } : {}) };
  if (!ir.ok) { problems.push(`The image answered ${ir.status}.`); return r; }
  if (bytes.length > BIG) problems.push('The image is over 5 MB: some apps skip it.');
  if (!size) problems.push('The image is not a PNG, JPEG or GIF this could read.');
  else if (size.width !== COVER_SIZE[0] || size.height !== COVER_SIZE[1]) problems.push(`The image is ${size.width} x ${size.height}, not ${COVER_SIZE.join(' x ')}.`);
  if (size && tags['og:image:width'] && Number(tags['og:image:width']) !== size.width) problems.push('og:image:width is not the image\'s width.');
  if (size && tags['og:image:height'] && Number(tags['og:image:height']) !== size.height) problems.push('og:image:height is not the image\'s height.');
  return r;
}

/** A report as plain lines. */
export function describe(r: Report): string {
  const t = r.tags;
  const lines = [`${r.url}  (${r.status})`, `  title        ${t['og:title'] ?? '-'}`, `  description  ${t['og:description'] ?? '-'}`];
  if (r.image) lines.push(`  image        ${r.image.url}  ${r.image.width ? `${r.image.width} x ${r.image.height}` : '?'}  ${r.image.type ?? '?'}  ${Math.ceil(r.image.bytes / 1024)} KB`);
  else lines.push(`  image        ${t['og:image'] ?? '-'}`);
  lines.push(r.problems.length ? r.problems.map((p) => `  ! ${p}`).join('\n') : '  ok');
  return lines.join('\n');
}
