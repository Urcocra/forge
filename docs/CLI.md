# FORGE CLI Documentation

The FORGE CLI is the primary interface for running evaluations, generating reports, and analyzing results.

## Global Usage

```bash
npm run forge -- <command> [options]
```

or if installed globally/linked:

```bash
forge <command> [options]
```

## Commands

### `run`
Executes a single evaluation run based on a configuration file.

```bash
forge run --config <config_path>
```
- **Arguments**:
  - `--config <path>`: Path to the JSON configuration file (e.g., `configs/qwen3.json`).

### `batch`
Runs a configuration multiple times in sequence. Useful for gathering statistical data.

```bash
forge batch --config <config_path> --times <N>
```
- **Arguments**:
  - `--config <path>`: Path to the JSON configuration file.
  - `--times <N>`: Number of times to repeat the run.

### `reproduce`
Re-runs the evaluation phase for an existing run directory. This is useful if you want to re-score a previous generation without re-generating the code.

```bash
forge reproduce <run_dir>
```
- **Arguments**:
  - `<run_dir>`: Path to the specific run directory (e.g., `runs/qwen3_2023-10-27_...`).

### `compare`
(Experimental) Compares multiple runs.

```bash
forge compare
```

### `report`
Generates a human-readable HTML/Markdown report for a specific run.

```bash
forge report <run_dir>
```
- **Arguments**:
  - `<run_dir>`: Path to the run directory.

### `esg`
Generates the Engineering Systems Grammar (ESG) analysis for a run. This computes the structural integrity and complexity scores.

```bash
forge esg <run_dir>
```
- **Arguments**:
  - `<run_dir>`: Path to the run directory.

### `eval-report`
Generates the detailed Evaluation Report (`eval_evaluation_report.md`) for a run, combining scores, logs, and failure analysis.

```bash
forge eval-report <run_dir>
```
- **Arguments**:
  - `<run_dir>`: Path to the run directory.
