# FORGE Evaluation Report

**Model:** x-ai/grok-4
**Parameter Scale:** 0e+0
**Date:** 2026-01-27T02:16:19.484Z
**Run ID:** AGGREGATED

---

## 1. Capability Performance (Quality Axis)

**Final Quality Score:** 68 / 100

This score measures functional task-solving capability only.
It is computed without access to any compute, token, or ESG data.

**What this score answers:**
*   Did the artifacts satisfy the specification?
*   Did the code survive static and runtime validation?
*   Were cross-file contracts respected?

### Quality Subscores

| Dimension | Meaning | Score |
| :--- | :--- | :--- |
| Completeness | Required artifacts present & non-empty | 1.00 |
| Structure | Syntactic & format validity | 1.00 |
| Survivability | Plausible execution readiness | 0.60 |
| Connectivity | Cross-file semantic linkage | 0.48 |

> ⚠️ These dimensions are scored before any ESG or compute metric is calculated.

---

## 2. Environmental Cost (Compute Axis)

**Eval Compute Index (ECI):** 0

ECI is a physical disclosure, not a performance metric.

**It answers only:**
*   How much computation occurred during evaluation?
*   How large was the evaluated model?

### ECI Definition (Frozen)

$$ ECI = \frac{\text{Total Eval Tokens} \times \text{Parameter Scale}}{10,000} $$

### Compute Breakdown

| Metric | Value |
| :--- | :--- |
| **Total Eval Tokens** | 0 |
| **Parameter Scale** | 0e+0 |
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
| xs_task      | XS   | 60  | 2655   | 0.0M | ✅ Efficient Success |
| s_task       | S    | 80  | 2781   | 0.0M | ✅ Efficient Success |
| m_task       | M    | 69  | 4550   | 0.0M | ✅ Efficient Success |
| l_task       | L    | 73  | 6051   | 0.0M | ✅ Efficient Success |
| xl_task      | XL   | 59  | 14312  | 0.0M | ✅ Efficient Success |

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
> - **Quality**: 68/100
> - **Runtime**: 5 Fatal Errors
> - **ESG (ECI)**: 0 (Index)

# Detailed Failure Analysis

## Top Failure Rules
| Rule ID | Count | Layer |
| :--- | :--- | :--- |
| connectivity/schema | 2 | L3/StaticValidation |

## Connectivity Details
| Task | File Ref | Script | API Link | Route |
| :--- | :--- | :--- | :--- | :--- |
| xs_task | 1 | 0 | 1 | 0 |
| s_task | 1 | 0 | 1 | 0 |
| m_task | 0.5 | 0 | 0 | 0 |
| l_task | 0.5 | 0 | 0 | 0.5 |
| xl_task | 0.5 | 0 | 1 | 0.5 |

## Runtime Health
- **Total Runtime Errors** (Fatal): 5
- **Total Runtime Warnings**: 1
