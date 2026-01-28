
import * as fs from 'fs';
import * as path from 'path';

const MICRO_REPORTS_DIR = path.join(process.cwd(), 'attachment', 'micro-reports');
const OUTPUT_FILE = path.join(process.cwd(), 'model_averaged_report.md');

// Define the order and display names for models
const MODELS = [
    { id: 'anthropic/claude-sonnet-4.5', dir: 'claude-sonnet-4.5' },
    { id: 'minimax/minimax-m2', dir: 'minimax-m2' },
    { id: 'moonshotai/kimi-k2-thinking', dir: 'kimi-k2-thinking' },
    { id: 'openai/gpt-5.2', dir: 'gpt-5.2' },
    { id: 'qwen/qwen3-coder', dir: 'qwen3-coder' },
    { id: 'x-ai/grok-4', dir: 'grok' } // Fixed directory name
];

// Task order for the table
const TASKS = ['xs_task', 's_task', 'm_task', 'l_task', 'xl_task'];

async function main() {
    let markdownContent = `# Averaged Model Performance Report\n`;
    markdownContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    for (const model of MODELS) {
        const modelDir = path.join(MICRO_REPORTS_DIR, model.dir);

        // 1. Read Metadata
        let runCount = 0;
        let avgScore: number | string = 0;
        let avgECI: number | string = '-';

        const metadataPath = path.join(modelDir, 'metadata.json');
        console.log(`Checking metadata at: ${metadataPath}`);
        if (fs.existsSync(metadataPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                console.log(`Read metadata for ${model.id}: runCount=${meta.runCount}`);
                runCount = meta.runCount;
                avgScore = parseFloat(meta.averageScore).toFixed(1);
                // raw ECI might be 0 if missing, check logic
                if (meta.averageECI && meta.averageECI > 0) {
                    avgECI = meta.averageECI.toFixed(2);
                }
            } catch (e) { console.error(`Error reading metadata for ${model.id}`, e); }
        } else {
            console.error(`Metadata file not found: ${metadataPath}`);
        }

        // 2. Read Detailed Stats for Task Breakdown
        const evalReportPath = path.join(modelDir, 'eval_evaluation_report.json');
        let tasksData: any[] = [];
        if (fs.existsSync(evalReportPath)) {
            try {
                const report = JSON.parse(fs.readFileSync(evalReportPath, 'utf8'));
                tasksData = report.results || report.breakdown || [];
            } catch (e) { console.error(`Error reading eval report for ${model.id}`, e); }
        }

        // 3. Section Header
        markdownContent += `# Model: ${model.id}\n`;
        markdownContent += `Based on ${runCount} runs.\n\n`;

        // 4. Metrics Table
        markdownContent += `### Metrics (Average)\n`;
        markdownContent += `| Avg Score | Avg ECI |\n`;
        markdownContent += `|---|---|\n`;
        markdownContent += `| ${avgScore} | ${avgECI} |\n\n`;

        // 5. Task Breakdown Table
        markdownContent += `### Task Breakdown\n`;
        markdownContent += `| Task | Avg Time (s) | Tree (s) | Files (s) | Parse (s) | Static (s) | Runtime (s) |\n`;
        markdownContent += `|---|---|---|---|---|---|---|\n`;

        for (const taskName of TASKS) {
            // Find data for this task
            // The aggregated structure might be flat or nested, let's assume flat array as per aggregate_reports logic
            const taskData = tasksData.find((t: any) => t.taskId === taskName);

            if (taskData) {
                // Helpers to safely get numbers
                const getNum = (n: any) => (typeof n === 'number' ? n.toFixed(2) : '0.00');

                // Depending on aggregation structure, these fields might vary.
                // aggregate_reports.ts attempts to average numbers. 
                // We need to look at what 'aggregateObjects' produces.
                // It produces an object where keys are averaged if they are numbers.
                // So we expect taskData.finalResult.durationMs etc.

                // Mappings based on presumed structure (checking eval_evaluation_report structure)
                // Usually: timings: { tree: ..., files: ..., parse: ... }
                // Let's abstract this lookup

                const timings = taskData.timings || {};
                // Try to get duration from finalResult.scoreBreakdown.static.timeTracking.actualMs if timings missing
                let durationRaw = taskData.durationMs;
                if (!durationRaw && taskData.finalResult?.scoreBreakdown?.static?.timeTracking?.actualMs) {
                    durationRaw = taskData.finalResult.scoreBreakdown.static.timeTracking.actualMs;
                }

                const duration = getNum((durationRaw || 0) / 1000);

                // Map specific columns
                const tree = getNum((timings.treeNode || timings.tree || 0) / 1000); // ms -> s
                const files = getNum((timings.files || 0) / 1000);
                const parse = getNum((timings.parse || 0) / 1000);
                const staticAnalysis = getNum((timings.static || 0) / 1000);
                const runtime = getNum((timings.runtime || 0) / 1000);

                // If total duration is missing, maybe sum them? Or use header
                const avgTime = duration;

                markdownContent += `| ${taskName} | ${avgTime} | ${tree} | ${files} | ${parse} | ${staticAnalysis} | ${runtime} |\n`;
            } else {
                markdownContent += `| ${taskName} | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |\n`;
            }
        }

        markdownContent += `\n<br>\n\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, markdownContent);
    console.log(`Successfully generated ${OUTPUT_FILE}`);
}

main();
