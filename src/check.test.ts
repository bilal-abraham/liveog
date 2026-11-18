import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, describe, readTags } from './check.js';
import { png } from './png.test.util.js';
import { links } from './links.js';

const site = links('limn', [], { name: 'plain', title: 'limn & co', description: 'You talk, it draws.', cover: '/og.png' });
const page = site.page('<html><head></head></html>', '/', 'https://limn.app');

test('readTags reads what tags() wrote', () => {
  const t = readTags(page);
  assert.equal(t['og:title'], 'limn & co');
  assert.equal(t['og:image'], 'https://limn.app/og.png');
  assert.equal(t['twitter:card'], 'summary_large_image');
  assert.deepEqual(readTags(`<meta name='twitter:title' content=x><meta property="og:title"><meta name="description" content="d">`), { 'twitter:title': 'x' });
});

const fake = (routes: Record<string, () => Response>): typeof fetch =>
  (async (u: string | URL | Request) => (routes[String(u)] ?? (() => new Response('', { status: 404 })))()) as typeof fetch;

test('check: a good link has no problems', async () => {
  const r = await check('https://limn.app/', fake({
    'https://limn.app/': () => new Response(page),
    'https://limn.app/og.png': () => new Response(png(1200, 630)),
  }));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.image && [r.image.type, r.image.width, r.image.height], ['png', 1200, 630]);
  assert.match(describe(r), /1200 x 630  png/);
});

test('check: says what is wrong', async () => {
  const r = await check('https://x.dev/', fake({
    'https://x.dev/': () => new Response('<head><meta property="og:image" content="http://x.dev/a.png"><meta property="og:image:width" content="1200"></head>'),
    'http://x.dev/a.png': () => new Response(png(800, 400)),
  }));
  const all = r.problems.join('\n');
  for (const p of ['No og:title', 'No og:description', 'not summary_large_image', 'not on https', '800 x 400', 'og:image:width'])
    assert.match(all, new RegExp(p), p);
  const rel = await check('https://x.dev/', fake({ 'https://x.dev/': () => new Response('<meta property="og:image" content="/a.png">') }));
  assert.match(rel.problems.join('\n'), /not absolute/);
});
