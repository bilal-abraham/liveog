import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverHtml } from './template.js';

test('coverHtml: words escaped, the default look, a look given', () => {
  const h = coverHtml({ title: '<b>Q4</b> plan', site: 'limn & co', line: 'You talk, it draws.' });
  assert.match(h, /&lt;b&gt;Q4&lt;\/b&gt; plan/);
  assert.match(h, /limn &amp; co/);
  assert.match(h, /background: #0a0a0a/);
  const g = coverHtml({ title: 't' }, { bg: '#fff', fg: 'rgb(10, 10, 10)', font: '"Söhne", sans-serif' });
  assert.match(g, /background: #fff; color: rgb\(10, 10, 10\)/);
});

test('coverHtml: a look that is not a colour or a font is let go', () => {
  const h = coverHtml({ title: 't' }, { bg: 'red; } body { display:none', font: 'x; } * { color: red' });
  assert.match(h, /background: #0a0a0a/);
  assert.doesNotMatch(h, /display:none|color: red/);
});

test('coverHtml: a mark in place of the site name', () => {
  assert.match(coverHtml({ title: 't', site: 's' }, { mark: '<svg viewBox="0 0 1 1"></svg>' }), /<div class="mark"><svg/);
});
