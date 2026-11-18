// The MCP server: JSON-RPC over stdio, one message per line. Two tools.
import { createInterface } from 'node:readline';
import { check, describe } from './check.js';

export const SETUP = `Set up liveog in this project (npm i liveog; Node 22+, ESM).

1. Say your link kinds, first match wins:
   import { links, originOf } from 'liveog';
   const site = links('yoursite', [
     { name: 'invite', match: (p) => p.startsWith('/join/'), title: 'Join a board', description: '...', cover: '/og/join.png', private: true },
   ], { name: 'plain', title: 'yoursite', description: '...', cover: '/og/plain.png' });

2. Where the server sends an HTML page, put the tags in its head and the headers on the answer:
   const origin = originOf(req.headers.host, process.env.SITE);   // SITE: your public host
   for (const [k, v] of Object.entries(site.headers(path))) res.setHeader(k, v);
   res.end(site.page(html, path, origin, own));   // own: { image, title? } for a link's own cover, or null

3. Draw the generic covers once, at 1200 x 630, from an HTML page, with the local Chrome:
   npx liveog draw cover.html public/og/plain.png
   Commit the PNGs. Redraw when the page changes.

4. Optional, a link's own cover that stays current: the user's page draws it
   (import { drawCover, sendCover } from 'liveog/browser') and posts it to your server. The server
   keeps it only if isCover(bytes), stores c = nextCover(prev, fresh) and serves coverPath(c);
   at GET /c/<id>/<v>.png use answer(parseCoverPath(path), current) for 200, 302 or 404.
   Make a fresh id (nextCover(prev, true)) when a private link is stopped or replaced.

5. Check it: npx liveog check https://yoursite/some/link
Never put a private link's code or token in its title, description or image.`;

const TOOLS = [
  {
    name: 'check_link',
    description: 'Fetch a link as a preview bot would and report its Open Graph and Twitter tags, its image (type, size, weight) and what is wrong.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'An http or https address.' } }, required: ['url'] },
  },
  {
    name: 'setup_project',
    description: 'The steps and code to add liveog link previews to the project you are working in.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type Msg = { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown> };
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

async function call(name: unknown, args: Record<string, unknown>) {
  if (name === 'setup_project') return text(SETUP);
  if (name === 'check_link') {
    const url = String(args.url ?? '');
    if (!/^https?:\/\//i.test(url)) return text('Give an http or https address.', true);
    try { return text(describe(await check(url))); } catch (e) { return text(`Could not check ${url}: ${(e as Error).message}`, true); }
  }
  return text(`No tool ${String(name)}.`, true);
}

/** One message in, its answer out (null for a notification). */
export async function reply(m: Msg, version: string): Promise<object | null> {
  if (m.id === undefined) return null;
  const ok = (result: object) => ({ jsonrpc: '2.0', id: m.id, result });
  switch (m.method) {
    case 'initialize':
      return ok({ protocolVersion: String(m.params?.protocolVersion ?? '2025-06-18'), capabilities: { tools: {} }, serverInfo: { name: 'liveog', version } });
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': return ok(await call(m.params?.name, (m.params?.arguments ?? {}) as Record<string, unknown>));
    default: return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: `No method ${m.method}` } };
  }
}

export function serve(version: string, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): void {
  createInterface({ input }).on('line', async (line) => {
    if (!line.trim()) return;
    let m: Msg;
    try { m = JSON.parse(line) as Msg; } catch {
      output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      return;
    }
    const out = await reply(m, version);
    if (out) output.write(`${JSON.stringify(out)}\n`);
  });
}
