# ESG / Transparency Disclaimer

This document clarifies the scope and limitations of ESG-style reporting in FORGE.

## 1. Scope of "ESG" in FORGE
The term **ESG (Environmental, Social, and Governance)** in this benchmark is used in a specific, limited context:

*   **Environmental**: Refers **solely** to the `Evaluation Compute Index (ECI)`, which serves as a proxy for evaluation-time computational cost. It does not measure actual carbon emissions, energy consumption in Watt-hours, or hardware lifecycle impacts.
*   **Social**: Refers to the transparency and reproducibility of the evaluation process. It does *not* assess the social impact, bias, or safety of the models' outputs in deployment.
*   **Governance**: Refers to the auditability of the evaluation pipeline (e.g., using fixed rules, deterministic seeds, and open logs).

## 2. Personal Data (PII)
This benchmark and its associated datasets **do not contain** any Personally Identifiable Information (PII). All tasks are synthetic engineering scenarios constructed for evaluation purposes.

## 3. Sandbox Security
The `Situatedness (S)` metric includes a "Security" component. This measures whether the generated code attempts to violate sandbox constraints (e.g., accessing forbidden file paths or network hosts).
*   These violations are recorded as evaluation signals.
*   The benchmark runner executes all code in isolated containers to prevent actual harm to the host system.

## 4. Limitation of Liability
The ECI metric and ESG reports are provided for research transparency purposes only. They should not be used for regulatory compliance or formal environmental auditing.
