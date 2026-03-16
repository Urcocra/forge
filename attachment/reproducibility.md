# Reproducibility Manifest

This document specifies the minimal information required to reproduce the main experimental results reported in the FORGE benchmark paper.

Reproducible within ~30 minutes on a standard laptop (Node.js 18+ required).

## 1. Setup

```bash
# Install dependencies
npm install

# Verify environment
node -v  # Should be >= 18.x
```

## 2. Re-run Statistical Analysis

Derived run metadata can be regenerated from raw logs and evaluation reports. You can re-run this step to refresh score, token, and failure-summary fields used by downstream scripts.

```bash
# Recompute derived metadata and update run.json files
npx ts-node scripts/recompute_run_metadata.ts
```

*Output*: This will scan all `runs/` and update `run.json` with derived score, ECI, and failure summary fields.

## 3. Generate Aggregated Reports

After calculating dimensions, regenerate the markdown reports used for the paper's tables.

```bash
# Generate the Model Averaged Report (Source of Table 3)
npx ts-node scripts/generate_averaged_model_report.ts
```

*Artifact*: The intended output file is `scripts/model_averaged_report.md`, but this script currently resolves `runs/` relative to `scripts/` and may require a path fix before it can be re-run successfully from a clean clone.

## 4. Full Audit (Optional)

To verify the integrity of all files and dependencies:

```bash
# Run the audit script
npx ts-node scripts/verify_audit.ts
```
