
import { FailureLayer, FailureSeverity, FailureCategory } from '../types';

export interface FailureDefinition {
    ruleId: string;
    layer: FailureLayer;
    category: FailureCategory;
    severity: FailureSeverity;
    message: string; // Template
}

// Rule IDs Constants
export const RULE_IDS = {
    RUNTIME: {
        CRASH: 'runtime/crash',
        CONSOLE_ERROR: 'runtime/console',
        NETWORK_FAIL: 'runtime/network',
        TIMEOUT: 'runtime/timeout',
        MANIFEST_MISMATCH: 'runtime/manifest-mismatch',
        EXTERNAL_ACCESS: 'runtime/external-access',
    },
    PARSE: {
        INVALID_JSON: 'parse/json',
        MISSING_TREE: 'parse/tree',
        MISSING_ARTIFACTS: 'parse/artifacts',
    },
    CONNECTIVITY: {
        BROKEN_LINK: 'connectivity/link',
        BROKEN_BINDING: 'connectivity/binding',
        SCHEMA_MISMATCH: 'connectivity/schema',
        ROUTE_CONSISTENCY: 'connectivity/route',
    },
    LINT: {
        ESLINT_A: 'lint/level-a',
        ESLINT_B: 'lint/level-b', // Logic
        ESLINT_C: 'lint/level-c', // Style
    },
    MODEL: {
        NO_OUTPUT: 'model/no-output'
    }
} as const;

// The Registry
export const FAILURE_REGISTRY: Record<string, FailureDefinition> = {
    // Runtime
    [RULE_IDS.RUNTIME.CRASH]: {
        ruleId: RULE_IDS.RUNTIME.CRASH,
        layer: 'L5/BrowserRuntime',
        category: 'runtime',
        severity: 'critical',
        message: 'Browser page crashed or encountered a fatal error'
    },
    [RULE_IDS.RUNTIME.CONSOLE_ERROR]: {
        ruleId: RULE_IDS.RUNTIME.CONSOLE_ERROR,
        layer: 'L5/BrowserRuntime',
        category: 'runtime',
        severity: 'error',
        message: 'Console error detected'
    },
    [RULE_IDS.RUNTIME.NETWORK_FAIL]: {
        ruleId: RULE_IDS.RUNTIME.NETWORK_FAIL,
        layer: 'L5/BrowserRuntime',
        category: 'runtime',
        severity: 'error',
        message: 'Critical network resource failed to load'
    },
    [RULE_IDS.RUNTIME.TIMEOUT]: {
        ruleId: RULE_IDS.RUNTIME.TIMEOUT,
        layer: 'L5/BrowserRuntime',
        category: 'runtime',
        severity: 'error',
        message: 'Execution timed out'
    },
    [RULE_IDS.RUNTIME.MANIFEST_MISMATCH]: {
        ruleId: RULE_IDS.RUNTIME.MANIFEST_MISMATCH,
        layer: 'L5/BrowserRuntime',
        category: 'runtime',
        severity: 'error',
        message: 'Runtime artifacts do not match sandbox manifest'
    },
    [RULE_IDS.RUNTIME.EXTERNAL_ACCESS]: {
        ruleId: RULE_IDS.RUNTIME.EXTERNAL_ACCESS,
        layer: 'L1/Warnings',
        category: 'runtime',
        severity: 'warning',
        message: 'External resource accessed'
    },

    // Parse
    [RULE_IDS.PARSE.INVALID_JSON]: {
        ruleId: RULE_IDS.PARSE.INVALID_JSON,
        layer: 'L4/Parse',
        category: 'parse',
        severity: 'error',
        message: 'File includes invalid JSON'
    },
    [RULE_IDS.PARSE.MISSING_TREE]: {
        ruleId: RULE_IDS.PARSE.MISSING_TREE,
        layer: 'L4/Parse',
        category: 'parse',
        severity: 'error',
        message: 'Required file structure missing'
    },
    [RULE_IDS.PARSE.MISSING_ARTIFACTS]: {
        ruleId: RULE_IDS.PARSE.MISSING_ARTIFACTS,
        layer: 'L4/Parse',
        category: 'parse',
        severity: 'warning',
        message: 'Required artifact files are empty or missing content'
    },

    // Connectivity
    [RULE_IDS.CONNECTIVITY.BROKEN_LINK]: {
        ruleId: RULE_IDS.CONNECTIVITY.BROKEN_LINK,
        layer: 'L3/StaticValidation',
        category: 'connectivity',
        severity: 'error',
        message: 'File reference or link is broken'
    },
    [RULE_IDS.CONNECTIVITY.BROKEN_BINDING]: {
        ruleId: RULE_IDS.CONNECTIVITY.BROKEN_BINDING,
        layer: 'L3/StaticValidation',
        category: 'connectivity',
        severity: 'error',
        message: 'HTML/JS data binding mismatch'
    },
    [RULE_IDS.CONNECTIVITY.SCHEMA_MISMATCH]: {
        ruleId: RULE_IDS.CONNECTIVITY.SCHEMA_MISMATCH,
        layer: 'L3/StaticValidation',
        category: 'connectivity',
        severity: 'error',
        message: 'API Schema not correctly implemented in code'
    },
    [RULE_IDS.CONNECTIVITY.ROUTE_CONSISTENCY]: {
        ruleId: RULE_IDS.CONNECTIVITY.ROUTE_CONSISTENCY,
        layer: 'L3/StaticValidation',
        category: 'connectivity',
        severity: 'error',
        message: 'Route configuration is inconsistent'
    },

    // Lint
    [RULE_IDS.LINT.ESLINT_A]: {
        ruleId: RULE_IDS.LINT.ESLINT_A,
        layer: 'L2/CodeQuality',
        category: 'lint',
        severity: 'error',
        message: 'Critical code quality issue (Level A)'
    },
    [RULE_IDS.LINT.ESLINT_B]: {
        ruleId: RULE_IDS.LINT.ESLINT_B,
        layer: 'L2/CodeQuality',
        category: 'lint',
        severity: 'warning',
        message: 'Code quality warning (Level B)'
    },
    [RULE_IDS.LINT.ESLINT_C]: {
        ruleId: RULE_IDS.LINT.ESLINT_C,
        layer: 'L2/CodeQuality',
        category: 'lint',
        severity: 'info',
        message: 'Style suggestion (Level C)'
    },

    // Model
    [RULE_IDS.MODEL.NO_OUTPUT]: {
        ruleId: RULE_IDS.MODEL.NO_OUTPUT,
        layer: 'L1/Model',
        category: 'model',
        severity: 'error',
        message: 'Model failed to generate output'
    }
};

// Helper: Get definition or throw (Strict Registry enforcement)
export function getFailureDef(ruleId: string): FailureDefinition {
    const def = FAILURE_REGISTRY[ruleId];
    if (!def) {
        throw new Error(`[FailureRegistry] Unknown Rule ID: ${ruleId}`);
    }
    return def;
}
