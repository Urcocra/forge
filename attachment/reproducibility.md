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

The FERPS dimensions (F, E, R, P, S) are calculated deterministically from raw logs. You can re-run this calculation to verify the scores reported in Table 3 of the paper.

```bash
# Calculate dimensions and update run.json files
npx tsx scripts/calc_scientific_dims.ts
```

*Output*: This will scan all `runs/` and update `run.json` with rigorous F, E, R, P, S scores based on the formulas in `stats-details.md`.

## 3. Generate Aggregated Reports

After calculating dimensions, regenerate the markdown reports used for the paper's tables.

```bash
# Generate the Model Averaged Report (Source of Table 3)
npx tsx generate_averaged_model_report.ts
```

*Artifact*: Checks `model_averaged_report.md` for the updated tables.

## 4. Full Audit (Optional)

To verify the integrity of all files and dependencies:

```bash
# Run the audit script
npx tsx verify_audit.ts
```
