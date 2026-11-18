// Reading a project for what its covers should look like and which links it has: its name, its
// colours, fonts and marks, the tags it already writes, and its routes. Plain file reads, bounded.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { readTags } from './check.js';

export interface Brief {
  dir: string;
  name?: string;
  description?: string;
  homepage?: string;
  /** Colours by how often they are used, with the custom property that names one when there is one. */
  colors: { value: string; uses: number; names: string[] }[];
  fonts: { family: string; uses: number }[];
  /** Logo, mark and icon files. */
  marks: string[];
  /** Pages that already write og: or twitter: tags, and what they say. */
  tagged: { file: string; tags: Record<string, string> }[];
  /** Files that set previews in code (Next metadata, opengraph-image), to change rather than add to. */
  previewFiles: string[];
  /** Preview images already there. */
  covers: string[];
  /** Paths the project serves, as found in its routes. */
  routes: string[];
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage', 'vendor', '.turbo', '.vercel', '.cache']);
const TEXT = /\.(css|scss|sass|less|html?|[cm]?[jt]sx?|svelte|vue|astro|svg)$/i;
const MAX_FILES = 3000;
const MAX_BYTES = 512 * 1024;

function walk(dir: string, depth = 0, out: string[] = []): string[] {
  if (depth > 8 || out.length >= MAX_FILES) return out;
  let names: string[];
  try { names = readdirSync(dir).sort(); } catch { return out; }
  for (const n of names) {
    if (out.length >= MAX_FILES) break;
    if (SKIP.has(n) || (n.startsWith('.') && n !== '.github')) continue;
    const p = join(dir, n);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, depth + 1, out);
    else out.push(p);
  }
  return out;
}

const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const norm = (c: string) => c.toLowerCase().replace(/\s+/g, ' ');

// a file's place as a route, for the frameworks that route by file (Next, SvelteKit, Astro, Nuxt), or null
function fileRoute(rel: string): string | null {
  const p = rel.split(sep).join('/');
  const m = /(?:^|\/)(app|pages|routes|src\/pages)\/(.*)$/.exec(p);
  if (!m?.[2]) return null;
  let r = m[2];
  if (m[1] === 'app' && !/(^|\/)page\.(tsx|jsx|ts|js|mdx)$/.test(r)) return null;
  if (m[1] === 'routes' && !/(^|\/)\+page\.svelte$/.test(r)) return null;
  if (/(^|\/)(_app|_document|_error|api\/|layout\.|\+layout)/.test(r)) return null;
  r = r.replace(/(^|\/)(page|\+page|index)\.[a-z]+$/, '').replace(/\.(tsx|jsx|ts|js|mdx|astro|vue|svelte)$/, '');
  r = r.replace(/\([^/)]*\)\/?/g, '').replace(/\/$/, '');
  return `/${r}`;
}

/** Read a project and say what its covers could be made of. */
export function study(dir: string): Brief {
  const b: Brief = { dir, colors: [], fonts: [], marks: [], tagged: [], previewFiles: [], covers: [], routes: [] };
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    for (const k of ['name', 'description', 'homepage'] as const) if (typeof pkg[k] === 'string') b[k] = pkg[k];
  } catch { /* not a package */ }
  const colors = new Map<string, number>();
  const names = new Map<string, Set<string>>();
  const fonts = new Map<string, number>();
  const routes = new Set<string>();
  for (const file of walk(dir)) {
    const rel = relative(dir, file);
    const r = fileRoute(rel);
    if (r !== null) routes.add(r);
    if (/\.svg$/i.test(file)) {
      if (/logo|mark|brand|icon|favicon/i.test(rel)) b.marks.push(rel);
      continue;
    }
    if (/\.(ico|png|jpe?g|webp)$/i.test(rel)) {
      if (/(^|[/\\])(og|opengraph|twitter|social)[^/\\]*\.\w+$/i.test(rel)) b.covers.push(rel);
      else if (/favicon|logo|icon|brand/i.test(rel)) b.marks.push(rel);
      continue;
    }
    if (/(^|[/\\])(opengraph|twitter)-image\.\w+$/.test(rel)) { b.previewFiles.push(rel); continue; }
    if (!TEXT.test(file)) continue;
    let t: string;
    try { if (statSync(file).size > MAX_BYTES) continue; t = readFileSync(file, 'utf8'); } catch { continue; }
    if (/export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata)|\bopenGraph\s*:/.test(t)) b.previewFiles.push(rel);
    // shadcn's bare HSL: --primary: 222.2 47.4% 11.2%;
    for (const m of t.matchAll(/--([\w-]+)\s*:\s*([0-9.]{1,6}\s+[0-9.]{1,6}%\s+[0-9.]{1,6}%)\s*;/g)) {
      if (!m[1] || !m[2]) continue;
      const v = `hsl(${norm(m[2])})`;
      bump(colors, v);
      (names.get(v) ?? names.set(v, new Set()).get(v))?.add(`--${m[1]}`);
    }
    for (const m of t.matchAll(/import\s*\{([^}]{1,300})\}\s*from\s*['"]next\/font\/google['"]/g))
      for (const f of (m[1] ?? '').split(',')) { const n = f.trim().split(/\s+as\s+/)[0]?.trim(); if (n) bump(fonts, n.replace(/_/g, ' ')); }
    if (/next\/font\/local|@font-face/.test(t))
      for (const m of t.matchAll(/['"(]([^'"()]*?([^/'"()]+)\.(?:woff2?|ttf|otf))['")]/g)) if (m[2]) bump(fonts, `${m[2]} (file)`);
    for (const m of t.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab)\([^)]{1,60}\))/g)) {
      if (!m[1] || !m[2]) continue;
      const v = norm(m[2]);
      if (!v.startsWith('#') || !/\.(css|scss|sass|less|html?|svelte|vue|astro)$/i.test(file)) bump(colors, v);   // a hex there is counted below
      (names.get(v) ?? names.set(v, new Set()).get(v))?.add(`--${m[1]}`);
    }
    if (/\.(css|scss|sass|less|html?|svelte|vue|astro)$/i.test(file) || /tailwind\.config/.test(file))
      for (const m of t.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) bump(colors, norm(m[0]));
    for (const m of t.matchAll(/font-family\s*:\s*([^;}{]{1,200})/g)) if (m[1]) bump(fonts, m[1].trim().replace(/\s*!important$/, ''));
    for (const m of t.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/g)) if (m[1]) bump(fonts, decodeURIComponent(m[1].replace(/\+/g, ' ')));
    for (const m of t.matchAll(/\b(?:app|router|server)\.(?:get|all|route)\(\s*['"`](\/[^'"`]{0,100})/g)) if (m[1]) routes.add(m[1]);
    if (/\.html?$/i.test(file) || /(^|\/)(layout|_document|_app|head)\.[jt]sx?$/.test(rel)) {
      const tags = readTags(t);
      if (Object.keys(tags).length) b.tagged.push({ file: rel, tags });
    }
    if (/\.html?$/i.test(file) && r === null) routes.add(`/${rel.split(sep).join('/').replace(/(^|\/)index\.html?$/, '').replace(/\.html?$/, '')}`);
  }
  b.colors = [...colors].sort((x, y) => y[1] - x[1]).slice(0, 16).map(([value, uses]) => ({ value, uses, names: [...(names.get(value) ?? [])].slice(0, 4) }));
  b.fonts = [...fonts].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([family, uses]) => ({ family, uses }));
  b.marks = b.marks.slice(0, 12);
  b.tagged = b.tagged.slice(0, 8);
  b.previewFiles = b.previewFiles.slice(0, 20);
  b.covers = b.covers.slice(0, 12);
  b.routes = [...routes].sort().slice(0, 60);
  return b;
}
