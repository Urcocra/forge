
import * as fs from 'fs';
import * as path from 'path';

const RUNS_DIR = path.resolve(process.cwd(), 'runs');

// Map model IDs (from directory/run.json) to display names for LaTeX
// Adjust keys based on actual model names found in runs
const MODEL_MAP: Record<string, string> = {
    'anthropic/claude-sonnet-4.5': 'Claude-4.5',
    'alibaba/qwen3-coder': 'Qwen3-Coder',
    'x-ai/grok-4': 'Grok-4',
    'moonshot/kimi-k2': 'Kimi-K2',
    'minimax/minimax-m2': 'Minimax-M2',
    'openai/gpt-5.2': 'GPT-5.2'
};

// Reverse lookup helper if needed, but we mostly just need to group by model
// We'll normalize model strings.

interface RunStats {
    score: number;
    l2: number;
    l3: number;
    l4: number;
    l5: number;
}

interface AggregatedStats {
    count: number;
    avgScore: number;
    avgL2L3: number;
    avgL4L5: number;
}

function main() {
    if (!fs.existsSync(RUNS_DIR)) {
        console.error('Runs directory not found:', RUNS_DIR);
        process.exit(1);
    }

    const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
    const runDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (runDirs.length === 0) {
        console.error('No run directories found.');
        process.exit(1);
    }

    const modelStats: Record<string, RunStats[]> = {};

    for (const d of runDirs) {
        const runJsonPath = path.join(RUNS_DIR, d, 'run.json');
        if (!fs.existsSync(runJsonPath)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(runJsonPath, 'utf-8'));
            const modelKey = data.model; // e.g., "anthropic/claude-sonnet-4.5"

            if (!modelStats[modelKey]) {
                modelStats[modelKey] = [];
            }

            modelStats[modelKey].push({
                score: data.score || 0,
                l2: data.failures?.l2 || 0,
                l3: data.failures?.l3 || 0,
                l4: data.failures?.l4 || 0,
                l5: data.failures?.l5 || 0
            });
        } catch (e) {
            console.warn('Failed to parse', runJsonPath, e);
        }
    }

    // Aggregate
    const results: Record<string, AggregatedStats> = {};

    for (const [model, stats] of Object.entries(modelStats)) {
        const count = stats.length;
        const totalScore = stats.reduce((acc, current) => acc + current.score, 0);
        const totalL2 = stats.reduce((acc, current) => acc + current.l2, 0);
        const totalL3 = stats.reduce((acc, current) => acc + current.l3, 0);
        const totalL4 = stats.reduce((acc, current) => acc + current.l4, 0);
        const totalL5 = stats.reduce((acc, current) => acc + current.l5, 0);

        results[model] = {
            count,
            avgScore: totalScore / count,
            avgL2L3: (totalL2 + totalL3) / count,
            avgL4L5: (totalL4 + totalL5) / count
        };
    }

    // Generate Outputs to file
    let output = '';
    output += '--- LaTeX Table Rows ---\n';
    // Sort by Avg Score desc
    const sortedModels = Object.keys(results).sort((a, b) => results[b].avgScore - results[a].avgScore);

    // Filter to only models in our map to ensure clean names
    const validModels = sortedModels.filter(m => MODEL_MAP[m] || m); // fallback to raw if missing

    for (const m of validModels) {
        const name = MODEL_MAP[m] || m.split('/').pop() || m;
        const s = results[m];
        // Format: Claude-4.5 & 82.20 & 4.80 & 0.00 \\
        output += `${name.padEnd(12)} & ${s.avgScore.toFixed(2)} & ${s.avgL2L3.toFixed(2)} & ${s.avgL4L5.toFixed(2)} \\\\\n`;
    }

    output += '\n--- TikZ Plot Coordinates ---\n';

    // Ordered specifically for the plot (maybe same order as table or specific)
    // The paper uses: symbolic x coords={Claude-4.5, Qwen3-Coder, Kimi-K2, Grok-4, Minimax-M2, GPT-5.2},
    // We should probably generate that list too or match it.
    // Let's print the symbolic coords list based on data
    const displayNames = validModels.map(m => MODEL_MAP[m] || m.split('/').pop() || m);
    output += `symbolic x coords={${displayNames.join(', ')}},\n`;

    // Static (L2/L3) Coordinates
    // (Claude-4.5,4.80) (Qwen3-Coder,7.30) ...
    const staticCoords = validModels.map(m => {
        const name = MODEL_MAP[m] || m.split('/').pop() || m;
        return `(${name},${results[m].avgL2L3.toFixed(2)})`;
    }).join(' ');
    output += `\\addplot[fill=yellow!30] coordinates {${staticCoords}};\n`;

    // Runtime (L4/L5) Coordinates
    const runtimeCoords = validModels.map(m => {
        const name = MODEL_MAP[m] || m.split('/').pop() || m;
        return `(${name},${results[m].avgL4L5.toFixed(2)})`;
    }).join(' ');
    output += `\\addplot[fill=red!30] coordinates {${runtimeCoords}};\n`;

    fs.writeFileSync('latex_stats.txt', output);
    console.log('Wrote stats to latex_stats.txt');
}

main();
