# Utility Scripts Documentation

This directory contains various utility scripts for analyzing benchmark results, generating reports, and verifying the framework's integrity.

## 📊 Report Generation (Report Generation)

These scripts process raw data from the `runs/` directory (produced by `npm run forge` or `forge batch`) and generate human-readable Markdown reports.

| Script | Description | Output |
| :--- | :--- | :--- |
| **`generate_run_summary.ts`** | Scans all runs and generates a summary table with scores, tokens, and failure status. | `runs_summary.md` |
| **`generate_model_report.ts`** | XML/Log parser that generates a detailed event timeline for each model's run. | `model_events_report.md` |
| **`generate_averaged_model_report.ts`** | Aggregates results to calculate average scores and stability metrics per model. | `model_averaged_report.md` |
| **`generate_detailed_event_report.ts`** | Produces granular debugging reports for specific task execution events. | *(Console / Temp files)* |

### Usage
```bash
# Generate the high-level summary
npx ts-node scripts/generate_run_summary.ts

# Generate the detailed model report
npx ts-node scripts/generate_model_report.ts
```

## 📈 Data Analysis (Data Analysis)

Tools for extracting specific metrics for research or paper writing.

| Script | Description | Output |
| :--- | :--- | :--- |
| **`analyze_deps.ts`** | Analyzes the `src/lib` dependency graph. | `analysis_results_utf8.txt` |
| **`analyze_layers.js`** | Counts failure layer statistics (L1-L5) across all runs. | `layer_stats_output.txt` |
| **`analyze_scores.js`** | Quickly computes average scores for all models in the runs directory. | `scores_output.txt` |

### Usage
```bash
node scripts/analyze_layers.js
```

## ✅ Framework Verification (Verification)

Scripts used to test the FORGE core framework itself. These are not for benchmarking models, but for ensuring the test harness is working correctly.

| Script | Description |
| :--- | :--- |
| **`verify_audit.ts`** | Simulates a malicious agent trying to access external URLs to ensure the Sandbox blocks it. |
| **`verify_manifest.ts`** | Verifies that the file manifest hashing and structure validation logic is correct. |

### Usage
```bash
npx ts-node scripts/verify_audit.ts
```
