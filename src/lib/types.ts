// src/lib/types.ts
import { SandboxManifest } from '../types/sandbox';
import { RuntimeExternalAccess } from '../types/audit';

// ============================================================
// FORGE Core Types (Single Source of Truth)
// - Shared interfaces across execution, evaluation, runtime
// - Descriptive, non-normative by design
// ============================================================

/* =========================
 * Difficulty / Task
 * ========================= */

export type Difficulty = 'XS' | 'S' | 'M' | 'L' | 'XL';

export interface TreeRules {
  requiredFiles: string[];
  optionalFiles?: string[];
}

export interface QuestionSpec {
  qid: string;
  description: string;
  expectedArtifacts: string[];
  treeRules: TreeRules;
  runtime?: Record<string, any>;
}

export interface TaskSpec {
  id: string;
  size: Difficulty;
  question: QuestionSpec;
  questionPoolSize: number;

  runtime?: {
    type?: 'browser' | 'node';
    buildCommand?: string;
    entry?: string;
  };

  /**
   * ⏱️ Optional descriptive time budget (milliseconds)
   * - Not used for scoring
   * - Used only for feasibility / analysis
   */
  timeBudgetMs?: number;
}

/* =========================
 * File Tree / Artifacts Contracts
 * ========================= */

export interface FileTreeSpec {
  files: Array<{ path: string; type: string }>;
}

export interface FileArtifactsSpec {
  files: Record<string, string>;
}

export interface CombinedModelOutput {
  tree: FileTreeSpec;
  artifacts: FileArtifactsSpec;
  raw: string;
}

/* =========================
 * Tree Phase Output (Discriminated Union)
 * ========================= */

export type TreePhaseOutput =
  | {
    success: true;
    tree: FileTreeSpec;
    rawModelOutput: string;
    logs: string[];
  }
  | {
    success: false;
    error: string;
    rawModelOutput: string;
    details?: string;
    logs: string[];
  };

/* =========================
 * Model Interface
 * ========================= */

export interface ModelRequest {
  taskId: string;
  size: Difficulty;
  description: string;
  expectedArtifacts: string[];
  hints?: string;
  phase: 'tree' | 'files';
}

export interface ModelGenerateFnOutput {
  tree?: FileTreeSpec;
  artifacts?: FileArtifactsSpec;
  logs: string[];
  usage?: {
    totalTokens: number;
  };
}

export type ModelGenerateFn = (req: ModelRequest) => Promise<ModelGenerateFnOutput>;

export interface RunOptions {
  parameterScale?: number;
}

/* =========================
 * Parsing
 * ========================= */

export interface ParsedModelOutput {
  tree: FileTreeSpec;
  artifacts?: FileArtifactsSpec;
  logs: string[];
  raw: string;
  errors?: string[];
}

/* =========================
 * Time Tracking
 * ========================= */

/**
 * Time tracking for a single phase
 */
export interface PhaseTimeTracking {
  predictedMs: number;
  actualMs: number;
  completedInPredictedTime: boolean;
  startTime: string;
  endTime: string;
}

/**
 * Time tracking for an entire task
 */
export interface TaskTimeTracking {
  total: PhaseTimeTracking;
  phases: Record<string, PhaseTimeTracking>;
}

/* =========================
 * Logging
 * ========================= */

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

/* =========================
 * Execution Artifacts / Result
 * ========================= */

export interface ExecutionArtifacts {
  html: string;
  logs: LogEntry[];
  errors?: string[];
  files?: Record<string, string>;

  // Optional evaluation fields
  lintErrors?: number;
  browserErrors?: { type: string; message: string }[];
  browserLogs?: { type: string; text: string }[];
}

export interface ExecutionResult {
  artifacts: ExecutionArtifacts;
  logs: LogEntry[];

  /**
   * Metadata is intentionally open:
   * - time
   * - tree
   * - scores
   * - hashes
   * - reproducibility anchors
   */
  metadata: Record<string, any>;
}

/* =========================
 * Scoring
 * ========================= */

/**
 * Lint error information (JSON serializable)
 */
export interface LintError {
  ruleId: string | null;
  message: string;
  filePath: string;
  line?: number;
  column?: number;
}

export interface ScoreBreakdown {
  completeness: number;
  structure: number;
  survivability: number;
  connectivity: number;
  connectivityBreakdown?: ConnectivityBreakdown;

  // Lint errors by level
  lintErrorsLevelA?: LintError[]; // Hard errors - trigger L2 Failure
  lintErrorsLevelB?: LintError[]; // Soft errors - affect scoring
  lintErrorsLevelC?: LintError[]; // Style only - reporting

  lintErrorCount?: number; // Total count for backward compatibility
  lintErrors?: LintError[]; // Deprecated but kept for compatibility

  timeTracking?: PhaseTimeTracking;
  failureAnnotations: FailureAnnotation[];
  sandboxManifest?: SandboxManifest;
}

export interface ConnectivityBreakdown {
  fileReference: 0 | 0.5 | 1;
  scriptBinding: 0 | 0.5 | 1;
  apiSchemaLinkage: 0 | 0.5 | 1;
  routeConsistency: 0 | 0.5 | 1;
}

export interface EvalComputeIndexResult {
  rawTokens: number;
  parameterScale: number;
  eci: number;
}

export interface FinalEvaluationResult {
  totalScore: number;
  scoreBreakdown: {
    static: ScoreBreakdown;
    runtime: number | null;
  };
  notes: string[];
  errors: string[];
  recommendedFixes: string[];

  // Optional evaluation fields
  lintErrors?: number;
  browserErrors?: { type: string; message: string }[];
  browserLogs?: { type: string; text: string }[];
  failureLayer?: string;
  eci?: EvalComputeIndexResult;
  infrastructureTimeout?: boolean;

  // Runtime disclosure (does not affect score directly, provided for transparency)
  runtimeReport?: {
    errorCount: number;
    warningCount: number;
    examples: string[];
  };

  /**
   * 🛑 Failure Annotations (Unified Evidence)
   * - Single source of truth for "Why did this fail?"
   * - Decoupled from formatted notes/errors
   */
  failureAnnotations: FailureAnnotation[];
}

/* =========================
 * Failure Annotations
 * ========================= */

export type FailureLayer =
  | 'L1/Model'
  | 'L1/Warnings'
  | 'L2/CodeQuality'
  | 'L3/StaticValidation'
  | 'L4/Parse'
  | 'L5/BrowserRuntime';

export type FailureSeverity = 'critical' | 'error' | 'warning' | 'info';

export type FailureCategory = 'connectivity' | 'lint' | 'runtime' | 'parse' | 'model';

export interface FailureEvidence {
  missingFiles?: string[];
  referencedFiles?: string[];
  entry?: string;
  filesMounted?: string[];
  hashMismatchList?: string[];
  access?: RuntimeExternalAccess;
  url?: string;
  stack?: string;
  expected?: string;
  observed?: string;
  [key: string]: any;
}

export interface BaseFailureAnnotation {
  ruleId: string;
  severity: FailureSeverity;
  layer: FailureLayer;
  category: FailureCategory;
  message: string;
  filePath?: string;
  /**
   * 0-indexed line/column range
   */
  span?: {
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
  evidence?: FailureEvidence;
}

export interface StaticFailureAnnotation extends BaseFailureAnnotation {
  layer: 'L2/CodeQuality' | 'L3/StaticValidation' | 'L4/Parse';
  category: 'lint' | 'connectivity' | 'parse';
}

export interface RuntimeFailureAnnotation extends BaseFailureAnnotation {
  layer: 'L5/BrowserRuntime' | 'L1/Warnings';
  category: 'runtime';
  timestamp?: number;
}

export interface GeneralFailureAnnotation extends BaseFailureAnnotation {
  layer: 'L1/Model' | 'L1/Warnings';
  category: 'model' | 'runtime';
}

export type FailureAnnotation = StaticFailureAnnotation | RuntimeFailureAnnotation | GeneralFailureAnnotation;

/* =========================
 * ESG Annotations
 * ========================= */

export interface EsgAnnotation {
  taskId: string;
  size: Difficulty;
  evalTokens: number;
  parameterScale: number;
  eciIndex: number;
}

/* =========================
 * Sandbox / Runtime
 * ========================= */

/**
 * Browser error information (JSON serializable)
 */
export interface BrowserError {
  type: 'console.error' | 'pageerror' | 'network';
  timestamp: number;
  message: string;
  url?: string;
  status?: number;
}

/**
 * Browser log entry (JSON serializable)
 */
export interface BrowserLog {
  type: 'console.log' | 'console.warn' | 'console.info';
  timestamp: number;
  message: string;
}

export interface SandboxResult {
  manifest?: SandboxManifest;
  externalAccess?: RuntimeExternalAccess[];
  serverUrl?: string;
  logs: string[];
  success: boolean;

  /**
   * Critical failures that force a 0 score
   * Mapped from: browserErrors, failed infrastructure
   */
  runtimeErrors?: BrowserError[];

  /**
   * Non-fatal issues to be disclosed in the report
   * Mapped from: browserLogs (console.warn)
   */
  runtimeWarnings?: BrowserLog[];

  // Legacy fields (kept for backward compatibility)
  browserErrors?: BrowserError[];
  browserLogs?: BrowserLog[];
}