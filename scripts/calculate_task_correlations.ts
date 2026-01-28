
import * as fs from 'fs';
import * as path from 'path';

// --- Data ---
const EXTERNAL_BENCHMARKS: Record<string, number> = {
    'anthropic/claude-sonnet-4.5': 65.0,
    'openai/gpt-5.2': 72.0,
    'x-ai/grok-4': 60.0,
    'moonshotai/kimi-k2-thinking': 55.0,
    'qwen/qwen3-coder': 50.0,
    'minimax/minimax-m2': 45.0
};

// Map directory names to IDs if needed, or rely on ID in report
const DIR_TO_ID: Record<string, string> = {
    'claude-sonnet-4.5': 'anthropic/claude-sonnet-4.5',
    'gpt-5.2': 'openai/gpt-5.2',
    'grok': 'x-ai/grok-4',
    'kimi-k2-thinking': 'moonshotai/kimi-k2-thinking',
    'qwen3-coder': 'qwen/qwen3-coder',
    'minimax-m2': 'minimax/minimax-m2'
};

const TASKS = ['xs_task', 's_task', 'm_task', 'l_task', 'xl_task'];

// --- Statistics Utils ---
function calculateKendallTau(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return NaN;

    let concordant = 0;
    let discordant = 0;
    const n = x.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const xDiff = x[i] - x[j];
            const yDiff = y[i] - y[j];

            const signX = Math.sign(xDiff);
            const signY = Math.sign(yDiff);

            if (signX === 0 || signY === 0) continue;

            if (signX === signY) {
                concordant++;
            } else {
                discordant++;
            }
        }
    }

    const totalPairs = (n * (n - 1)) / 2;
    if (totalPairs === 0) return 0;

    let tieX = 0;
    let tieY = 0;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (x[i] === x[j]) tieX++;
            if (y[i] === y[j]) tieY++;
        }
    }

    const denom = Math.sqrt((totalPairs - tieX) * (totalPairs - tieY));
    if (denom === 0) return 0;

    return (concordant - discordant) / denom;
}

// --- Main ---
async function main() {
    const microReportsDir = path.join(process.cwd(), 'attachment', 'micro-reports');
    const modelScores: Record<string, Record<string, number>> = {};

    // 1. Gather Scores
    for (const dirName of Object.keys(DIR_TO_ID)) {
        const modelId = DIR_TO_ID[dirName];
        const reportPath = path.join(microReportsDir, dirName, 'eval_evaluation_report.json');

        if (fs.existsSync(reportPath)) {
            try {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                // Assuming 'results' array contains tasks
                const tasks = report.results || report.breakdown || [];

                modelScores[modelId] = {};

                for (const task of tasks) {
                    // Try to finding score. Usually task.score or task.finalResult.totalScore
                    // In aggregated reports, it might just be 'score'
                    let score = 0;
                    if (typeof task.score === 'number') {
                        score = task.score;
                    } else if (task.finalResult && typeof task.finalResult.totalScore === 'number') {
                        score = task.finalResult.totalScore;
                    }
                    modelScores[modelId][task.taskId] = score;
                }
            } catch (e) {
                console.error(`Error reading ${dirName}`, e);
            }
        } else {
            console.warn(`Report not found for ${dirName}`);
        }
    }

    // 2. Calculate Correlations
    console.log('--- Coordinates for LaTeX ---');
    console.log('\\addplot[color=blue, mark=square*, thick] coordinates {');

    const difficultyLabels: Record<string, string> = {
        'xs_task': 'XS',
        's_task': 'S',
        'm_task': 'M',
        'l_task': 'L',
        'xl_task': 'XL'
    };

    for (const taskName of TASKS) {
        const x: number[] = [];
        const y: number[] = [];

        for (const [modelId, tasks] of Object.entries(modelScores)) {
            const extScore = EXTERNAL_BENCHMARKS[modelId];
            const forgeScore = tasks[taskName];

            if (extScore !== undefined && forgeScore !== undefined) {
                x.push(extScore);
                y.push(forgeScore);
            }
        }

        const tau = calculateKendallTau(x, y);
        const label = difficultyLabels[taskName];
        console.log(`    (${label},${tau.toFixed(2)})`);
    }

    console.log('};');
}

main();
