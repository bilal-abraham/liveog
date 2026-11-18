import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRIVATE_HEADERS, links } from './links.js';

const TOKEN = 'Zq3r9xY_secret-token-abcdefghijklmnopqrstu';
const site = links('limn', [
  { name: 'join', match: (p) => /^\/join\/[^/]+$/.test(p), title: 'Join a board', description: 'On limn.', cover: '/og/join.png', alt: 'limn: join a board', private: true },
  { name: 'share', match: (p) => p.startsWith('/s/'), title: 'A board', description: 'On limn.', private: true },
], { name: 'plain', title: 'limn', description: 'You talk, it draws.', cover: '/og/limn.png' });

test('of: first match, else the fallback', () => {
  assert.equal(site.of('/join/abc').name, 'join');
  assert.equal(site.of(`/s/${TOKEN}`).name, 'share');
  assert.equal(site.of('/').name, 'plain');
  assert.equal(site.of('/join/a/b').name, 'plain');
});

test('card: the kind\'s cover, absolute; none without an origin', () => {
  assert.deepEqual(site.card('/join/abc', 'https://limn.app'), {
    site: 'limn', title: 'Join a board', description: 'On limn.', image: 'https://limn.app/og/join.png', alt: 'limn: join a board',
  });
  assert.equal(site.card('/join/abc', null).image, undefined);
  assert.equal(site.card(`/s/${TOKEN}`, 'https://limn.app').image, undefined);
});

test('card: a link\'s own cover and title win', () => {
  const c = site.card('/join/abc', 'https://limn.app', { image: '/c/id/2.png', title: 'Join Q4 plan' });
  assert.equal(c.image, 'https://limn.app/c/id/2.png');
  assert.equal(c.title, 'Join Q4 plan');
  assert.equal(c.alt, 'limn: Join Q4 plan');
});

test('a private link: its headers, and its secret never in the page', () => {
  assert.deepEqual(site.headers(`/s/${TOKEN}`), PRIVATE_HEADERS);
  assert.deepEqual(site.headers('/'), {});
  const html = site.page('<head></head>', `/s/${TOKEN}`, 'https://limn.app', { image: '/c/abc/1.png' });
  assert.doesNotMatch(html, new RegExp(TOKEN));
  assert.match(html, /og:image" content="https:\/\/limn.app\/c\/abc\/1.png"/);
});
