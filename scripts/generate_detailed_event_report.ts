import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, 'runs');
const OUTPUT_FILE = path.resolve(__dirname, 'runs_events_report.md');

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

function extractJSON(text: string, startIndex: number): any | null {
    let braceCount = 0;
    let jsonString = '';
    let started = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (char === '{') {
            braceCount++;
            started = true;
        } else if (char === '}') {
            braceCount--;
        }

        jsonString += char;

        if (started && braceCount === 0) {
            try {
                // crude attempt to fix loose keys if necessary, strictly standard JSON expected usually
                // But looking at logs, keys are unquoted often? e.g. MODEL: ...
                // The logs show standard JS object printout, not strict JSON.
                // e.g. { files: [ { path: 'index.html', type: 'html' } ] }
                // We might need to use `eval` or a loose parser if it's not strict JSON.
                // Wait, look at the log sample:
                // Static Score: {
                //   completeness: 1,
                // ...
                // }
                // This is NOT valid JSON (keys unquoted). It looks like util.inspect or console.log output.
                // Parsing this strictly is hard.
            } catch (e) {
                return null; // parse failed
            }
            return jsonString;
        }
    }
    return null;
}

// Simple parser for the "JS object style" dump in logs
// This is fragile but fits the specific format seen in logs
function parseLogDump(block: string): any {
    try {
        // Attempt to convert JS object printout to JSON
        // 1. Quote keys
        let jsonStr = block.replace(/(\w+):/g, '"$1":');
        // 2. Quote strings that might be unquoted (though logs seem to have quoted strings)
        // 3. Fix single quotes to double quotes
        jsonStr = jsonStr.replace(/'/g, '"');
        return JSON.parse(jsonStr);
    } catch (e) {
        // console.warn('Failed to loose-parse block', e);
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

    // Split by task boundaries
    const taskBlocks = logContent.split(/\[TASK_BEGIN\]\s+(\w+)/);
    // split results in [preamble, taskId1, content1, taskId2, content2...]

    for (let i = 1; i < taskBlocks.length; i += 2) {
        const taskId = taskBlocks[i];
        const content = taskBlocks[i + 1];

        let staticScore = null;
        let detailedTimeTracking = null;

        // Extract Static Score block
        const staticScoreMatch = content.match(/Static Score:\s*({[\s\S]*?})\nRuntime Score:/);
        if (staticScoreMatch) {
            staticScore = parseLogDump(staticScoreMatch[1]);
        }

        // Extract Time Tracking block (the second one, usually at end of task)
        const timeTrackingMatch = content.match(/Time Tracking:\s*({[\s\S]*?})\nLogs:/);
        if (timeTrackingMatch) {
            detailedTimeTracking = parseLogDump(timeTrackingMatch[1]);
        }

        tasks.push({
            taskId,
            staticScore,
            detailedTimeTracking,
            logs: [] // skipping detailed browser logs for now to keep report manageable
        });
    }

    return { meta, tasks };
}

async function main() {
    if (!fs.existsSync(RUNS_DIR)) return;

    const runDirs = fs.readdirSync(RUNS_DIR).filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());
    const runs: RunDetail[] = [];

    for (const d of runDirs) {
        const r = processRun(d);
        if (r) runs.push(r);
    }

    // Sort by date desc
    runs.sort((a, b) => new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime());

    let md = `# Detailed Experiment Event Report\nGenerated: ${new Date().toLocaleString()}\n\n`;
    md += `Total Runs: ${runs.length}\n\n`;

    for (const run of runs) {
        md += `## Run: ${run.meta.runId}\n`;
        md += `**Model**: \`${run.meta.model}\` | **Date**: ${new Date(run.meta.timestamp).toLocaleString()}\n\n`;

        if (run.tasks.length === 0) {
            md += `*No tasks recorded in logs.*\n\n`;
            continue;
        }

        for (const t of run.tasks) {
            md += `### Task: ${t.taskId}\n`;

            // Scores & Failures
            if (t.staticScore) {
                const score = t.staticScore.timeTracking?.completedInPredictedTime ? "✅" : "⚠️";
                const actual = t.staticScore.timeTracking?.actualMs;
                const predicted = t.staticScore.timeTracking?.predictedMs;

                md += `**Status**: ${score} (${actual}ms / ${predicted}ms)\n`;

                if (t.staticScore.failureAnnotations && t.staticScore.failureAnnotations.length > 0) {
                    md += `\n**Failures**:\n`;
                    for (const f of t.staticScore.failureAnnotations) {
                        md += `- 🔴 **${f.ruleId}** (${f.layer}): ${f.message}\n`;
                    }
                } else {
                    md += `- No static failures detected.\n`;
                }
            }

            // Phase breakdown
            if (t.detailedTimeTracking && t.detailedTimeTracking.phases) {
                md += `\n**Phase Timing**:\n`;
                md += `| Phase | Predicted | Actual | Status |\n`;
                md += `|---|---|---|---|\n`;
                for (const [phase, data] of Object.entries(t.detailedTimeTracking.phases) as [string, any][]) {
                    const status = data.completedInTime ? "✅" : "❌";
                    md += `| ${phase} | ${data.predicted} | ${data.actual} | ${status} |\n`;
                }
            }

            md += `\n---\n`;
        }
        md += `\n<br>\n\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
    console.log(`Report generated at ${OUTPUT_FILE}`);
}

main();
