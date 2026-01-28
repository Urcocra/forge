// Unified Model Adapter
// - generic OpenAI-compatible adapter
// - Configured via environment variables: BASE_URL, API_KEY, MODEL

import { ModelRequest, ModelGenerateFnOutput, ModelGenerateFn } from './types';
import { OpenAICompatibleClient } from './sdk/openai';

/**
 * Generic OpenAI-compatible model generate function.
 * reads configuration from process.env
 */
export const unifiedGenerate: ModelGenerateFn = async (req: ModelRequest): Promise<ModelGenerateFnOutput> => {
    const baseURL = process.env.BASE_URL;
    const apiKey = process.env.API_KEY;
    const model = process.env.MODEL;

    if (!baseURL || !apiKey || !model) {
        throw new Error('Missing configuration: BASE_URL, API_KEY, and MODEL must be set.');
    }

    const client = new OpenAICompatibleClient({
        baseUrl: baseURL,
        apiKey: apiKey,
        model: model,
    });

    return client.generate(req);
};
