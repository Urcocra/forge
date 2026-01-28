# "The Orthogonality Trap" - ESG Validation Experiment

## 1. Goal
Prove conclusively that **ECI (Eval Compute Index)** and **Quality Score** are independent variables in the FORGE evaluation system.

## 2. The Four Quadrants (Deterministic Design)

We utilize `MOCK_TOKEN_USAGE` and `MOCK_QUALITY_GAP` to deterministically force every run into one of four quadrants.

| Quadrant | Scenario Name | Quality (Score) | ECI (Cost) | Settings |
| :--- | :--- | :--- | :--- | :--- |
| **Q1** | **Efficient Genius** | **High** (~100) | **Low** (<1) | `GAP=0`, `TOKENS=1000`, `SCALE=1e9` |
| **Q2** | **Brute Force** | **High** (~100) | **High** (>1M) | `GAP=0`, `TOKENS=100000`, `SCALE=1e11` |
| **Q3** | **Cheap Failure** | **Low** (<50) | **Low** (<1) | `GAP=0.5`, `TOKENS=1000`, `SCALE=1e9` |
| **Q4** | **Expensive Failure** | **Low** (<50) | **High** (>1M) | `GAP=0.5`, `TOKENS=100000`, `SCALE=1e11` |

## 3. Expected Phenomena (Proof of Orthogonality)

1.  **Q1 vs Q2 (Cost Indifference)**:
    *   $\Delta Score \approx 0$ (Identical quality)
    *   $\Delta ECI \gg 0$ (Massive cost difference)
    *   *Proof*: High ECI does not buy higher quality.

2.  **Q1 vs Q3 (Quality Indifference)**:
    *   $\Delta ECI \approx 0$ (Identical cost)
    *   $\Delta Score \gg 0$ (Massive quality difference)
    *   *Proof*: Low cost does not imply low quality.

3.  **Q2 vs Q4 (The "Fatal" Trap)**:
    *   ECI is identical (High).
    *   Score drops significantly in Q4.
    *   *Proof*: High ECI offers no protection against correctness failure.

## 4. Verification Logic (Deterministic Script)

To certify the system "Orthogonal", the following assertions MUST pass:

```typescript
// Pseudo-code for verification script
const results = await runAllQuadrants();

// 1. ECI Independence
assert(results.Q1.score === results.Q2.score, "Score should not be affected by ECI");
assert(results.Q1.eci !== results.Q2.eci, "ECI must reflect scale/tokens");

// 2. Quality Independence
assert(results.Q1.eci === results.Q3.eci, "ECI should not be affected by Score");
assert(results.Q1.score !== results.Q3.score, "Score must reflect quality gap");

// 3. The Orthogonality Check
// In this specific 2x2 matrix, correlation between Score and ECI must be 0.
```
