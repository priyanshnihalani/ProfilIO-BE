import { config } from "../config.js";

const cleanText = (value, maxLength) => typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, maxLength) : "";

export const validateScoreRequest = (body = {}) => {
    const resumeText = cleanText(body.resumeText, config.atsMaxResumeChars);
    const targetRole = cleanText(body.targetRole, 200);
    const jobDescription = cleanText(body.jobDescription, config.atsMaxJobChars);
    if (resumeText.length < 100) return { error: "resumeText must contain at least 100 readable characters." };
    if (!targetRole) return { error: "targetRole is required." };
    return { value: { resumeText, targetRole, jobDescription } };
};

export const clampScore = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.min(100, Math.max(0, number))) : 0;
};

export const stringArray = (value, maxItems = 15, maxLength = 300) =>
    (Array.isArray(value) ? value : []).filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);

export const normalizeModelObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const normalized = {};
    for (const [key, item] of Object.entries(value)) {
        if (key.endsWith("_score") || key.startsWith("no_") || key.endsWith("_present") || key === "email_professionalism") normalized[key] = clampScore(item);
        else if (Array.isArray(item)) normalized[key] = stringArray(item);
        else if (item && typeof item === "object") normalized[key] = normalizeModelObject(item);
        else if (["string", "boolean"].includes(typeof item)) normalized[key] = item;
        else if (typeof item === "number" && Number.isFinite(item)) normalized[key] = Math.max(0, Math.round(item));
    }
    return normalized;
};
