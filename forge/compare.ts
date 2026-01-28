import * as fs from 'fs';
import * as path from 'path';

export function compare() {
    const RUNS_DIR = path.join(process.cwd(), 'runs');

    const runs = fs.readdirSync(RUNS_DIR)
        .map(d => {
            const p = path.join(RUNS_DIR, d, 'run.json');
            return fs.existsSync(p)
                ? JSON.parse(fs.readFileSync(p, 'utf-8'))
                : null;
        })
        .filter(Boolean);

    console.log('\nRunID\tModel\tFailureLayer');
    console.log('--------------------------------------------------');

    for (const r of runs) {
        console.log(`${r.runId}\t${r.model}\t${r.failureLayer}`);
    }
}