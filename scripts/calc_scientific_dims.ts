
import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, '../runs');

// === Metric Definitions ===
// Score: Total Score (0-100)
// ECI: Eval Compute Index = (EvalTokens * ParameterScale) / 10000
// Failure Taxonomy: L1-L5 Failure Counts

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

    // Default values
    let score = 0;
    let evalTokens = 0;

    // Try reading from eval_evaluation_report.json (Best Source)
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
        // Fallback to log parsing
        const log = fs.readFileSync(path.join(runDir, 'stdout.log'), 'utf8');
        const scoreMatch = log.match(/Overall Score:\s*(\d+)/) || log.match(/Total Score:\s*(\d+)/);
        // Note: Total Score appears multiple times, Overall Score appears at end.
        // If we only find Total Score, it might be partial. But strict parsing prefers report.json.
        score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    }

    // 2. Time
    const timeMs = runMeta.elapsedMs || 0;

    // 3. ECI Input
    const parameterScale = runMeta.parameterScale;

    // Failures (still need log for details if not in report, but report has failureAnnotations)
    // For now we keep log scanning for failures as it's regex based and robust enough for counts
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
    if (!fs.existsSync(RUNS_DIR)) return;

    // 1. Parse all runs
    const runsRaw = fs.readdirSync(RUNS_DIR).filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());
    const dataset: RunData[] = [];

    for (const id of runsRaw) {
        const data = parseRun(id);
        if (data) dataset.push(data);
    }

    // 2. Update run.json with ECI and clean up FERPS
    let updated = 0;

    for (const d of dataset) {
        // ECI Calculation
        // ECI = (EvalTokens * ParameterScale) / 10000
        let ECI: number | null = null;
        if (typeof d.parameterScale === 'number' && typeof d.evalTokens === 'number') {
            ECI = (d.evalTokens * d.parameterScale) / 10000;
        }

        // Update run.json
        const jsonPath = path.join(RUNS_DIR, d.runId, 'run.json');
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // === REMOVE FERPS ===
        delete meta.F;
        delete meta.E;
        delete meta.R;
        delete meta.P;
        delete meta.S;

        // === SET DATA ===
        meta.score = d.score;
        meta.ECI = ECI;

        // Ensure failure taxonomy is recorded in meta for easy access (optional, but requested "Keep Failure Taxonomy")
        // run.json usually just stores meta, but let's add these if not present
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

    console.log(`Success: Calculated ECI and updated failures for ${updated} runs.`);
}

main();

