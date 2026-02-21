/**
 * DACO Backend — Brave Search
 * Real-time web search
 * Requires env.BRAVE_API_KEY
 */

export const BRAVE_TOOLS = [
    {
        name: 'brave_search',
        description: `Real-time web search using Brave Search API.
Use for current information, prices, news, trends, or anything requiring up-to-date data.
Returns titles, descriptions, and URLs of top results.`,
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                count: { type: 'number', minimum: 1, maximum: 10, default: 5, description: 'Number of results' }
            },
            required: ['query']
        }
    }
];

export async function callBrave(toolName, args, env) {
    if (toolName !== 'brave_search') throw new Error(`Unknown Brave tool: ${toolName}`);

    const apiKey = env.BRAVE_API_KEY;
    if (!apiKey) return 'Brave Search not configured (missing BRAVE_API_KEY)';

    const { query, count = 5 } = args;

    const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
        {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey,
            }
        }
    );

    if (!res.ok) {
        return `Brave Search error: ${res.status} ${res.statusText}`;
    }

    const data = await res.json();
    const results = data.web?.results || [];

    if (results.length === 0) return `No results found for: "${query}"`;

    let output = `🔍 Brave Search — "${query}"\n\n`;
    for (const r of results) {
        output += `• **${r.title}**\n`;
        output += `  ${r.description || ''}\n`;
        output += `  ${r.url}\n\n`;
    }

    return output;
}
