import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SERVER, addEverywhere, addToJson, report, type Env } from './install.js';

test('addToJson: adds one key, keeps the rest, never twice, never over a broken file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'liveog-install-'));
  try {
    const f = join(dir, 'mcp.json');
    writeFileSync(f, JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'x' } } }));
    assert.equal(addToJson(f), 'added');
    assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')), { theme: 'dark', mcpServers: { other: { command: 'x' }, liveog: SERVER } });
    assert.equal(addToJson(f), 'already');
    const broken = join(dir, 'broken.json');
    writeFileSync(broken, '{ not json');
    assert.equal(addToJson(broken), 'failed');
    assert.equal(readFileSync(broken, 'utf8'), '{ not json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('addEverywhere: the apps found, by command or by file', () => {
  const home = mkdtempSync(join(tmpdir(), 'liveog-home-'));
  try {
    mkdirSync(join(home, '.cursor'));
    mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
    const ran: string[][] = [];
    const env: Env = {
      home, platform: 'linux',
      has: (b) => b === 'claude' || b === 'codex' || b === 'kimi',
      run: (b, args) => { ran.push([b, ...args]); if (b === 'codex') throw Object.assign(new Error('x'), { stderr: 'liveog already exists' }); return ''; },
    };
    const found = addEverywhere(env);
    assert.deepEqual(found, [{ app: 'Claude Code', result: 'added' }, { app: 'Codex', result: 'already' }, { app: 'Kimi Code', result: 'added' }, { app: 'Cursor', result: 'added' }, { app: 'OpenCode', result: 'added' }]);
    assert.deepEqual(JSON.parse(readFileSync(join(home, '.config', 'opencode', 'opencode.json'), 'utf8')), { mcp: { liveog: { type: 'local', command: ['npx', '-y', 'liveog', 'mcp'], enabled: true } } });
    assert.deepEqual(ran[0], ['claude', 'mcp', 'add', '--scope', 'user', 'liveog', '--', 'npx', '-y', 'liveog', 'mcp']);
    assert.deepEqual(ran[2], ['kimi', 'mcp', 'add', '--transport', 'stdio', 'liveog', '--', 'npx', '-y', 'liveog', 'mcp']);
    assert.match(report(found), /Restart the app/);
    assert.match(report([]), /No agent app found/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
