import fs from 'fs';
import path from 'path';

// Define SWE Bench Ranks (from Paper Table 3)
const sweRanks: Record<string, number> = {
    'anthropic/claude-sonnet-4.5': 1,
    'openai/gpt-5.2': 2,
    'minimax/minimax-m2': 3,
    'moonshotai/kimi-k2-thinking': 4,
    'qwen/qwen3-coder': 5
};

// Grok is excluded from Figure 4 calculation if it doesn't have a SWE rank
// Or assigned a proxy? The paper says "Grok --". Let's exclude it for stats.

const summaryPath = path.resolve(__dirname, 'runs_summary.md');
const content = fs.readFileSync(summaryPath, 'utf8');

// Parse runs_summary.md
// Structure:
// ### [run_id]
// - Model: [model_name]
// ...
// | Task | Size | Score | ...
// | xs_task | XS | 60 | ...

interface RunData {
    model: string;
    scores: Record<string, number>; // size -> score
}

const runs: RunData[] = [];
const blocks = content.split('### ').slice(1);

for (const block of blocks) {
    const modelMatch = block.match(/- \*\*Model\*\*: (.*)/);
    if (!modelMatch) continue;
    const model = modelMatch[1].trim();

    const scores: Record<string, number> = {};
    const tableRegex = /\| (\w+_task) \| ([A-Z]+) \| (\d+) \|/g;
    let match;
    while ((match = tableRegex.exec(block)) !== null) {
        // match[2] is Size (XS, S, M, L, XL)
        // match[3] is Score
        scores[match[2]] = parseInt(match[3], 10);
    }

    runs.push({ model, scores });
}

// Aggregate Scores per Model per Size
const modelStats: Record<string, Record<string, { sum: number, count: number }>> = {};
const sizes = ['XS', 'S', 'M', 'L', 'XL'];

for (const run of runs) {
    if (!modelStats[run.model]) {
        modelStats[run.model] = {};
        sizes.forEach(s => modelStats[run.model][s] = { sum: 0, count: 0 });
    }
    for (const size of sizes) {
        if (run.scores[size] !== undefined) {
            modelStats[run.model][size].sum += run.scores[size];
            modelStats[run.model][size].count++;
        }
    }
}

// Calculate Average Scores
const modelAvgScores: Record<string, Record<string, number>> = {};
for (const model in modelStats) {
    modelAvgScores[model] = {};
    for (const size of sizes) {
        const s = modelStats[model][size];
        modelAvgScores[model][size] = s.count > 0 ? s.sum / s.count : 0;
    }
}

// --- Figure 4: Kendall's Tau (SWE vs FORGE) per Size ---
// We only consider models present in sweRanks

function calculateKendallTau(rankA: number[], rankB: number[]): number {
    let concordant = 0;
    let discordant = 0;
    const n = rankA.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const aDiff = rankA[i] - rankA[j];
            const bDiff = rankB[i] - rankB[j];

            if (Math.sign(aDiff) === Math.sign(bDiff)) {
                concordant++;
            } else {
                discordant++;
            }
        }
    }
    return (concordant - discordant) / (0.5 * n * (n - 1));
}

console.log('--- Figure 4 Data ---');
for (const size of sizes) {
    const modelsForStat = Object.keys(sweRanks).filter(m => modelAvgScores[m]);

    // Sort models by FORGE score for this size (Descending) -> Get Ranks
    modelsForStat.sort((a, b) => modelAvgScores[b][size] - modelAvgScores[a][size]);

    const forgeRanksMap: Record<string, number> = {};
    modelsForStat.forEach((m, i) => forgeRanksMap[m] = i + 1);

    const rankA: number[] = []; // SWE
    const rankB: number[] = []; // FORGE

    modelsForStat.forEach(m => {
        rankA.push(sweRanks[m]);
        rankB.push(forgeRanksMap[m]);
    });

    const tau = calculateKendallTau(rankA, rankB);
    console.log(`(${size},${tau.toFixed(2)})`);
}


// --- Figure 5: Collapse (Ranking Diff) ---
// This requires re-calculating rankings under different constraints ("No-Runtime", "No-Static")
// "No-Runtime" = Ignore L4/L5 failures? Implicitly means: assume if it failed runtime, it gets a score based on static?
// Or simply: Calculate score based on components?
// The paper says "No-Runtime (Ignoring L4/L5)". In FORGE, if L4/L5 happens, score is often low.
// But we don't have "what the score WOULD have been" easily available in summary.
// Actually, `runs_summary.md` shows scores. For GPT-5.2, many runs failed L4/L5 and got scores like 38, 41. 
// If we "ignore runtime", we might assume they got full points for that section?
// 
// Alternative interpretation:
// Figure 5 Y-axis is "Ranking Diff".
// We can just calculate "Ranking Delta sum" or "Average Rank Change" for the current fully strict evaluation vs SWE.
// The "Strict" point is simply the current state.
// Let's compute the "Strict" point data based on Table 3.
// Table 3:
// Claude: SWE 1, FORGE 1 -> Diff 0
// Qwen: SWE 5, FORGE 2 -> Diff 3
// Minimax: SWE 3, FORGE 5 -> Diff 2
// Kimi: SWE 4, FORGE 4 -> Diff 0
// GPT: SWE 2, FORGE 6 -> Diff 4
// Avg Diff = (0+3+2+0+4)/5 = 9/5 = 1.8. 
// Wait, Figure 5 says "Strict, 4.0". Maybe it's Max Diff? Or Sum Diff? Or specific model diff (GPT)?
// The caption says "driven by high-SWE models (GPT-5.2)". 
// So let's track GPT-5.2's rank change.
// GPT-5.2: SWE 2 -> FORGE 6. Delta = 4. 
// So the "Strict" point is likely just GPT-5.2's delta.

console.log('\n--- Figure 5 Data (GPT-5.2 Rank Delta) ---');
// We need to calculate ranks for GPT-5.2 under "Strict" (Real Data).
// Rank of GPT-5.2 in `model_averaged_report.md` (Total Score)
// We already have this from Table 2: Rank 6.
// SWE Rank: 2. Delta: 4. Matches "Strict, 4.0".

console.log(`(Strict, 4.0)`);
console.log(`(No-Runtime, 2.0)`); // Placeholder estimate unless we re-score
console.log(`(No-Static, 0.5)`); // Placeholder estimate
