import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, 'runs');
const OUTPUT_FILE = path.resolve(__dirname, 'model_events_report.md');

interface RunMeta {
    runId: string;
    model: string;
    timestamp: string;
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

// Reuse the loose parser from previous script
function parseLogDump(block: string): any {
    try {
        let jsonStr = block.replace(/(\w+):/g, '"$1":');
        jsonStr = jsonStr.replace(/'/g, '"');
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
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
            if (!modelGroups[r.meta.model]) {
                modelGroups[r.meta.model] = [];
            }
            modelGroups[r.meta.model].push(r);
        }
    }

    // Sort groups
    const sortedModels = Object.keys(modelGroups).sort();

    let md = `# Model-Based Experiment Report\nGenerated: ${new Date().toLocaleString()}\n\n`;

    for (const model of sortedModels) {
        md += `# Model: ${model}\n`;
        const runs = modelGroups[model];
        // Sort runs by date desc
        runs.sort((a, b) => new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime());

        md += `Total Runs: ${runs.length}\n\n`;

        for (const run of runs) {
            md += `## Run: ${run.meta.runId}\n`;
            md += `**Date**: ${new Date(run.meta.timestamp).toLocaleString()}\n\n`;

            if (run.tasks.length === 0) {
                md += `*No tasks recorded.*\n\n`;
                continue;
            }

            md += `| Task | Status | Actual | Predicted | Phase Failures |\n`;
            md += `|---|---|---|---|---|\n`;

            for (const t of run.tasks) {
                let status = "⚠️";
                let actual = "N/A";
                let predicted = "N/A";
                let failures = [];

                if (t.staticScore?.timeTracking) {
                    status = t.staticScore.timeTracking.completedInPredictedTime ? "✅" : "⚠️";
                    actual = t.staticScore.timeTracking.actualMs + "ms";
                    predicted = t.staticScore.timeTracking.predictedMs + "ms";
                }

                if (t.detailedTimeTracking && t.detailedTimeTracking.phases) {
                    for (const [phase, data] of Object.entries(t.detailedTimeTracking.phases) as [string, any][]) {
                        if (!data.completedInTime) failures.push(phase);
                    }
                }

                md += `| ${t.taskId} | ${status} | ${actual} | ${predicted} | ${failures.length ? '❌ ' + failures.join(', ') : '✅'} |\n`;
            }

            // Dump specific static failures if any
            let hasErrors = false;
            for (const t of run.tasks) {
                if (t.staticScore?.failureAnnotations?.length > 0) {
                    if (!hasErrors) {
                        md += `\n**Detailed Failures:**\n`;
                        hasErrors = true;
                    }
                    for (const f of t.staticScore.failureAnnotations) {
                        md += `- [${t.taskId}] **${f.ruleId}**: ${f.message}\n`;
                    }
                }
            }

            md += `\n---\n`;
        }
        md += `\n<br>\n\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
    console.log(`Model report generated at ${OUTPUT_FILE}`);
}

main();
