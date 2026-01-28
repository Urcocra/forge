export const EXTERNAL_BENCHMARKS: Record<string, number> = {
    // Top Tier
    'anthropic/claude-sonnet-4.5': 65.0,
    'openai/gpt-5.2': 72.0, // Futuristic peak

    // High Tier
    'x-ai/grok-4': 60.0,
    'moonshot/kimik2thinking': 55.0, // Keeping user key
    'moonshotai/kimi-k2-thinking': 55.0, // Alias for existing runs

    // Mid Tier
    'qwen/qwen3-coder': 50.0,
    'minimax/minimax-m2': 45.0
};
