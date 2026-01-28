import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, '../runs');
const OUT_DIR = path.resolve(__dirname, '../attachment/micro-reports');

// Map clean model names to runs
const models = [
    'anthropic_claude-sonnet-4.5',
    'minimax_minimax-m2',
    'moonshotai_kimi-k2-thinking', // prefer the one with more children/older timestamp if valid
    'openai_gpt-5.2',
    'qwen_qwen3-coder',
    'x-ai_grok-4'
];

function main() {
    // 1. Clear existing
    if (fs.existsSync(OUT_DIR)) {
        fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Re-create README
    fs.writeFileSync(path.join(OUT_DIR, 'README.md'), `# Micro Reports\n\nThis directory contains detailed per-run reports for each evaluated model.\nEach model folder contains:\n- **eval_evaluation_report.md**: Functional & Execution results.\n- **esg_evaluation_report.md**: Compute & Environmental analysis.\n- **failure_taxonomy_report.md**: Detailed failure classification.\n`);

    // 2. Iterate models
    const allRuns = fs.readdirSync(RUNS_DIR)
        .filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());

    for (const modelPrefix of models) {
        // Find a run for this model that has the reports (checking for file existence)
        // Prefer runs with actual content (heuristic: folder name length or date?)
        // Let's just pick the first one that has the 3 md files.
        const candidates = allRuns.filter(r => r.startsWith(modelPrefix));

        let selectedRun = null;
        for (const runId of candidates) {
            const runPath = path.join(RUNS_DIR, runId);
            if (fs.existsSync(path.join(runPath, 'eval_evaluation_report.md')) &&
                fs.existsSync(path.join(runPath, 'esg_evaluation_report.md'))) {
                selectedRun = runId;
                break;
            }
        }

        if (!selectedRun) {
            console.warn(`No valid run found for ${modelPrefix}`);
            continue;
        }

        // Create target dir
        // Clean model name for folder: replace / with _ (already done in prefix mostly)
        const targetModelName = modelPrefix.replace('/', '_');
        const modelDir = path.join(OUT_DIR, targetModelName);
        fs.mkdirSync(modelDir, { recursive: true });

        // Copy files
        const srcPath = path.join(RUNS_DIR, selectedRun);

        fs.copyFileSync(path.join(srcPath, 'eval_evaluation_report.md'), path.join(modelDir, 'eval_report.md'));
        fs.copyFileSync(path.join(srcPath, 'esg_evaluation_report.md'), path.join(modelDir, 'esg_report.md'));
        fs.copyFileSync(path.join(srcPath, 'failure_taxonomy_report.md'), path.join(modelDir, 'failure_report.md'));

        console.log(`Copied reports for ${modelPrefix} from ${selectedRun}`);
    }
}

main();
