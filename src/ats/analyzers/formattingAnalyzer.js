/**
 * Analyzes formatting safety based on template metadata.
 * 
 * @param {Object} templateMetadata - Metadata about the chosen template
 * @returns {Object} Formatting analysis result
 */
export const analyzeFormatting = (templateMetadata = {}) => {
    let score = 10;
    const warnings = [];

    // Default safe assumptions if no metadata provided
    const hasColumns = templateMetadata.columns > 1;
    const hasIcons = templateMetadata.icons === true;
    const hasTables = templateMetadata.tables === true;
    const hasProgressBars = templateMetadata.progressBars === true;
    const hasCharts = templateMetadata.charts === true;

    if (hasColumns) {
        warnings.push("Multiple columns can confuse older ATS parsers.");
        score -= 2;
    }
    if (hasIcons) {
        warnings.push("Icons are often rendered as gibberish characters by ATS.");
        score -= 1;
    }
    if (hasTables) {
        warnings.push("Tables destroy reading order in many applicant tracking systems.");
        score -= 3;
    }
    if (hasProgressBars || hasCharts) {
        warnings.push("Progress bars and charts cannot be read by text-based ATS.");
        score -= 2;
    }

    return {
        score: Math.max(0, score),
        warnings
    };
};
