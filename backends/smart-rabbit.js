/**
 * DACO Backend — Smart Rabbit Fitness
 * Wraps the Smart Rabbit API for fitness program generation
 */

const SMART_RABBIT_API = 'https://smartrabbit-rapidapi.contactjccoaching.workers.dev';

export const SMART_RABBIT_TOOLS = [
    {
        name: 'smart_rabbit_generate_program',
        description: `Generate a personalized AI fitness program using Smart Rabbit.
Returns a complete training plan with exercises, sets, reps, tempo, rest times, and a 6-week progression.

⚠️ IMPORTANT: Before calling this tool, make sure you have collected from the user:
- age (required)
- sex: male or female (required)
- level: beginner / intermediate / advanced (required)
- sessions: number of training sessions per week, 2-6 (required)
- duration: session length in minutes — 30, 45, 60, 75, or 90 (required)
- equipment: bodyweight / minimal / home_gym / full_gym (required)
- goal: muscle / strength / endurance / weight_loss / wellness / definition (required)
- condition: sedentary / light / moderate / active / athletic (ask if not provided)
- preferences: exercise preferences, favorite equipment (ask)
- limitations: injuries or exercises to avoid (always ask for safety)

If any required field is missing, ask the user before calling this tool.`,
        inputSchema: {
            type: 'object',
            properties: {
                age: { type: 'number', minimum: 14, maximum: 80 },
                sex: { type: 'string', enum: ['male', 'female'] },
                level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                condition: { type: 'string', enum: ['sedentary', 'light', 'moderate', 'active', 'athletic'] },
                sessions: { type: 'number', minimum: 2, maximum: 6 },
                duration: { type: 'number', enum: [30, 45, 60, 75, 90] },
                equipment: { type: 'string', enum: ['bodyweight', 'minimal', 'home_gym', 'full_gym'] },
                style: { type: 'string', enum: ['hybrid', 'bodybuilding', 'powerlifting', 'crossfit', 'calisthenics', 'functional'] },
                goal: { type: 'string', enum: ['muscle', 'strength', 'endurance', 'weight_loss', 'wellness', 'definition'] },
                preferences: { type: 'string', maxLength: 500 },
                limitations: { type: 'string', maxLength: 500 },
            },
            required: ['age', 'sex', 'level', 'sessions', 'duration', 'equipment', 'goal']
        }
    },
    {
        name: 'smart_rabbit_get_options',
        description: 'Get all valid parameter values for Smart Rabbit program generation (goals, equipment, levels, styles).',
        inputSchema: { type: 'object', properties: {} }
    }
];

export async function callSmartRabbit(toolName, args, env) {
    if (toolName === 'smart_rabbit_get_options') {
        return `Smart Rabbit — Available Options:

GOALS: muscle | strength | endurance | weight_loss | wellness | definition
EQUIPMENT: bodyweight | minimal | home_gym | full_gym
LEVELS: beginner | intermediate | advanced
CONDITIONS: sedentary | light | moderate | active | athletic
STYLES: hybrid | bodybuilding | powerlifting | crossfit | calisthenics | functional
DURATIONS: 30, 45, 60, 75, 90 minutes
SESSIONS/WEEK: 2–6`;
    }

    if (toolName === 'smart_rabbit_generate_program') {
        const response = await fetch(`${SMART_RABBIT_API}/generate-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
        });

        const data = await response.json();

        if (!data.success) {
            return `Error from Smart Rabbit API: ${data.error}\nRequired: ${data.required?.join(', ') || 'age, sex, level, sessions, duration, equipment, goal'}`;
        }

        return data.prompt;
    }

    throw new Error(`Unknown Smart Rabbit tool: ${toolName}`);
}
