// Covers: PNGs a browser drew (yours at build time, your user's at run time), checked and kept by
// your server, served at versioned addresses: /c/<id>/<v>.png. v goes up with each new picture,
// so a link pasted again names one no app has cached; an older v is sent to the newest; a new id
// ends the old picture's address (a share link stopped or replaced).
import { randomBytes } from 'node:crypto';
import { COVER_SIZE } from './og.js';

/** The most a cover may weigh. */
export const MAX_BYTES = 300 * 1024;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const u16 = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32 = (b: Uint8Array, i: number) => ((u16(b, i) << 16) >>> 0) + u16(b, i + 2);

/** An image's type and its width and height, read from its header (PNG, JPEG, GIF), or null. */
export function imageSize(b: Uint8Array): { type: 'png' | 'jpeg' | 'gif'; width: number; height: number } | null {
  if (b.length >= 24 && PNG.every((x, i) => b[i] === x) && String.fromCharCode(...b.subarray(12, 16)) === 'IHDR')
    return { type: 'png', width: u32(b, 16), height: u32(b, 20) };
  if (b.length >= 10 && String.fromCharCode(...b.subarray(0, 4)) === 'GIF8')
    return { type: 'gif', width: (b[6] ?? 0) | ((b[7] ?? 0) << 8), height: (b[8] ?? 0) | ((b[9] ?? 0) << 8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    // walk the segments to the frame header (SOF0..SOF15, not DHT, JPG or DAC)
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1] ?? 0;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { type: 'jpeg', width: u16(b, i + 7), height: u16(b, i + 5) };
      i += 2 + u16(b, i + 2);
    }
  }
  return null;
}

/** A PNG your server may keep as a cover: the signature, IHDR first, 1200 x 630, at most MAX_BYTES. */
export function isCover(b: Uint8Array): boolean {
  const s = b.length <= MAX_BYTES ? imageSize(b) : null;
  return s?.type === 'png' && s.width === COVER_SIZE[0] && s.height === COVER_SIZE[1];
}

/** A cover as you keep it: a random id made for it and nothing else, and its version. */
export interface Cover {
  id: string;
  v: number;
}
export const COVER_ID = /^[A-Za-z0-9_-]{22}$/;
export const newCoverId = (): string => randomBytes(16).toString('base64url');
export const coverPath = (c: Cover): string => `/c/${c.id}/${c.v}.png`;

/** The cover after a new picture: the same id one version up, or a new id at 1 when fresh (or none before). */
export const nextCover = (prev: Cover | null | undefined, fresh = false): Cover =>
  !prev || fresh || !COVER_ID.test(prev.id) ? { id: newCoverId(), v: 1 } : { id: prev.id, v: prev.v + 1 };

/** The id and version a cover address names, or null. */
export function parseCoverPath(path: string): Cover | null {
  const m = /^\/c\/([A-Za-z0-9_-]{22})\/([1-9][0-9]{0,8})\.png$/.exec(path);
  return m?.[1] && m[2] ? { id: m[1], v: Number(m[2]) } : null;
}

/** Headers for a cover's picture: a version never changes, but an hour, so a stopped link is not shown for long. */
export const COVER_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'content-type': 'image/png',
  'cache-control': 'public, max-age=3600',
  'x-robots-tag': 'noindex',
});

export type Answer = { status: 200; headers: Record<string, string> } | { status: 302; location: string } | { status: 404 };

/**
 * What to answer at a cover address, given the cover its id is now (null when it is nothing:
 * never made, stopped, replaced, deleted). The newest version is sent, an older one redirected.
 */
export function answer(asked: Cover | null, now: Cover | null): Answer {
  if (!asked || !now || asked.id !== now.id) return { status: 404 };
  if (asked.v !== now.v) return { status: 302, location: coverPath(now) };
  return { status: 200, headers: { ...COVER_HEADERS } };
}
