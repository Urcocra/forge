// Execution Layer
// - Orchestrates the complete FORGE pipeline
// - Manages model calls, parsing, evaluation, and sandbox execution
// - Adds descriptive time tracking (non-normative)

import {
  TaskSpec,
  ExecutionResult,
  ExecutionArtifacts,
  LogEntry,
  ModelRequest,
  ModelGenerateFn,
  CombinedModelOutput,
  Difficulty,
  PhaseTimeTracking,
  TaskTimeTracking,
  ScoreBreakdown,
  RunOptions,
  FinalEvaluationResult,
} from './types';
import { SandboxManifest } from '../types/sandbox';
import * as crypto from 'crypto';

import { parseModelOutput } from './parsing/model-output-parser';
import { evaluateStatic } from './eval/static-eval';
import { runInSandbox } from './runtime/sandbox-runner';
import { evaluateRuntime } from './eval/runtime-eval';
import { evaluateFinal } from './eval/final-eval';
import { computeECI } from './eval/esg-eval';

/* =========================
 * Utils
 * ========================= */

/**
 * Default time budgets (in milliseconds) by task difficulty
 */
const TIME_BUDGETS: Record<Difficulty, number> = {
  'XS': 30000,   // 30 seconds
  'S': 60000,    // 60 seconds
  'M': 120000,   // 2 minutes
  'L': 300000,   // 5 minutes
  'XL': 600000   // 10 minutes (OPTIMAL: 2x L. Cost-benefit max for stalled tasks.)
};

/**
 * Gets the time budget for a given task size
 */
function getTimeBudget(size: Difficulty): number {
  return TIME_BUDGETS[size];
}

/**
 * Tracks the execution time of an async operation
 * Returns both the result and time tracking metadata
 */
async function trackPhaseTime<T>(
  phaseName: string,
  predictedMs: number,
  fn: () => Promise<T>
): Promise<{ result: T; tracking: PhaseTimeTracking }> {
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const result = await fn();

  const endTime = new Date().toISOString();
  // Use wall-clock time difference
  const actualMs = Date.now() - startMs;
  const completedInPredictedTime = actualMs <= predictedMs;

  return {
    result,
    tracking: {
      predictedMs,
      actualMs,
      completedInPredictedTime,
      startTime,
      endTime
    }
  };
}

function toLogEntries(
  lines: string[] = [],
  level: LogEntry['level'] = 'info'
): LogEntry[] {
  const now = new Date();
  return lines.map((message) => ({
    timestamp: now,
    level,
    message,
  }));
}

/**
 * Runs the complete FORGE pipeline for the given task.
 *
 * Benchmark-side failures (e.g., parse issues) are handled as SILENT DEGRADES:
 * - No throws
 * - No user-facing error logs
 * - No exposure in returned artifacts/errors
 * - Evaluation is gated to avoid contaminating capability scores
 *
 * Timing is recorded as DESCRIPTIVE metadata only.
 */
export async function runTask(
  taskSpec: TaskSpec,
  modelGenerateFn: ModelGenerateFn,
  options?: RunOptions
): Promise<ExecutionResult> {

  /* =========================================================
   * ⏱️ Time tracking (START)
   * ========================================================= */
  const taskStartTime = new Date().toISOString();
  const startMs = Date.now();
  const timeBudget = taskSpec.timeBudgetMs ?? getTimeBudget(taskSpec.size);
  const deadline = startMs + timeBudget;
  const isXL = taskSpec.size === 'XL';

  type ModelGenerateFnOutput = Awaited<ReturnType<ModelGenerateFn>>;

  // Helper for KilledTimeout (XL only)
  async function callWithTimeout(
    phase: string,
    fn: () => Promise<ModelGenerateFnOutput>
  ): Promise<{ result?: ModelGenerateFnOutput; timeout?: boolean }> {
    if (!isXL) {
      const result = await fn();
      return { result };
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return { timeout: true };

    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<{ timeout: boolean }>((resolve) => {
      timer = setTimeout(() => resolve({ timeout: true }), remaining);
    });

    const executionPromise = fn().then(result => ({ result }));

    const winner = await Promise.race([executionPromise, timeoutPromise]);
    // @ts-ignore
    clearTimeout(timer);
    return winner;
  }

  // Phase tracking
  const phaseTimings: TaskTimeTracking['phases'] = {};
  let taskEvalTokens = 0;
  let infrastructureTimeout = false;

  /* =========================================================
   * 1) Call model → Tree phase
   * ========================================================= */
  const treeReq: ModelRequest = {
    taskId: taskSpec.id,
    size: taskSpec.size,
    description: taskSpec.question.description,
    expectedArtifacts: taskSpec.question.expectedArtifacts,
    phase: 'tree',
  };

  // Predict 10% of total budget for tree phase
  const treePredictedMs = Math.floor(timeBudget * 0.1);

  // WRAPPER: Track phase time + Enforce Timeout
  const treeStartTime = Date.now();
  const treeCallResult = await callWithTimeout('tree', () => modelGenerateFn(treeReq));

  const treeActualMs = Date.now() - treeStartTime;
  phaseTimings.treePhase = {
    predictedMs: treePredictedMs,
    actualMs: treeActualMs,
    completedInPredictedTime: treeActualMs <= treePredictedMs,
    startTime: new Date(treeStartTime).toISOString(),
    endTime: new Date().toISOString()
  };

  if (treeCallResult.result?.usage) {
    taskEvalTokens += treeCallResult.result.usage.totalTokens;
  }

  if (treeCallResult.timeout) {
    infrastructureTimeout = true;
  }

  const treeOutput = treeCallResult.result;
  const tree = treeOutput?.tree;

  // Tree missing OR Timeout → MODEL failure (or Timeout handling)
  if (!tree || infrastructureTimeout) {
    const artifacts: ExecutionArtifacts = {
      html: '',
      logs: [],
      errors: infrastructureTimeout ? ['Infrastructure Timeout during Tree Phase'] : undefined,
      files: {} as any,
    };

    const staticScore = {
      completeness: 0,
      structure: 0,
      survivability: 0,
      connectivity: 0,
      lintErrorsLevelA: [],
      lintErrorsLevelB: [],
      lintErrorsLevelC: [],
      lintErrors: [],
      lintErrorCount: 0,
      failureAnnotations: []
    } satisfies ScoreBreakdown;

    const runtimeScore =
      taskSpec.runtime?.entry || taskSpec.runtime?.buildCommand
        ? 0
        : null;

    const currentElapsedMs = Date.now() - startMs;
    const finalResult = evaluateFinal(staticScore, runtimeScore, {});

    if (infrastructureTimeout) {
      finalResult.infrastructureTimeout = true;
      finalResult.notes.push('Infrastructure Timeout Triggered');
    }

    // Inject ECI
    if (options?.parameterScale !== undefined) {
      const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
      if (eciVal !== null) {
        finalResult.eci = {
          rawTokens: taskEvalTokens,
          parameterScale: options.parameterScale,
          eci: eciVal
        };
      }
    }

    // Update benchmark accumulator (Skip if Timeout)
    if (!infrastructureTimeout) {
      let esgData;
      if (options?.parameterScale !== undefined) {
        const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
        if (eciVal !== null) {
          esgData = { evalTokens: taskEvalTokens, parameterScale: options.parameterScale, eciIndex: eciVal };
        }
      }
      addToBenchmark(taskSpec.id, taskSpec.size, finalResult.totalScore, esgData);
    }

    return {
      artifacts,
      logs: [],
      metadata: {
        taskId: taskSpec.id,
        executedAt: new Date().toISOString(),
        tree: null,
        combined: null,
        staticScore,
        runtimeScore,
        finalResult,
        infrastructureTimeout,
        timeTracking: {
          total: {
            predictedMs: timeBudget,
            actualMs: currentElapsedMs,
            completedInPredictedTime: currentElapsedMs <= timeBudget,
            startTime: taskStartTime,
            endTime: new Date().toISOString()
          },
          phases: phaseTimings
        },
        evalTokens: taskEvalTokens,
        ...(options?.parameterScale !== undefined && {
          esg: {
            parameterScale: options.parameterScale,
            eciIndex: computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale })
          }
        })
      },
    };
  }

  /* =========================================================
   * 2) Call model → Files phase
   * ========================================================= */
  const filesReq: ModelRequest = {
    taskId: taskSpec.id,
    size: taskSpec.size,
    description: taskSpec.question.description,
    expectedArtifacts: taskSpec.question.expectedArtifacts,
    phase: 'files',
  };

  // Predict 30% of total budget for files phase
  const filesPredictedMs = Math.floor(timeBudget * 0.3);

  const filesStartTime = Date.now();
  const filesCallResult = await callWithTimeout('files', () => modelGenerateFn(filesReq));

  const filesActualMs = Date.now() - filesStartTime;
  phaseTimings.filesPhase = {
    predictedMs: filesPredictedMs,
    actualMs: filesActualMs,
    completedInPredictedTime: filesActualMs <= filesPredictedMs,
    startTime: new Date(filesStartTime).toISOString(),
    endTime: new Date().toISOString()
  };

  if (filesCallResult.result?.usage) {
    taskEvalTokens += filesCallResult.result.usage.totalTokens;
  }

  if (filesCallResult.timeout) {
    infrastructureTimeout = true;
  }

  const filesOutput = filesCallResult.result;
  const artifactsSpec = filesOutput?.artifacts;

  // Missing artifacts OR Timeout → MODEL failure (but preserve Tree metadata!)
  if (!artifactsSpec || infrastructureTimeout) {
    const artifacts: ExecutionArtifacts = {
      html: '',
      logs: [],
      errors: infrastructureTimeout ? ['Infrastructure Timeout during Files Phase'] : undefined,
      files: {} as any,
    };

    const staticScore = {
      completeness: 0,
      structure: 0,
      survivability: 0,
      connectivity: 0,
      lintErrorsLevelA: [],
      lintErrorsLevelB: [],
      lintErrorsLevelC: [],
      lintErrors: [],
      lintErrorCount: 0,
      failureAnnotations: []
    } satisfies ScoreBreakdown;

    const runtimeScore =
      taskSpec.runtime?.entry || taskSpec.runtime?.buildCommand
        ? 0
        : null;

    const currentElapsedMs = Date.now() - startMs;
    const finalResult = evaluateFinal(staticScore, runtimeScore, {});

    if (infrastructureTimeout) {
      finalResult.infrastructureTimeout = true;
      finalResult.notes.push('Infrastructure Timeout Triggered');
    }

    // Inject ECI
    if (options?.parameterScale !== undefined) {
      const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
      if (eciVal !== null) {
        finalResult.eci = {
          rawTokens: taskEvalTokens,
          parameterScale: options.parameterScale,
          eci: eciVal
        };
      }
    }

    // Update benchmark accumulator (Skip if Timeout)
    if (!infrastructureTimeout) {
      let esgData;
      if (options?.parameterScale !== undefined) {
        const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
        if (eciVal !== null) {
          esgData = { evalTokens: taskEvalTokens, parameterScale: options.parameterScale, eciIndex: eciVal };
        }
      }
      addToBenchmark(taskSpec.id, taskSpec.size, finalResult.totalScore, esgData);
    }

    return {
      artifacts,
      logs: [],
      metadata: {
        taskId: taskSpec.id,
        executedAt: new Date().toISOString(),
        tree, // ✅ PRESERVED
        combined: null,
        staticScore,
        runtimeScore,
        finalResult,
        infrastructureTimeout,
        timeTracking: {
          total: {
            predictedMs: timeBudget,
            actualMs: currentElapsedMs,
            completedInPredictedTime: currentElapsedMs <= timeBudget,
            startTime: taskStartTime,
            endTime: new Date().toISOString()
          },
          phases: phaseTimings
        },
        evalTokens: taskEvalTokens,
        ...(options?.parameterScale !== undefined && {
          esg: {
            parameterScale: options.parameterScale,
            eci: computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale })
          }
        })
      },
    };
  }

  /* =========================================================
   * 3) Merge user-visible logs
   * ========================================================= */
  const allLogs: LogEntry[] = [
    ...toLogEntries(treeOutput?.logs ?? []),
    ...toLogEntries(filesOutput?.logs ?? []),
  ];

  /* =========================================================
   * 4) Parsing Layer (benchmark-side silent)
   * ========================================================= */
  let artifactStatus: 'VALID' | 'INVALID' = 'VALID';
  let combined: CombinedModelOutput | null = null;

  // Predict 5% of total budget for parsing
  const parsingPredictedMs = Math.floor(timeBudget * 0.05);
  const parsingResult = await trackPhaseTime(
    'parsing',
    parsingPredictedMs,
    async () => {
      try {
        const parsed = parseModelOutput(tree, artifactsSpec);
        if (!parsed) {
          artifactStatus = 'INVALID';
          return null;
        }
        return parsed;
      } catch {
        artifactStatus = 'INVALID';
        return null;
      }
    }
  );
  phaseTimings.parsing = parsingResult.tracking;
  combined = parsingResult.result;

  /* =========================================================
   * 5) Build artifacts
   * ========================================================= */
  const artifacts: ExecutionArtifacts = {
    html:
      artifactStatus === 'VALID'
        ? artifactsSpec.files?.['index.html'] || ''
        : '',
    logs: allLogs,
    errors: undefined,
    files:
      artifactStatus === 'VALID'
        ? combined!.artifacts.files
        : ({} as any),
  };

  /* =========================================================
   * 5.5) Generate Sandbox Manifest
   * ========================================================= */
  let sandboxManifest: SandboxManifest | undefined;
  if (artifactStatus === 'VALID') {
    const fileHashes: Record<string, string> = {};
    const filesMounted = Object.keys(artifacts.files || {});

    for (const [path, content] of Object.entries(artifacts.files || {})) {
      fileHashes[path] = crypto.createHash('sha256').update(content).digest('hex');
    }

    sandboxManifest = {
      entry: taskSpec.runtime?.entry || '',
      filesMounted,
      fileHashes,
      generatedAt: new Date().toISOString()
    };
  }

  /* =========================================================
   * 6) Static evaluation
   * ========================================================= */
  // Predict 15% of total budget for static evaluation
  const staticPredictedMs = Math.floor(timeBudget * 0.15);
  const staticEvalResult = await trackPhaseTime(
    'staticEval',
    staticPredictedMs,
    () => artifactStatus === 'VALID'
      ? evaluateStatic(artifacts, taskSpec, sandboxManifest)
      : Promise.resolve({
        completeness: 0.5,
        structure: 0,
        survivability: 0,
        connectivity: 0,
        lintErrorsLevelA: [],
        lintErrorsLevelB: [],
        lintErrorsLevelC: [],
        lintErrors: [],
        lintErrorCount: 0,
        failureAnnotations: []
      } satisfies ScoreBreakdown)
  );
  phaseTimings.staticEval = staticEvalResult.tracking;
  const staticScore = staticEvalResult.result;

  // Add time tracking to static score
  // User Request: ActualMs should be from first LLM calling (Start of Task)
  staticScore.timeTracking = {
    ...staticEvalResult.tracking,
    startTime: taskStartTime,
    actualMs: Date.now() - startMs,
    predictedMs: timeBudget,
    completedInPredictedTime: (Date.now() - startMs) <= timeBudget
  };

  /* =========================================================
   * 7) Runtime execution + eval
   * ========================================================= */
  let runtimeScore: number | null = null;
  let sandboxResultForMetadata: any = undefined;

  // ⭐ 正确：runtime 是否执行只由 Difficulty 决定
  const needsRuntime =
    taskSpec.size === 'M' ||
    taskSpec.size === 'L' ||
    taskSpec.size === 'XL';

  if (needsRuntime && artifactStatus === 'VALID') {
    const runtimePredictedMs = Math.floor(timeBudget * 0.4);

    const runtimeEvalResult = await trackPhaseTime(
      'runtimeEval',
      runtimePredictedMs,
      async () => {
        const sandboxResult = await runInSandbox(artifacts, taskSpec, sandboxManifest);
        const { score, failureAnnotations } = evaluateRuntime(sandboxResult, taskSpec);
        return { sandboxResult, score, failureAnnotations };
      }
    );

    phaseTimings.runtimeEval = runtimeEvalResult.tracking;

    const sandboxResult = runtimeEvalResult.result.sandboxResult;
    runtimeScore = runtimeEvalResult.result.score;

    sandboxResultForMetadata = {
      browserErrors: sandboxResult.browserErrors,
      browserLogs: sandboxResult.browserLogs,
      runtimeErrors: sandboxResult.runtimeErrors,
      runtimeWarnings: sandboxResult.runtimeWarnings,
      failureAnnotations: runtimeEvalResult.result.failureAnnotations
    };

    const sandboxLogs = sandboxResult.logs.map((message) => ({
      timestamp: new Date(),
      level: 'info' as const,
      message,
    }));

    artifacts.logs.push(...sandboxLogs);

    if (sandboxResult.browserErrors || sandboxResult.browserLogs) {
      artifacts.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Browser validation: ${sandboxResult.browserErrors?.length || 0} errors, ${sandboxResult.browserLogs?.length || 0} logs`
      });

      sandboxResultForMetadata = {
        browserErrors: sandboxResult.browserErrors,
        browserLogs: sandboxResult.browserLogs,
        runtimeErrors: sandboxResult.runtimeErrors,
        runtimeWarnings: sandboxResult.runtimeWarnings
      };
    }
  } else {
    runtimeScore = null;
  }

  /* =========================================================
   * 8) Final evaluation
   * ========================================================= */
  const preFinalEvalMs = Date.now() - startMs;

  const timeTracking: TaskTimeTracking = {
    total: {
      predictedMs: timeBudget,
      actualMs: preFinalEvalMs,
      completedInPredictedTime: preFinalEvalMs <= timeBudget,
      startTime: taskStartTime,
      endTime: new Date().toISOString()
    },
    phases: phaseTimings
  };

  const mergedAnnotations = [
    ...staticScore.failureAnnotations,
    ...(sandboxResultForMetadata?.failureAnnotations ?? [])
  ];

  const finalResult = evaluateFinal(staticScore, runtimeScore, {
    difficulty: taskSpec.size,
    browserErrors: sandboxResultForMetadata?.browserErrors,
    runtimeErrors: sandboxResultForMetadata?.runtimeErrors,
    runtimeWarnings: sandboxResultForMetadata?.runtimeWarnings,

    lintErrorsLevelA: staticScore.lintErrorsLevelA,
    lintErrorsLevelB: staticScore.lintErrorsLevelB,

    failureAnnotations: mergedAnnotations,

    runtimeScore
  });

  if (infrastructureTimeout) {
    finalResult.infrastructureTimeout = true;
  }

  // Inject ECI
  if (options?.parameterScale !== undefined) {
    const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
    if (eciVal !== null) {
      finalResult.eci = {
        rawTokens: taskEvalTokens,
        parameterScale: options.parameterScale,
        eci: eciVal
      };
    }
  }

  /* =========================================================
   * ⏱️ Time tracking (END) & Return
   * ========================================================= */

  // Update benchmark accumulator (Success path)
  if (!infrastructureTimeout) {
    let esgData;
    if (options?.parameterScale !== undefined) {
      const eciVal = computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale });
      if (eciVal !== null) {
        esgData = { evalTokens: taskEvalTokens, parameterScale: options.parameterScale, eciIndex: eciVal };
      }
    }
    addToBenchmark(taskSpec.id, taskSpec.size, finalResult.totalScore, esgData);
  }

  return {
    artifacts,
    logs: artifacts.logs,
    metadata: {
      taskId: taskSpec.id,
      executedAt: new Date().toISOString(),
      tree,
      combined,
      staticScore,
      runtimeScore,
      finalResult,
      infrastructureTimeout, // ✅ Metadata
      ...(sandboxResultForMetadata && {
        browserErrors: sandboxResultForMetadata.browserErrors,
        browserLogs: sandboxResultForMetadata.browserLogs
      }),
      timeTracking,
      evalTokens: taskEvalTokens,
      ...(options?.parameterScale !== undefined && {
        esg: {
          parameterScale: options.parameterScale,
          eciIndex: computeECI({ evalTokens: taskEvalTokens, parameterScale: options.parameterScale })
        }
      })
    },
  } as ExecutionResult;
}

/* =========================
 * Benchmark Accumulator
 * ========================= */

import { DIFFICULTY_WEIGHTS } from './difficulty';
import { EsgAnnotation } from './types'; // Import EsgAnnotation

export interface BenchmarkAccumulator {
  weightedSum: number;
  totalWeight: number;
  evalTokens: number;
  eciTotal: number; // Sum of ECIs
  perTask: {
    taskId: string;
    size: Difficulty;
    score: number;
    weight: number;
  }[];
  esgBreakdown: EsgAnnotation[]; // Detailed ESG tracking
}

export const benchmarkAccumulator: BenchmarkAccumulator = {
  weightedSum: 0,
  totalWeight: 0,
  evalTokens: 0,
  eciTotal: 0,
  perTask: [],
  esgBreakdown: []
};

/**
 * Adds a task completion result to the global benchmark accumulator
 */
export function addToBenchmark(
  taskId: string,
  size: Difficulty,
  score: number,
  esg?: { evalTokens: number; parameterScale: number; eciIndex: number }
) {
  const weight = DIFFICULTY_WEIGHTS[size];

  benchmarkAccumulator.weightedSum += score * weight;
  benchmarkAccumulator.totalWeight += weight;

  benchmarkAccumulator.perTask.push({
    taskId,
    size,
    score,
    weight
  });

  if (esg) {
    benchmarkAccumulator.evalTokens += esg.evalTokens;
    benchmarkAccumulator.eciTotal += esg.eciIndex;
    benchmarkAccumulator.esgBreakdown.push({
      taskId,
      size,
      evalTokens: esg.evalTokens,
      parameterScale: esg.parameterScale,
      eciIndex: esg.eciIndex
    });
  }
}

/**
 * Resets the benchmark accumulator (useful for test runs)
 */
export function resetBenchmark() {
  benchmarkAccumulator.weightedSum = 0;
  benchmarkAccumulator.totalWeight = 0;
  benchmarkAccumulator.evalTokens = 0;
  benchmarkAccumulator.eciTotal = 0;
  benchmarkAccumulator.perTask = [];
  benchmarkAccumulator.esgBreakdown = [];
}

/**
 * Computes the final weighted average score for the benchmark run.
 * Returns an integer [0, 100].
 */
export function getBenchmarkScore(): number {
  if (benchmarkAccumulator.totalWeight === 0) {
    return 0;
  }
  return Math.round(benchmarkAccumulator.weightedSum / benchmarkAccumulator.totalWeight);
}

import { ESGMethodDisclosure } from '../esg/method-disclosure';

export interface BenchmarkSummary {
  overallScore: number;
  evalTokensTotal: number;
  eciTotal: number;
  esg?: {
    parameterScale: number;
    score: number;
  };
  esgDisclosure?: ESGMethodDisclosure; // Fixed Method Disclosure
  breakdown: BenchmarkAccumulator['perTask'];
  esgBreakdown: EsgAnnotation[];
  weights: typeof DIFFICULTY_WEIGHTS;
}

/**
 * Returns the full structured benchmark summary.
 * Ideal for reporting, JSON output, and UI visualization.
 */
import { FIXED_ESG_DISCLOSURE } from '../esg/method-disclosure';

export function getBenchmarkSummary(parameterScale?: number): BenchmarkSummary {
  const summary: BenchmarkSummary = {
    overallScore: getBenchmarkScore(),
    evalTokensTotal: benchmarkAccumulator.evalTokens,
    eciTotal: benchmarkAccumulator.eciTotal,
    esgDisclosure: FIXED_ESG_DISCLOSURE, // Attach Fixed Disclosure
    breakdown: benchmarkAccumulator.perTask,
    esgBreakdown: benchmarkAccumulator.esgBreakdown,
    weights: DIFFICULTY_WEIGHTS
  };

  if (parameterScale !== undefined) {
    // ECI Total is explicitly tracked now, so we can use that or recalculate global?
    // For consistency with per-task accumulation, let's use the accumulated total.
    // But we can also set the 'esg' field for simplified view if requested.

    summary.esg = {
      parameterScale,
      score: benchmarkAccumulator.eciTotal
    };
  }

  return summary;
}
