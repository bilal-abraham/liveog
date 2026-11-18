<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo-light.svg" alt="liveog" width="220" height="48">
  </picture>
</p>

<p align="center">Link previews that stay current.<br><a href="https://bilal-abraham.github.io/liveog/">bilal-abraham.github.io/liveog</a></p>

---

What a link shows when it is pasted into a chat or a post: the Open Graph and Twitter card tags,
a 1200 x 630 cover, and nothing it should not show.

- **Covers drawn by a browser you already run.** Your Chrome at build time, or your user's page at
  run time. Your server only checks and keeps the PNG: no image service, no headless browser.
- **Covers that stay current.** Versioned addresses (`/c/<id>/<v>.png`), so a link pasted again
  shows the new picture, never a cached one.
- **Privacy per link kind.** An invite or share link's preview never holds its code, and its
  answers stay out of search, Referers and caches.
- **Zero dependencies.** The main import uses web APIs only: Node 22+, Deno, Bun, Cloudflare
  Workers, Vercel.

## With your agent

```sh
claude mcp add liveog -- npx -y liveog mcp
```

Any MCP client runs `npx -y liveog mcp`. Then ask: *"Set up link previews for this project."* Your
agent is the designer; liveog gives it the tools:

| Tool | |
|---|---|
| `study_project` | the project's colours, fonts, logo files, existing previews and routes |
| `draw_cover` | draws a cover (the default, in your colours, or your own HTML) and shows it |
| `setup_project` | the code to wire it in |
| `check_link` | what a link's preview shows, as a chat app sees it, and what is wrong |

The server tells your agent how to work: study the project, ask you which links matter, draw two
or three ideas, let you choose, then wire it in and check. And what a good cover is: even sides,
one font, the title short, the line under it saying what is true now.

## By hand

```sh
npm i liveog
npx liveog cover "Your site" public/og/home.png   # the default cover
npx liveog draw cover.html public/og/home.png     # or your own page, 1200 x 630
npx liveog check https://yoursite.com/            # what the preview shows
```

```js
import { links, originOf } from 'liveog';

const site = links('yoursite', [
  { name: 'invite', match: (p) => p.startsWith('/join/'), title: 'Join a board',
    description: 'On yoursite.', cover: '/og/join.png', private: true },
], { name: 'home', title: 'yoursite', description: 'What it is.', cover: '/og/home.png' });

// where your server sends a page
const origin = originOf(req.headers.host, process.env.SITE);
for (const [k, v] of Object.entries(site.headers(path))) res.setHeader(k, v);
res.end(site.page(html, path, origin));
```

A static site can write the tags at build time with `tags()`.

## Covers that stay current

A link's own cover (an invite naming its board, a shared board's picture) is drawn in your user's
page and sent to your server:

```js
// in the page
import { drawCover, sendCover } from 'liveog/browser';
const png = await drawCover((ctx, w, h) => { /* draw on a 1200 x 630 canvas */ });
await sendCover('/api/boards/42/cover', png);

// on the server
import { isCover, nextCover, coverPath, parseCoverPath, answer } from 'liveog';
if (!isCover(bytes)) return reply(400);   // a 1200 x 630 PNG, at most 300 KB
board.cover = nextCover(board.cover);     // same id, v + 1
// keep the bytes; the link's preview is { image: coverPath(board.cover) }

// GET /c/<id>/<v>.png
const a = answer(parseCoverPath(path), board.cover);   // 200, 302 to the newest, or 404
```

When a private link is stopped or replaced, `nextCover(prev, true)` makes a new id and the old
picture's address is nothing from then.

## API

| | |
|---|---|
| `tags(card)`, `inject(html, tags)` | the meta tags; put before `</head>` |
| `cleanHost(x)`, `originOf(host, site?)` | a plain host only |
| `links(site, kinds, fallback)` | `.of`, `.card`, `.headers`, `.page` for a path |
| `coverHtml(words, look?)` | the default cover as HTML: site, tag, title, line, art |
| `isCover`, `imageSize` | headers read, nothing decoded |
| `nextCover`, `coverPath`, `parseCoverPath`, `answer` | versioned cover addresses |
| `check`, `describe`, `readTags` | the checker |
| `liveog/draw`: `draw`, `findChrome` | covers from local Chrome (`CHROME=` to choose); Node only |
| `liveog/study`: `study` | what `study_project` reads; Node only |
| `liveog/browser`: `drawCover`, `sendCover` | covers drawn in the page |

---

MIT
