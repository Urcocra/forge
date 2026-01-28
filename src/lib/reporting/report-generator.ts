import * as fs from 'fs';
import * as path from 'path';
import {
    BenchmarkSummary
} from '../exec';
import {
    Difficulty,
    FinalEvaluationResult,
    ScoreBreakdown,
    FailureAnnotation
} from '../types';
import { FAILURE_REGISTRY, FailureDefinition } from '../rules/registry';

export interface ReportConfig {
    model: string;
    parameterScale?: number;
}

export interface TaskResult {
    taskId: string;
    size: Difficulty;
    finalResult: FinalEvaluationResult;
    staticScore: ScoreBreakdown;
    evalTokens: number;
}

export interface ReportContext {
    summary: BenchmarkSummary;
    config: ReportConfig;
    results: TaskResult[];
}

/* ============================================================================
 * 1. Unified Eval Report (eval_evaluation_report.md)
 * ============================================================================ */
function generateUnifiedEvalReport(ctx: ReportContext): string {
    const { summary, config, results } = ctx;
    const templatePath = path.resolve(process.cwd(), 'eval_report_template.md');

    let content = "";
    if (fs.existsSync(templatePath)) {
        content = fs.readFileSync(templatePath, 'utf-8');
    } else {
        // Fallback if template missing
        content = `# FORGE Evaluation Report\n**Model**: {{model.id}}\n**Run ID**: {{runId}}\n\n## 4. Task-Level Outcome Matrix\n| Task | Difficulty | Quality Score | Eval Tokens | ECI | Interpretation |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| {{taskId}} | {{size}} | {{score}} | {{tokens}} | {{eci}} | {{quadrantLabel}} |\n`;
    }

    // --- REPLACEMENTS ---

    const runId = path.basename(path.resolve(process.cwd(), process.env.FORGE_OUTPUT_DIR ?? ''));

    content = content.replace(/{{model.id}}/g, config.model);
    content = content.replace(/{{runId}}/g, runId || 'N/A');
    content = content.replace(/{{meta.generatedAt}}/g, new Date().toISOString());

    // 2. Static Averages
    const avg = (fn: (r: TaskResult) => number) => {
        if (results.length === 0) return "0.00";
        const sum = results.reduce((acc, r) => acc + fn(r), 0);
        return (sum / results.length).toFixed(2);
    };

    content = content.replace(/{{overallScore}}/g, summary.overallScore.toString());
    content = content.replace(/{{static.completeness}}/g, avg(r => r.staticScore.completeness));
    content = content.replace(/{{static.structure}}/g, avg(r => r.staticScore.structure));
    content = content.replace(/{{static.survivability}}/g, avg(r => r.staticScore.survivability));
    content = content.replace(/{{static.connectivity}}/g, avg(r => r.staticScore.connectivity));

    // 3. Compute Axis
    const paramScale = Number(config.parameterScale ?? 0);

    let paramLabel = paramScale.toExponential();
    if (paramScale >= 1e9) paramLabel = (paramScale / 1e9).toFixed(1) + 'B';

    content = content.replace(/{{esg.score}}/g, summary.eciTotal.toLocaleString());
    content = content.replace(/{{evalTokens}}/g, summary.evalTokensTotal.toLocaleString());
    content = content.replace(/{{esg.parameterScale}}/g, paramLabel);
    content = content.replace(/{{esgDisclosure.methodologyVersion}}/g, summary.esgDisclosure?.methodologyVersion ?? "1.0.0-frozen");


    // 4. Matrix Generation
    const matrixRows = results.map(t => {
        if (t.finalResult.infrastructureTimeout) {
            return `| ${t.taskId.padEnd(12)} | ${t.size.padEnd(4)} | N/A | N/A | N/A | ⏱️ Infrastructure Timeout |`;
        }

        const score = t.finalResult.totalScore;
        const tokens = t.evalTokens;
        const eci = (tokens * paramScale) / 10000;

        let label = "";
        const isSuccess = score >= 50;
        const isHighCost = eci > 100_000_000;

        if (isSuccess && !isHighCost) label = "✅ Efficient Success";
        else if (isSuccess && isHighCost) label = "⚠️ Brute Force";
        else if (!isSuccess && !isHighCost) label = "❌ Cheap Failure";
        else label = "💀 Expensive Failure";

        return `| ${t.taskId.padEnd(12)} | ${t.size.padEnd(4)} | ${score.toString().padEnd(3)} | ${tokens.toString().padEnd(6)} | ${(eci / 1e6).toFixed(1)}M | ${label} |`;
    });

    const tableHeader = "| Task | Difficulty | Quality Score | Eval Tokens | ECI (M) | Interpretation |\n| :--- | :--- | :--- | :--- | :--- | :--- |";
    const tableBody = matrixRows.join('\n');
    const fullTable = `${tableHeader}\n${tableBody}`;

    const matrixRegex = /\| Task \| Difficulty \| Quality Score \| Eval Tokens \| ECI \| Interpretation \|\s*\n\s*\| :--- \| :--- \| :--- \| :--- \| :--- \| :--- \|\s*\n\s*\| {{taskId}} \| {{size}} \| {{score}} \| {{tokens}} \| {{eci}} \| {{quadrantLabel}} \|/m;

    if (matrixRegex.test(content)) {
        content = content.replace(matrixRegex, fullTable);
    } else {
        content = content.replace(/{{taskId}}.*{{quadrantLabel}}/, tableBody);
    }

    // 5. Append Detailed Analysis
    content += `\n\n---\n\n`;

    // Orthogonality Assertion (Phase 7)
    content += `## ⚖️ Orthogonality Assertion\n`;
    content += `> **Quality ≠ Runtime ≠ ESG**\n`;
    content += `> This report certifies that **ECI (Energy Consumption Index)** is calculated strictly post-evaluation and has **0% impact** on the Quality Score.\n`;
    content += `> - **Quality**: ${summary.overallScore}/100\n`;
    content += `> - **Runtime**: ${results.reduce((acc, r) => acc + (r.finalResult.runtimeReport?.errorCount || 0), 0)} Fatal Errors\n`;
    content += `> - **ESG (ECI)**: ${summary.eciTotal.toLocaleString()} (Index)\n\n`;

    content += `# Detailed Failure Analysis\n\n`;

    // 5.1 Top Failure Rules
    content += `## Top Failure Rules\n`;
    const ruleCounts: Record<string, number> = {};
    for (const res of results) {
        for (const ann of res.finalResult.failureAnnotations) {
            if (ann.severity === 'error' || ann.severity === 'critical') {
                const key = `${ann.layer}::${ann.ruleId}`;
                ruleCounts[key] = (ruleCounts[key] || 0) + 1;
            }
        }
    }

    const sortedRules = Object.entries(ruleCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    if (sortedRules.length === 0) {
        content += `*No critical failures detected.*\n`;
    } else {
        content += `| Rule ID | Count | Layer |\n`;
        content += `| :--- | :--- | :--- |\n`;
        for (const [key, count] of sortedRules) {
            const [layer, ruleId] = key.split('::');
            content += `| ${ruleId} | ${count} | ${layer} |\n`;
        }
    }
    content += `\n`;

    // 5.2 Connectivity
    content += `## Connectivity Details\n`;
    content += `| Task | File Ref | Script | API Link | Route |\n`;
    content += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const res of results) {
        if (res.staticScore.connectivityBreakdown) {
            const b = res.staticScore.connectivityBreakdown;
            content += `| ${res.taskId} | ${b.fileReference} | ${b.scriptBinding} | ${b.apiSchemaLinkage} | ${b.routeConsistency} |\n`;
        } else {
            content += `| ${res.taskId} | N/A | N/A | N/A | N/A |\n`;
        }
    }
    content += `\n`;

    // 5.3 Runtime
    content += `## Runtime Health\n`;
    let totalErrors = 0;
    let totalWarnings = 0;
    for (const res of results) {
        if (res.finalResult.runtimeReport) {
            totalErrors += res.finalResult.runtimeReport.errorCount;
            totalWarnings += res.finalResult.runtimeReport.warningCount;
        }
    }
    content += `- **Total Runtime Errors** (Fatal): ${totalErrors}\n`;
    content += `- **Total Runtime Warnings**: ${totalWarnings}\n`;

    return content;
}

/* ============================================================================
 * 2. Failure Taxonomy (reports/failure-taxonomy.md)
 * ============================================================================ */
function generateFailureTaxonomyReport(): string {
    const lines: string[] = [];
    lines.push(`# Failure Taxonomy Definitions\n`);
    lines.push(`> This report is automatically generated from the rule registry.\n`);

    // Group by Layer
    const rulesByLayer: Record<string, FailureDefinition[]> = {};
    for (const def of Object.values(FAILURE_REGISTRY)) {
        if (!rulesByLayer[def.layer]) {
            rulesByLayer[def.layer] = [];
        }
        rulesByLayer[def.layer].push(def);
    }

    // Sort Layers (L5 -> L1)
    const layers = Object.keys(rulesByLayer).sort().reverse();

    for (const layer of layers) {
        lines.push(`## ${layer}`);
        const rules = rulesByLayer[layer];
        for (const r of rules) {
            lines.push(`- \`${r.ruleId}\` (${r.severity}): ${r.message}`);
        }
        lines.push(``);
    }

    return lines.join('\n');
}

/* ============================================================================
 * Writer
 * ============================================================================ */
/* ============================================================================
 * 3. ESG Report (esg_evaluation_report.md)
 * ============================================================================ */
function generateEsgReport(ctx: ReportContext): string {
    const lines: string[] = [];
    lines.push(`# FORGE ESG Report v1.0 (Definition Freeze)`);
    lines.push(`**Methodology**: Double-Anchored (EvalTokens × ParameterScale)`);
    lines.push(``);
    lines.push(`## 1. Metric: Eval Compute Index (ECI)`);
    lines.push(`> **Formula**: ECI = (T_eval × S_param) / 10,000`);
    lines.push(`> - **T_eval**: Token usage during evaluation`);
    lines.push(`> - **S_param**: Model Parameter Scale (e.g. 1e9)`);
    lines.push(``);
    lines.push(`## 2. Methodology Principles (Frozen)`);
    lines.push(`This methodology is frozen; any change to constants or formula must bump version.`);
    lines.push(`- **Orthogonality**: ECI is mathematically orthogonal to Quality Score.`);
    lines.push(`- **Non-comparability**: ECI is an absolute cost index, not comparable across different benchmarks.`);
    lines.push(`- **Auditability**: All inputs (Tokens, Scale) are logged in run data.`);
    lines.push(``);

    lines.push(`## 3. Difficulty Weight Table (Quality Axis Only)`);
    lines.push(`> *Note: This table applies ONLY to Quality Score aggregation. It is NOT used for ESG/ECI.*`);
    lines.push(`| Size | Weight |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| XS   | ${ctx.summary.weights['XS']} |`);
    lines.push(`| S    | ${ctx.summary.weights['S']} |`);
    lines.push(`| M    | ${ctx.summary.weights['M']} |`);
    lines.push(`| L    | ${ctx.summary.weights['L']} |`);
    lines.push(`| XL   | ${ctx.summary.weights['XL']} |`);
    lines.push(``);

    lines.push(`## 4. Run Data Breakdown`);
    lines.push(`| Task | Quality Size | Eval Tokens | Param Scale | ECI (Index) |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    for (const r of ctx.results) {
        const eci = (r.evalTokens * (ctx.config.parameterScale || 0)) / 10000;
        lines.push(`| ${r.taskId} | ${r.size} | ${r.evalTokens} | ${ctx.config.parameterScale?.toExponential()} | ${eci.toFixed(0)} |`);
    }
    lines.push(``);
    lines.push(`## 5. Totals`);
    lines.push(`- **Total Eval Tokens**: ${ctx.summary.evalTokensTotal}`);
    lines.push(`- **Total ECI Score**: ${ctx.summary.eciTotal.toLocaleString()}`);

    return lines.join('\n');
}

/* ============================================================================
 * Writer
 * ============================================================================ */
export function writeReports(ctx: ReportContext, outputDir: string = './reports') {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Unified Eval Report
    const evalReport = generateUnifiedEvalReport(ctx);
    fs.writeFileSync(path.join(outputDir, 'eval_evaluation_report.md'), evalReport, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'eval_evaluation_report.json'), JSON.stringify(ctx, null, 2), 'utf8');

    // 2. Failure Taxonomy
    const taxonomyReport = generateFailureTaxonomyReport();
    fs.writeFileSync(path.join(outputDir, 'failure_taxonomy_report.md'), taxonomyReport, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'failure_taxonomy_report.json'), JSON.stringify(FAILURE_REGISTRY, null, 2), 'utf8');

    // 3. ESG Report
    const esgReport = generateEsgReport(ctx);
    fs.writeFileSync(path.join(outputDir, 'esg_evaluation_report.md'), esgReport, 'utf8');

    // ESG JSON (Data View)
    const esgData = {
        meta: { version: "1.0-frozen", methodology: "Double-Anchored" },
        totals: { evalTokens: ctx.summary.evalTokensTotal, eciIndex: ctx.summary.eciTotal },
        breakdown: ctx.results.map(r => ({
            taskId: r.taskId,
            evalTokens: r.evalTokens,
            parameterScale: ctx.config.parameterScale || 0,
            eciIndex: (r.evalTokens * (ctx.config.parameterScale || 0)) / 10000
        }))
    };
    fs.writeFileSync(path.join(outputDir, 'esg_evaluation_report.json'), JSON.stringify(esgData, null, 2), 'utf8');

    // STDOUT Summary
    console.log(`\n==================================================`);
    console.log(`FORGE BENCHMARK SUMMARY`);
    console.log(`==================================================`);
    console.log(`Overall Score: ${ctx.summary.overallScore}/100`);
    console.log(`Total ECI:     ${ctx.summary.eciTotal.toLocaleString()}`);
    console.log(`Eval Tokens:   ${ctx.summary.evalTokensTotal.toLocaleString()}`);
    console.log(`Runs Output:   ${outputDir}`);

    // Rule Histogram in stdout
    const ruleCounts: Record<string, number> = {};
    for (const res of ctx.results) {
        for (const ann of res.finalResult.failureAnnotations) {
            const key = ann.ruleId;
            ruleCounts[key] = (ruleCounts[key] || 0) + 1;
        }
    }
    const topRules = Object.entries(ruleCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
    if (topRules.length > 0) {
        console.log(`\nTop Failures:`);
        topRules.forEach(([id, count]) => console.log(`- ${id}: ${count}`));
    }
    console.log(`==================================================\n`);
}
