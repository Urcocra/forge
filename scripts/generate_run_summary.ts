import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.resolve(__dirname, 'runs');
const OUTPUT_FILE = path.resolve(__dirname, 'runs_summary.md');

interface RunConfig {
    runId: string;
    model: string;
    timestamp: string;
    failureLayer: string;
}

interface ValidationResult {
    totalScore: number;
}

interface EvalReport {
    summary: {
        overallScore: number;
        evalTokensTotal: number;
    };
    results: {
        taskId: string;
        size: string;
        finalResult: ValidationResult;
        evalTokens: number;
    }[];
}

async function main() {
    if (!fs.existsSync(RUNS_DIR)) {
        console.error(`Runs directory not found: ${RUNS_DIR}`);
        return;
    }

    const runDirs = fs.readdirSync(RUNS_DIR).filter(file => {
        return fs.statSync(path.join(RUNS_DIR, file)).isDirectory();
    });

    const runsData: any[] = [];

    for (const runDir of runDirs) {
        const fullPath = path.join(RUNS_DIR, runDir);
        const runJsonPath = path.join(fullPath, 'run.json');
        const reportJsonPath = path.join(fullPath, 'eval_evaluation_report.json');

        if (fs.existsSync(runJsonPath) && fs.existsSync(reportJsonPath)) {
            try {
                const runConfig: RunConfig = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
                const report: EvalReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));

                runsData.push({
                    ...runConfig,
                    report
                });
            } catch (e) {
                console.error(`Error parsing data for ${runDir}:`, e);
            }
        } else {
            console.warn(`Missing metadata files for ${runDir}`);
        }
    }

    // Sort by timestamp descending
    runsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    let mdContent = `# Run Summary Report
Generated on: ${new Date().toLocaleString()}

## Overview

| Run ID | Model | Score | Tokens | Failure | Date |
|:---|:---|:---:|:---:|:---|:---|
`;

    for (const run of runsData) {
        const score = run.report.summary.overallScore;
        const tokens = run.report.summary.evalTokensTotal;
        const failure = run.failureLayer !== 'None' ? run.failureLayer : '✅';
        const date = new Date(run.timestamp).toLocaleString();
        const runIdShort = run.runId; // simplified

        mdContent += `| ${runIdShort} | ${run.model} | ${score} | ${tokens} | ${failure} | ${date} |\n`;
    }

    mdContent += `\n## Detailed Breakdown\n`;

    for (const run of runsData) {
        mdContent += `\n### ${run.runId}\n`;
        mdContent += `- **Model**: ${run.model}\n`;
        mdContent += `- **Date**: ${new Date(run.timestamp).toLocaleString()}\n`;
        mdContent += `- **Overall Score**: ${run.report.summary.overallScore}\n`;
        mdContent += `- **Total Tokens**: ${run.report.summary.evalTokensTotal}\n`;

        if (run.failureLayer !== 'None') {
            mdContent += `- **Failure Layer**: ${run.failureLayer}\n`;
        }

        mdContent += `\n**Task Results:**\n\n`;
        mdContent += `| Task | Size | Score | Tokens |\n`;
        mdContent += `|:---|:---:|:---:|:---:|\n`;

        for (const result of run.report.results) {
            mdContent += `| ${result.taskId} | ${result.size} | ${result.finalResult.totalScore} | ${result.evalTokens} |\n`;
        }
        mdContent += `\n---\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, mdContent, 'utf8');
    console.log(`Summary written to ${OUTPUT_FILE}`);
}

main();
