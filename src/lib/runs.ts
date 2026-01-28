import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { getTask } from './task';

/**
 * ======================================
 * Types
 * ======================================
 */

export interface RunMeta {
    runId: string;
    model: string;
    timestamp: string;
    configPath?: string;
    [key: string]: any;
}

export type Run = RunMeta;

const getRunsDir = () => {
    // 1. Try env var
    if (process.env.FORGE_RUNS_DIR && fsSync.existsSync(process.env.FORGE_RUNS_DIR)) {
        return process.env.FORGE_RUNS_DIR;
    }

    // 2. Try CWD and parents
    const candidates = [
        path.resolve(process.cwd(), 'runs'),
        path.resolve(process.cwd(), '../runs'),
    ];

    // 3. Try relative to __dirname (CommonJS fallback)
    if (typeof __dirname !== 'undefined') {
        // likely src/lib/runs.ts or dist/lib/runs.js
        // both need ../../runs to get to project root runs
        candidates.push(path.resolve(__dirname, '../../runs'));
    }

    for (const candidate of candidates) {
        if (fsSync.existsSync(candidate)) {
            return candidate;
        }
    }

    // 4. Fallback
    return candidates[0];
};

export const RUNS_DIR = getRunsDir();

console.log('[FORGE:UI] Resolved RUNS_DIR =', RUNS_DIR);

/**
 * ======================================
 * Internal helpers
 * ======================================
 */

async function readRunFile(runDirName: string): Promise<RunMeta | null> {
    const runJsonPath = path.join(RUNS_DIR, runDirName, 'run.json');

    try {
        const content = await fs.readFile(runJsonPath, 'utf-8');
        const data = JSON.parse(content);

        if (!data.runId) {
            data.runId = runDirName;
        }

        return data;
    } catch (err: any) {
        if (err.code === 'ENOENT') return null;
        console.warn('[FORGE:UI] Failed to read', runJsonPath, err);
        return null;
    }
}

/**
 * ======================================
 * Public API
 * ======================================
 */

export async function getRuns(): Promise<RunMeta[]> {
    try {
        const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory());

        const runs: RunMeta[] = [];

        for (const dir of dirs) {
            const run = await readRunFile(dir.name);
            if (run) runs.push(run);
        }

        runs.sort(
            (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
        );

        console.log(`[FORGE:UI] Loaded ${runs.length} runs`);
        return runs;
    } catch (err) {
        console.error('[FORGE:UI] Failed to read runs directory', err);
        return [];
    }
}

export async function getRun(runId: string): Promise<RunMeta | null> {
    const direct = await readRunFile(runId);
    if (direct) return direct;

    const all = await getRuns();
    return all.find(r => r.runId === runId) ?? null;
}

/**
 * ======================================
 * Failure analysis
 * ======================================
 */

export interface FailureDetails {
    'L5 Env': number;
    'L4 Runtime': number;
    'L3 Static': number;
    'L2 Code': number;
    'L1 Quality': number;
}

export interface FailureDefinition {
    ruleId: string;
    layer: string;
    category: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    message: string;
}

export interface FailureTaxonomy {
    [ruleId: string]: FailureDefinition;
}

export async function getFailureTaxonomy(runId: string): Promise<FailureTaxonomy> {
    const jsonPath = path.join(RUNS_DIR, runId, 'failure_taxonomy_report.json');
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

export async function getFailureCounts(runId: string): Promise<Record<string, number>> {
    const reportPath = path.join(RUNS_DIR, runId, 'eval_evaluation_report.json');
    const counts: Record<string, number> = {};

    try {
        const content = await fs.readFile(reportPath, 'utf-8');
        const data = JSON.parse(content);

        // Aggregate failures from all task results
        if (Array.isArray(data.results)) {
            for (const result of data.results) {
                const annotations = result.finalResult?.failureAnnotations ||
                    result.staticScore?.failureAnnotations || [];

                for (const note of annotations) {
                    if (note.ruleId) {
                        counts[note.ruleId] = (counts[note.ruleId] || 0) + 1;
                    }
                }
            }
        }
        return counts;
    } catch {
        return counts;
    }
}

export async function getFailureDetails(runId: string): Promise<FailureDetails> {
    const logPath = path.join(RUNS_DIR, runId, 'stdout.log');

    const details: FailureDetails = {
        'L5 Env': 0,
        'L4 Runtime': 0,
        'L3 Static': 0,
        'L2 Code': 0,
        'L1 Quality': 0,
    };

    try {
        const log = await fs.readFile(logPath, 'utf-8');

        const count = (re: RegExp) => (log.match(re) ?? []).length;

        // L5: Environment / Browser
        details['L5 Env'] = count(/BrowserError|NetworkError|ConnectionRefused|TaskTimedOut|Puppeteer/i);

        // L4: Runtime Execution
        details['L4 Runtime'] = count(/RuntimeError|EntryNotFound|SandboxError|ZeroScore/i);

        // L3: Static Contract
        details['L3 Static'] = count(/SyntaxError|JSON parse error|No files generated|Empty output|MODULE_NOT_FOUND/i);

        // L2: Code-Level
        details['L2 Code'] = count(/ReferenceError|TypeError|NotDefined|ESLint error/i);

        // L1: Soft Quality
        details['L1 Quality'] = count(/AssertionError|Verification failed|ESLint warning/i);

        return details;
    } catch {
        return details;
    }
}

export async function getRunLog(runId: string): Promise<string> {
    try {
        return await fs.readFile(
            path.join(RUNS_DIR, runId, 'stdout.log'),
            'utf-8'
        );
    } catch {
        return '[Error] stdout.log not found';
    }
}

/**
 * ======================================
 * Artifact diffs (task-level)
 * ======================================
 */

export interface ArtifactDiffResult {
    missing: string[];
    extra: string[];
    matching: string[];
}

export async function getArtifactDiffs(
    runId: string
): Promise<Record<string, ArtifactDiffResult>> {
    const log = await getRunLog(runId);
    const diffs: Record<string, ArtifactDiffResult> = {};

    const taskRegex =
        /\[TASK_BEGIN\]\s+(\w+)[\s\S]*?File Tree:\s*({[\s\S]*?})(?=\s*Static Score:)/g;

    let match: RegExpExecArray | null;

    while ((match = taskRegex.exec(log))) {
        const taskId = match[1];
        const treeBlock = match[2];

        const actual = new Set<string>();
        const pathRegex = /path:\s*'([^']+)'/g;
        let p: RegExpExecArray | null;

        while ((p = pathRegex.exec(treeBlock))) {
            actual.add(p[1]);
        }

        const task = getTask(taskId);
        const expected = new Set(task.question.expectedArtifacts);

        diffs[taskId] = {
            missing: [...expected].filter(x => !actual.has(x)),
            extra: [...actual].filter(x => !expected.has(x)),
            matching: [...expected].filter(x => actual.has(x)),
        };
    }

    return diffs;
}

/**
 * ======================================
 * Reports
 * ======================================
 */

export interface ReportStatus {
    name: string;
    description: string;
    filename: string;
    exists: boolean;
    path?: string;
    error?: string;
}

export async function getReportAvailability(
    runId: string
): Promise<ReportStatus[]> {
    const base = path.join(RUNS_DIR, runId);

    const check = async (
        name: string,
        description: string,
        filename: string
    ): Promise<ReportStatus> => {
        const fullPath = path.join(base, filename);
        try {
            await fs.access(fullPath);
            return { name, description, filename, exists: true };
        } catch (err: any) {
            return {
                name,
                description,
                filename,
                exists: false,
                path: fullPath,
                error: err?.message
            };
        }
    };

    return [
        await check(
            'ESG Evaluation',
            'Sustainability & Impact',
            'esg_evaluation_report.md'
        ),
        await check(
            'Evaluation Report',
            'Full metrics & Analysis',
            'eval_evaluation_report.md'
        ),
        await check(
            'Failure Taxonomy',
            'Error categorization & Roots',
            'failure_taxonomy_report.md'
        ),
    ];
}

export async function getReportContent(
    runId: string,
    filename: string
): Promise<string | null> {
    const safe = path.basename(filename);
    if (safe !== filename) return null;

    try {
        return await fs.readFile(
            path.join(RUNS_DIR, runId, safe),
            'utf-8'
        );
    } catch {
        return null;
    }
}

/**
         * ======================================
         * Dimensions Extraction (Descriptive Evidence)
         * ======================================
         */

/**
 * ======================================
 * Dimensions Extraction (Descriptive Evidence)
 * ======================================
 */

export interface RunDimensions {
    score: number | null;
    ECI: number | null;
    failures?: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
        l5: number;
    } | null;
    time?: {
        budgetMs?: number | null;
        elapsedMs?: number | null;
        finishedInTime?: boolean | null;
    }
}

/**
 * Extracts descriptive dimensions from run artifacts.
 * Note: These are EVIDENCE signals, not normative scores.
 * Absence of data (null) is a valid signal for "Not Measured".
 */
export async function getRunDimensions(runId: string): Promise<RunDimensions> {
    if (process.env.NODE_ENV === 'development') {
        console.debug(`[FORGE:UI] getRunDimensions called for ${runId}`);
    }

    const dims: RunDimensions = {
        score: null, ECI: null, failures: null,
        time: {
            budgetMs: null,
            elapsedMs: null,
            finishedInTime: null
        }
    };

    try {
        const runMeta = await getRun(runId);
        if (!runMeta) return dims;

        // 1. Time Metrics (from RunMeta / existing logic)
        dims.time = {
            budgetMs: null, // Budget is task-specific, aggregate might be tricky
            elapsedMs: runMeta.elapsedMs ?? null,
            finishedInTime: null
        };

        // 2. Try run.json keys (Primary Source)
        if (typeof runMeta.score === 'number') dims.score = runMeta.score;
        if (typeof runMeta.ECI === 'number') dims.ECI = runMeta.ECI;

        // 3. Failure Taxonomy
        if (runMeta.failures) {
            dims.failures = runMeta.failures;
        }

        return dims;
    } catch (e) {
        console.warn(`[FORGE:UI] Failed to extract dimensions for ${runId}`, e);
        return dims;
    }
}

/**
 * Usage Example (for UI):
 * 
 * ```typescript
 * const dims = await getRunDimensions(runId);
 * if (dims.score !== null) {
 *   renderTable(dims);
 * }
 * ```
 */