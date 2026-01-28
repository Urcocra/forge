import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, 'runs');
const OUTPUT_FILE = path.resolve(__dirname, 'model_averaged_report.md');

interface RunMeta {
    runId: string;
    model: string;
    timestamp: string;
    score?: number;
    ECI?: number;
    failures?: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
        l5: number;
    };
    [key: string]: any;
}

interface TaskEvent {
    taskId: string;
    staticScore: any;
    detailedTimeTracking: any;
    logs: any[];
}

interface RunDetail {
    meta: RunMeta;
    tasks: TaskEvent[];
}

// Reuse the loose parser
function parseLogDump(block: string): any {
    try {
        let jsonStr = block.replace(/(\w+):/g, '"$1":');
        jsonStr = jsonStr.replace(/'/g, '"');
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

function parseDuration(val: string | number): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        if (val.endsWith('s')) return parseFloat(val) * 1000;
        if (val.endsWith('ms')) return parseFloat(val);
    }
    return 0;
}

function processRun(runDir: string): RunDetail | null {
    const runPath = path.join(RUNS_DIR, runDir);
    const runJsonPath = path.join(runPath, 'run.json');
    const stdoutPath = path.join(runPath, 'stdout.log');

    if (!fs.existsSync(runJsonPath) || !fs.existsSync(stdoutPath)) return null;

    const meta: RunMeta = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
    const logContent = fs.readFileSync(stdoutPath, 'utf8');

    const tasks: TaskEvent[] = [];
    const taskBlocks = logContent.split(/\[TASK_BEGIN\]\s+(\w+)/);

    for (let i = 1; i < taskBlocks.length; i += 2) {
        const taskId = taskBlocks[i];
        const content = taskBlocks[i + 1];
        let staticScore = null;
        let detailedTimeTracking = null;

        const staticScoreMatch = content.match(/Static Score:\s*({[\s\S]*?})\nRuntime Score:/);
        if (staticScoreMatch) staticScore = parseLogDump(staticScoreMatch[1]);

        const timeTrackingMatch = content.match(/Time Tracking:\s*({[\s\S]*?})\nLogs:/);
        if (timeTrackingMatch) detailedTimeTracking = parseLogDump(timeTrackingMatch[1]);

        tasks.push({ taskId, staticScore, detailedTimeTracking, logs: [] });
    }

    return { meta, tasks };
}

async function main() {
    if (!fs.existsSync(RUNS_DIR)) return;

    const runDirs = fs.readdirSync(RUNS_DIR).filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());

    // Group by model
    const modelGroups: Record<string, RunDetail[]> = {};

    for (const d of runDirs) {
        const r = processRun(d);
        if (r) {
            if (!modelGroups[r.meta.model]) modelGroups[r.meta.model] = [];
            modelGroups[r.meta.model].push(r);
        }
    }

    const sortedModels = Object.keys(modelGroups).sort();

    let md = `# Averaged Model Performance Report\nGenerated: ${new Date().toLocaleString()}\n\n`;

    for (const model of sortedModels) {
        const runs = modelGroups[model];
        md += `# Model: ${model}\n`;
        md += `Based on ${runs.length} runs.\n\n`;

        // Calculate Averages
        let sumScore = 0, sumECI = 0, countECI = 0;
        const totalFailures = { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 };
        let runCount = 0;

        for (const run of runs) {
            runCount++;
            sumScore += run.meta.score || 0;

            if (typeof run.meta.ECI === 'number') {
                sumECI += run.meta.ECI;
                countECI++;
            }

            if (run.meta.failures) {
                totalFailures.l1 += run.meta.failures.l1 || 0;
                totalFailures.l2 += run.meta.failures.l2 || 0;
                totalFailures.l3 += run.meta.failures.l3 || 0;
                totalFailures.l4 += run.meta.failures.l4 || 0;
                totalFailures.l5 += run.meta.failures.l5 || 0;
            }
        }

        md += `### Metrics (Average)\n`;
        md += `| Avg Score | Avg ECI |\n`;
        md += `|---|---|\n`;

        const avgScore = (sumScore / runCount).toFixed(1);
        const avgECI = countECI > 0 ? (sumECI / countECI).toFixed(2) : '-';

        md += `| ${avgScore} | ${avgECI} |\n\n`;

        // key: taskId, value: { count, totalTime, phases: { phaseName: totalTime } }
        const taskStats: Record<string, { count: number, totalTime: number, phases: Record<string, number>, scores: number[] }> = {};

        for (const run of runs) {
            for (const t of run.tasks) {
                if (!taskStats[t.taskId]) {
                    taskStats[t.taskId] = { count: 0, totalTime: 0, phases: {}, scores: [] };
                }

                const stats = taskStats[t.taskId];
                stats.count++;

                if (t.staticScore?.timeTracking?.actualMs) {
                    stats.totalTime += t.staticScore.timeTracking.actualMs;
                }

                if (typeof t.staticScore?.totalScore === 'number') {
                    stats.scores.push(t.staticScore.totalScore);
                }

                if (t.detailedTimeTracking && t.detailedTimeTracking.phases) {
                    for (const [phase, data] of Object.entries(t.detailedTimeTracking.phases) as [string, any][]) {
                        if (!stats.phases[phase]) stats.phases[phase] = 0;
                        stats.phases[phase] += parseDuration(data.actual);
                    }
                }
            }
        }

        md += `### Task Breakdown\n`;
        md += `| Task | Avg Time (s) | Tree (s) | Files (s) | Parse (s) | Static (s) | Runtime (s) |\n`;
        md += `|---|---|---|---|---|---|---|\n`;

        const taskOrder = ['xs_task', 's_task', 'm_task', 'l_task', 'xl_task'];

        for (const taskId of taskOrder) {
            const stats = taskStats[taskId];
            if (!stats) {
                md += `| ${taskId} | N/A | N/A | N/A | N/A | N/A | N/A |\n`;
                continue;
            }

            const avgTime = (stats.totalTime / stats.count / 1000).toFixed(2);

            const getPhaseAvg = (p: string) => {
                if (!stats.phases[p]) return '0.00';
                return (stats.phases[p] / stats.count / 1000).toFixed(2);
            };

            md += `| ${taskId} | ${avgTime} | ${getPhaseAvg('treePhase')} | ${getPhaseAvg('filesPhase')} | ${getPhaseAvg('parsing')} | ${getPhaseAvg('staticEval')} | ${getPhaseAvg('runtimeEval')} |\n`;
        }

        md += `\n<br>\n\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
    console.log(`Averaged report generated at ${OUTPUT_FILE}`);
}

main();
