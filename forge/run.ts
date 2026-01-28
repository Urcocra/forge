import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { generateESGReport } from './esg';

/**
 * ======================================
 * Paths & Utils
 * ======================================
 */

const ROOT = process.cwd();
const RUNS_DIR = path.join(ROOT, 'runs');

function ensureDir(p: string) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function hash(s: string) {
    return crypto.createHash('sha256').update(s).digest('hex');
}

function nowId() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * ======================================
 * Types
 * ======================================
 */

interface ForgeConfig {
    model: string;
    baseUrl: string;
    apiKey: string;
    parameterScale?: number;
}

/**
 * ======================================
 * forge run (config-driven)
 * ======================================
 */
export async function run(configPath: string, options?: { runIdSuffix?: string }) {
    // --------------------------------------------------
    // 1. Load & validate config.json
    // --------------------------------------------------

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const config: ForgeConfig = JSON.parse(
        fs.readFileSync(configPath, 'utf-8')
    );
    if (config.parameterScale) {
        config.parameterScale = Number(config.parameterScale);
    }

    if (!config.model) {
        throw new Error('Invalid config.json: missing "model"');
    }

    if (!config.baseUrl) {
        throw new Error('Invalid config.json: missing "baseUrl"');
    }

    if (!config.apiKey) {
        throw new Error('Invalid config.json: missing "apiKey"');
    }

    if (config.parameterScale === undefined) {
        throw new Error('Invalid config.json: missing "parameterScale"');
    }

    // --------------------------------------------------
    // 2. Prepare run directory
    // --------------------------------------------------

    ensureDir(RUNS_DIR);

    let runId = `${config.model.replace(/[\/:]/g, '_')}_${nowId()}`;
    if (options?.runIdSuffix) {
        runId += `_${options.runIdSuffix}`;
    }
    const outDir = path.join(RUNS_DIR, runId);
    ensureDir(outDir);

    const stdoutPath = path.join(outDir, 'stdout.log');
    const stderrPath = path.join(outDir, 'stderr.log');

    const stdout = fs.createWriteStream(stdoutPath);
    const stderr = fs.createWriteStream(stderrPath);

    console.log(`[FORGE] run=${runId}`);
    console.log(`[FORGE] config=${configPath}`);

    // --------------------------------------------------
    // 3. Spawn CORE with injected config
    // --------------------------------------------------

    const child = spawn(
        process.execPath,
        ['-r', 'ts-node/register', 'src/index.ts'], // run TypeScript source directly
        {
            env: {
                ...process.env,
                FORGE_CONFIG: JSON.stringify(config),
                FORGE_OUTPUT_DIR: outDir // Pass run directory to core
            },
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );

    let buf = '';

    child.stdout.on('data', d => {
        const s = d.toString();
        buf += s;
        stdout.write(s);
    });

    child.stderr.on('data', d => {
        stderr.write(d);
    });

    await new Promise<void>((resolve, reject) => {
        child.on('close', code => {
            stdout.end();
            stderr.end();
            code === 0
                ? resolve()
                : reject(new Error(`CORE crashed (code=${code})`));
        });
    });

    // --------------------------------------------------
    // 4. Derive failure layer (descriptive)
    // --------------------------------------------------

    const failureLayer =
        buf.includes('Failed to parse response')
            ? 'L4/Parse'
            : buf.includes('MODULE_NOT_FOUND')
                ? 'L3/Runtime'
                : 'None';

    // --------------------------------------------------
    // 5. Persist run.json (experiment record)
    // --------------------------------------------------

    const runJson = {
        runId,
        model: config.model,
        configPath,
        configHash: hash(JSON.stringify(config)),
        timestamp: new Date().toISOString(),
        failureLayer,
        stdoutHash: hash(buf),
        reproduce: `forge reproduce runs/${runId}`,
        parameterScale: config.parameterScale
    };

    fs.writeFileSync(
        path.join(outDir, 'run.json'),
        JSON.stringify(runJson, null, 2)
    );

    // --------------------------------------------------
    // 6. Generate ESG Report
    // --------------------------------------------------
    generateESGReport(outDir);

    // Generate Eval Report
    // NOTE: Internal reporter (src/index.ts) now handles eval_evaluation_report.md generation
    // merging rich data with the template.
    // We do NOT call the external one here anymore.

    console.log(`[FORGE] completed → runs/${runId}`);
}