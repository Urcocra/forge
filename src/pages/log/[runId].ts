import type { APIRoute } from 'astro';
import { getRunLog, getRun } from '../../lib/runs';

export const GET: APIRoute = async ({ params }) => {
    const { runId } = params;

    if (!runId) {
        return new Response('Run ID is required', { status: 400 });
    }

    const run = await getRun(runId);
    if (!run) {
        return new Response('Run not found', { status: 404 });
    }

    const logContent = await getRunLog(runId);

    return new Response(logContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};
