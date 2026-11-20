# Connecting liveog to a coding agent

For an AI agent setting up liveog for a person. liveog is an MCP server that gives a project link
previews that show what's happening now. It runs on the person's computer over stdio:

    command: npx
    args:    -y liveog mcp

No account, no API key, no sign-in.

## 1. Add the server

The quickest way, for most apps, is to run this in a terminal:

    npx liveog mcp add

It finds the agent apps on this computer and adds liveog to each one, changing nothing else.
If you prefer to add it yourself, use the line for the app you are running in.

Apps with their own command:

| App | Command |
|---|---|
| Claude Code | `claude mcp add --scope user liveog -- npx -y liveog mcp` |
| Codex | `codex mcp add liveog -- npx -y liveog mcp` |
| Kimi Code | `kimi mcp add --transport stdio liveog -- npx -y liveog mcp` |
| Hermes Agent | `hermes mcp add liveog --command npx --args -y liveog mcp` |
| Amp | `amp mcp add liveog -- npx -y liveog mcp` |
| VS Code | `code --add-mcp '{"name":"liveog","command":"npx","args":["-y","liveog","mcp"]}'` |

Apps that keep a JSON file. Add one key and keep everything else in the file as it is:

| App | File | Key |
|---|---|---|
| Cursor | `~/.cursor/mcp.json` | `mcpServers` |
| Windsurf (Devin Desktop) | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |
| Kiro | `~/.kiro/settings/mcp.json` | `mcpServers` |
| LM Studio | `~/.lmstudio/mcp.json` | `mcpServers` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers` |

The entry under `mcpServers`:

```json
{ "mcpServers": { "liveog": { "command": "npx", "args": ["-y", "liveog", "mcp"] } } }
```

OpenCode (`~/.config/opencode/opencode.json`) uses its own shape:

```json
{ "mcp": { "liveog": { "type": "local", "command": ["npx", "-y", "liveog", "mcp"], "enabled": true } } }
```

Any other app (Muse Code, Factory, Zed, JetBrains, Cline, Warp, Goose, Continue, Kilo Code, and the
rest): add a local stdio MCP server named `liveog` with command `npx` and args `-y liveog mcp`,
wherever that app keeps its MCP settings. Check the app's own docs for the place; don't guess.

## 2. Restart if needed

Most apps load MCP servers when they start. If liveog's tools (`study_project`, `draw_cover`,
`setup_project`, `check_link`) don't appear, tell the person to restart the app, then carry on.

## 3. Set up link previews, with the person

The server's own instructions explain the work. In short:

1. `study_project`, then say which links people share and what each preview could show. Ask
   which matter; don't decide alone.
2. For the ones they pick, draw two or three ideas with `draw_cover` in the project's own style,
   and let them choose.
3. `setup_project` for the code, then wire it in.
4. `check_link` on a deployed link to confirm.

Never change the project before the person has picked what they want.
