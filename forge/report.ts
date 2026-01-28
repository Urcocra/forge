import * as fs from 'fs';
import * as path from 'path';
export function report(runDir: string) {
    const meta = JSON.parse(
        fs.readFileSync(path.join(runDir, 'run.json'), 'utf-8')
    );

    const md = `# FORGE Micro Report

**Model:** ${meta.model}  
**Run ID:** ${meta.runId}  
**Timestamp:** ${meta.timestamp}

## Failure Layer
${meta.failureLayer}

## Reproduce
\`\`\`bash
${meta.reproduce}
\`\`\`
`;

    fs.writeFileSync(path.join(runDir, 'micro-report.md'), md);
    console.log('[FORGE] report generated');
}