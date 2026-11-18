#!/usr/bin/env node
import { check, describe } from './check.js';
import { draw } from './draw.js';
import { serve } from './mcp.js';
import { coverHtml } from './template.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const USAGE = `liveog ${version}
  liveog draw <page.html|url> <out.png>   draw a 1200 x 630 cover with this machine's Chrome
  liveog cover <title> <out.png> [site]   the default cover, black, white and grey
  liveog check <url>                      what a link's preview shows, and what is wrong
  liveog mcp                              the MCP server, on stdio`;

const [cmd, a, b, c] = process.argv.slice(2);
try {
  if (cmd === 'draw' && a && b) {
    const s = draw(a, b);
    console.log(`${b}  ${s.width} x ${s.height}`);
  } else if (cmd === 'cover' && a && b) {
    const dir = mkdtempSync(join(tmpdir(), 'liveog-'));
    try {
      writeFileSync(join(dir, 'cover.html'), coverHtml(c ? { title: a, site: c } : { title: a }));
      const s = draw(join(dir, 'cover.html'), b);
      console.log(`${b}  ${s.width} x ${s.height}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } else if (cmd === 'check' && a) {
    const r = await check(a);
    console.log(describe(r));
    process.exitCode = r.problems.length ? 1 : 0;
  } else if (cmd === 'mcp') {
    serve(version);
  } else {
    console.log(USAGE);
    process.exitCode = cmd === undefined || cmd === 'help' || cmd === '--help' ? 0 : 2;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
