const isProduction = process.env.NODE_ENV === "production";

const requiredInProduction = (name) => {
    const value = process.env[name]?.trim();
    if (isProduction && !value) {
        throw new Error(`${name} is required in production.`);
    }
    return value;
};

export const config = Object.freeze({
    isProduction,
    port: Number(process.env.PORT) || 5000,
    databaseUrl: requiredInProduction("DATABASE_URL") || process.env.DATABASE_URL?.trim(),
    jwtSecret: requiredInProduction("JWT_SECRET") || "dfbe450716e055662d12ba1696412d44e1343a61287dd5a5cf1b342b46d346c4",
    groqApiKey: requiredInProduction("GROQ_API_KEY") || process.env.GEMINI_API_KEY?.trim(),
    corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174")
        .replace(/"/g, "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    atsTimeoutMs: Math.max(2_000, Number(process.env.ATS_TIMEOUT_MS) || 20_000),
    atsMaxResumeChars: Math.max(1_000, Number(process.env.ATS_MAX_RESUME_CHARS) || 30_000),
    atsMaxJobChars: Math.max(500, Number(process.env.ATS_MAX_JOB_CHARS) || 15_000),
}); 