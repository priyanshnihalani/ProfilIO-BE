/**
 * Evaluates the chosen template's inherent ATS score.
 * 
 * @param {Object} templateMetadata - Metadata about the chosen template
 * @returns {Object} Template analysis result
 */
export const analyzeTemplate = (templateMetadata = {}) => {
    // Expected templateMetadata: { templateId: "developer-ats", atsScore: 99, ... }
    
    // Scale template atsScore (which is usually out of 100) to out of 10 for the engine
    const suppliedScore = Number(templateMetadata.atsScore);
    let baseScore = Number.isFinite(suppliedScore) ? Math.min(100, Math.max(0, suppliedScore)) : 85;
    
    // Convert out of 100 to out of 10
    let score = Math.round((baseScore / 100) * 10);
    
    const warnings = [];
    
    if (baseScore < 80) {
        warnings.push("The selected template is highly creative and may fail strict ATS systems. Consider switching to an ATS-Optimized template.");
    }

    return {
        score: Math.max(0, Math.min(10, score)),
        warnings
    };
};
