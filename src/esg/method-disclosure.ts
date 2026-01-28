/**
 * ESG Method Disclosure Block
 * FIXED DISCLOSURE - IMMUTABLE
 *
 * This block defines the invariant principles and formulas used for
 * ESG (Environmental, Social, and Governance) impact estimation.
 * It does NOT contain runtime values.
 */

export interface ESGMethodDisclosure {
    readonly methodologyVersion: string;
    readonly definition: {
        readonly metricName: string;
        readonly formula: string;
        readonly unit: string;
    };
    readonly principles: {
        readonly orthogonality: string;
        readonly nonPunitive: string;
        readonly reproducibility: string;
    };
    readonly freezingDeclaration: string;
}

export const FIXED_ESG_DISCLOSURE: ESGMethodDisclosure = {
    methodologyVersion: "1.0.0-frozen",
    definition: {
        metricName: "Eval Compute Index (ECI)",
        formula: "ECI = (EvalTokens * ParameterScale) / 10000",
        unit: "Dimensionless Index (Linear Proxy for Eval-Time Compute)"
    },
    principles: {
        orthogonality: "ECI is mathematically orthogonal to Quality Score. High ECI != Low Quality.",
        nonPunitive: "ECI is a disclosure of cost, not a penalty on performance.",
        reproducibility: "ECI implies instantaneous evaluation cost, assuming deterministic token usage."
    },
    freezingDeclaration: "This methodology is empirically validated and frozen. No runtime parameters affect this definition."
} as const;
