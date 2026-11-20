# Working on liveog

## The website (`site/`)

Every change to the site is checked at all of these before it is committed:

| Width | What it stands for |
|---|---|
| 360px and 375px | phones |
| 768px | tablets |
| 1280px | laptops and desktops |

In both light and dark mode. At each one:

- nothing scrolls sideways,
- the hero fills the screen and nothing from the next section shows inside it,
- no text is cut off or wraps into a single orphaned word,
- the part you changed looks right, and so do the parts around it.

A fix for one width must not break another. Phone-only rules live in the `@media (max-width: 900px)` block.

## The package (`src/`)

- `npm test` builds and runs every test; it must pass before a commit.
- Never guess a config path or command for an agent app in `src/install.ts`: use the app's own docs.
- Each release gets a new version, a `vX.Y.Z` tag and GitHub release notes.

## Commits

Plain messages that say what changed. No `Co-Authored-By` or other AI attribution lines.
