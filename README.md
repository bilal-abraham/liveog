<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo-light.svg" alt="liveog" width="177" height="40">
  </picture>
</p>

<p align="center">
  Link previews that show what’s happening now.<br>
  <a href="https://bilal-abraham.github.io/liveog/">Website</a> · <a href="https://www.npmjs.com/package/liveog">npm</a> · MIT
</p>

---

When someone pastes your link into iMessage, Slack, X or WhatsApp, the app shows a preview card.
liveog makes that card show **what is true right now**: who is going, the current bid, how close
the fundraiser is. And it does it without an image server.

- **Covers drawn in a browser**: your Chrome at build time, or your user's open page at run time.
  Your server only stores a PNG.
- **Always fresh**: every new picture gets a new address, so a link shared again never shows a
  stale, cached image.
- **Private links stay private**: invite codes and share tokens never show in a preview, and those
  pages stay out of search engines and caches.
- **Zero dependencies**, ESM. Works on Node 22+, Deno, Bun, Cloudflare Workers and Vercel.

## Quick start

### Let your agent do it

```sh
npx liveog mcp add
```

This finds the agent apps on your machine and adds the liveog MCP server to each one: Hermes
Agent, Claude Code, Codex, Kimi Code, Cursor, VS Code, Amp, Windsurf (Devin Desktop), Claude Desktop,
OpenCode, Kiro and LM Studio. Muse Code, Factory, Antigravity, Zed, JetBrains, Cline, Warp, Goose,
Continue and Kilo Code work too, with one step by hand (see below). Restart the app, then ask:

> Set up link previews for this project.

The agent studies your project (colours, fonts, logo, routes), asks you which links matter, draws
two or three cover ideas for you to pick from, wires in the code, and checks the result.

### Or do it yourself

```sh
npm i liveog
```

```js
import { links, originOf } from 'liveog';

// 1. Say what kinds of link you have. First match wins; the last argument is the fallback.
const site = links('yoursite', [
  { name: 'invite', match: (p) => p.startsWith('/join/'), private: true,
    title: 'Join the team', description: 'On yoursite.', cover: '/og/invite.png' },
], { name: 'home', title: 'yoursite', description: 'What it does.', cover: '/og/home.png' });

// 2. Wherever your server sends an HTML page:
const origin = originOf(req.headers.host, process.env.SITE);   // SITE = your public domain
for (const [k, v] of Object.entries(site.headers(path))) res.setHeader(k, v);
res.end(site.page(html, path, origin));
```

Then draw the covers once and commit them:

```sh
npx liveog cover "yoursite" public/og/home.png     # the built-in cover, black and white
npx liveog draw cover.html public/og/home.png      # or your own 1200 x 630 HTML page
npx liveog check https://yoursite.com/             # see what a chat app will show
```

Static site? Call `tags(card)` at build time and paste the result into each page's `<head>`.

## Covers that change

For links whose picture should change (an invite filling up, a price, a bid), the page that has
the thing open draws the cover and sends it to your server:

```js
// In the browser
import { drawCover, sendCover } from 'liveog/browser';
const png = await drawCover((ctx, w, h) => { /* draw on a 1200 x 630 canvas */ });
await sendCover('/api/invites/42/cover', png);
```

```js
// On your server
import { isCover, nextCover, coverPath, parseCoverPath, answer } from 'liveog';

if (!isCover(bytes)) return reply(400);     // must be a 1200 x 630 PNG under 300 KB
invite.cover = nextCover(invite.cover);     // same id, version + 1
save(bytes);                                // the link's preview image is coverPath(invite.cover)

// GET /c/<id>/<version>.png
const a = answer(parseCoverPath(path), invite.cover);   // 200, a 302 to the newest, or 404
```

If a private link is stopped or replaced, call `nextCover(cover, true)`: it makes a new id, and the
old picture's address stops working.

There is always a fallback: until a link has its own cover, it shows its kind's generic one.

## Any other MCP client

liveog's MCP server speaks the standard protocol over stdin/stdout. Point your client at:

```json
{ "mcpServers": { "liveog": { "command": "npx", "args": ["-y", "liveog", "mcp"] } } }
```

Its tools:

| Tool | What it does |
|---|---|
| `study_project` | reads your project's colours, fonts, logo files, routes and existing previews |
| `draw_cover` | draws a 1200 x 630 cover and shows it to the agent |
| `setup_project` | the code to wire liveog into your server |
| `check_link` | fetches a live link the way a chat app does and reports what's wrong |

## API

| Import | |
|---|---|
| `tags(card)`, `inject(html, tags)` | the meta tags, and putting them before `</head>` |
| `links(site, kinds, fallback)` | `.page()`, `.headers()`, `.card()` and `.of()` for a path |
| `originOf(host, site?)`, `cleanHost(x)` | a safe absolute origin for image addresses |
| `coverHtml(words, look?)` | the built-in cover as HTML (site, tag, title, line, picture) |
| `isCover`, `imageSize` | checks a PNG's size without decoding it |
| `nextCover`, `coverPath`, `parseCoverPath`, `answer` | versioned cover addresses |
| `check`, `describe`, `readTags` | the link checker |
| `liveog/draw` | `draw(page, out)` with your local Chrome (Node only) |
| `liveog/browser` | `drawCover`, `sendCover` for the user's page |

## Using liveog?

Tell us in [Using liveog? Tell us](https://github.com/bilal-abraham/liveog/discussions/7): what you built and
what your previews show. Want it set up for you instead? Email babraham@hmc.edu.

## License

MIT
