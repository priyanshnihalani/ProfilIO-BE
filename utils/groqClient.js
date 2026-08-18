import Groq from "groq-sdk";

const FALLBACK_MODEL = "openai/gpt-oss-120b";

const isModelNotFoundError = (error) => {
    return error?.status === 404 || 
        error?.code === "model_not_found" ||
        (error?.error?.error?.code === "model_not_found") ||
        (typeof error?.message === "string" && error.message.includes("model_not_found"));
};

/**
 * Wrapper around groq.chat.completions.create that automatically:
 * 1. Falls back to FALLBACK_MODEL if a 404 Model Not Found error occurs.
 * 2. Falls back to GROQ_API_KEY_1 and then GROQ_API_KEY_2 if a 429 Rate Limit error occurs.
 */
export const createChatCompletion = async (options, requestOptions = {}) => {
    const apiKey1 = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const apiKey2 = process.env.GROQ_API_KEY_1;
    const apiKey3 = process.env.GROQ_API_KEY_2;

    if (!apiKey1) {
        throw new Error("GROQ_API_KEY environment variable is missing or empty.");
    }

    const groq1 = new Groq({ apiKey: apiKey1 });
    const groq2 = apiKey2 ? new Groq({ apiKey: apiKey2 }) : null;
    const groq3 = apiKey3 ? new Groq({ apiKey: apiKey3 }) : null;

    const executeCall = async (client, opts) => {
        try {
            return await client.chat.completions.create(opts, requestOptions);
        } catch (err) {
            if (isModelNotFoundError(err) && opts.model !== FALLBACK_MODEL) {
                console.warn(`[groqClient] Model '${opts.model}' returned 404. Falling back to '${FALLBACK_MODEL}'.`);
                const fallbackOpts = { ...opts, model: FALLBACK_MODEL };
                return await client.chat.completions.create(fallbackOpts, requestOptions);
            }
            throw err;
        }
    };

    try {
        return await executeCall(groq1, options);
    } catch (error) {
        if (error.status === 429 && groq2) {
            console.warn("[groqClient] GROQ_API_KEY rate limit reached (429). Falling back to GROQ_API_KEY_1.");
            try {
                return await executeCall(groq2, options);
            } catch (error2) {
                if (error2.status === 429 && groq3) {
                    console.warn("[groqClient] GROQ_API_KEY_1 rate limit reached (429). Falling back to GROQ_API_KEY_2.");
                    return await executeCall(groq3, options);
                }
                throw error2;
            }
        }
        throw error;
    }
};

