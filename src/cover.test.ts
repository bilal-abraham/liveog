import assert from 'node:assert/strict';
import { test } from 'node:test';
import { png } from './png.test.util.js';
import { MAX_BYTES, answer, coverPath, imageSize, isCover, newCoverId, nextCover, parseCoverPath } from './cover.js';

test('imageSize reads PNG, GIF and JPEG headers', () => {
  assert.deepEqual(imageSize(png(1200, 630)), { type: 'png', width: 1200, height: 630 });
  assert.deepEqual(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x20, 0x00])), { type: 'gif', width: 16, height: 32 });
  // SOI, an APP0 of 4 bytes, then SOF0: precision, height 630, width 1200
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x02, 0x76, 0x04, 0xb0, 3, 0, 0, 0]);
  assert.deepEqual(imageSize(jpeg), { type: 'jpeg', width: 1200, height: 630 });
  assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
});

test('isCover: a 1200 x 630 PNG within the weight, nothing else', () => {
  assert.equal(isCover(png(1200, 630)), true);
  assert.equal(isCover(png(1200, 600)), false);
  assert.equal(isCover(png(1200, 630, MAX_BYTES + 1)), false);
  assert.equal(isCover(new Uint8Array(100)), false);
});

test('versions: the same id up by one, a fresh id when asked', () => {
  const a = nextCover(null);
  assert.equal(a.v, 1);
  assert.match(a.id, /^[A-Za-z0-9_-]{22}$/);
  const b = nextCover(a);
  assert.deepEqual(b, { id: a.id, v: 2 });
  const c = nextCover(b, true);
  assert.notEqual(c.id, a.id);
  assert.equal(c.v, 1);
  assert.notEqual(newCoverId(), newCoverId());
});

test('cover addresses round-trip, and nothing else parses', () => {
  const c = nextCover(null);
  assert.deepEqual(parseCoverPath(coverPath(c)), c);
  for (const bad of ['/c/short/1.png', `/c/${c.id}/0.png`, `/c/${c.id}/1.jpg`, `/c/${c.id}/1.png/x`, `/x/${c.id}/1.png`])
    assert.equal(parseCoverPath(bad), null, bad);
});

test('answer: the newest is sent, an older one redirected, anything else 404', () => {
  const now = { id: newCoverId(), v: 3 };
  assert.equal(answer({ ...now }, now).status, 200);
  assert.deepEqual(answer({ id: now.id, v: 1 }, now), { status: 302, location: coverPath(now) });
  assert.equal(answer({ id: newCoverId(), v: 3 }, now).status, 404);
  assert.equal(answer({ ...now }, null).status, 404);
  assert.equal(answer(null, now).status, 404);
});
