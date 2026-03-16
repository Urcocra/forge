# Upload Bundle

This folder mirrors the files that are suitable to upload through the GitHub web UI for this cleanup.

Included categories:
- Documentation updates
- Script path and exit-code fixes
- Script rename from calc_scientific_dims.ts to recompute_run_metadata.ts

Included files:
- readme.md
- docs/CLI.md
- scripts/README.md
- attachment/reproducibility.md
- attachment/stats-details.md
- scripts/generate_run_summary.ts
- scripts/generate_model_report.ts
- scripts/generate_detailed_event_report.ts
- scripts/generate_averaged_model_report.ts
- scripts/aggregate_reports.ts
- scripts/calculate_current_rankings.ts
- scripts/calculate_task_correlations.ts
- scripts/copy_micro_reports.ts
- scripts/generate_latex_stats.ts
- scripts/generate_model_averaged_report.ts
- scripts/recompute_run_metadata.ts

Do not upload from the main workspace:
- configs/qwen3.json
- runs/
- node_modules/
- generated local reports such as runs_summary.md and model_events_report.md
