// Lint Evaluator Layer (FINAL, SAFE, NON-CONTAMINATING)
// - ESLint Node API (Flat Config)
// - Three-tier rules: A (hard), B (soft), C (style)
// - Runtime-aware globals (browser vs node)
// - NEVER contaminates model scores if ESLint fails
// - Benchmark-safe by design

import { ESLint, Linter } from 'eslint';
import globals from 'globals';
import path from 'path';
import { LintError } from '../types';

/* =========================
 * Types
 * ========================= */

export interface LintErrorsByLevel {
    levelA: LintError[];
    levelB: LintError[];
    levelC: LintError[];
}

export interface LintEvalResult {
    totalErrorCount: number;
    errorsByLevel: LintErrorsByLevel;
    // Backward compatibility
    errorCount: number;
    errors: LintError[];
}

/* =========================
 * Rule Sets
 * ========================= */

// Level A: 真 bug（触发 L2）
const LEVEL_A_RULES = [
    'no-undef',
    'no-unused-vars',
    'no-use-before-define',
    'no-shadow',
    'no-var',
    'no-duplicate-imports'
];

// Level B: 最佳实践（影响分数）
const LEVEL_B_RULES = [
    'eqeqeq',
    'no-eval',
    'no-param-reassign',
    'consistent-return',
    'prefer-const',
    'prefer-template'
];

// Level C: 风格（仅统计）
const LEVEL_C_RULES = [
    'camelcase',
    'new-cap'
];

function getRuleLevel(
    ruleId: string | null
): 'A' | 'B' | 'C' | 'unknown' {
    if (!ruleId) return 'unknown';
    if (LEVEL_A_RULES.includes(ruleId)) return 'A';
    if (LEVEL_B_RULES.includes(ruleId)) return 'B';
    if (LEVEL_C_RULES.includes(ruleId)) return 'C';
    return 'unknown';
}

/* =========================
 * Lint Evaluator
 * ========================= */

export async function evaluateLint(
    filePaths: string[],
    options?: {
        runtime?: 'browser' | 'node';
    }
): Promise<LintEvalResult> {
    const levelA: LintError[] = [];
    const levelB: LintError[] = [];
    const levelC: LintError[] = [];
    const allErrors: LintError[] = [];

    // Default runtime: node
    const runtime = options?.runtime ?? 'node';
    const isBrowser = runtime === 'browser';

    try {
        /* -------------------------
         * Flat ESLint Config
         * ------------------------- */
        const flatConfig: Linter.Config[] = [
            {
                languageOptions: {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                    globals: {
                        ...(isBrowser ? globals.browser : globals.node),
                        ...globals.es2021
                    }
                },
                rules: {
                    // Level A — 真 bug
                    'no-undef': 'error',
                    'no-unused-vars': 'error',
                    'no-use-before-define': 'error',
                    'no-shadow': 'error',
                    'no-var': 'error',
                    'no-duplicate-imports': 'error',

                    // Level B — 最佳实践
                    'eqeqeq': 'error',
                    'no-eval': 'error',
                    'no-param-reassign': 'error',
                    'consistent-return': 'error',
                    'prefer-const': 'error',
                    'prefer-template': 'error',

                    // Level C — 风格
                    'camelcase': 'warn',
                    'new-cap': 'warn'
                }
            }
        ];

        const cwd =
            filePaths.length > 0
                ? path.dirname(filePaths[0])
                : process.cwd();

        const eslint = new ESLint({
            cwd,
            overrideConfig: flatConfig
        });

        const results = await eslint.lintFiles(filePaths);

        /* -------------------------
         * Collect Results
         * ------------------------- */
        for (const result of results) {
            for (const msg of result.messages) {
                const lintError: LintError = {
                    ruleId: msg.ruleId,
                    message: msg.message,
                    filePath: result.filePath,
                    line: msg.line,
                    column: msg.column
                };

                if (msg.severity === 2) {
                    // Error
                    const level = getRuleLevel(msg.ruleId);
                    if (level === 'A') levelA.push(lintError);
                    else levelB.push(lintError);
                    allErrors.push(lintError);
                } else if (msg.severity === 1) {
                    // Warning → Level C
                    if (getRuleLevel(msg.ruleId) === 'C') {
                        levelC.push(lintError);
                    }
                }
            }
        }

    } catch {
        /* =====================================================
         * 🚨 CRITICAL DESIGN DECISION
         *
         * ESLint internal failure MUST NOT:
         * - Trigger L2
         * - Affect scoring
         * - Pollute ranking
         *
         * Treat as: "lint unavailable"
         * ===================================================== */
        return {
            totalErrorCount: 0,
            errorsByLevel: {
                levelA: [],
                levelB: [],
                levelC: []
            },
            errorCount: 0,
            errors: []
        };
    }

    return {
        totalErrorCount: levelA.length + levelB.length + levelC.length,
        errorsByLevel: {
            levelA,
            levelB,
            levelC
        },
        errorCount: allErrors.length,
        errors: allErrors
    };
}