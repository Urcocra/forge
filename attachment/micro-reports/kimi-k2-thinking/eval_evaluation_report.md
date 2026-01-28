# FORGE Evaluation Report

**Model:** moonshotai/kimi-k2-thinking
**Parameter Scale:** 32.0B
**Date:** 2026-01-28T01:23:33.267Z
**Run ID:** AGGREGATED

---

## 1. Capability Performance (Quality Axis)

**Final Quality Score:** 65 / 100

This score measures functional task-solving capability only.
It is computed without access to any compute, token, or ESG data.

**What this score answers:**
*   Did the artifacts satisfy the specification?
*   Did the code survive static and runtime validation?
*   Were cross-file contracts respected?

### Quality Subscores

| Dimension | Meaning | Score |
| :--- | :--- | :--- |
| Completeness | Required artifacts present & non-empty | 0.80 |
| Structure | Syntactic & format validity | 0.70 |
| Survivability | Plausible execution readiness | 0.60 |
| Connectivity | Cross-file semantic linkage | 0.53 |

> ⚠️ These dimensions are scored before any ESG or compute metric is calculated.

---

## 2. Environmental Cost (Compute Axis)

**Eval Compute Index (ECI):** 407,097,600,000

ECI is a physical disclosure, not a performance metric.

**It answers only:**
*   How much computation occurred during evaluation?
*   How large was the evaluated model?

### ECI Definition (Frozen)

$$ ECI = \frac{\text{Total Eval Tokens} \times \text{Parameter Scale}}{10,000} $$

### Compute Breakdown

| Metric | Value |
| :--- | :--- |
| **Total Eval Tokens** | 127,218 |
| **Parameter Scale** | 32.0B |
| **ECI Unit** | Dimensionless (Linear Proxy for Eval-Time Compute) |


---

## 3. Orthogonality Declaration (Critical)

Quality and Compute are mathematically independent axes.

| ❌ Common Fallacy | ✅ Correct Interpretation |
| :--- | :--- |
| "High ECI should reduce the score." | False. Quality is already finalized when ECI is computed. |
| "Low ECI means a better model." | False. Low ECI only means lower cost, not correctness. |
| "50 score + low ECI is acceptable." | Context-dependent. Tradeoffs are user decisions, not benchmark decisions. |

This benchmark enforces orthogonality by design.
No scoring path allows ECI to influence Quality.

---

## 4. Task-Level Outcome Matrix

| Task | Difficulty | Quality Score | Eval Tokens | ECI (M) | Interpretation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| xs_task      | XS   | 60  | 5528   | 0.0M | ✅ Efficient Success |
| s_task       | S    | 80  | 6664   | 0.0M | ✅ Efficient Success |
| m_task       | M    | 47  | 38035  | 0.0M | ✅ Efficient Success |
| l_task       | L    | 74  | 64995  | 0.0M | ✅ Efficient Success |
| xl_task      | XL   | 0   | 14036  | 0.0M | ✅ Efficient Success |

### Quadrant Legend
*   ✅ **Efficient Success** — Correct + Low Cost
*   ⚠️ **Brute Force Success** — Correct + High Cost
*   ❌ **Cheap Failure** — Incorrect + Low Cost
*   💀 **Expensive Failure** — Incorrect + High Cost

These quadrants are observational, not judgmental.

---

## 5. ESG Method Disclosure (Fixed)

**Methodology Version:** 1.0.0-frozen
**Status:** 🔒 Frozen

*   **Non-Punitive:** ESG metrics never modify scores
*   **Orthogonal:** Compute ≠ Quality
*   **Reproducible:** Deterministic under fixed config

This disclosure block is invariant across runs and models.

---

## 6. Runtime External Access Summary

This section records resource access during runtime (scripts, fetch, XHR).
**These accesses do not affect quality scores.**

{% if runtimeExternalAccess.length > 0 %}
| Type | Target | Resolved | Time |
| :--- | :--- | :--- | :--- |
{% for access in runtimeExternalAccess %}
| {{access.type}} | `{{access.target}}` | {{access.resolved}} | {{access.timestamp}} |
{% endfor %}
{% else %}
*No external resource access detected.*
{% endif %}

---

## 7. How to Use This Report

*   **Engineers:** Compare correctness under fixed tasks
*   **Researchers:** Study quality–compute decoupling
*   **Decision Makers:** Choose tradeoffs explicitly

This report does not recommend models.
It exposes facts.


---

## ⚖️ Orthogonality Assertion
> **Quality ≠ Runtime ≠ ESG**
> This report certifies that **ECI (Energy Consumption Index)** is calculated strictly post-evaluation and has **0% impact** on the Quality Score.
> - **Quality**: 65/100
> - **Runtime**: 1 Fatal Errors
> - **ESG (ECI)**: 407,097,600,000 (Index)

# Detailed Failure Analysis

## Top Failure Rules
| Rule ID | Count | Layer |
| :--- | :--- | :--- |
| parse/json | 2 | L4/Parse |

## Connectivity Details
| Task | File Ref | Script | API Link | Route |
| :--- | :--- | :--- | :--- | :--- |
| xs_task | 1 | 0 | 1 | 0 |
| s_task | 1 | 1 | 1 | 0 |
| m_task | 0.5 | 0 | 0 | 0 |
| l_task | 0.5 | 0 | 1 | 0.5 |
| xl_task | N/A | N/A | N/A | N/A |

## Runtime Health
- **Total Runtime Errors** (Fatal): 1
- **Total Runtime Warnings**: 0
