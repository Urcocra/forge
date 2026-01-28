
import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.join(process.cwd(), 'runs');

const MODEL_PREFIXES = [
    'anthropic_claude',
    'minimax_minimax',
    'moonshotai_kimi',
    'openai_gpt',
    'qwen_qwen3',
    'x-ai_grok'
];

interface ModelStats {
    model: string;
    totalScore: number;
    count: number;
    scores: number[];
}

function main() {
    const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
    const allRuns = entries.filter(e => e.isDirectory()).map(e => e.name);

    const stats: Record<string, ModelStats> = {};

    for (const prefix of MODEL_PREFIXES) {
        let modelName = prefix.split('_').slice(1).join('_');
        if (prefix.includes('grok-4')) modelName = 'x-ai/grok-4';
        else if (prefix.includes('claude')) modelName = 'anthropic/claude-sonnet-4.5';
        else if (prefix.includes('minimax')) modelName = 'minimax/minimax-m2';
        else if (prefix.includes('kimi')) modelName = 'moonshotai/kimi-k2-thinking';
        else if (prefix.includes('gpt')) modelName = 'openai/gpt-5.2';
        else if (prefix.includes('qwen')) modelName = 'qwen/qwen3-coder';

        stats[modelName] = { model: modelName, totalScore: 0, count: 0, scores: [] };

        const modelRuns = allRuns.filter(r => r.startsWith(prefix));

        for (const run of modelRuns) {
            const reportPath = path.join(RUNS_DIR, run, 'eval_evaluation_report.json');
            if (fs.existsSync(reportPath)) {
                try {
                    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                    const score = report.summary.overallScore;
                    if (typeof score === 'number') {
                        stats[modelName].totalScore += score;
                        stats[modelName].count++;
                        stats[modelName].scores.push(score);
                    }
                } catch (e) { }
            }
        }
    }

    const results = Object.values(stats).map(s => ({
        model: s.model,
        avgScore: s.count > 0 ? (s.totalScore / s.count).toFixed(1) : '0.0',
        count: s.count
    }));

    results.sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('Model Rankings (Average Score):');
    results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.model}: ${r.avgScore} (${r.count} runs)`);
    });
}

main();
