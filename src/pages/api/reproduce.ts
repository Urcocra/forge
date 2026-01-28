import type { APIRoute } from 'astro';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { RUNS_DIR } from '../../lib/runs';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { runId, apiKey } = body;

        if (!runId) {
            return new Response('Missing runId', { status: 400 });
        }

        // Validate Run Path (simple check)
        // Using RUNS_DIR from lib ensures we look in the right place
        const runDir = path.join(RUNS_DIR, runId);

        // Command configuration
        // We use 'npx ts-node' to execute the source file directly in development
        // In production this might need to point to compiled js, but for now we follow the 'forge' script pattern
        const scriptPath = path.resolve(process.cwd(), 'forge/index.ts');

        console.log(`[API] Spawning reproduction for ${runId} at ${runDir}`);

        const child = spawn('npx.cmd', ['ts-node', scriptPath, 'reproduce', runDir], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                OPENAI_API_KEY: apiKey || process.env.OPENAI_API_KEY, // Use provided key or fallback
                FORCE_COLOR: '1' // Attempt to keep colors
            },
            shell: true // Helpful on Windows for npx
        });

        const stream = new ReadableStream({
            start(controller) {
                const encode = (msg: string) => controller.enqueue(new TextEncoder().encode(msg));

                child.stdout.on('data', (data) => {
                    encode(data.toString());
                });

                child.stderr.on('data', (data) => {
                    encode(data.toString());
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        encode('\n[FORGE] Reproduction Complete.\n');
                    } else {
                        encode(`\n[FORGE] Process exited with code ${code}\n`);
                    }
                    controller.close();
                });

                child.on('error', (err) => {
                    encode(`\n[FORGE] Spawn Error: ${err.message}\n`);
                    controller.close();
                });
            },
            cancel() {
                child.kill();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff'
            }
        });

    } catch (e: any) {
        console.error('[API] Error', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
