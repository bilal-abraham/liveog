# liveog

Link previews that stay current. Extracted from limn's link-preview system.

## What it does
- **Tags**: the Open Graph and Twitter large-card tags for a page, escaped, with an absolute image address taken from a plain host only.
- **Link kinds with privacy**: you say which paths are which kind (a plain page, an invite, a private share). A private kind gets headers that keep it out of search, Referers and caches, and its words never hold the path's secret.
- **Covers drawn at no server cost**: 1200 x 630 PNGs are drawn by a browser that is already running: your own Chrome at build time (`liveog draw`), or your user's page at run time (canvas, sent to your server). The server only checks the PNG (signature, size) and keeps it. No image library, no headless browser on the server.
- **Versioned addresses**: `/c/<id>/<v>.png`. `v` goes up on each new picture so a link pasted again shows the new one; an old `v` redirects to the newest; a new `id` ends the old picture's address (a share link stopped or replaced).

## API (ESM, zero runtime deps, Node 22+)
- `tags(card)` -> meta tags string; `inject(html, tags)` -> page with them before `</head>`
- `cleanHost(x)`, `originOf(host, site?)` -> `https://host` (http for localhost) or null
- `links(site, kinds, fallback)` -> `{ of(path), card(path, origin, own?), headers(path), page(html, path, origin, own?) }`
- `isCover(bytes)`, `imageSize(bytes)`, `COVER_SIZE`, `MAX_BYTES`
- `nextCover(prev, fresh?)`, `coverPath(c)`, `parseCoverPath(path)`, `answer(asked, now)` -> 200 / 302 / 404
- `liveog/browser`: `drawCover(draw)` -> PNG Blob from a 1200 x 630 canvas; `sendCover(url, png)`

## CLI
- `liveog draw <page.html> <out.png>`: local Chrome, headless, its own `--screenshot`; checks the size
- `liveog cover <title> <out.png> [site]`: the default cover (`coverHtml`), black, white and grey
- `liveog check <url>`: fetches the page, reports its tags and whether the image is a reachable 1200 x 630
- `liveog mcp`: the MCP server on stdio

## MCP tools
- `check_link(url)`: the same report as `liveog check`, for an agent
- `study_project(dir?)`: colours, fonts, logo files, existing previews and routes, then a nudge to plan link kinds with the person
- `draw_cover(html | title, look?, out?)`: draws with local Chrome and returns the picture, so the agent can look and change it
- `setup_project()`: the steps and code to add liveog to the project the agent is in
The agent is the designer; liveog gives it eyes (study), a pen (draw) and a check.

## The page (later, GitHub Pages, free)
One page, black/white/grey. A link box that shows its preview. Two ways in: **by hand** (`npm i liveog`, three lines of code) and **with your agent** (one line to add the MCP server). Footer: "made by limn".

## License: MIT, public repo
MIT is the shortest well-known licence: anyone can use it, including in closed products, so it spreads and nobody needs to ask. It asks only for the notice. limn keeps nothing back by it: liveog is the generic part, limn's product is elsewhere. A public repo is free on GitHub (Actions, Pages), and npm packages are public anyway.
