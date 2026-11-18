# liveog

Link previews that stay current. Open Graph and Twitter card tags, covers drawn by a browser you
already run (no image service, no headless browser on your server), versioned cover addresses,
and privacy per link kind. Zero runtime dependencies, ESM. The main import uses web APIs only, so it
runs wherever your server does: Node 22+, Deno, Bun, Cloudflare Workers, Vercel. A static site can
write the tags at build time with `tags()`; covers that change per link need a server to keep them.

```sh
npm i liveog
```

## By hand

```js
import { links, originOf } from 'liveog';

const site = links('yoursite', [
  { name: 'invite', match: (p) => p.startsWith('/join/'), title: 'Join a board',
    description: 'On yoursite.', cover: '/og/join.png', private: true },
], { name: 'plain', title: 'yoursite', description: 'What it is.', cover: '/og/plain.png' });

// where your server sends a page
const origin = originOf(req.headers.host, process.env.SITE);
for (const [k, v] of Object.entries(site.headers(path))) res.setHeader(k, v);
res.end(site.page(html, path, origin));
```

Draw the covers once from an HTML page with your own Chrome, and commit the PNGs:

```sh
npx liveog draw cover.html public/og/plain.png
```

Check a link as a preview bot sees it:

```sh
npx liveog check https://yoursite.com/join/abc
```

## With your agent

Add the MCP server (Claude Code shown; any MCP client runs `npx -y liveog mcp`):

```sh
claude mcp add liveog -- npx -y liveog mcp
```

Tools: `check_link` (what a link's preview shows and what is wrong) and `setup_project` (the steps
to add liveog to the project the agent is in).

## Covers that stay current

A link's own cover (an invite naming its board, a shared board's picture) is drawn in your user's
page and sent to your server, which only checks and keeps it:

```js
// in the page
import { drawCover, sendCover } from 'liveog/browser';
const png = await drawCover((ctx, w, h) => { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h); /* ... */ });
await sendCover('/api/boards/42/cover', png);

// on the server
import { isCover, nextCover, coverPath, parseCoverPath, answer } from 'liveog';
if (!isCover(bytes)) return reply(400);          // a 1200 x 630 PNG, at most 300 KB
board.cover = nextCover(board.cover);            // same id, v + 1: a new address no app has cached
// keep bytes; the link's preview is { image: coverPath(board.cover) }

// GET /c/<id>/<v>.png
const a = answer(parseCoverPath(path), coverOf(id)); // 200 with headers, 302 to the newest, or 404
```

Stop or replace a private link with `nextCover(prev, true)`: a new id, and the old picture's
address is nothing from then. A private kind's words never hold its path, and its answers carry
`no-referrer`, `noindex, nofollow` and `no-store`.

## API

| | |
|---|---|
| `tags(card)`, `inject(html, tags)` | the meta tags; put before `</head>` |
| `cleanHost(x)`, `originOf(host, site?)` | a plain host only; `https://`, `http://` for localhost |
| `links(site, kinds, fallback)` | `.of(path)`, `.card(path, origin, own?)`, `.headers(path)`, `.page(html, path, origin, own?)` |
| `isCover(bytes)`, `imageSize(bytes)` | PNG, JPEG, GIF headers read, nothing decoded |
| `nextCover`, `coverPath`, `parseCoverPath`, `answer` | versioned cover addresses |
| `check(url)`, `describe(report)`, `readTags(html)` | the checker |
| `liveog/draw`: `draw(page, out)`, `findChrome()` | covers from local Chrome (`CHROME` to choose one); Node only |
| `liveog/browser`: `drawCover`, `sendCover` | covers drawn in the page |

MIT. Made by [limn](https://limn.ai).
