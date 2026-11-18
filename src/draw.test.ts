import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isCover } from './cover.js';
import { draw, findChrome } from './draw.js';

test('draw: a page becomes a 1200 x 630 cover', { skip: !findChrome() && 'no Chrome on this machine' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'liveog-test-'));
  try {
    const page = join(dir, 'cover.html');
    writeFileSync(page, '<!doctype html><body style="margin:0;background:#0a0a0a;color:#f2f2f2;font:96px sans-serif">liveog</body>');
    const out = join(dir, 'cover.png');
    assert.deepEqual(draw(page, out), { width: 1200, height: 630 });
    assert.equal(isCover(readFileSync(out)), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
