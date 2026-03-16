import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(ROOT_DIR, 'runs');

interface RunData {
    runId: string;
    model: string;
    score: number;
    timeMs: number;
    parameterScale?: number;
    evalTokens: number;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    l5: number;
    securityViolations: number;
}

function parseRun(runId: string): RunData | null {
    const runDir = path.join(RUNS_DIR, runId);
    if (!fs.existsSync(path.join(runDir, 'run.json'))) return null;

    const runMeta = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));

    let score = 0;
    let evalTokens = 0;

    const reportPath = path.join(runDir, 'eval_evaluation_report.json');
    if (fs.existsSync(reportPath)) {
        try {
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            if (typeof report.summary?.overallScore === 'number') {
                score = report.summary.overallScore;
            }
            if (typeof report.summary?.evalTokensTotal === 'number') {
                evalTokens = report.summary.evalTokensTotal;
            } else if (typeof report.config?.evalTokens === 'number') {
                evalTokens = report.config.evalTokens;
            }
        } catch (e) {
            console.warn(`Failed to parse report for ${runId}`, e);
        }
    } else if (fs.existsSync(path.join(runDir, 'stdout.log'))) {
        const log = fs.readFileSync(path.join(runDir, 'stdout.log'), 'utf8');
        const scoreMatch = log.match(/Overall Score:\s*(\d+)/) || log.match(/Total Score:\s*(\d+)/);
        score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    }

    const timeMs = runMeta.elapsedMs || 0;
    const parameterScale = runMeta.parameterScale;

    let l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0, securityViolations = 0;

    if (fs.existsSync(path.join(runDir, 'stdout.log'))) {
        const log = fs.readFileSync(path.join(runDir, 'stdout.log'), 'utf8');
        const count = (re: RegExp) => (log.match(re) ?? []).length;
        l5 = count(/BrowserError|NetworkError|ConnectionRefused|TaskTimedOut|Puppeteer/i);
        l4 = count(/RuntimeError|EntryNotFound|SandboxError|ZeroScore/i);
        l3 = count(/SyntaxError|JSON parse error|No files generated|Empty output|MODULE_NOT_FOUND/i);
        l2 = count(/ReferenceError|TypeError|NotDefined|ESLint error/i);
        l1 = count(/AssertionError|Verification failed|ESLint warning/i);
        securityViolations = count(/SandboxViolation|AccessDenied|SecretLeak|UnsafeEval/i);
    }

    return {
        runId,
        model: runMeta.model,
        score,
        timeMs,
        parameterScale,
        evalTokens,
        l1, l2, l3, l4, l5,
        securityViolations
    };
}

function main() {
    if (!fs.existsSync(RUNS_DIR)) {
        console.error(`Runs directory not found: ${RUNS_DIR}`);
        process.exitCode = 1;
        return;
    }

    const runsRaw = fs.readdirSync(RUNS_DIR).filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());
    const dataset: RunData[] = [];

    for (const id of runsRaw) {
        const data = parseRun(id);
        if (data) dataset.push(data);
    }

    let updated = 0;

    for (const d of dataset) {
        let ECI: number | null = null;
        if (typeof d.parameterScale === 'number' && typeof d.evalTokens === 'number') {
            ECI = (d.evalTokens * d.parameterScale) / 10000;
        }

        const jsonPath = path.join(RUNS_DIR, d.runId, 'run.json');
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        delete meta.F;
        delete meta.E;
        delete meta.R;
        delete meta.P;
        delete meta.S;

        meta.score = d.score;
        meta.ECI = ECI;
        meta.failures = {
            l1: d.l1,
            l2: d.l2,
            l3: d.l3,
            l4: d.l4,
            l5: d.l5
        };

        meta._audit = {
            method: 'eci_v1',
            timestamp: new Date().toISOString(),
            metrics: { score: d.score, eci: ECI }
        };

        fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
        updated++;
    }

    console.log(`Success: Recomputed derived metadata for ${updated} runs.`);
}

main();