import { toText, isEmpty } from "./resumeUtils.js";

/**
 * Evaluates the alignment between target role and listed skills.
 */
export const analyzeSkills = (resumeData, targetRole = "") => {
    let score = 10;
    const missingSkills = [];
    const recommendedSkills = [];

    // Safely convert skills to a plain text string regardless of data type
    const skillsText = toText(resumeData.skills).toLowerCase();

    if (!skillsText.trim()) {
        return {
            score: 0,
            missingSkills: [],
            recommendedSkills: ["Add a skills section listing core technologies and methodologies."]
        };
    }

    const roleLower = (targetRole || "").toLowerCase();

    if (roleLower.includes("frontend") || roleLower.includes("react")) {
        ["javascript", "typescript", "react", "css", "html", "git"].forEach(skill => {
            if (!skillsText.includes(skill)) recommendedSkills.push(skill);
        });
    } else if (roleLower.includes("backend") || roleLower.includes("node")) {
        ["node.js", "express", "sql", "mongodb", "api", "docker"].forEach(skill => {
            if (!skillsText.includes(skill)) recommendedSkills.push(skill);
        });
    } else if (roleLower.includes("manager") || roleLower.includes("lead")) {
        ["agile", "scrum", "leadership", "jira", "communication"].forEach(skill => {
            if (!skillsText.includes(skill)) recommendedSkills.push(skill);
        });
    } else if (roleLower.includes("mern") || roleLower.includes("fullstack") || roleLower.includes("full-stack")) {
        ["react", "node.js", "express", "mongodb", "javascript", "git"].forEach(skill => {
            if (!skillsText.includes(skill)) recommendedSkills.push(skill);
        });
    }

    if (recommendedSkills.length > 3) {
        score -= 3;
    } else if (recommendedSkills.length > 0) {
        score -= 1;
    }

    return {
        score: Math.max(0, score),
        missingSkills,
        recommendedSkills
    };
};
