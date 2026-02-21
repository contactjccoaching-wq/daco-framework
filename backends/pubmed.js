/**
 * DACO Backend — PubMed (NCBI)
 * Scientific literature search, no API key required
 */

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const PUBMED_TOOLS = [
    {
        name: 'pubmed_search',
        description: `Search PubMed for peer-reviewed scientific articles.
Returns titles, authors, journal, year, and direct links.
Use for evidence-based answers on training, physiology, nutrition, health.
Examples: "hypertrophy training volume", "HIIT fat loss", "sleep recovery athletes"`,
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search terms' },
                max_results: { type: 'number', minimum: 1, maximum: 10, default: 5 }
            },
            required: ['query']
        }
    }
];

export async function callPubmed(toolName, args, env) {
    if (toolName !== 'pubmed_search') throw new Error(`Unknown PubMed tool: ${toolName}`);

    const { query, max_results = 5 } = args;

    // Search for IDs
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max_results}&retmode=json&sort=relevance`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];

    if (ids.length === 0) {
        return `No PubMed results for: "${query}"\nTry broader terms or check spelling.`;
    }

    // Get summaries
    const summaryUrl = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();

    let output = `📚 PubMed — "${query}" (${ids.length} results)\n\n`;
    for (const id of ids) {
        const a = summaryData.result?.[id];
        if (!a) continue;
        const authors = a.authors?.slice(0, 3).map(x => x.name).join(', ') || 'Unknown';
        const year = a.pubdate?.split(' ')[0] || '';
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `📄 ${a.title}\n`;
        output += `👤 ${authors} (${year})\n`;
        output += `📰 ${a.source}\n`;
        output += `🔗 https://pubmed.ncbi.nlm.nih.gov/${id}/\n\n`;
    }

    return output;
}
