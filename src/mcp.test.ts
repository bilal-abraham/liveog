import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { isCover } from './cover.js';
import { findChrome } from './draw.js';
import { CSP, lockDown, reply, savePath, serve } from './mcp.js';

test('initialize, list, call', async () => {
  const init = await reply({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, '0.0.0') as { result: { serverInfo: { name: string }; protocolVersion: string } };
  assert.equal(init.result.serverInfo.name, 'liveog');
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.match((init.result as unknown as { instructions: string }).instructions, /study_project[\s\S]*draw_cover[\s\S]*setup_project[\s\S]*check_link/);
  const old = await reply({ jsonrpc: '2.0', id: 9, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, '0') as { result: { protocolVersion: string } };
  assert.equal(old.result.protocolVersion, '2025-06-18');
  const list = await reply({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, '0') as { result: { tools: { name: string }[] } };
  assert.deepEqual(list.result.tools.map((t) => t.name), ['study_project', 'draw_cover', 'setup_project', 'check_link']);
  const setup = await reply({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'setup_project' } }, '0') as { result: { content: { text: string }[] } };
  assert.match(setup.result.content[0]?.text ?? '', /npm i liveog/);
  const bad = await reply({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'check_link', arguments: { url: 'file:///etc/passwd' } } }, '0') as { result: { isError: boolean } };
  assert.equal(bad.result.isError, true);
});

test('a notification gets nothing; an unknown method an error', async () => {
  assert.equal(await reply({ jsonrpc: '2.0', method: 'notifications/initialized' }, '0'), null);
  const r = await reply({ jsonrpc: '2.0', id: 5, method: 'nope' }, '0') as { error: { code: number } };
  assert.equal(r.error.code, -32601);
});

test('serve: one line in, one line out', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  serve('0', input, output);
  const line = new Promise<string>((ok) => output.once('data', (d: Buffer) => ok(d.toString())));
  input.write('{"jsonrpc":"2.0","id":7,"method":"ping"}\n');
  assert.deepEqual(JSON.parse(await line), { jsonrpc: '2.0', id: 7, result: {} });
  input.end();
});

test('draw_cover: the default cover, shown as a PNG', { skip: !findChrome() && 'no Chrome on this machine' }, async () => {
  const r = await reply({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'draw_cover', arguments: { title: 'Vintage tee', site: 'Logo', line: 'Top bid $84 · 7 bids', tag: 'Live auction' } } }, '0') as { result: { content: { type: string; data?: string }[] } };
  const img = r.result.content[0];
  assert.equal(img?.type, 'image');
  assert.equal(isCover(Buffer.from(img?.data ?? '', 'base64')), true);
  const bad = await reply({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'draw_cover', arguments: { title: 't', out: 'x.html' } } }, '0') as { result: { isError: boolean } };
  assert.equal(bad.result.isError, true);
});

test('draw_cover: saves only inside the project, and its pages reach no files or network', async () => {
  assert.equal(savePath('public/og/home.png', '/p'), '/p/public/og/home.png');
  assert.equal(savePath('../elsewhere.png', '/p'), null);
  assert.equal(savePath('/etc/x.png', '/p'), null);
  assert.equal(savePath('/p/og/a.png', '/p'), '/p/og/a.png');
  assert.match(lockDown('<!doctype html><html><head><title>x</title></head></html>'), new RegExp(`^<!doctype html><html><head><meta http-equiv="Content-Security-Policy"`));
  assert.match(lockDown('<!doctype html><p>x'), /^<!doctype html><meta http-equiv/);
  assert.ok(lockDown('<p>x').startsWith('<meta http-equiv'));
  assert.ok(!CSP.includes('file:') && CSP.includes("default-src 'none'"));
  const r = await reply({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'draw_cover', arguments: { title: 'x', out: '../../x.png' } } }, '0') as { result: { isError?: boolean } };
  assert.equal(r.result.isError, true);
});
