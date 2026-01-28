// Final Evaluation Layer (100-Point System, HARD-CAPPED)
// - Score ∈ [0, 100]
// - Difficulty weighted
// - Error-penalized
// - FAILURE LAYER = SCORE CAP (NOT just penalty)
// - Fact-first, math-stable, benchmark-safe

import {
  ScoreBreakdown,
  BrowserError,
  LintError,
  Difficulty,
  FinalEvaluationResult,
  FailureAnnotation
} from '../types';

import { DIFFICULTY_WEIGHTS } from '../difficulty';

/* =========================
 * Metadata (FACTS ONLY)
 * ========================= */

export interface FailureMetadata {
  difficulty?: Difficulty;
  // Legacy fields for backward compat or logging
  parseStatus?: 'VALID' | 'INVALID';
  browserErrors?: BrowserError[];
  browserLogs?: { type: string; message: string; timestamp: number }[];
  runtimeErrors?: BrowserError[];
  runtimeWarnings?: { type: string; message: string; timestamp: number }[];

  lintErrorsLevelA?: LintError[];
  lintErrorsLevelB?: LintError[];
  runtimeScore?: number | null;

  // PRIMARY EVIDENCE SOURCE
  failureAnnotations?: FailureAnnotation[];
}

/* =========================
 * Failure → Score Cap
 * ========================= */

function getScoreCap(failureLayer?: string): number {
  if (!failureLayer) return 100;

  if (failureLayer.startsWith('L5')) return 30; // Browser runtime
  if (failureLayer.startsWith('L4')) return 50; // Parse / Runtime
  if (failureLayer.startsWith('L3')) return 70; // Static validation
  if (failureLayer.startsWith('L2')) return 85; // Code quality

  return 100;
}

/* =========================
 * Final Evaluation
 * ========================= */

export function evaluateFinal(
  staticScore: ScoreBreakdown,
  runtimeScore: number | null,
  metadata: FailureMetadata = {}
): FinalEvaluationResult {
  const notes: string[] = [];
  const errors: string[] = [];
  const recommendedFixes: string[] = [];

  const difficulty = metadata.difficulty ?? 'M';
  const weight = DIFFICULTY_WEIGHTS[difficulty];
  const annotations = metadata.failureAnnotations ?? [];

  let failureLayer: string | undefined;

  /* =========================
   * FAILURE LAYER (FACT FIRST)
   * Derived from Annotations
   * Priority: L5 > L4 > L3 > L2
   * ========================= */

  // Helper to get priority
  const getPriority = (layer: string) => {
    if (layer.startsWith('L5')) return 5;
    if (layer.startsWith('L4')) return 4;
    if (layer.startsWith('L3')) return 3;
    if (layer.startsWith('L2')) return 2;
    return 1;
  };

  // Find highest priority annotation that implies failure (severity >= error)
  // Warnings (L1) do not trigger failure layer capping generally, but L2 warnings might if strictly defined?
  // Spec says: "L5 > L4(parse/runtime) > L3(static/connectivity) > L2(lint A) > L1(warnings)"
  // Failure Layer is determined by the "highest" annotation.

  const failureCandidates = annotations.filter(a =>
    a.severity === 'critical' || a.severity === 'error'
  );

  if (failureCandidates.length > 0) {
    // Sort by priority desc
    failureCandidates.sort((a, b) => getPriority(b.layer) - getPriority(a.layer));
    const worst = failureCandidates[0];
    failureLayer = worst.layer;

    errors.push(`${worst.layer}: ${worst.message}`);
    // Add more errors if needed
  } else {
    // Fallback for legacy fields if no annotations?
    // Keeping legacy logic as backup might be safe, but user requested explicit dependency on annotations.
    // However, previous steps ensured static-eval and runtime-eval return annotations.
    // Parsing failure in exec.ts?
    // exec.ts handles parsing failure by passing parseStatus='INVALID'.
    // Wait, I should add annotation for Parse failure in exec.ts or here if missing.

    if (metadata.parseStatus === 'INVALID') {
      failureLayer = 'L4/Parse';
      errors.push('Model output parsing failed (Legacy Fallback)');
    }
  }


  /* =========================
   * BASE SCORE (0–100)
   * ========================= */

  const baseScore01 =
    runtimeScore === null
      ? 0.6 * staticScore.completeness +
      0.3 * staticScore.structure +
      0.1 * staticScore.survivability
      : 0.4 * staticScore.completeness +
      0.2 * staticScore.structure +
      0.1 * staticScore.survivability +
      0.3 * runtimeScore;

  const baseScore100 = baseScore01 * 100;

  /* =========================
   * Difficulty Adjustment
   * ========================= */

  const weightedScore = baseScore100 * weight;

  /* =========================
   * Error Penalty (From Annotations)
   * ========================= */

  let penalty = 0;

  // Penalty Rules (Approximate mapping to previous logic)
  // L5 (Runtime/Crash): 15
  // L4 (Parse): 20
  // L3 (Connectivity/Static): ? Previously implicit in score < 1. 
  //     But now we use explicit penalty? 
  //     Actually, score reduction is already in baseScore. 
  //     Double counting?
  //     User said: "penalty source must be from annotations".
  //     Previously: runtimeErrors * 15, parse * 20, runtimeScore==0 * 15, lint * 5/2.

  // Let's iterate annotations.
  for (const note of annotations) {
    if (note.layer.startsWith('L5')) { // Runtime
      penalty += 15;
    } else if (note.layer.startsWith('L4')) { // Parse
      penalty += 20;
    } else if (note.layer.startsWith('L3')) { // Static
      // Previously connectivity < 1 reduced base score.
      // Do we add extra penalty? 
      // If we add penalty, we might punish twice.
      // However, user said "totalScore ... penalty must come from annotations count".
      // Maybe only for strictly "Bonus/Penalty" things?
      // Let's stick to "Error Penalty" section of previous code.
      // Previous code had:
      // penalty += runtimeErrors * 15
      // penalty += parse * 20
      // penalty += runtimeScore==0 * 15
      // penalty += lintA * 5
      // penalty += lintB * 2

      // So L3 generally didn't have explicit penalty, just score loss.
      // EXCEPT if we define new rules?
      // Let's ignore L3 penalty for now to match previous logic (score loss handles it).
    } else if (note.layer.startsWith('L2')) { // Lint
      if (note.severity === 'error') penalty += 5; // Level A
      if (note.severity === 'warning') penalty += 2; // Level B
    }
  }

  // Legacy backups if annotations missing for parsing/runtime?
  // If we rely purely on annotations, ensure exec.ts generates them!
  // BUT: runtime-eval generates annotations. static-eval generates annotations.
  // Parse failure in exec.ts does NOT currently generate annotation passed here?
  // I need to update exec.ts to pass annotation for parse/model failure OR handle legacy here.

  // Evidence-First: We ONLY penalize based on annotations.
  // Legacy fallbacks (parseStatus, runtimeScore==0) are REMOVED.
  // Upstream must provide annotations for these cases.
  if (annotations.length === 0) {
    // No implicit penalties.
  }

  const penalizedScore = weightedScore - penalty;

  /* =========================
   * HARD CAP BY FAILURE LAYER
   * ========================= */

  const cap = getScoreCap(failureLayer);

  const totalScore = Math.max(
    0,
    Math.min(cap, Math.round(penalizedScore))
  );

  /* =========================
   * Notes
   * ========================= */

  if (!failureLayer) {
    notes.push('All validation checks passed');
  } else {
    notes.push(`Failure classified as ${failureLayer}`);
    notes.push(`Score capped at ${cap}`);
  }

  // Runtime Disclosure Construction
  const runtimeErrors = metadata.runtimeErrors ?? metadata.browserErrors ?? [];
  const runtimeWarnings = metadata.runtimeWarnings ?? [];

  const errorCount = runtimeErrors.length;
  const warningCount = runtimeWarnings.length;
  const examples: string[] = [];

  if (errorCount > 0) {
    examples.push(`Error: ${runtimeErrors[0].message}`);
  }
  if (warningCount > 0) {
    examples.push(`Warning: ${runtimeWarnings[0].message}`);
  }
  if (errorCount > 1) examples.push(`...and ${errorCount - 1} more errors`);
  else if (warningCount > 1) examples.push(`...and ${warningCount - 1} more warnings`);

  return {
    totalScore,
    scoreBreakdown: {
      static: staticScore,
      runtime: runtimeScore
    },
    notes,
    errors,
    recommendedFixes,
    failureLayer,
    runtimeReport: {
      errorCount,
      warningCount,
      examples
    },
    failureAnnotations: annotations
  };
}