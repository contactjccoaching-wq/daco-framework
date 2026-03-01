# DACO — Declarative Agent & MCP Orchestration

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

| Project | Role |
|---------|------|
| **[PRISM Framework](https://github.com/contactjccoaching-wq/prism-framework)** | N-parallel sampling + meritocratic synthesis — *what to ask* |
| **[Spinal Loop](https://github.com/contactjccoaching-wq/spinal-loop)** | Bio-inspired model routing — *who to ask* |
| **DACO** *(this repo)* | MCP tool orchestration — *what to do with it* |

---

MIT License — by [Jacques Chauvin](https://github.com/contactjccoaching-wq)
