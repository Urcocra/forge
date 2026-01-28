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
- **FERPS Framework**: Evaluation based on Functional, Engineering, Resilience, Product, and Situatedness criteria.
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

3. Configure Environment:
   Create a `.env` file in the root directory and add your API keys (e.g., for OpenRouter):
   ```bash
   OPENROUTER_API_KEY=sk-...
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
# Run the FORGE CLI
npm run forge
```

The process involves:
1. **Load Task**: Reads task definitions.
2. **Execute**: Runs the agent to generate artifacts.
3. **Evaluate**: Performs static analysis and runtime execution in the sandbox.
4. **Report**: Outputs scores and failure analysis to the `reports/` directory.

### Viewing Reports

Results are generated in the `reports/` directory. You can also view the summarized findings in `model_averaged_report.md`.

## 🤝 Contributing

We welcome contributions to FORGE! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details on how to get started, report bugs, and submit pull requests.

## ❓ Troubleshooting

-   **Browser Crashes**: If you experience browser crashes during evaluation, ensure you have the necessary Playwright dependencies installed (`npx playwright install-deps`).
-   **Timeout Errors**: For complex tasks, you may need to increase the timeout settings in `configs/runtime.json`.

## 🙏 Acknowledgements

We explicitly thank the open-source community for the tools that made this framework possible, including [Astro](https://astro.build), [Playwright](https://playwright.dev), and [TailwindCSS](https://tailwindcss.com).



## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

