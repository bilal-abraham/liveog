import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanHost, esc, inject, originOf, tags } from './og.js';

test('esc makes text safe in content and attributes', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc(null), '');
});

test('tags: a large card with an image, a small one without', () => {
  const t = tags({ site: 'limn', title: 'A "board"', description: 'You talk, it draws.', image: 'https://x.dev/og.png' });
  assert.match(t, /<meta property="og:title" content="A &quot;board&quot;">/);
  assert.match(t, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(t, /<meta property="og:image:width" content="1200">/);
  assert.match(t, /<meta property="og:image:alt" content="A &quot;board&quot;">/);
  const small = tags({ site: 'limn', title: 't', description: 'd' });
  assert.match(small, /content="summary"/);
  assert.doesNotMatch(small, /og:image/);
});

test('inject puts the tags before </head>, and leaves a page without one alone', () => {
  assert.equal(inject('<html><HEAD></HEAD></html>', 'T'), '<html><HEAD>T\n</HEAD></html>');
  assert.equal(inject('<p>no head</p>', 'T'), '<p>no head</p>');
});

test('cleanHost keeps a plain host only', () => {
  assert.equal(cleanHost('https://Limn.App/'), 'limn.app');
  assert.equal(cleanHost('localhost:8080'), 'localhost:8080');
  for (const bad of ['evil.com/x', 'a b', 'x.com"><script>', '-x.com', '.x.com', '', undefined, 'user@x.com'])
    assert.equal(cleanHost(bad), null, String(bad));
});

test('originOf prefers the public site, uses http for localhost only', () => {
  assert.equal(originOf('evil.example', 'limn.app'), 'https://limn.app');
  assert.equal(originOf('limn.app'), 'https://limn.app');
  assert.equal(originOf('localhost:3000'), 'http://localhost:3000');
  assert.equal(originOf('127.0.0.1'), 'http://127.0.0.1');
  assert.equal(originOf('x.com/<'), null);
  assert.equal(originOf('bad host', 'also bad'), null);
});
