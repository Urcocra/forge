import * as fs from 'fs';
import * as path from 'path';
import { FIXED_ESG_DISCLOSURE, ESGMethodDisclosure } from '../src/esg/method-disclosure';

/**
 * ESG (Environmental, Social, and Governance) Report Schema
 * Final Engineering Fix - Version 1.1
 */
export interface ESGReportSchema {
    meta: {
        schemaVersion: string;
        generatedAt: string;
        forgeVersion: string;
    };
    methodDisclosure: ESGMethodDisclosure; // Step 2: Fixed Disclosure
    model: {
        id: string;
        parameterScale: number;
    };
    compute: {
        totalEvalTokens: number;
        eci: number | null;
        anchoring: { // Step 1: Double Anchoring
            method: "DOUBLE-ANCHORED";
            sources: ["eval_tokens", "parameter_scale"];
        };
        breakdown?: { // Step 3: Audit Breakdown
            taskId: string;
            size: string;
            evalTokens: number;
        }[];
    };
    impact: {
        summary: string;
        orthogonalityDeclaration: string;
    };
}

/**
 * Generates the ESG Report for a given run directory.
 * @param runDir Absolute path to the run directory
 */
export function generateESGReport(runDir: string) {
    const runJsonPath = path.join(runDir, 'run.json');
    const stdoutPath = path.join(runDir, 'stdout.log');

    if (!fs.existsSync(runJsonPath) || !fs.existsSync(stdoutPath)) {
        console.error('[ESG] Missing run.json or stdout.log, skipping report.');
        return;
    }

    const runMeta = JSON.parse(fs.readFileSync(runJsonPath, 'utf-8'));
    const stdout = fs.readFileSync(stdoutPath, 'utf-8');

    // Parse Benchmark Summary to get total tokens and breakdown
    let evalTokens = 0;
    let breakdown: any[] = [];

    // Attempt to find the full JSON summary block in stdout
    // Pattern: 🏆 Benchmark Summary ... { ... }
    const summaryBlockMatch = stdout.match(/(\{[\s\S]*?\})\s*$/);

    // Better: Match the JSON object specifically.
    // Or restart using the regex from previous step as fallback?
    // Let's rely on the fact that the summary is valid JSON at the end.

    // We already know priority 1 extraction from previous step
    const summaryJsonMatch = stdout.match(/"evalTokens":\s*(\d+)/);

    if (summaryBlockMatch) {
        try {
            // Find the last occurrence of '{' and verify if it parses
            // The regex above grabs the last block.
            const summaryJson = JSON.parse(summaryBlockMatch[1]);
            evalTokens = summaryJson.evalTokens;
            // Extract breakdown if available. run.ts prints 'breakdown', which is BenchmarkAccumulator['perTask']
            // It contains taskId, size, score, weight. 
            // Note: BenchmarkSummary in exec.ts doesn't explicitly put evalTokens in breakdown items?
            // Let's check BenchmarkAccumulator perTask structure in exec.ts.
            // It is: { taskId, size, score, weight }. It does NOT have per-task evalTokens accumulated globally!
            // Wait, `runTask` accumulates `taskEvalTokens` globally, but does it store it in `perTask` array?
            // Checking `addToBenchmark` in `exec.ts`: No, it pushes { taskId, size, score, weight }.
            // So `summary.breakdown` lacks tokens.
            // We must parse per-task tokens from logs iteratively.
        } catch (e) {
            console.warn('[ESG] Failed to parse summary block JSON', e);
        }
    }

    // Fallback/Refinement: Extract per-task tokens from log lines
    // Log format: [TASK_END] taskId ... Eval Tokens: 123
    // We want to map taskId -> tokens.
    const taskTokenMap = new Map<string, number>();
    const taskMatches = stdout.matchAll(/\[TASK_BEGIN\]\s+(\w+)[\s\S]*?Eval Tokens:\s*(\d+)/g);
    // This regex might be fragile if output is interleaved. 
    // Simpler: Just look for "Eval Tokens: (\d+)" and assume order? Or look for context.
    // Safe bet: The logs are sequential.

    // Let's refine parsing:
    // Iterate all "Running Task: X" ... "Eval Tokens: Y" sections.
    const sections = stdout.split('▶ Running Task:');
    const auditBreakdown: { taskId: string; size: string; evalTokens: number }[] = [];

    // Sum tokens separately to confirm
    let calculatedTotalTokens = 0;

    for (const section of sections) {
        const taskIdMatch = section.match(/^\s*(\w+)/);
        const tokenMatch = section.match(/Eval Tokens:\s*(\d+)/);
        if (taskIdMatch && tokenMatch) {
            const taskId = taskIdMatch[1];
            const tokens = parseInt(tokenMatch[1], 10);
            const size = taskId.split('_')[0].toUpperCase(); // xs_task -> XS

            auditBreakdown.push({ taskId, size, evalTokens: tokens });
            calculatedTotalTokens += tokens;
        }
    }

    if (evalTokens === 0 && calculatedTotalTokens > 0) {
        evalTokens = calculatedTotalTokens;
    }

    // Retrieve Parameter Scale from metadata
    const parameterScale = Number(runMeta.parameterScale || 0);

    // Compute ECI
    let eci: number | null = null;
    if (typeof parameterScale === 'number' && typeof evalTokens === 'number') {
        eci = (evalTokens * parameterScale) / 10000;
    }

    const report: ESGReportSchema = {
        meta: {
            schemaVersion: '1.2.0',
            generatedAt: new Date().toISOString(),
            forgeVersion: '1.0.0'
        },
        methodDisclosure: FIXED_ESG_DISCLOSURE,
        model: {
            id: runMeta.model,
            parameterScale: parameterScale ?? 0
        },
        compute: {
            totalEvalTokens: evalTokens,
            eci: eci,
            anchoring: {
                method: "DOUBLE-ANCHORED",
                sources: ["eval_tokens", "parameter_scale"]
            },
            breakdown: auditBreakdown
        },
        impact: {
            summary: `Model ${runMeta.model} consumed ${evalTokens} tokens during evaluation.`,
            orthogonalityDeclaration: "ESG metrics are computed independently of quality scores. High ECI does not imply high or low performance."
        }
    };

    const reportPath = path.join(runDir, 'esg_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[ESG] Report generated: ${reportPath}`);

    // Generate Markdown Report
    generateESGMarkdownReport(runDir, report);
}

export function generateESGMarkdownReport(runDir: string, data: ESGReportSchema) {
    const templatePath = path.join(process.cwd(), 'esg_report_template.md');
    if (!fs.existsSync(templatePath)) {
        console.warn('[ESG] Template esg_report_template.md not found, skipping MD generation.');
        return;
    }

    let content = fs.readFileSync(templatePath, 'utf-8');

    // Replacements
    // {{ModelID}}
    content = content.replace(/{{ModelID}}/g, data.model.id);
    // {{RunID}} -> derive from runDir name
    const runId = path.basename(runDir);
    content = content.replace(/{{RunID}}/g, runId);

    // {{EvalTokens}}
    content = content.replace(/{{EvalTokens}}/g, data.compute.totalEvalTokens.toString());

    // {{ParameterScaleLabel}} -> e.g. "1000000000" or pretty print "1B"
    // For now use raw number as label if string not available, or just the number
    const paramScale = Number(data.model.parameterScale || 0);
    let label = paramScale.toExponential();
    if (paramScale >= 1e9) label = (paramScale / 1e9).toFixed(1) + 'B';
    else if (paramScale >= 1e6) label = (paramScale / 1e6).toFixed(1) + 'M';

    content = content.replace(/{{ParameterScaleLabel}}/g, label);

    // {{ParameterMultiplier}} -> The raw scale used in calculation
    content = content.replace(/{{ParameterMultiplier}}/g, paramScale.toString());

    // {{EsgRaw}} -> EvalTokens * ParameterScale
    const raw = data.compute.totalEvalTokens * paramScale;
    content = content.replace(/{{EsgRaw}}/g, raw.toExponential(4));

    // {{EsgNormalized}} -> ECI
    const eci = data.compute.eci !== null ? data.compute.eci.toFixed(4) : "N/A";
    content = content.replace(/{{EsgNormalized}}/g, eci);

    const mdPath = path.join(runDir, 'esg_evaluation_report.md');
    fs.writeFileSync(mdPath, content);
    console.log(`[ESG] Markdown Report generated: ${mdPath}`);
}