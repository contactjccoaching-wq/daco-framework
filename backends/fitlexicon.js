/**
 * DACO Backend — FitLexicon
 * 873 exercises in 8 languages via RapidAPI
 * Requires env.RAPIDAPI_KEY
 */

const FITLEXICON_BASE = 'https://fitlexicon.p.rapidapi.com';

export const FITLEXICON_TOOLS = [
    {
        name: 'fitlexicon_search_exercises',
        description: `Search the FitLexicon exercise database (873 exercises, 8 languages).
Filter by muscle group, category, equipment, or language.
Use to find specific exercises with full instructions and images.`,
        inputSchema: {
            type: 'object',
            properties: {
                muscle: { type: 'string', description: 'Target muscle (e.g., chest, back, biceps, quadriceps)' },
                category: { type: 'string', description: 'Category (e.g., strength, cardio, stretching)' },
                equipment: { type: 'string', description: 'Equipment (e.g., barbell, dumbbell, bodyweight, machine)' },
                lang: { type: 'string', default: 'en', description: 'Language: en, fr, es, de, pt, it, ar, hi' },
                limit: { type: 'number', default: 10, maximum: 50 }
            }
        }
    },
    {
        name: 'fitlexicon_get_exercise',
        description: 'Get full details of a specific exercise by ID, including instructions, muscles worked, and images.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Exercise ID' },
                lang: { type: 'string', default: 'en' }
            },
            required: ['id']
        }
    }
];

export async function callFitlexicon(toolName, args, env) {
    const apiKey = env.RAPIDAPI_KEY;
    if (!apiKey) return 'FitLexicon not configured (missing RAPIDAPI_KEY)';

    const headers = {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'fitlexicon.p.rapidapi.com',
    };

    if (toolName === 'fitlexicon_search_exercises') {
        const params = new URLSearchParams();
        if (args.muscle) params.set('muscle', args.muscle);
        if (args.category) params.set('category', args.category);
        if (args.equipment) params.set('equipment', args.equipment);
        if (args.lang) params.set('lang', args.lang || 'en');
        if (args.limit) params.set('limit', String(args.limit || 10));

        const res = await fetch(`${FITLEXICON_BASE}/exercises?${params}`, { headers });
        if (!res.ok) return `FitLexicon error: ${res.status}`;
        const data = await res.json();

        const exercises = data.data || data.exercises || data || [];
        if (!exercises.length) return 'No exercises found with those filters.';

        let out = `💪 FitLexicon — ${exercises.length} exercise(s) found\n\n`;
        for (const ex of exercises.slice(0, args.limit || 10)) {
            out += `[${ex.id}] **${ex.name}**\n`;
            out += `  Muscle: ${ex.muscle || ex.muscles || '—'} | Equipment: ${ex.equipment || '—'}\n`;
            if (ex.description) out += `  ${ex.description.substring(0, 120)}...\n`;
            out += '\n';
        }
        return out;
    }

    if (toolName === 'fitlexicon_get_exercise') {
        const params = new URLSearchParams({ lang: args.lang || 'en' });
        const res = await fetch(`${FITLEXICON_BASE}/exercises/${args.id}?${params}`, { headers });
        if (!res.ok) return `Exercise ${args.id} not found`;
        const ex = await res.json();

        let out = `💪 **${ex.name}**\n\n`;
        out += `Muscle: ${ex.muscle || ex.muscles || '—'}\n`;
        out += `Equipment: ${ex.equipment || '—'}\n`;
        out += `Category: ${ex.category || '—'}\n\n`;
        if (ex.description) out += `**Description:**\n${ex.description}\n\n`;
        if (ex.instructions) out += `**Instructions:**\n${ex.instructions}\n\n`;
        return out;
    }

    throw new Error(`Unknown FitLexicon tool: ${toolName}`);
}
