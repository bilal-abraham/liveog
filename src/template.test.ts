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

test('coverHtml: a mark before the site name, a tag and a picture', () => {
  const h = coverHtml({ title: 't', site: 's', tag: 'Live <now>', art: '<svg id="a"></svg>' }, { mark: '<svg viewBox="0 0 1 1"></svg>' });
  assert.match(h, /<div class="site"><svg viewBox="0 0 1 1"><\/svg><span>s<\/span><\/div>/);
  assert.match(h, /<div class="tag">Live &lt;now&gt;<\/div>/);
  assert.match(h, /<div class="art"><svg id="a"><\/svg><\/div>/);
});
