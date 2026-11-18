// The MCP server: JSON-RPC over stdio, one message per line. Four small tools; how to use them and
// what a good cover looks like is said once, in INSTRUCTIONS, which a client reads at the start.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { check, describe } from './check.js';
import { draw } from './draw.js';
import { study } from './study.js';
import { coverHtml, type CoverWords, type Look } from './template.js';

export const INSTRUCTIONS = `liveog gives a project link previews that stay current: the tags, a 1200 x 630 cover per kind of link, and privacy for links that hold a secret.

How to work, with the person:
1. study_project, then say in a few lines which of its links people share (home, an article, a profile, an invite, a listing, a share) and what each preview should show. Ask which matter; do not decide alone.
   If no logo file turns up (it may live in a component, an image host or a design tool), ask the person for one: an SVG, a PNG, or a screenshot to trace.
2. For the ones they pick, draw two or three ideas with draw_cover in the project's own colours, fonts and mark. Look at each, fix what is off, then show them. Let the person choose.
3. setup_project for the code, then wire it in. Save the chosen covers with out.
4. check_link on a deployed link to confirm.

A good cover:
- Even sides: the same margin left and right, nothing closer to an edge. The default cover (draw_cover with a title) already has this; start there.
- One font, two weights, three sizes. The title under 30 characters, two lines at most.
- The line under the title says what is true now: who is in, the bid, how close to the goal.
- At most one picture, bottom right, its foot on the text's last line. The mark top left; a word or two top right for state.
- The project's own colours, high contrast. No gradients or shadows the brand does not have.
- It must read at 360px wide, as chats show it.
- Never a private link's code or token, or a name it should not show.`;

export const SETUP = `Add liveog to this project (npm i liveog; Node 22+, Deno, Bun, Workers; ESM).

1. Name the kinds of link, first match wins:
   import { links, originOf } from 'liveog';
   const site = links('yoursite', [
     { name: 'invite', match: (p) => p.startsWith('/join/'), title: 'Join the team', description: '...', cover: '/og/invite.png', private: true },
   ], { name: 'home', title: 'yoursite', description: '...', cover: '/og/home.png' });

2. Where the server sends an HTML page:
   const origin = originOf(req.headers.host, process.env.SITE);   // SITE: the public host
   for (const [k, v] of Object.entries(site.headers(path))) res.setHeader(k, v);
   res.end(site.page(html, path, origin, own));   // own: { image, title? } for a link's own cover, else null
   A static site: write tags(card) into each page at build time instead.

3. Draw each kind's cover once and commit the PNGs: draw_cover with out, or
   npx liveog cover "Title" public/og/home.png, or npx liveog draw cover.html public/og/home.png.

4. Only for a link whose picture changes (an invite filling up, a bid, a goal): the page that has
   it open draws it (import { drawCover, sendCover } from 'liveog/browser') and posts it. The server
   keeps it if isCover(bytes), sets cover = nextCover(cover) and the link's own image is
   coverPath(cover). At GET /c/<id>/<v>.png answer with answer(parseCoverPath(path), cover):
   200, 302 to the newest, or 404. nextCover(cover, true) when a private link is stopped or replaced.

5. npx liveog check https://yoursite/some/link`;

const TOOLS = [
  {
    name: 'study_project',
    title: 'Study a project',
    description: 'Start here. Reads a project folder (no network) and returns, as JSON: its name, colours with their CSS variable names, fonts, logo files, existing preview images and tags, files that set previews, and its routes.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'The project folder. Default: the current one.' } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'draw_cover',
    title: 'Draw a cover',
    description: 'Draws a 1200 x 630 cover with this machine\'s Chrome and returns the picture to look at. Give a title (and site, line, tag, art, look) for the default cover, which has good spacing and type; or a whole html page. Saves a PNG only when out is given.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Under 30 characters.' },
        site: { type: 'string', description: 'The site\'s name, top left.' },
        line: { type: 'string', description: 'Under the title: what is true now.' },
        tag: { type: 'string', description: 'A word or two, top right: Live, Sold, Friday 8pm.' },
        art: { type: 'string', description: 'One picture, bottom right: inline SVG drawn in currentColor.' },
        look: {
          type: 'object',
          description: 'The project\'s own: bg, fg, muted (hex, rgb(), hsl(), oklch()), font (a CSS font-family list), mark (its logo as inline SVG).',
          properties: { bg: { type: 'string' }, fg: { type: 'string' }, muted: { type: 'string' }, font: { type: 'string' }, mark: { type: 'string' } },
        },
        html: { type: 'string', description: 'Instead of the default: a whole page laid out at 1200 x 630.' },
        out: { type: 'string', description: 'Where to save the PNG, relative to the project, e.g. public/og/home.png.' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'setup_project',
    title: 'How to wire it in',
    description: 'The code to add liveog to the project: link kinds, tags, covers, covers that stay current. Use once the person has chosen what each link shows.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'check_link',
    title: 'Check a link',
    description: 'Fetches a public link as a chat app would and says what its preview shows (title, description, image size and weight) and what is wrong.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'An http or https address.' } }, required: ['url'] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Msg = { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown> };
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });
const str = (x: unknown) => (typeof x === 'string' && x ? x : undefined);

function drawCover(args: Record<string, unknown>) {
  const title = str(args.title);
  const html = str(args.html);
  if (!html && !title) return text('Give a title for the default cover, or a whole html page.', true);
  const out = str(args.out);
  if (out && !/\.png$/i.test(out)) return text('out must end in .png.', true);
  const words: CoverWords = { title: title ?? '' };
  for (const k of ['site', 'line', 'tag', 'art'] as const) { const v = str(args[k]); if (v) words[k] = v; }
  const look = (args.look && typeof args.look === 'object' ? args.look : {}) as Look;
  const tmp = mkdtempSync(join(tmpdir(), 'liveog-mcp-'));
  try {
    const src = join(tmp, 'cover.html');
    writeFileSync(src, html ?? coverHtml(words, look));
    const file = out ? (isAbsolute(out) ? out : resolve(process.cwd(), out)) : join(tmp, 'cover.png');
    const s = draw(src, file);
    return {
      content: [
        { type: 'image', data: readFileSync(file).toString('base64'), mimeType: 'image/png' },
        { type: 'text', text: `${s.width} x ${s.height}${out ? `, saved at ${file}` : ', not saved (give out to keep it)'}` },
      ],
    };
  } catch (e) {
    return text((e as Error).message, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function call(name: unknown, args: Record<string, unknown>) {
  switch (name) {
    case 'study_project': return text(JSON.stringify(study(resolve(str(args.dir) ?? process.cwd())), null, 2));
    case 'draw_cover': return drawCover(args);
    case 'setup_project': return text(SETUP);
    case 'check_link': {
      const url = str(args.url) ?? '';
      if (!/^https?:\/\//i.test(url)) return text('Give an http or https address.', true);
      try { return text(describe(await check(url))); } catch (e) { return text(`Could not check ${url}: ${(e as Error).message}`, true); }
    }
    default: return text(`No tool ${String(name)}.`, true);
  }
}

/** One message in, its answer out (null for a notification). */
export async function reply(m: Msg, version: string): Promise<object | null> {
  if (m.id === undefined) return null;
  const ok = (result: object) => ({ jsonrpc: '2.0', id: m.id, result });
  switch (m.method) {
    case 'initialize': {
      const asked = String(m.params?.protocolVersion ?? '');
      return ok({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: 'liveog', version }, instructions: INSTRUCTIONS });
    }
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
