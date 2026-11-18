// The MCP server: JSON-RPC over stdio, one message per line. Two tools.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { check, describe } from './check.js';
import { draw } from './draw.js';
import { study } from './study.js';
import { coverHtml, type Look } from './template.js';

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

3. Draw the generic covers once, at 1200 x 630, with the local Chrome (the draw_cover tool does
   this too, and shows you the picture): from your own HTML page, or the default one in the
   project's colours (import { coverHtml } from 'liveog'):
   npx liveog draw cover.html public/og/plain.png
   Commit the PNGs. Redraw when the page changes.

4. Optional, a link's own cover that stays current: the user's page draws it
   (import { drawCover, sendCover } from 'liveog/browser') and posts it to your server. The server
   keeps it only if isCover(bytes), stores c = nextCover(prev, fresh) and serves coverPath(c);
   at GET /c/<id>/<v>.png use answer(parseCoverPath(path), current) for 200, 302 or 404.
   Make a fresh id (nextCover(prev, true)) when a private link is stopped or replaced.

5. Check it: npx liveog check https://yoursite/some/link
Never put a private link's code or token in its title, description or image.`;

const PLAN = `Next, with the person: say which of these routes are link kinds that people paste (home,
an article, a profile, an invite, a share). For each: public or private (holds a code or token),
its words, and its cover: one generic cover drawn once, or its own cover that stays current
(drawn in the user's page). Offer two or three cover ideas in the project's own colours, fonts
and mark; draw them with draw_cover, look, and change them before you write any code.`;

const TOOLS = [
  {
    name: 'check_link',
    description: 'Fetch a link as a preview bot would and report its Open Graph and Twitter tags, its image (type, size, weight) and what is wrong.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'An http or https address.' } }, required: ['url'] },
  },
  {
    name: 'study_project',
    description: 'Read a project for its link previews: name, colours (with their CSS variable names), fonts, logo files, the og: tags it already writes, and its routes. Start here to plan covers in its own style.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'The project folder; the current one when left out.' } } },
  },
  {
    name: 'draw_cover',
    description: 'Draw a 1200 x 630 cover with this machine\'s Chrome and show it. Give your own html, or a title (and site, line, look) for the default cover. Saved at out when given.',
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'A whole HTML page laid out at 1200 x 630.' },
        title: { type: 'string' },
        site: { type: 'string' },
        line: { type: 'string', description: 'A quiet line under the title.' },
        look: {
          type: 'object',
          description: 'Colours (hex, rgb(), hsl(), oklch()), a font-family list, and the mark as inline SVG.',
          properties: { bg: { type: 'string' }, fg: { type: 'string' }, muted: { type: 'string' }, font: { type: 'string' }, mark: { type: 'string' } },
        },
        out: { type: 'string', description: 'Where to save the PNG, e.g. public/og/home.png.' },
      },
    },
  },
  {
    name: 'setup_project',
    description: 'The steps and code to add liveog link previews to the project you are working in.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type Msg = { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown> };
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

const str = (x: unknown) => (typeof x === 'string' && x ? x : undefined);

function drawCover(args: Record<string, unknown>) {
  const title = str(args.title);
  const html = str(args.html);
  if (!html && !title) return text('Give html, or a title for the default cover.', true);
  const look = (args.look && typeof args.look === 'object' ? args.look : {}) as Look;
  const page = html ?? coverHtml({ title: title ?? '', ...(str(args.site) ? { site: str(args.site) as string } : {}), ...(str(args.line) ? { line: str(args.line) as string } : {}) }, look);
  const tmp = mkdtempSync(join(tmpdir(), 'liveog-mcp-'));
  try {
    const src = join(tmp, 'cover.html');
    writeFileSync(src, page);
    const out = str(args.out);
    const file = out ? (isAbsolute(out) ? out : resolve(process.cwd(), out)) : join(tmp, 'cover.png');
    const s = draw(src, file);
    const png = readFileSync(file).toString('base64');
    return {
      content: [
        { type: 'image', data: png, mimeType: 'image/png' },
        { type: 'text', text: `${s.width} x ${s.height}${out ? `, saved at ${file}` : ' (not saved: give out to keep it)'}` },
      ],
    };
  } catch (e) {
    return text((e as Error).message, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function call(name: unknown, args: Record<string, unknown>) {
  if (name === 'setup_project') return text(SETUP);
  if (name === 'study_project') return text(`${JSON.stringify(study(resolve(str(args.dir) ?? process.cwd())), null, 2)}\n\n${PLAN}`);
  if (name === 'draw_cover') return drawCover(args);
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
