import * as fs from 'fs';
import { run } from './run';

/**
 * Executes a batch of runs sequentially.
 * @param configPath Path to the configuration file
 * @param times Number of times to run
 */
export async function batch(configPath: string, times: number) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    if (isNaN(times) || times <= 0) {
        throw new Error(`Invalid batch times: ${times}. Must be a positive integer.`);
    }

    console.log(`[FORGE] Starting BATCH execution`);
    console.log(`[FORGE] Config: ${configPath}`);
    console.log(`[FORGE] Times:  ${times}`);

    let successCount = 0;
    let failureCount = 0;

    const promises: Promise<void>[] = [];

    for (let i = 1; i <= times; i++) {
        const p = (async () => {
            console.log(`[FORGE] Starting Batch Iteration ${i} / ${times}`);
            try {
                // Pass suffix to ensure unique runId even if started same ms
                await run(configPath, { runIdSuffix: `batch${i}` });
                successCount++;
            } catch (e: any) {
                console.error(`[FORGE] Iteration ${i} failed:`, e.message);
                failureCount++;
            }
        })();
        promises.push(p);
    }

    await Promise.all(promises);

    console.log(`\n==================================================`);
    console.log(`[FORGE] BATCH COMPLETED`);
    console.log(`Summary: ${successCount} Success, ${failureCount} Failed`);
    console.log(`==================================================`);
}
