# Security

Please report a security problem privately: open a [security advisory](https://github.com/bilal-abraham/liveog/security/advisories/new)
on GitHub rather than a public issue. You will get an answer within a few days.

What liveog does on your machine:

- `liveog mcp` reads the project folder it is asked about, draws covers with your own Chrome, and
  fetches only the links you ask it to check. Covers it draws can't reach the network or your files,
  and it saves them only inside the project.
- `liveog mcp add` adds one entry to each agent app's MCP settings and changes nothing else.
- The package has no runtime dependencies.
