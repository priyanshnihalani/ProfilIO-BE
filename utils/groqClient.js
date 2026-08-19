import Groq from "groq-sdk";

const FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "llama-3.1-8b-instant"
];

const isModelNotFoundError = (error) => {
    return error?.status === 404 || 
        error?.code === "model_not_found" ||
        (error?.error?.error?.code === "model_not_found") ||
        (typeof error?.message === "string" && (
            error.message.includes("model_not_found") || 
            error.message.includes("does not exist") || 
            error.message.includes("not found")
        ));
};

const isLimitExceededError = (error) => {
    return error?.status === 429 || 
        error?.status === 400 || 
        error?.code === "rate_limit_exceeded" ||
        error?.code === "limit_exceeded" ||
        (typeof error?.message === "string" && (
            error.message.toLowerCase().includes("rate limit") ||
            error.message.toLowerCase().includes("limit exceeded") ||
            error.message.toLowerCase().includes("quota") ||
            error.message.toLowerCase().includes("capacity")
        ));
};

/**
 * Wrapper around groq.chat.completions.create that automatically:
 * 1. Sequentially falls back to other API keys if a 429/Limit Exceeded error occurs.
 * 2. Sequentially falls back to alternative models (FALLBACK_MODELS) if a model fails (404, or all keys fail).
 */
export const createChatCompletion = async (options, requestOptions = {}) => {
    const apiKey1 = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const apiKey2 = process.env.GROQ_API_KEY_1;
    const apiKey3 = process.env.GROQ_API_KEY_2;

    if (!apiKey1) {
        throw new Error("GROQ_API_KEY environment variable is missing or empty.");
    }

    const isGroqKey = (key) => typeof key === 'string' && key.startsWith('gsk_');

    // Build the list of active clients
    const clients = [];
    if (isGroqKey(apiKey1)) clients.push({ name: "GROQ_API_KEY", client: new Groq({ apiKey: apiKey1 }) });
    if (isGroqKey(apiKey2)) clients.push({ name: "GROQ_API_KEY_1", client: new Groq({ apiKey: apiKey2 }) });
    if (isGroqKey(apiKey3)) clients.push({ name: "GROQ_API_KEY_2", client: new Groq({ apiKey: apiKey3 }) });

    if (clients.length === 0) {
        throw new Error("No valid Groq API keys found.");
    }

    // Build sequence of models to attempt
    const modelsToTry = [options.model];
    for (const model of FALLBACK_MODELS) {
        if (!modelsToTry.includes(model)) {
            modelsToTry.push(model);
        }
    }

    let lastError = null;

    // Outer loop: Try each model in sequence
    for (const modelName of modelsToTry) {
        const currentOpts = { ...options, model: modelName };

        // Inner loop: Try each API key for the current model
        for (let i = 0; i < clients.length; i++) {
            const { name, client } = clients[i];
            try {
                return await client.chat.completions.create(currentOpts, requestOptions);
            } catch (err) {
                lastError = err;
                console.warn(`[groqClient] Call failed for model '${modelName}' using key '${name}': ${err.message}`);

                // If it is a rate limit or quota/limit exceeded error, and we have more keys, try the next key
                if (isLimitExceededError(err)) {
                    if (i < clients.length - 1) {
                        console.warn(`[groqClient] Rate limit/quota exceeded for '${name}'. Trying next API key...`);
                        continue;
                    }
                }

                // If it is a 404 (model not found) or we have run out of keys for this model, 
                // break the inner loop to try the next fallback model.
                break;
            }
        }
    }

    throw lastError || new Error("Failed to create chat completion: All models and API keys failed.");
};
