// Drawing a cover with the Chrome already on this machine: headless, its own --screenshot, from a
// page on disk or an address. Nothing is installed or downloaded.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { imageSize } from './cover.js';
import { COVER_SIZE } from './og.js';

const PLACES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

/** This machine's Chrome: $CHROME, else the usual places, else null. */
export const findChrome = (env: NodeJS.ProcessEnv = process.env): string | null =>
  env.CHROME || PLACES.find((p) => existsSync(p)) || null;

export interface DrawOptions {
  chrome?: string;
  width?: number;
  height?: number;
}

/** Draw a page (a file or an address) to a PNG at out; throws when it is not the size asked for. */
export function draw(page: string, out: string, o: DrawOptions = {}): { width: number; height: number } {
  const chrome = o.chrome ?? findChrome();
  if (!chrome) throw new Error('liveog: no Chrome found. Set CHROME to its path.');
  const width = o.width ?? COVER_SIZE[0];
  const height = o.height ?? COVER_SIZE[1];
  const url = /^(https?|file):/i.test(page) ? page : pathToFileURL(resolve(page)).href;
  const file = resolve(out);
  const profile = mkdtempSync(join(tmpdir(), 'liveog-'));
  try {
    execFileSync(chrome, ['--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars',
      '--force-device-scale-factor=1', `--window-size=${width},${height}`, '--virtual-time-budget=1000',
      `--screenshot=${file}`, url], { stdio: 'ignore', timeout: 60_000 });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  const got = imageSize(readFileSync(file));
  if (got?.width !== width || got.height !== height)
    throw new Error(`liveog: ${out} came out ${got ? `${got.width} x ${got.height}` : 'unreadable'}, not ${width} x ${height}`);
  return { width, height };
}
