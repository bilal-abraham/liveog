// `liveog mcp add`: the MCP server added to every agent app on this machine. Apps with their own
// command are asked through it; apps that keep a JSON file get one key added, nothing else changed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const SERVER = { command: 'npx', args: ['-y', 'liveog', 'mcp'] };

export type Result = 'added' | 'already' | 'failed';

/** Add liveog under `mcpServers` in an app's JSON file; the rest of the file is kept as it was. */
export function addToJson(file: string): Result {
  let cfg: Record<string, unknown> = {};
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, 'utf8') || '{}') as Record<string, unknown>; } catch { return 'failed'; }
  }
  const servers = (cfg.mcpServers && typeof cfg.mcpServers === 'object' ? cfg.mcpServers : {}) as Record<string, unknown>;
  if (servers.liveog) return 'already';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...cfg, mcpServers: { ...servers, liveog: SERVER } }, null, 2)}\n`);
  return 'added';
}

export interface Env {
  home: string;
  platform: NodeJS.Platform;
  /** Is this command on the PATH? */
  has(bin: string): boolean;
  /** Run a command; its output, or a thrown error. */
  run(bin: string, args: string[]): string;
}

export const realEnv = (): Env => ({
  home: homedir(),
  platform: process.platform,
  has: (bin) => { try { execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } },
  run: (bin, args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
});

const viaCommand = (env: Env, bin: string, args: string[]): Result => {
  try { env.run(bin, args); return 'added'; } catch (e) {
    const msg = String((e as { stderr?: unknown }).stderr ?? (e as Error).message);
    return /already exists|already configured/i.test(msg) ? 'already' : 'failed';
  }
};

/** Each app found, and what happened. */
export function addEverywhere(env: Env = realEnv()): { app: string; result: Result }[] {
  const out: { app: string; result: Result }[] = [];
  const tail = ['--', SERVER.command, ...SERVER.args];
  if (env.has('claude')) out.push({ app: 'Claude Code', result: viaCommand(env, 'claude', ['mcp', 'add', '--scope', 'user', 'liveog', ...tail]) });
  if (env.has('codex')) out.push({ app: 'Codex', result: viaCommand(env, 'codex', ['mcp', 'add', 'liveog', ...tail]) });
  if (env.has('code')) out.push({ app: 'VS Code', result: viaCommand(env, 'code', ['--add-mcp', JSON.stringify({ name: 'liveog', ...SERVER })]) });
  const files: [string, string][] = [
    ['Cursor', join(env.home, '.cursor', 'mcp.json')],
    ['Windsurf', join(env.home, '.codeium', 'windsurf', 'mcp_config.json')],
  ];
  if (env.platform === 'darwin') files.push(['Claude Desktop', join(env.home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')]);
  for (const [app, file] of files) if (existsSync(dirname(file))) out.push({ app, result: addToJson(file) });
  return out;
}

/** What to tell the person. */
export function report(found: { app: string; result: Result }[]): string {
  const manual = `Any other MCP client: run "${[SERVER.command, ...SERVER.args].join(' ')}" over stdio, e.g.\n${JSON.stringify({ mcpServers: { liveog: SERVER } }, null, 2)}`;
  if (!found.length) return `No agent app found here.\n${manual}`;
  const word: Record<Result, string> = { added: 'added', already: 'already there', failed: 'could not add, see below' };
  return [...found.map((f) => `${f.app.padEnd(16)}${word[f.result]}`), '', found.some((f) => f.result === 'failed') ? manual : 'Restart the app, then ask: "Set up link previews for this project."'].join('\n');
}
