/**
 * Calculates Kendall's Tau Rank Correlation Coefficient.
 * @param x First array of numbers (e.g., Benchmark Scores)
 * @param y Second array of numbers (e.g., FORGE Task Scores)
 * @returns Tau value in [-1, 1], or NaN if inputs invalid.
 */
export function calculateKendallTau(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return NaN;

    let concordant = 0;
    let discordant = 0;
    const n = x.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const xDiff = x[i] - x[j];
            const yDiff = y[i] - y[j];

            // Tie handling: strictly speaking, ties reduce denominator in Tau-b.
            // For simplicity (Tau-a), we skip ties or handle them as 0 contribution.
            // A more robust Tau-b handles ties in x and y separately.

            // Standard simplified implementation for now:
            const signX = Math.sign(xDiff);
            const signY = Math.sign(yDiff);

            if (signX === 0 || signY === 0) {
                // Ignore ties for basic rank trend matching
                continue;
            }

            if (signX === signY) {
                concordant++;
            } else {
                discordant++;
            }
        }
    }

    // Tau-a denominator: n * (n - 1) / 2
    // If we have many ties, we should use Tau-b, but for model rankings (usually varying float scores), ties are rare.
    const totalPairs = (n * (n - 1)) / 2;
    if (totalPairs === 0) return 0;

    // Adjust for the fact we skipped ties in numerator... 
    // Actually, let's just stick to (C - D) / (C + D) for visualized trend strength, 
    // or (C - D) / TotalPairs. Let's use (C - D) / TotalPairs which is standard Tau-a.
    // However, if we skip ties in loop, we must be careful.

    // Let's implement Tau-b for safety.
    let tieX = 0;
    let tieY = 0;

    // Re-loop for ties
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (x[i] === x[j]) tieX++;
            if (y[i] === y[j]) tieY++;
        }
    }

    const denom = Math.sqrt((totalPairs - tieX) * (totalPairs - tieY));

    if (denom === 0) return 0; // Avoid division by zero if all scores are identical

    return (concordant - discordant) / denom;
}

/**
 * Calculates a Confidence Interval for Tau.
 * Note: Exact CI for Tau is complex. This uses a standard normal approximation.
 */
export function calculateTauCI(tau: number, n: number, confidence = 0.95): { low: number, high: number } {
    if (n < 4) return { low: tau, high: tau }; // Too few samples for CI

    // Variance approximation for Tau under null hypothesis (independence):
    // var = 2(2n+5) / (9n(n-1))
    // But we want CI around estimated tau. 
    // Simplified standard error for non-null tau is complex (Long & Cliff, 1997).

    // Fallback: Use simple sampling error approximation roughly 1/sqrt(n-3) scaled.
    // Or standard Fisher Z-transformation adapted for Tau? No, that's for Pearson.

    // Let's use the variance of S (numerator) under null hypothesis as a conservative estimate width.
    // sigma_tau = sqrt( 2*(2n+5) / (9*n*(n-1)) )
    const sigma = Math.sqrt((2 * (2 * n + 5)) / (9 * n * (n - 1)));
    const z = 1.96; // 95%

    const margin = z * sigma;
    return {
        low: Math.max(-1, tau - margin),
        high: Math.min(1, tau + margin)
    };
}
