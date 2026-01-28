// Model Simulator
// - Accepts ModelRequest
// - Produces ModelResponse with placeholder files, logs, etc.

import { ModelRequest, ModelGenerateFnOutput, FileTreeSpec, FileArtifactsSpec } from '../lib/types';

/**
 * Simulates model generation based on the request.
 * @param req - The model request containing task details.
 * @returns A promise resolving to the model generate output with placeholder data.
 */
export function mockGenerate(req: ModelRequest): Promise<ModelGenerateFnOutput> {
  const logs: string[] = [
    `Mock generation for task ${req.taskId} with size ${req.size}, phase ${req.phase}`
  ];

  if (req.phase === 'tree') {
    // Generate tree from expectedArtifacts
    // Quality Control: Drop artifacts based on MOCK_QUALITY_GAP (0 = Perfect, 0.5 = Drop 50%)
    const qualityGap = process.env.MOCK_QUALITY_GAP ? parseFloat(process.env.MOCK_QUALITY_GAP) : 0;

    // Deterministic drop using strict logic (not random to keep tests stable)
    const filteredArtifacts = req.expectedArtifacts.filter((_, idx) => {
      if (qualityGap === 0) return true;
      // Simple drop strategy: drop if index % (1/gap) == 0? 
      // Better: keep first N items.
      // Let's use modulus. If gap is 0.5, we want to drop 50%. So drop odd indices.
      return idx % 2 === 0;
    });

    const treeFiles = filteredArtifacts.map(path => ({
      path,
      type: path.endsWith('.html') ? 'html' : path.endsWith('.js') ? 'javascript' : 'text'
    }));
    const tree: FileTreeSpec = { files: treeFiles };

    const usage = {
      totalTokens: process.env.MOCK_TOKEN_USAGE ? parseInt(process.env.MOCK_TOKEN_USAGE, 10) : 0
    };

    return Promise.resolve({
      tree,
      logs,
      usage
    });
  } else if (req.phase === 'files') {
    // Generate placeholder files based on expectedArtifacts
    const files: Record<string, string> = {};
    for (const artifact of req.expectedArtifacts) {
      files[artifact] = `Placeholder content for ${artifact}`;
    }
    // For tasks that need server, add a simple server.js
    if (req.size === 'M' || req.size === 'L' || req.size === 'XL') {
      files['server.js'] = `
const http = require('http');
// Mock Server Logic that runs and exits
console.log('Starting server logic verification...');
const server = http.createServer((req, res) => {
  res.end('ok');
});
// Simulate a "run" by listening and then immediately closing
server.listen(0, () => {
    console.log('Server started successfully on random port');
    console.log('Running internal checks...');
    setTimeout(() => {
        console.log('Checks passed.');
        server.close(() => {
            console.log('Server closed. Exiting.');
            process.exit(0);
        });
    }, 100);
});
      `.trim();
    }
    const artifacts: FileArtifactsSpec = { files };

    const usage = {
      totalTokens: process.env.MOCK_TOKEN_USAGE ? parseInt(process.env.MOCK_TOKEN_USAGE, 10) : 0
    };

    return Promise.resolve({
      artifacts,
      logs,
      usage
    });
  }

  // Fallback
  const usage = {
    totalTokens: process.env.MOCK_TOKEN_USAGE ? parseInt(process.env.MOCK_TOKEN_USAGE, 10) : 0
  };
  return Promise.resolve({ logs, usage });
}