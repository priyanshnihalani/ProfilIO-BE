import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
const groq = new Groq({ apiKey });

/**
 * Uses Groq (Llama 3) to generate actionable feedback based purely on deterministic ATS scores.
 * 
 * @param {Object} atsScoreData - The deterministic scoring result from AtsEngine
 * @returns {Promise<Object>} AI generated recommendations { overview, actionItems }
 */
export const generateRecommendations = async (atsScoreData) => {
    // We import the instantiated groq client from the main genAI.js file.
    // If it's not exported there, we'd instantiate it here. For now, assuming groq is exported.
    
    const prompt = `You are an expert ATS Resume Consultant. 
I have a deterministic ATS score breakdown for a user's resume.
Overall Score: ${atsScoreData.overallScore}/100

Score Breakdown:
- Keywords: ${atsScoreData.breakdown?.keywordScore || 0}/25
- Format: ${atsScoreData.breakdown?.formatScore || 0}/18
- Impact Quality: ${atsScoreData.breakdown?.impactScore || 0}/15
- Section Completeness: ${atsScoreData.breakdown?.completenessScore || 0}/12
- Role Alignment: ${atsScoreData.breakdown?.alignmentScore || 0}/12
- Contact Info: ${atsScoreData.breakdown?.contactScore || 0}/8
- Readability: ${atsScoreData.breakdown?.readabilityScore || 0}/7
- Anti-Patterns: ${atsScoreData.breakdown?.antiPatternScore || 0}/6

Details:
Missing Keywords: ${(atsScoreData.details?.keyword?.missing_keywords || []).join(", ") || "None"}
Structure Issues: ${(atsScoreData.details?.completeness?.missing_sections || []).join(", ") || "None"}
Weak Bullets Count: ${(atsScoreData.details?.impact?.total_bullet_count - atsScoreData.details?.impact?.quantified_bullet_count) || 0}
Formatting Warnings: ${(atsScoreData.details?.format?.format_issues || []).join(", ") || "None"}

INSTRUCTIONS:
1. Do NOT recalculate the score. Accept it as final.
2. Provide a 1-2 sentence encouraging overview explaining why the score is what it is.
3. Provide a list of 3-5 specific, actionable bullet points to improve the resume, based ONLY on the missing keywords, structure issues, weak bullets, or formatting warnings provided above.
4. NEVER fabricate experience or suggest adding technologies the user doesn't know. 
5. Return ONLY a valid JSON string (no markdown formatting, no backticks) with this structure:
{
  "overview": "string",
  "actionItems": ["string", "string"]
}`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const content = chatCompletion.choices[0]?.message?.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to generate AI recommendations:", error);
        return {
            overview: "We could not generate AI recommendations at this time, but please refer to the score breakdown to manually improve your resume.",
            actionItems: []
        };
    }
};
