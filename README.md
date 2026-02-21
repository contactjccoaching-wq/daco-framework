# DACO MCP — Declarative Agent & MCP Orchestration

A Cloudflare Worker that implements the MCP protocol over HTTP, orchestrating multiple backends through a single endpoint.

## The concept

Instead of configuring 5 MCPs in your Claude Desktop, you configure one: DACO.
DACO routes tool calls to the right backend, and adds parallel execution (`daco_execute_parallel`) for the PRISM pattern applied to tools.

The LLM poses questions. DACO executes.

## Backends included

| Backend | Tools | Key use case |
|---------|-------|---|
| Smart Rabbit | `smart_rabbit_generate_program` | Personalized fitness programs |
| PubMed | `pubmed_search` | Scientific literature |
| Brave Search | `brave_search` | Real-time web search |
| FitLexicon | `fitlexicon_search_exercises`, `fitlexicon_get_exercise` | Exercise database |

## Deploy

```bash
cd DACO-MCP
npm install
npx wrangler secret put BRAVE_API_KEY      # Brave Search API key
npx wrangler secret put RAPIDAPI_KEY       # RapidAPI key
npx wrangler deploy
```

## Configure in Claude Desktop

Once deployed, add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "daco": {
      "url": "https://daco-mcp.contactjccoaching.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

Or use the npx local proxy:

```json
{
  "mcpServers": {
    "daco": {
      "command": "npx",
      "args": ["mcp-remote", "https://daco-mcp.contactjccoaching.workers.dev/mcp"]
    }
  }
}
```

## Extending

To add a new backend:

1. Create `backends/my-service.js` with `MY_SERVICE_TOOLS` and `callMyService(name, args, env)`
2. Import both in `worker.js`
3. Add tools to `ALL_TOOLS`
4. Add routing in `dispatchTool()`

The pattern is intentionally simple.

## PRISM + DACO

`daco_execute_parallel` lets Claude fire multiple tool calls simultaneously:

```
User: "Find studies on hypertrophy AND generate my program AND search for current gym prices"
        ↓
daco_execute_parallel([
  { tool: "pubmed_search", arguments: { query: "hypertrophy" } },
  { tool: "smart_rabbit_generate_program", arguments: { ... } },
  { tool: "brave_search", arguments: { query: "gym membership prices 2026" } }
])
        ↓
All 3 results returned simultaneously
```

---

Part of the [PRISM Framework](https://github.com/contactjccoaching-wq/prism-framework) by Jacques Chauvin.
