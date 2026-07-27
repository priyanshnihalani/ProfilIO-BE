import { createChatCompletion } from "../../../utils/groqClient.js";

/**
 * Uses Groq to intelligently weave truthful missing keywords into the resume data,
 * and improves weak experience bullets with action verbs.
 * 
 * @param {Object} resumeData - The parsed resume JSON
 * @param {string[]} missingKeywords - Array of missing keywords from ATS scan
 * @param {string[]} recommendedSkills - Array of missing skills from ATS scan
 * @returns {Promise<Object>} Improved partial resumeData (summary, skills, experience)
 */
export const autoImproveResume = async (resumeData, missingKeywords, recommendedSkills) => {
    const prompt = `You are an expert ATS Resume Optimizer.
I have a user's current resume data, along with a list of missing ATS keywords and recommended skills that may improve their score when they are truthfully supported.

CURRENT RESUME DATA:
Summary: ${resumeData.summary || "None"}
Skills: ${Array.isArray(resumeData.skills) ? resumeData.skills.join(", ") : resumeData.skills || "None"}
Experience: ${JSON.stringify(resumeData.experience || [])}

MISSING ITEMS TO INJECT:
Missing Keywords: ${missingKeywords.join(", ") || "None"}
Recommended Skills: ${recommendedSkills.join(", ") || "None"}

INSTRUCTIONS:
1. Organically rewrite the Summary to include some of the missing keywords, keeping it professional and under 80 words.
2. Preserve and organize existing skills. Do NOT add, remove, or replace skills.
3. Rewrite the Experience bullets:
   - Incorporate only truthful missing keywords naturally into the bullets.
   - Preserve the same jobs and the same number of bullets.
   - Replace weak passive verbs (e.g., 'helped', 'worked on') with strong action verbs ('engineered', 'spearheaded', 'led', 'managed').
   - DO NOT fabricate entirely new skills, jobs, dates, companies, tools, metrics, certifications, or responsibilities. Only improve the text.
   - Preserve the exact dates and date ranges from the user input. Do NOT alter, format, normalize, or change any dates or date ranges. Keep them exactly as they are in the original content (e.g., keep "2021 - Present" or "2020" as is, without adding or modifying months).
4. Return ONLY a valid JSON string (no markdown formatting, no backticks) with this structure:
{
  "summary": "improved summary string",
  "skills": ["skill 1", "skill 2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "Location",
      "dates": "Dates",
      "bullets": ["improved bullet 1", "improved bullet 2"]
    }
  ]
}`;

    try {
        const chatCompletion = await createChatCompletion({
            messages: [{ role: "user", content: prompt }],
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const content = chatCompletion.choices[0]?.message?.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to auto-improve resume:", error);
        throw new Error("Failed to auto-improve resume.");
    }
};
