# Model Configuration & Custom Endpoints

FORGE is designed to be model-agnostic, using a unified adapter that communicates with any OpenAI-compatible API. This allows you to easily switch between official OpenAI models, third-party providers (like OpenRouter, Together AI), or local inference servers (like vLLM, Ollama, LM Studio).

## Configuration File

Model execution is controlled by JSON configuration files located in the `configs/` directory.

### Structure

A typical configuration file looks like this:

```json
{
  "model": "provider/model-name",
  "baseUrl": "https://api.provider.com/v1",
  "apiKey": "sk-...",
  "parameterScale": 70000000000
}
```

### Fields

- **`model`**: The model identifier string expected by the API provider (e.g., `gwt-4o`, `deepseek/deepseek-coder`, `meta-llama/Llama-3-70b-instruct`).
- **`baseUrl`**: The full URL to the chat completions API endpoint.
    - Official OpenAI: `https://api.openai.com/v1`
    - OpenRouter: `https://openrouter.ai/api/v1`
    - Local (vLLM/Ollama): `http://localhost:8000/v1`
- **`apiKey`**: Your authentication key.
- **`parameterScale`**: An approximate parameter count (e.g., `7e10` for 70B models). This is used for "Compute Index" calculations in ESG reports.

## Examples

### 1. OpenRouter (Recommended for variety)

Use OpenRouter to access Claude, Gemini, Llama, and Qwen models via a standard API.

```json
{
  "model": "qwen/qwen-2.5-coder-32b-instruct",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-v1-...",
  "parameterScale": 32000000000
}
```

### 2. Local Inference (vLLM / LM Studio)

If you are running a model locally on port 8000:

```json
{
  "model": "local-model",
  "baseUrl": "http://localhost:8000/v1",
  "apiKey": "not-needed",
  "parameterScale": 7000000000
}
```

### 3. Official OpenAI

```json
{
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-proj-...",
  "parameterScale": 1800000000000
}
```

## SDK Implementation

Under the hood, FORGE uses a modular SDK located at `src/lib/sdk/openai.ts`.

```typescript
import { OpenAICompatibleClient } from './sdk/openai';

const client = new OpenAICompatibleClient({
    baseUrl: process.env.BASE_URL,
    apiKey: process.env.API_KEY,
    model: process.env.MODEL
});
```

The `OpenAICompatibleClient` ensures robust JSON parsing and error handling regardless of the backend provider.
