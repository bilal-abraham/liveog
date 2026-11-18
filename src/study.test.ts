import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { study } from './study.js';

test('study: name, colours, fonts, marks, tags, routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'liveog-study-'));
  const put = (p: string, s: string) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
  try {
    put('package.json', '{"name":"acme","description":"Rockets."}');
    put('app/globals.css', ':root { --brand: #FF5500; --ink: #111111; } body { font-family: "Söhne", sans-serif; color: #111111; }');
    put('app/page.tsx', 'export default 1');
    put('app/(site)/blog/[slug]/page.tsx', 'export default 1');
    put('app/invite/[code]/page.tsx', 'export default 1');
    put('app/layout.tsx', '<meta property="og:title" content="Acme" />');
    put('public/logo.svg', '<svg/>');
    put('public/favicon.ico', 'x');
    put('public/og.jpg', 'x');
    put('app/blog/page.tsx', 'export const metadata = { openGraph: {} }');
    put('styles/ui.css', ':root { --primary: 222.2 47.4% 11.2%; }');
    put('app/fonts.ts', 'import { Inter as Sans, Roboto_Mono } from "next/font/google"');
    put('server.js', "app.get('/s/:token', h)");
    put('node_modules/x/a.css', ':root { --no: #000000 }');
    const b = study(dir);
    assert.equal(b.name, 'acme');
    assert.deepEqual(b.colors[0], { value: '#111111', uses: 2, names: ['--ink'] });
    assert.ok(b.colors.some((c) => c.value === '#ff5500' && c.names.includes('--brand')));
    assert.ok(!b.colors.some((c) => c.value === '#000000'));
    assert.ok(b.fonts.some((f) => f.family === '"Söhne", sans-serif'));
    assert.deepEqual(b.marks, [join('public', 'favicon.ico'), join('public', 'logo.svg')]);
    assert.deepEqual(b.covers, [join('public', 'og.jpg')]);
    assert.deepEqual(b.previewFiles, [join('app', 'blog', 'page.tsx')]);
    assert.ok(b.colors.some((c) => c.value === 'hsl(222.2 47.4% 11.2%)' && c.names.includes('--primary')));
    assert.ok(['Inter', 'Roboto Mono'].every((f) => b.fonts.some((x) => x.family === f)));
    assert.deepEqual(b.tagged, [{ file: join('app', 'layout.tsx'), tags: { 'og:title': 'Acme' } }]);
    assert.deepEqual(b.routes, ['/', '/blog', '/blog/[slug]', '/invite/[code]', '/s/:token']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
