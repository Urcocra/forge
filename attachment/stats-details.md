# Statistical Details

This document specifies the statistical methodology used in FORGE.

## 1. FERPS Dimension Calculations

The five dimensions are calculated deterministically for each run $i$ of model $m$.

### F - Functionality
$$ F_i = \frac{\text{Score}_i}{100} $$
*Range*: $[0, 1]$. Derived directly from the static + runtime score.

### E - Engineering (Efficiency)
Relative efficiency compared to the model's average execution time $\mu_T^{(m)}$.
$$ E_i = \frac{1}{1 + \frac{T_i}{\mu_T^{(m)}}} $$
*Range*: $(0, 1]$.
*   $T_i = \mu_T^{(m)} \implies E_i = 0.5$
*   $T_i \to 0 \implies E_i \to 1.0$

### R - Resilience (Score Stability)
Measures how stable the score is relative to the model's mean performance.
$$ R_i = \max\left(0, 1 - \frac{|\text{Score}_i - \mu_S^{(m)}|}{50}\right) $$
*Interpretation*: A run that deviates significantly from the model's average (high variance) receives a low R score.
*   $\text{Score}_i = \mu_S^{(m)} \implies R_i = 1.0$
*   Deviation of 50 points $\implies R_i = 0.0$

### P - Product Quality
Penalized by static errors ($C_{L1}, C_{L2}, C_{L3}$) and runtime failures ($C_{L4}$).
$$ P_i = \max(0, 1 - (0.05 C_{L1} + 0.2 C_{L2} + 0.5 C_{L3} + 1.0 C_{L4})) $$

### S - Situatedness (Security)
Penalized by security violations $V_{sec}$.
$$ S_i = \max(0, 1 - V_{sec}) $$

## 2. Rank Correlation (Kendall's $\tau$)
Used for Figure 1 (Validity Window).

$$ \tau = \frac{C - D}{\sqrt{(n_0 - n_1)(n_0 - n_2)}} $$
Where:
*   $C$: Number of concordant pairs
*   $D$: Number of discordant pairs
*   Ties are handled using the Tau-b formulation to account for precision limits.
