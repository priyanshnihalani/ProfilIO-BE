import Groq from "groq-sdk";

/**
 * Wrapper around groq.chat.completions.create that automatically
 * falls back to GROQ_API_KEY_1 and then GROQ_API_KEY_2 if a 429 Rate Limit error occurs.
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

    try {
        return await groq1.chat.completions.create(options, requestOptions);
    } catch (error) {
        if (error.status === 429 && groq2) {
            console.warn("[groqClient] GROQ_API_KEY rate limit reached (429). Falling back to GROQ_API_KEY_1.");
            try {
                return await groq2.chat.completions.create(options, requestOptions);
            } catch (error2) {
                if (error2.status === 429 && groq3) {
                    console.warn("[groqClient] GROQ_API_KEY_1 rate limit reached (429). Falling back to GROQ_API_KEY_2.");
                    return await groq3.chat.completions.create(options, requestOptions);
                }
                throw error2;
            }
        }
        throw error;
    }
};

