/**
 * ESG (Environmental, Social, and Governance) Evaluation Module
 *
 * Implements the Eval Compute Index (ECI) calculation.
 *
 * DEFINITION:
 * ECI = (Eval-Time Token Usage * Parameter Scale) / 10000
 *
 * DESIGN PHILOSOPHY ("Frozen Definition"):
 * 1. Deterministic: Same inputs always yield same output.
 * 2. Side-Effect Free: No IO, no global state access.
 * 3. Isolated: Independent of quality scores (accuracy, structure, etc.).
 * 4. Observable: Derived purely from metadata (tokens, model scale).
 */

export interface ECIInput {
    evalTokens: number;
    parameterScale?: number;
}

/**
 * Computes the Eval Compute Index (ECI).
 * Formula: (evalTokens * parameterScale) / 10000
 *
 * @param input - Object containing evalTokens and optional parameterScale
 * @returns The computed ECI score or null if parameterScale is missing/invalid or input is invalid
 */
export function computeECI({ evalTokens, parameterScale }: ECIInput): number | null {
    // 1. Validation (Fail safe)
    if (
        parameterScale === undefined ||
        parameterScale === null ||
        typeof parameterScale !== 'number' ||
        isNaN(parameterScale) ||
        parameterScale < 0
    ) {
        return null;
    }

    if (typeof evalTokens !== 'number' || isNaN(evalTokens) || evalTokens < 0) {
        return 0; // Usage 0 is valid, negative is treated as 0 (sanitization)
    }

    // 2. Frozen Formula Calculation
    // ECI = (Tokens * Params) / 10k
    const rawScore = (evalTokens * parameterScale) / 10000;

    // 3. Precision Handling (Optional but good for determinism)
    // Returning raw float is usually fine, but let's keep it clean.
    return rawScore;
}
