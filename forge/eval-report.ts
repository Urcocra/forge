import * as fs from 'fs';
import * as path from 'path';
import { ESGReportSchema } from './esg';

/**
 * Generates the Evaluation Report (Performance + Compute)
 * @param runDir Absolute path to the run directory
 */
export function generateEvalMarkdownReport(runDir: string) {
    const runJsonPath = path.join(runDir, 'run.json');
    const esgJsonPath = path.join(runDir, 'esg_report.json');
    const stdoutPath = path.join(runDir, 'stdout.log');
    const templatePath = path.join(process.cwd(), 'eval_report_template.md');

    if (!fs.existsSync(runJsonPath) || !fs.existsSync(stdoutPath) || !fs.existsSync(templatePath)) {
        console.error('[EvalReport] Missing run.json, stdout.log, or template. Skipping.');
        return;
    }

    // Load Data
    const runMeta = JSON.parse(fs.readFileSync(runJsonPath, 'utf-8'));
    const stdout = fs.readFileSync(stdoutPath, 'utf-8');

    let esgData: ESGReportSchema | null = null;
    if (fs.existsSync(esgJsonPath)) {
        esgData = JSON.parse(fs.readFileSync(esgJsonPath, 'utf-8'));
    }

    // Parse Static Subscores average
    const staticScores = {
        completeness: [] as number[],
        structure: [] as number[],
        survivability: [] as number[],
        connectivity: [] as number[]
    };

    // Parse Per-Task Metrics for Matrix
    interface TaskMetric {
        taskId: string;
        size: string;
        score: number;
        tokens: number;
        eci: number;
    }
    const tasks: TaskMetric[] = [];

    // Regex parsing strategy:
    // We split by [TASK_BEGIN] to get task chunks
    const taskChunks = stdout.split('[TASK_BEGIN]');
    // Skip first chunk (preamble)
    for (let i = 1; i < taskChunks.length; i++) {
        const chunk = taskChunks[i];
        // Extract Task ID (first word)
        const taskIdMatch = chunk.match(/^\s*(\w+)/);
        if (!taskIdMatch) continue;
        const taskId = taskIdMatch[1];

        // Size from taskId (xs_task ...)
        const size = taskId.split('_')[0].toUpperCase();

        // Static Score Block
        const staticBlockMatch = chunk.match(/Static Score:\s*({[\s\S]*?})\s*Runtime Score:/);
        if (staticBlockMatch) {
            try {
                // The log printed object might be slightly loose JSON (unquoted keys in JS object output usually)
                // stdout logs from console.log({ key: val }) usually don't have quoted keys.
                // We need more robust parsing or just regex extracting.
                // Regex extraction is safer for logs.
                const extractAndPush = (key: string, arr: number[]) => {
                    const m = chunk.match(new RegExp(`${key}:\\s*([0-9.]+)`));
                    if (m) arr.push(parseFloat(m[1]));
                };
                extractAndPush('completeness', staticScores.completeness);
                extractAndPush('structure', staticScores.structure);
                extractAndPush('survivability', staticScores.survivability);
                extractAndPush('connectivity', staticScores.connectivity);
            } catch (e) {
                // Ignore
            }
        }

        // Metrics
        const totalScoreMatch = chunk.match(/Total Score:\s*(\d+)/);
        const evalTokensMatch = chunk.match(/Eval Tokens:\s*(\d+)/);
        const eciScoreMatch = chunk.match(/ECI Score:\s*(\d+)/); // ECI Score: 36900000

        if (totalScoreMatch) {
            tasks.push({
                taskId,
                size,
                score: parseInt(totalScoreMatch[1], 10),
                tokens: evalTokensMatch ? parseInt(evalTokensMatch[1], 10) : 0,
                eci: eciScoreMatch ? parseInt(eciScoreMatch[1], 10) : 0
            });
        }
    }

    // Averages
    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "0.00";

    // Read Template
    let content = fs.readFileSync(templatePath, 'utf-8');

    // --- REPLACEMENTS ---

    // 1. Meta & Header
    content = content.replace(/{{model.id}}/g, runMeta.model);
    content = content.replace(/{{runId}}/g, path.basename(runDir));
    content = content.replace(/{{meta.generatedAt}}/g, new Date().toISOString());

    // 2. Quality Axis
    // Overall Score - try to get from esg_report (summary isn't there), or parse from end of log
    // We can rely on summing weighted scores if needed, but parsing "🏆 Benchmark Summary" is better.
    // Or just re-calc from tasks.
    // Let's parse from log summary if possible.
    const overallScoreMatch = stdout.match(/"overallScore":\s*(\d+)/);
    const overallScore = overallScoreMatch ? overallScoreMatch[1] : "N/A";
    content = content.replace(/{{overallScore}}/g, overallScore);

    content = content.replace(/{{static.completeness}}/g, avg(staticScores.completeness));
    content = content.replace(/{{static.structure}}/g, avg(staticScores.structure));
    content = content.replace(/{{static.survivability}}/g, avg(staticScores.survivability));
    content = content.replace(/{{static.connectivity}}/g, avg(staticScores.connectivity));

    // 3. Compute Axis
    const totalTokens = esgData?.compute.totalEvalTokens ?? 0;
    const paramScale = esgData?.model.parameterScale ?? runMeta.parameterScale ?? 0;
    // Format param scale
    let paramLabel = paramScale.toExponential();
    if (paramScale >= 1e9) paramLabel = (paramScale / 1e9).toFixed(1) + 'B';

    // ECI Score (Normalized)
    // esgData.compute.eci is the number
    const eciVal = esgData?.compute.eci ?? 0;

    content = content.replace(/{{esg.score}}/g, eciVal.toLocaleString()); // Add commas
    content = content.replace(/{{evalTokens}}/g, totalTokens.toLocaleString());
    content = content.replace(/{{esg.parameterScale}}/g, paramLabel);

    // 4. Matrix Generation
    // Template row: {{taskId}}	{{size}}	{{score}}	{{tokens}}	{{eci}}	{{quadrantLabel}}
    // We need to construct the table rows.

    const matrixRows = tasks.map(t => {
        // Quadrant Logic
        let label = "";
        const isSuccess = t.score >= 50;
        const isHighCost = t.eci > 100_000_000; // > 100M threshold

        if (isSuccess && !isHighCost) label = "✅ Efficient Success";
        else if (isSuccess && isHighCost) label = "⚠️ Brute Force";
        else if (!isSuccess && !isHighCost) label = "❌ Cheap Failure";
        else label = "💀 Expensive Failure";

        // Fixed width padding for cleaner markdown table source (optional, but nice)
        return `| ${t.taskId.padEnd(12)} | ${t.size.padEnd(4)} | ${t.score.toString().padEnd(3)} | ${t.tokens.toString().padEnd(6)} | ${(t.eci / 1e6).toFixed(1)}M | ${label} |`;
    });

    // Replace the template table row (hacky regex to find the line with placeholders)
    // The template has: {{taskId}}	{{size}}	{{score}}	{{tokens}}	{{eci}}	{{quadrantLabel}}
    // We will replace that whole line AND potentially surrounding pipe syntax if it exists in template
    // The template provided by USER has:
    // Task	Difficulty	Quality Score	Eval Tokens	ECI	Interpretation
    // {{taskId}}	{{size}}	{{score}}	{{tokens}}	{{eci}}	{{quadrantLabel}}

    // Note: User template has tabs/spaces, not Markdown table pipes in the example text provided in Step 387 diff?
    // Wait, the diff shows:
    // Task	Difficulty	Quality Score	Eval Tokens	ECI	Interpretation
    // {{taskId}}	{{size}}	{{score}}	{{tokens}}	{{eci}}	{{quadrantLabel}}
    // It looks like standard text, not a markdown table with pipes `|`. 
    // BUT the previous template `eval_report.md` HAD pipes.
    // The new one in step 387 seems to have removed pipes?
    // "Task	Difficulty	Quality Score	Eval Tokens	ECI	Interpretation"
    // I should check strict content of `eval_report_template.md`.
    // Step 392 "view_file" shows: 
    // 74: Task	Difficulty	Quality Score	Eval Tokens	ECI	Interpretation
    // 75: {{taskId}}	{{size}}	{{score}}	{{tokens}}	{{eci}}	{{quadrantLabel}}
    // No pipes. Just tab separated?
    // I will try to detect the line and replace it, respecting the format.
    // I will generate a markdown table regardless because it is cleaner.

    const tableHeader = "| Task | Difficulty | Quality Score | Eval Tokens | ECI (M) | Interpretation |\n| :--- | :--- | :--- | :--- | :--- | :--- |";
    const tableBody = matrixRows.join('\n');
    const fullTable = `${tableHeader}\n${tableBody}`;

    // Regex to replace the header line AND the placeholder line
    // The template now has:
    // | Task | Difficulty | Quality Score | Eval Tokens | ECI | Interpretation |
    // | :--- | :--- | :--- | :--- | :--- | :--- |
    // | {{taskId}} | {{size}} | {{score}} | {{tokens}} | {{eci}} | {{quadrantLabel}} |

    // We want to replace the DATA row (line 3) with our generated rows.
    // Or we can replace the whole block if we generate the header.
    // Since our generated `fullTable` includes the header, we should replace the whole block in the template.

    // Regex to match the 3-line table block in the template
    // Note: special chars in regex need escaping if literal.
    // We look for the header row start, skip to the data row start.
    const matrixRegex = /\| Task \| Difficulty \| Quality Score \| Eval Tokens \| ECI \| Interpretation \|\s*\n\s*\| :--- \| :--- \| :--- \| :--- \| :--- \| :--- \|\s*\n\s*\| {{taskId}} \| {{size}} \| {{score}} \| {{tokens}} \| {{eci}} \| {{quadrantLabel}} \|/m;

    if (matrixRegex.test(content)) {
        content = content.replace(matrixRegex, fullTable);
    } else {
        // Fallback: just find the placeholder line (now with pipes)
        // | {{taskId}} | {{size}} | {{score}} | {{tokens}} | {{eci}} | {{quadrantLabel}} |
        const placeholderRowRegex = /\|\s*{{taskId}}\s*\|\s*{{size}}\s*\|\s*{{score}}\s*\|\s*{{tokens}}\s*\|\s*{{eci}}\s*\|\s*{{quadrantLabel}}\s*\|/;

        if (placeholderRowRegex.test(content)) {
            // If we replace ONLY the row, we need to make sure we don't inject a second header from `fullTable`.
            // So we should strip the header from `fullTable` if we are falling back to row replacement?
            // Or better: ensure we always match the header if possible.
            // If regex fails (whitespace issues?), we might double headers.

            // Let's try to just replace the placeholder row with the BODY of the table (no header).
            content = content.replace(placeholderRowRegex, tableBody);
        } else {
            // Last resort fallback (maybe user changed template again?)
            content = content.replace(/{{taskId}}.*{{quadrantLabel}}/, tableBody);
        }
    }

    // 5. Method Disclosure
    content = content.replace(/{{esgDisclosure.methodologyVersion}}/g, esgData?.methodDisclosure.methodologyVersion ?? "1.0.0-frozen");

    // Fixes for missing keys or formatting
    // ...

    // Write Output
    const reportPath = path.join(runDir, 'eval_evaluation_report.md');
    fs.writeFileSync(reportPath, content);
    console.log(`[EvalReport] Generated: ${reportPath}`);
}
