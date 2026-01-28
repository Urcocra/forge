# Model Performance Ranking & Failure Analysis

Here is the Average Overall Score Rank and Failure Statistics based on all available runs (N=10) for each model:

| Rank | Model Name | Average Score | Avg L2/L3 Failures | Avg L4/L5 Failures |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **anthropic_claude-sonnet-4.5** | **82.1** | 0.4 | 0.1 |
| 2 | **qwen_qwen3-coder** | **72.9** | 0.8 | 0.0 |
| 3 | **x-ai_grok-4** | **67.8** | 1.2 | 0.1 |
| 4 | **moonshotai_kimi-k2-thinking** | **65.3** | 1.1 | 0.3 |
| 5 | **minimax_minimax-m2** | **51.1** | 0.9 | 4.2 |
| 6 | **openai_gpt-5.2** | **36.8** | 0.5 | 9.5 |

### Legend
- **L2/L3 Failures**: Validations related to Code Quality (Linting) and Static Validation (Connectivity, structure).
- **L4/L5 Failures**: Validations related to Parsing (Syntax) and Runtime (Crash, Browser errors).
