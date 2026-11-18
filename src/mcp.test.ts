import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { isCover } from './cover.js';
import { findChrome } from './draw.js';
import { reply, serve } from './mcp.js';

test('initialize, list, call', async () => {
  const init = await reply({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, '0.0.0') as { result: { serverInfo: { name: string }; protocolVersion: string } };
  assert.equal(init.result.serverInfo.name, 'liveog');
  assert.equal(init.result.protocolVersion, '2025-06-18');
  const list = await reply({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, '0') as { result: { tools: { name: string }[] } };
  assert.deepEqual(list.result.tools.map((t) => t.name), ['check_link', 'study_project', 'draw_cover', 'setup_project']);
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
  const r = await reply({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'draw_cover', arguments: { title: 'Join Q4 plan', site: 'limn' } } }, '0') as { result: { content: { type: string; data?: string }[] } };
  const img = r.result.content[0];
  assert.equal(img?.type, 'image');
  assert.equal(isCover(Buffer.from(img?.data ?? '', 'base64')), true);
});
