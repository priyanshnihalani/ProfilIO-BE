import express from "express";
import { calculateAtsScore } from "../AtsEngine.js";
import { generateRecommendations } from "../ai/generateRecommendations.js";
import { autoImproveResume } from "../ai/autoImprove.js";
import { consumeUsage, requireAuth } from "../../middleware/auth.js";
import { atsRateLimit } from "../../middleware/rateLimit.js";

const router = express.Router();

/**
 * POST /api/ats/analyze
 *
 * Accepts either:
 *   { resumeData: object, jobDescription, targetRole, templateMetadata }
 *   { resumeText: string, jobDescription, targetRole }
 *
 * Returns AtsAnalysisResult-shaped response.
 */
router.post("/analyze", requireAuth, atsRateLimit, async (req, res) => {
    try {
        const { resumeData, resumeText, jobDescription, targetRole, templateMetadata } = req.body;
        const selectedMissingKeywords = Array.isArray(req.body.selectedMissingKeywords) && req.body.selectedMissingKeywords.length > 0
            ? req.body.selectedMissingKeywords
            : null;

        const input = resumeData || resumeText;
        if (!input) {
            return res.status(400).json({ success: false, message: "resumeData or resumeText is required." });
        }

        const resolvedRole = targetRole ||
            (resumeData && typeof resumeData === "object" ? resumeData.targetRole : "") || "";

        // Deterministic ATS score
        const atsResult = calculateAtsScore(input, jobDescription || "", resolvedRole, templateMetadata || {}, selectedMissingKeywords);

        // AI recommendations are best-effort
        let aiRecommendations = null;
        try {
            aiRecommendations = await generateRecommendations(atsResult);
        } catch (_) { /* non-fatal */ }

        return res.json({
            success: true,
            overallScore:      atsResult.overallScore,
            tier:              atsResult.tier,
            targetRole:        atsResult.targetRole,
            scoredAt:          atsResult.scoredAt,
            dimensionScores:   atsResult.dimensionScores,
            breakdown:         atsResult.breakdown,
            recommendations:   atsResult.recommendations,
            details:           atsResult.details,
            strengths:         atsResult.strengths,
            weaknesses:        atsResult.weaknesses,
            // Legacy field names
            keywordAnalysis:    { score: atsResult.dimensionScores.keywordRelevance,    ...atsResult.details.keyword },
            structureAnalysis:  { score: atsResult.dimensionScores.sectionCompleteness, ...atsResult.details.completeness },
            experienceAnalysis: { score: atsResult.dimensionScores.impactLanguage,      ...atsResult.details.impact },
            formattingAnalysis: { score: atsResult.dimensionScores.formatParsability,   ...atsResult.details.format },
            aiRecommendations,
        });

    } catch (error) {
        console.error("Error in ATS analysis:", error);
        res.status(500).json({ success: false, message: "Failed to analyze resume for ATS." });
    }
});

/**
 * POST /api/ats/auto-improve
 */
router.post("/auto-improve", consumeUsage("aiImprovements"), atsRateLimit, async (req, res) => {
    try {
        const { resumeData, missingKeywords, recommendedSkills } = req.body;
        if (!resumeData) return res.status(400).json({ success: false, message: "resumeData is required" });

        const improvedData = await autoImproveResume(resumeData, missingKeywords || [], recommendedSkills || []);
        if (improvedData && Object.prototype.hasOwnProperty.call(resumeData, "skills")) {
            improvedData.skills = resumeData.skills;
        }
        return res.json({ success: true, improvedData });
    } catch (error) {
        console.error("Error in ATS auto-improve:", error);
        res.status(500).json({ success: false, message: "Failed to auto-improve resume." });
    }
});

export default router;
