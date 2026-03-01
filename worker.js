/**
 * DACO — Declarative Agent & MCP Orchestration
 * Cloudflare Worker implementing MCP Streamable HTTP transport
 *
 * A single MCP endpoint that orchestrates multiple backends:
 * - Smart Rabbit (fitness programs)
 * - PubMed (scientific literature)
 * - Brave Search (web search)
 * - FitLexicon (exercise database)
 *
 * The LLM poses questions, DACO executes the right tools.
 */

import { SMART_RABBIT_TOOLS, callSmartRabbit } from './backends/smart-rabbit.js';
import { PUBMED_TOOLS, callPubmed } from './backends/pubmed.js';
import { BRAVE_TOOLS, callBrave } from './backends/brave-search.js';
import { FITLEXICON_TOOLS, callFitlexicon } from './backends/fitlexicon.js';

const DACO_VERSION = '1.0.0';
const MCP_PROTOCOL_VERSION = '2024-11-05';

// Meta-tools added on top of backends
const META_TOOLS = [
    {
        name: 'daco_execute_parallel',
        description: `Execute multiple DACO tool calls simultaneously and return all results.
Use this when you need results from several independent tools at once.
Example: search PubMed + call Smart Rabbit API + search exercises, all in parallel.
This is the core PRISM pattern applied to tool execution.`,
        inputSchema: {
            type: 'object',
            properties: {
                calls: {
                    type: 'array',
                    description: 'Array of tool calls to execute in parallel',
                    items: {
                        type: 'object',
                        properties: {
                            tool: { type: 'string', description: 'Tool name' },
                            arguments: { type: 'object', description: 'Tool arguments' }
                        },
                        required: ['tool', 'arguments']
                    }
                }
            },
            required: ['calls']
        }
    },
    {
        name: 'daco_list_backends',
        description: 'List all available backends and their tools with descriptions. Use this first to understand what DACO can do for the current task.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];

const ALL_TOOLS = [
    ...META_TOOLS,
    ...SMART_RABBIT_TOOLS,
    ...PUBMED_TOOLS,
    ...BRAVE_TOOLS,
    ...FITLEXICON_TOOLS,
];

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
};

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // Health check
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                version: DACO_VERSION,
                tools: ALL_TOOLS.length,
                backends: ['smart_rabbit', 'pubmed', 'brave_search', 'fitlexicon']
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // MCP endpoint
        if (url.pathname !== '/mcp' && url.pathname !== '/') {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response('DACO MCP Server — send POST requests with MCP JSON-RPC messages', {
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonRpcError(null, -32700, 'Parse error');
        }

        // Handle batch requests
        if (Array.isArray(body)) {
            const results = await Promise.all(body.map(msg => handleMessage(msg, env)));
            return jsonResponse(results);
        }

        const result = await handleMessage(body, env);
        return jsonResponse(result);
    }
};

async function handleMessage(msg, env) {
    const { jsonrpc = '2.0', id, method, params = {} } = msg;

    try {
        switch (method) {
            case 'initialize':
                return {
                    jsonrpc, id,
                    result: {
                        protocolVersion: MCP_PROTOCOL_VERSION,
                        serverInfo: {
                            name: 'DACO',
                            version: DACO_VERSION,
                        },
                        capabilities: { tools: {} },
                        // The system prompt hint — tells Claude how to use DACO
                        instructions: `You are connected to DACO (Declarative Agent & MCP Orchestration).

DACO orchestrates multiple specialized backends through a single interface.

## How to use DACO

1. **Start by asking the user questions** — never assume. Gather what you need before calling tools.
2. **Use daco_list_backends** if unsure which tools are available.
3. **Use daco_execute_parallel** when you need results from multiple tools simultaneously.
4. **Chain results** — use output from one tool as input to another.

## Backends available
- Smart Rabbit API: personalized fitness program generation
- PubMed: scientific literature search (NCBI)
- Brave Search: real-time web search
- FitLexicon: exercise database (873 exercises, 8 languages)

## Conversation pattern
When a user asks for a fitness program:
1. Ask for missing info (age, goal, equipment, sessions/week, limitations) — ONE conversational message
2. Wait for their answer
3. Call smart_rabbit_generate_program with all parameters
4. Optionally enrich with pubmed_search for scientific references
5. Return the complete result

Never generate a program without knowing at minimum: age, level, goal, equipment, sessions/week.`
                    }
                };

            case 'notifications/initialized':
                return { jsonrpc, id: null, result: {} };

            case 'tools/list':
                return {
                    jsonrpc, id,
                    result: { tools: ALL_TOOLS }
                };

            case 'tools/call': {
                const { name, arguments: args = {} } = params;

                if (name === 'daco_list_backends') {
                    return {
                        jsonrpc, id,
                        result: {
                            content: [{
                                type: 'text',
                                text: formatBackendManifest()
                            }]
                        }
                    };
                }

                if (name === 'daco_execute_parallel') {
                    const results = await Promise.allSettled(
                        (args.calls || []).map(call =>
                            dispatchTool(call.tool, call.arguments || {}, env)
                        )
                    );

                    const content = results.map((r, i) => ({
                        type: 'text',
                        text: r.status === 'fulfilled'
                            ? `[${args.calls[i].tool}]\n${r.value}`
                            : `[${args.calls[i].tool}] ERROR: ${r.reason?.message || 'Unknown error'}`
                    }));

                    return { jsonrpc, id, result: { content } };
                }

                const toolResult = await dispatchTool(name, args, env);
                return {
                    jsonrpc, id,
                    result: {
                        content: [{ type: 'text', text: toolResult }]
                    }
                };
            }

            case 'ping':
                return { jsonrpc, id, result: {} };

            default:
                return {
                    jsonrpc, id,
                    error: { code: -32601, message: `Method not found: ${method}` }
                };
        }
    } catch (err) {
        console.error('DACO error:', err);
        return {
            jsonrpc, id,
            error: { code: -32000, message: err.message || 'Internal error' }
        };
    }
}

async function dispatchTool(name, args, env) {
    if (name.startsWith('smart_rabbit_')) return callSmartRabbit(name, args, env);
    if (name.startsWith('pubmed_')) return callPubmed(name, args, env);
    if (name.startsWith('brave_')) return callBrave(name, args, env);
    if (name.startsWith('fitlexicon_')) return callFitlexicon(name, args, env);
    throw new Error(`Unknown tool: ${name}`);
}

function formatBackendManifest() {
    const backends = [
        {
            name: 'Smart Rabbit',
            prefix: 'smart_rabbit_',
            tools: SMART_RABBIT_TOOLS,
        },
        {
            name: 'PubMed',
            prefix: 'pubmed_',
            tools: PUBMED_TOOLS,
        },
        {
            name: 'Brave Search',
            prefix: 'brave_',
            tools: BRAVE_TOOLS,
        },
        {
            name: 'FitLexicon',
            prefix: 'fitlexicon_',
            tools: FITLEXICON_TOOLS,
        },
    ];

    let text = '# DACO — Available Backends\n\n';
    for (const backend of backends) {
        text += `## ${backend.name}\n`;
        for (const tool of backend.tools) {
            text += `- \`${tool.name}\`: ${tool.description.split('\n')[0]}\n`;
        }
        text += '\n';
    }
    text += '## Meta-tools\n';
    for (const tool of META_TOOLS) {
        text += `- \`${tool.name}\`: ${tool.description.split('\n')[0]}\n`;
    }
    return text;
}

function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

function jsonRpcError(id, code, message) {
    return new Response(JSON.stringify({
        jsonrpc: '2.0', id,
        error: { code, message }
    }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
