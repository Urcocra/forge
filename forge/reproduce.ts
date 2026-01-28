import * as fs from 'fs';
import * as path from 'path';
import { run } from './run';

export async function reproduce(runDir: string) {
    const metaPath = path.join(runDir, 'run.json');

    if (!fs.existsSync(metaPath)) {
        throw new Error(`run.json not found in ${runDir}`);
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    if (!meta.configPath) {
        throw new Error(
            'run.json missing configPath (cannot reproduce exactly)'
        );
    }

    console.log(`[FORGE] reproducing ${meta.runId}`);
    await run(meta.configPath);   // ✅ 关键修复
}