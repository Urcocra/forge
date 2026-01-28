// Orchestrator
// - Runs complete FORGE v1 pipeline
// - Single traceable execution line
// - Config-injected (CLI / reproduce / UI friendly)
// - Fail-fast, no hidden control flow

import 'dotenv/config';

import { getTask } from './lib/task';
import { runTask, getBenchmarkSummary } from './lib/exec';
import { mockGenerate } from './test/mock';
import { unifiedGenerate } from './lib/adapter';
import { ModelGenerateFn } from './lib/types';
import { computeECI } from './lib/eval/esg-eval';
import { writeReports, TaskResult } from './lib/reporting/report-generator';

/**
 * ==============================
 * Forge Config (Single Source)
 * ==============================
 */
export interface ForgeConfig {
  model: string;
  baseUrl: string;
  apiKey: string;
  parameterScale?: number;
  tasks?: string[]; // optional override
}

/**
 * ==============================
 * Core Pipeline Entry
 * ==============================
 *
 * NOTE:
 * - process.env is used ONLY as a compatibility bridge
 * - all execution semantics are defined by ForgeConfig
 */
export async function runForge(config: ForgeConfig) {
  // ---------------------------------------------------------
  // 1. APPLY CONFIG (single source of truth)
  // ---------------------------------------------------------

  process.env.MODEL = config.model;
  process.env.BASE_URL = config.baseUrl;
  process.env.API_KEY = config.apiKey;
  process.env.PARAMETER_SCALE = config.parameterScale?.toString() ?? "undefined";

  console.log('[CONFIG]', {
    MODEL: config.model,
    BASE_URL: config.baseUrl,
    HAS_KEY: !!config.apiKey,
    PARAMETER_SCALE: config.parameterScale
  });

  if (!config.model) {
    throw new Error('CRITICAL: model is not set.');
  }

  // ---------------------------------------------------------
  // 2. SELECT MODEL ADAPTER
  // ---------------------------------------------------------

  let modelGenerateFn: ModelGenerateFn;

  if (config.model === 'mock') {
    modelGenerateFn = mockGenerate;
    console.log('Using model adapter: mock');
  } else if (config.apiKey) {
    modelGenerateFn = unifiedGenerate;
    console.log(`Using model adapter: unified (${config.model})`);
  } else {
    throw new Error(
      `CRITICAL: model="${config.model}" requires apiKey.`
    );
  }

  // ---------------------------------------------------------
  // 3. TASK SET (configurable but deterministic)
  // ---------------------------------------------------------

  const DEFAULT_TASKS = ['xs_task', 's_task', 'm_task', 'l_task', 'xl_task'];
  const taskIds = config.tasks ?? DEFAULT_TASKS;

  // ---------------------------------------------------------
  // 4. LINEAR PIPELINE EXECUTION
  // ---------------------------------------------------------

  const taskResults: TaskResult[] = [];

  for (const taskId of taskIds) {
    console.log(`\n==============================`);
    console.log(`▶ Running Task: ${taskId}`);
    console.log(`==============================`);

    // ---- TRACE ANCHOR (BEGIN)
    console.log(`[TASK_BEGIN] ${taskId}`);

    const taskSpec = getTask(taskId);

    // Pipeline phases:
    // 1. Generation
    // 2. Parsing
    // 3. Static Evaluation
    // 4. Runtime Evaluation
    // 5. Final Aggregation
    // Pipeline phases:
    // 1. Generation
    // 2. Parsing
    // 3. Static Evaluation
    // 4. Runtime Evaluation
    // 5. Final Aggregation
    const result = await execPipeline(taskSpec, modelGenerateFn, config.parameterScale);

    // Collect Data for Reporting
    taskResults.push({
      taskId: taskSpec.id,
      size: taskSpec.size,
      finalResult: result.finalResult,
      staticScore: result.staticScore,
      evalTokens: result.evalTokens
    });

    console.log('File Tree:', result.fileTree);
    console.log('Static Score:', result.staticScore);
    console.log('Runtime Score:', result.runtimeScore);
    console.log('Total Score:', result.totalScore);
    console.log('Eval Tokens:', result.evalTokens);

    const esgScore = computeECI({
      evalTokens: result.evalTokens,
      parameterScale: config.parameterScale
    });
    if (esgScore !== null) {
      console.log('ECI Score:', esgScore);
    }

    if (result.timeTracking) {
      const tt = result.timeTracking;
      console.log('Time Tracking:', {
        total: {
          predicted: `${(tt.total.predictedMs / 1000).toFixed(1)}s`,
          actual: `${(tt.total.actualMs / 1000).toFixed(1)}s`,
          completedInTime: tt.total.completedInPredictedTime
        },
        phases: Object.fromEntries(
          Object.entries(tt.phases).map(([k, v]: any) => [
            k,
            {
              predicted: `${(v.predictedMs / 1000).toFixed(1)}s`,
              actual: `${(v.actualMs / 1000).toFixed(1)}s`,
              completedInTime: v.completedInPredictedTime
            }
          ])
        )
      });
    }

    console.log('Logs:', result.logs);

    // ---- TRACE ANCHOR (END)
    console.log(`[TASK_END] ${taskId}`);
  }

  /* =========================================================
   * 5. AGGREGATED BENCHMARK SCORE
   * ========================================================= */
  const summary = getBenchmarkSummary(config.parameterScale);
  console.log(`\n==============================`);
  console.log(`🏆 Benchmark Summary`);
  console.log(`==============================`);
  console.log(JSON.stringify(summary, null, 2));

  /* =========================================================
   * 6. REPORT GENERATION
   * ========================================================= */
  const outputDir = process.env.FORGE_OUTPUT_DIR ?? './reports';

  try {
    writeReports({
      summary,
      config: {
        model: config.model,
        parameterScale: config.parameterScale
      },
      results: taskResults
    }, outputDir);
  } catch (err) {
    console.error('[FORGE ERROR] Failed to generate reports:', err);
    // We do NOT exit here, ensuring the run completes gracefully even if reporting fails
  }

}

/**
 * ==============================
 * Pipeline Executor (Semantic Box)
 * ==============================
 */
async function execPipeline(
  taskSpec: any,
  modelGenerateFn: ModelGenerateFn,
  parameterScale?: number
) {
  const result = await runTask(taskSpec, modelGenerateFn, { parameterScale });

  return {
    fileTree: result.metadata.tree,
    finalResult: result.metadata.finalResult,
    staticScore: result.metadata.staticScore,
    runtimeScore: result.metadata.runtimeScore,
    totalScore: result.metadata.finalResult.totalScore,
    timeTracking: result.metadata.timeTracking,
    logs: result.logs,
    evalTokens: result.metadata.evalTokens,
  };
}

/**
 * ==============================
 * BOOT (CLI / legacy compatible)
 * ==============================
 */
if (require.main === module) {
  const injected: ForgeConfig = process.env.FORGE_CONFIG
    ? JSON.parse(process.env.FORGE_CONFIG)
    : {
      model: process.env.MODEL!,
      baseUrl: process.env.BASE_URL!,
      apiKey: process.env.API_KEY!
    };

  runForge(injected).catch(err => {
    console.error('FORGE CRASHED:', err);
    process.exit(1);
  });
}