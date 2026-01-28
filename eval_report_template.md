# FORGE Evaluation Report

**Model:** {{model.id}}
**Parameter Scale:** {{esg.parameterScale}}
**Date:** {{meta.generatedAt}}
**Run ID:** {{runId}}

---

## 1. Capability Performance (Quality Axis)

**Final Quality Score:** {{overallScore}} / 100

This score measures functional task-solving capability only.
It is computed without access to any compute, token, or ESG data.

**What this score answers:**
*   Did the artifacts satisfy the specification?
*   Did the code survive static and runtime validation?
*   Were cross-file contracts respected?

### Quality Subscores

| Dimension | Meaning | Score |
| :--- | :--- | :--- |
| Completeness | Required artifacts present & non-empty | {{static.completeness}} |
| Structure | Syntactic & format validity | {{static.structure}} |
| Survivability | Plausible execution readiness | {{static.survivability}} |
| Connectivity | Cross-file semantic linkage | {{static.connectivity}} |

> ⚠️ These dimensions are scored before any ESG or compute metric is calculated.

---

## 2. Environmental Cost (Compute Axis)

**Eval Compute Index (ECI):** {{esg.score}}

ECI is a physical disclosure, not a performance metric.

**It answers only:**
*   How much computation occurred during evaluation?
*   How large was the evaluated model?

### ECI Definition (Frozen)

$$ ECI = \frac{\text{Total Eval Tokens} \times \text{Parameter Scale}}{10,000} $$

### Compute Breakdown

| Metric | Value |
| :--- | :--- |
| **Total Eval Tokens** | {{evalTokens}} |
| **Parameter Scale** | {{esg.parameterScale}} |
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

| Task | Difficulty | Quality Score | Eval Tokens | ECI | Interpretation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| {{taskId}} | {{size}} | {{score}} | {{tokens}} | {{eci}} | {{quadrantLabel}} |

### Quadrant Legend
*   ✅ **Efficient Success** — Correct + Low Cost
*   ⚠️ **Brute Force Success** — Correct + High Cost
*   ❌ **Cheap Failure** — Incorrect + Low Cost
*   💀 **Expensive Failure** — Incorrect + High Cost

These quadrants are observational, not judgmental.

---

## 5. ESG Method Disclosure (Fixed)

**Methodology Version:** {{esgDisclosure.methodologyVersion}}
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
