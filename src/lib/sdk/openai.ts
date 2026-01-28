
import { ModelRequest, ModelGenerateFnOutput, FileTreeSpec, FileArtifactsSpec } from '../types';
import OpenAI from 'openai';

export interface OpenAICompatibleConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export class OpenAICompatibleClient {
    private client: OpenAI;
    private model: string;

    constructor(config: OpenAICompatibleConfig) {
        if (!config.baseUrl || !config.apiKey || !config.model) {
            throw new Error('Missing configuration: baseUrl, apiKey, and model must be set.');
        }

        this.model = config.model;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
    }

    public async generate(req: ModelRequest): Promise<ModelGenerateFnOutput> {
        // Construct prompt
        const prompt = `
Task: ${req.description}
Generate the following artifacts: ${req.expectedArtifacts.join(', ')}
Constraints: Ensure code is valid and matches the task size ${req.size}.
Respond with JSON only: {"files": {"filename": "content"}}
IMPORTANT: Strictly valid JSON. Escape all double quotes, backslashes and newlines within strings.
`.trim();

        const logs: string[] = [];

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            });

            const rawOutput = completion.choices[0]?.message?.content || '';

            // Robust JSON Parsing Strategy
            let files: Record<string, string> = {};
            let parsed: any = null;

            // Strategy 1: Attempt to extract from Markdown Code Block
            const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = codeBlockRegex.exec(rawOutput);
            if (match && match[1]) {
                try {
                    parsed = JSON.parse(match[1]);
                } catch (e) { /* ignore */ }
            }

            // Strategy 2: Attempt strict parse of raw output
            if (!parsed) {
                try {
                    parsed = JSON.parse(rawOutput);
                } catch (e) { /* ignore */ }
            }

            // Strategy 3: Attempt to find outer braces
            if (!parsed) {
                try {
                    const firstBrace = rawOutput.indexOf('{');
                    const lastBrace = rawOutput.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        const potentialJson = rawOutput.substring(firstBrace, lastBrace + 1);
                        parsed = JSON.parse(potentialJson);
                    }
                } catch (e) { /* ignore */ }
            }

            if (parsed && parsed.files && typeof parsed.files === 'object') {
                files = parsed.files;
            } else {
                // Failed all strategies
                logs.push(`Failed to parse response. Raw output snippet: ${rawOutput.substring(0, 200)}...`);
                return {
                    tree: { files: [] },
                    artifacts: { files: {} },
                    logs,
                };
            }

            // Generate tree from files
            const treeFiles = Object.keys(files).map(path => ({
                path,
                type: path.endsWith('.html') ? 'html' : path.endsWith('.js') ? 'javascript' : 'text'
            }));
            const tree: FileTreeSpec = { files: treeFiles };
            const artifacts: FileArtifactsSpec = { files };

            return {
                tree,
                artifacts,
                logs,
                usage: {
                    totalTokens: completion.usage?.total_tokens ?? 0
                }
            };
        } catch (error) {
            logs.push(`API error: ${error}`);
            return {
                tree: { files: [] },
                artifacts: { files: {} },
                logs,
            };
        }
    }
}
