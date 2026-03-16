# FORGE: Real-World Generative Engineering Evaluation

**FORGE** is a comprehensive framework for evaluating AI agents on realistic, project-level software engineering tasks. unlike static benchmarks that only check for code correctness, FORGE executes generated systems in sandboxed environments to measure structural integrity, runtime stability, and failure recovery.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 📄 Abstract

Existing benchmarks frequently overestimate the capabilities of AI agents by evaluating isolated code snippets rather than holistic system construction. They often fail to assess whether an agent can construct a functional, integrated system. 

**FORGE** requires agents to engineer complete software projects. It executes generated artifacts within **Isolated Processes** and an **Essential Sandbox** to assess functional viability, stability, and error recovery. Our evaluation reveals a significant divergence: models proficient in generating isolated snippets frequently fail to construct integrated projects. FORGE provides a rigorous assessment of agent readiness for real-world software engineering tasks.

## ✨ Key Features

- **Real-World Task Complexity**: Evaluates agents on complete project construction, not just single functions.
- **Sandboxed Execution**: Runs generated code in isolated environments to test actual runtime behavior.
- **Failure Taxonomy**: Detailed categorization of failure modes, from static errors to runtime crashes (L1-L5 layers).
- **Transparent Reporting**: Generates detailed, reproducible reports on agent performance and failure modes.

## 🛠️ Project Structure

```bash
forge-core/
├── src/                    # 🧠 Core logic (The "Brain")
├── forge/                  # 🔨 CLI Tools & Utilities
├── main/                   # 🎓 Research Paper
├── attachment/             # 📎 Supplementary Materials
├── docs/                   # 📚 Documentation
├── scripts/                # 🛠️ Utility Scripts
├── configs/                # ⚙️ Configuration
├── README.md               # You are here
└── ......
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **LaTeX** (optional, for compiling the paper)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/forge.git
   cd forge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Model:
   Create a JSON configuration file in `configs/` (e.g., `configs/my-model.json`):
   ```json
   {
     "model": "provider/model-name",
     "baseUrl": "https://api.provider.com/v1",
     "apiKey": "your-api-key",
     "parameterScale": 70000000000
   }
   ```

### Configuration

FORGE supports strictly typed configuration files for defining model endpoints, including custom/local servers (e.g., vLLM, Ollama).

See [**Model Configuration Guide**](docs/model_configuration.md) for details on how to set up:
- Custom API Endpoints (`baseUrl`)
- Third-party Providers (OpenRouter, Together AI)
- Local Inference Servers

## 💻 Usage

To run the FORGE benchmark:

```bash
# Show CLI help
npm run forge

# Run a benchmark from a local clone
node -r ts-node/register forge/index.ts run --config configs/qwen3.json
```

The local `npm run forge -- <command>` form does not forward arguments correctly in this repository's current script setup. Use the direct CLI entry above for local runs, or `forge <command>` if you installed/linked the package globally.

For a complete list of commands (including `batch`, `reproduce`, `eval-report`), see the [**CLI Documentation**](docs/CLI.md).


The process involves:
1. **Load Task**: Reads task definitions.
2. **Execute**: Runs the agent to generate artifacts.
3. **Evaluate**: Performs static analysis and runtime execution in the sandbox.
4. **Report**: Outputs logs, scores, and generated reports to a new subdirectory under `runs/`.

### Viewing Reports

Each execution creates a directory under `runs/`, for example `runs/qwen_qwen3-coder_2026-03-16T02-15-25-366Z/`.

Key generated files include:
- `run.json`
- `stdout.log`
- `stderr.log`
- `esg_evaluation_report.md`
- `eval_evaluation_report.md`
- `failure_taxonomy_report.md`

## 🤝 Contributing

We welcome contributions to FORGE! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details on how to get started, report bugs, and submit pull requests.

## ❓ Troubleshooting

-   **Browser Crashes**: If you experience browser crashes during evaluation, ensure you have the necessary Playwright dependencies installed (`npx playwright install-deps`).

## 🙏 Acknowledgements

We explicitly thank the open-source community for the tools that made this framework possible, including [Astro](https://astro.build), [Playwright](https://playwright.dev), and [TailwindCSS](https://tailwindcss.com).

## 📧 Contact

For questions or feedback, please reach out to the authors via GitHub Issues or email at [contact@example.com](mailto:contact@example.com).

## 📚 Citation

If you use FORGE in your research, please cite our paper:

```bibtex
@article{forge2026,
  title={FORGE: A Framework for Real-World Generative Engineering Evaluation of AI Agents},
  author={Anonymous Author},
  journal={Under Review},
  year={2026}
}
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
