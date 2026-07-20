import { toText, isEmpty } from "./resumeUtils.js";

/**
 * Analyzes the structure of the parsed resume JSON.
 * Handles fields that can be strings, arrays, or objects.
 */
export const analyzeStructure = (resumeData) => {
    const requiredSections = [
        { key: "summary", name: "Professional Summary" },
        { key: "experience", name: "Experience" },
        { key: "skills", name: "Skills" },
        { key: "education", name: "Education" }
    ];

    const optionalSections = [
        { key: "projects", name: "Projects" },
        { key: "certifications", name: "Certifications" },
        { key: "languages", name: "Languages" }
    ];

    const issues = [];
    const recommendations = [];
    let score = 15;

    requiredSections.forEach(section => {
        const data = resumeData[section.key];
        if (isEmpty(data)) {
            issues.push(`Missing required section: ${section.name}`);
            score -= 3;
        }
    });

    optionalSections.forEach(section => {
        const data = resumeData[section.key];
        if (isEmpty(data)) {
            recommendations.push(`Consider adding a ${section.name} section to strengthen your profile.`);
        }
    });

    const experience = resumeData.experience;
    if (Array.isArray(experience) && experience.length > 0) {
        recommendations.push("Ensure your Experience section is placed before Education unless you are a recent graduate.");
    }

    return {
        score: Math.max(0, score),
        issues,
        recommendations
    };
};
