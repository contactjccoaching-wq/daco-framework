# DACO — Declarative Agent & MCP Orchestration

[![Stars](https://img.shields.io/github/stars/contactjccoaching-wq/daco-framework?style=social)](https://github.com/contactjccoaching-wq/daco-framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**One MCP endpoint to rule them all.**

> Instead of configuring N separate MCP servers in Claude Desktop, you configure one: DACO. It routes tool calls to the right backend, executes them in parallel when possible, and returns structured results.

The pattern is backend-agnostic. You define backends as simple modules (name prefix → handler function). DACO handles routing, parallel execution, error recovery, and the full MCP protocol over HTTP.

The LLM poses questions. DACO executes.

---

## How It Works

```
Claude Desktop / Any MCP Client
        |
        | (single MCP connection)
        v
   +---------+
   |  DACO   |  Cloudflare Worker
   |  Router |  MCP Streamable HTTP
   +----+----+
        |
   +----+----+----+----+
   |    |    |    |    |
   v    v    v    v    v
 Backend A  B  C  D  ...
```

Each backend is a JS module exporting:
- `TOOLS` — array of MCP tool definitions
- `callBackend(name, args, env)` — handler function

DACO merges all tool lists, dispatches by name prefix, and adds meta-tools on top (`daco_execute_parallel`, `daco_list_backends`).

## Current Backends (reference implementation)

This repo ships with 4 backends as a working example:

| Backend | Prefix | What it does |
|---------|--------|---|
| Smart Rabbit | `smart_rabbit_*` | AI fitness program generation |
| PubMed | `pubmed_*` | Scientific literature search (NCBI) |
| Brave Search | `brave_*` | Real-time web search |
| FitLexicon | `fitlexicon_*` | Exercise database (873 exercises, 8 languages) |

**To adapt DACO to your own use case**, replace these with your own backends. The orchestration layer doesn't care what the backends do.

## Deploy

```bash
npm install
npx wrangler secret put BRAVE_API_KEY
npx wrangler secret put RAPIDAPI_KEY
npx wrangler deploy
```

## Configure in Claude Desktop

```json
{
  "mcpServers": {
    "daco": {
      "url": "https://your-worker.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

Or via local proxy:

```json
{
  "mcpServers": {
    "daco": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/mcp"]
    }
  }
}
```

## Adding a Backend

1. Create `backends/my-service.js`:

```javascript
export const MY_SERVICE_TOOLS = [{
    name: 'myservice_do_thing',
    description: 'Does the thing',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
}];

export async function callMyService(name, args, env) {
    const res = await fetch('https://api.example.com/...', { ... });
    return JSON.stringify(await res.json());
}
```

2. Import in `worker.js`, add to `ALL_TOOLS`, add prefix routing in `dispatchTool()`

That's it. No config files, no plugin system. Just functions.

## Parallel Execution

`daco_execute_parallel` fires multiple tool calls simultaneously:

```
daco_execute_parallel([
  { tool: "pubmed_search", arguments: { query: "hypertrophy" } },
  { tool: "brave_search", arguments: { query: "gym prices 2026" } },
  { tool: "myservice_do_thing", arguments: { query: "..." } }
])
→ All results returned in a single response
```

## Related Projects

- [**immune**](https://github.com/contactjccoaching-wq/immune) — Adaptive memory system — learns patterns from every scan (+85% code quality)
- [**chimera**](https://github.com/contactjccoaching-wq/chimera) — Bio-inspired 3-stage pipeline (Slime Mold → PRISM → Immune)
- [**spinal-loop**](https://github.com/contactjccoaching-wq/spinal-loop) — Neuromuscular-inspired agent routing (cheap models first)
- [**prism-framework**](https://github.com/contactjccoaching-wq/prism-framework) — Multi-agent synthesis via native LLM stochasticity
- [**smartrabbit-mcp**](https://github.com/contactjccoaching-wq/smartrabbit-mcp) — AI workout generator MCP server ([smartrabbitfitness.com](https://www.smartrabbitfitness.com))

---

MIT License — by [Jacques Chauvin](https://github.com/contactjccoaching-wq)
