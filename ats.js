/**
 * atsScorer.js — MAANG-Level ATS Resume Scoring Engine
 *
 * Real ATS systems (Workday, Greenhouse, Lever, Taleo) don't just count keywords.
 * They evaluate: keyword relevance + placement, format parsability, section completeness,
 * impact language, role alignment, experience depth, and soft signals.
 *
 * This module mirrors that multi-dimensional scoring approach.
 */

import { createChatCompletion } from "./utils/groqClient.js";
import { config } from "./src/config.js";
import { clampScore, normalizeModelObject } from "./src/ats/validation.js";

// ─── 1. WEIGHTS (must sum to 100) ──────────────────────────────────────────────
export const ATS_WEIGHTS = {
  keywordRelevance: 22,      // keywords present AND in right sections
  formatParsability: 18,     // clean structure ATS can actually parse
  impactLanguage: 15,        // action verbs + quantified achievements
  sectionCompleteness: 12,   // all expected sections present
  roleAlignment: 12,         // experience/skills match the target role level
  contactInfo: 8,            // reachability completeness
  readability: 7,            // sentence clarity, no jargon overload
  atsAntiPatterns: 6,        // absence of known ATS-breaking patterns
};

// ─── 2. SCORING PROMPTS ────────────────────────────────────────────────────────

const SCORE_SYSTEM = `
You are an ATS scoring engine used internally at MAANG companies.
You evaluate resumes the way enterprise ATS systems (Workday, Greenhouse, Lever, Taleo) do.
You must return ONLY a valid JSON object — no markdown, no explanation, no preamble.
`;

/**
 * Keyword Relevance — 22 pts
 * Real ATS: proximity weighting (keywords in summary/title = higher score),
 * exact vs semantic match, density without stuffing, section context.
 */
const keywordRelevancePrompt = (resume, jobDescription, targetRole) => `
Evaluate keyword relevance for ATS scoring.

Target Role: ${targetRole}
Job Description: ${jobDescription || "Not provided"}
Resume: ${resume}

Score from 0-100 on each:
1. exact_match_score: Exact keyword matches from JD found in resume (0-100)
2. semantic_match_score: Semantically related skills/concepts matched (0-100)
3. placement_score: Keywords appear in summary and experience (not just a skills dump) (0-100)
4. density_score: Keyword density is optimal — not sparse, not stuffed (0-100)
5. title_match_score: Job title or close variant appears in resume (0-100)

Also return:
- matched_keywords: array of matched keywords (max 15)
- missing_keywords: array of important missing keywords (max 10)
- keyword_stuffing_detected: boolean

Return ONLY this JSON:
{
  "exact_match_score": number,
  "semantic_match_score": number,
  "placement_score": number,
  "density_score": number,
  "title_match_score": number,
  "matched_keywords": [],
  "missing_keywords": [],
  "keyword_stuffing_detected": boolean
}
`;

/**
 * Format Parsability — 18 pts
 * Real ATS: can it extract name, contact, dates, bullet points without errors?
 * Tables, columns, headers/footers, graphics = parsing failures.
 */
const formatParsabilityPrompt = (resume) => `
Evaluate ATS format parsability of this resume text.

Resume: ${resume}

Score 0-100 on each:
1. structure_clarity: Clear section headers (EXPERIENCE, EDUCATION, SKILLS etc.) (0-100)
2. date_format_consistency: Dates use consistent parsable format MM/YYYY or Month YYYY (0-100)
3. bullet_point_clarity: Bullets are clean, no nested lists, no symbols that break parsers (0-100)
4. section_order_score: Standard ATS section order followed (Contact > Summary > Experience > Education > Skills) (0-100)
5. no_tables_or_columns: No multi-column layouts or tables detected in text flow (0-100)

Also return:
- format_issues: array of specific format problems found (max 8)
- has_tables: boolean
- has_multi_columns: boolean
- has_headers_footers: boolean
- date_formats_found: array of date formats found

Return ONLY this JSON:
{
  "structure_clarity": number,
  "date_format_consistency": number,
  "bullet_point_clarity": number,
  "section_order_score": number,
  "no_tables_or_columns": number,
  "format_issues": [],
  "has_tables": boolean,
  "has_multi_columns": boolean,
  "has_headers_footers": boolean,
  "date_formats_found": []
}
`;

/**
 * Impact Language — 15 pts
 * Real ATS + recruiters: action verbs, quantified metrics, scope indicators.
 * "Responsible for" = red flag. "Engineered X that reduced Y by Z%" = green.
 */
const impactLanguagePrompt = (resume) => `
Evaluate impact language quality in this resume.

Resume: ${resume}

Score 0-100 on each:
1. action_verb_score: Strong action verbs start bullet points (Led, Engineered, Reduced etc.) (0-100)
2. quantification_score: Achievements include numbers/percentages/dollar amounts/scale (0-100)
3. scope_indicators_score: Scale of impact mentioned (team size, user count, revenue, ARR etc.) (0-100)
4. passive_language_penalty: Absence of weak phrases like "responsible for", "helped with", "worked on" (0-100, higher = fewer weak phrases)
5. specificity_score: Descriptions are specific, not generic filler (0-100)

Also return:
- strong_bullets: array of 3 best bullet points found
- weak_bullets: array of 3 worst bullet points found
- weak_phrases_found: array of weak phrases detected
- quantified_bullet_count: number of bullets with quantifiable metrics
- total_bullet_count: total bullets found

Return ONLY this JSON:
{
  "action_verb_score": number,
  "quantification_score": number,
  "scope_indicators_score": number,
  "passive_language_penalty": number,
  "specificity_score": number,
  "strong_bullets": [],
  "weak_bullets": [],
  "weak_phrases_found": [],
  "quantified_bullet_count": number,
  "total_bullet_count": number
}
`;

/**
 * Section Completeness — 12 pts
 * Every missing section is a parseable field that returns null in the ATS DB.
 * Null fields lower the candidate's rank in filtered searches.
 */
const sectionCompletenessPrompt = (resume, targetRole) => `
Evaluate which sections are present and complete in this resume.

Target Role: ${targetRole}
Resume: ${resume}

For each section, indicate if present (true/false) and quality (0-100):
Sections: contact_info, professional_summary, work_experience, education, skills, projects, certifications, linkedin_or_portfolio

Also score:
- summary_quality: Is the summary targeted and impactful? (0-100)
- experience_depth: Average depth of experience entries (multiple bullets, dates, company) (0-100)
- skills_categorized: Are skills organized by category (0-100)

Return ONLY this JSON:
{
  "sections_present": {
    "contact_info": boolean,
    "professional_summary": boolean,
    "work_experience": boolean,
    "education": boolean,
    "skills": boolean,
    "projects": boolean,
    "certifications": boolean,
    "linkedin_or_portfolio": boolean
  },
  "sections_quality": {
    "contact_info": number,
    "professional_summary": number,
    "work_experience": number,
    "education": number,
    "skills": number,
    "projects": number
  },
  "summary_quality": number,
  "experience_depth": number,
  "skills_categorized": number,
  "missing_sections": []
}
`;

/**
 * Role Alignment — 12 pts
 * Seniority match, industry relevance, tech stack overlap, career trajectory.
 */
const roleAlignmentPrompt = (resume, targetRole, jobDescription) => `
Evaluate how well this resume aligns with the target role.

Target Role: ${targetRole}
Job Description: ${jobDescription || "Not provided"}
Resume: ${resume}

Score 0-100 on each:
1. seniority_match: Years of experience and level match the target role seniority (0-100)
2. tech_stack_overlap: Technologies/tools match what's needed for the role (0-100)
3. industry_relevance: Prior companies/domains are relevant to target role (0-100)
4. career_trajectory: Career progression makes sense for this application (0-100)
5. education_fit: Education level and field appropriate for role (0-100)

Also return:
- inferred_seniority_level: "junior" | "mid" | "senior" | "staff" | "principal"
- years_of_experience: estimated years
- target_role_seniority: what seniority the target role likely needs
- alignment_gaps: array of specific gaps (max 5)
- alignment_strengths: array of key strengths (max 5)

Return ONLY this JSON:
{
  "seniority_match": number,
  "tech_stack_overlap": number,
  "industry_relevance": number,
  "career_trajectory": number,
  "education_fit": number,
  "inferred_seniority_level": string,
  "years_of_experience": number,
  "target_role_seniority": string,
  "alignment_gaps": [],
  "alignment_strengths": []
}
`;

/**
 * Contact Info — 8 pts
 * ATS can't schedule an interview without complete, correctly formatted contact info.
 */
const contactInfoPrompt = (resume) => `
Evaluate the contact information completeness and quality.

Resume: ${resume}

Score 0-100 on each:
1. name_present: Full name clearly at top (0-100)
2. email_present: Professional email present (0-100)
3. phone_present: Phone number present and formatted (0-100)
4. location_present: City/State or City/Country present (0-100)
5. linkedin_present: LinkedIn URL present (0-100)
6. portfolio_github_present: Portfolio, GitHub, or personal site present (0-100)
7. email_professionalism: Email is professional (not "cooldev123@") (0-100)

Also return:
- email_found: string or null
- phone_found: string or null
- location_found: string or null
- contact_issues: array of issues

Return ONLY this JSON:
{
  "name_present": number,
  "email_present": number,
  "phone_present": number,
  "location_present": number,
  "linkedin_present": number,
  "portfolio_github_present": number,
  "email_professionalism": number,
  "email_found": string_or_null,
  "phone_found": string_or_null,
  "location_found": string_or_null,
  "contact_issues": []
}
`;

/**
 * Readability — 7 pts
 * Overly long sentences, jargon soup, unclear descriptions hurt both ATS
 * NLP pipelines and the recruiter who reads after ATS shortlists.
 */
const readabilityPrompt = (resume) => `
Evaluate readability and clarity of this resume.

Resume: ${resume}

Score 0-100 on each:
1. sentence_length_score: Bullets and sentences are appropriately concise (0-100)
2. clarity_score: Descriptions are clear to someone outside the company (0-100)
3. consistency_score: Consistent tense (past for past roles, present for current) (0-100)
4. jargon_balance_score: Technical terms used appropriately without being inaccessible (0-100)
5. grammar_score: No grammatical errors or typos detected (0-100)

Also return:
- avg_bullet_length_words: estimated average words per bullet
- longest_bullet: the longest bullet point text (truncated to 100 chars)
- readability_issues: array of issues found (max 6)

Return ONLY this JSON:
{
  "sentence_length_score": number,
  "clarity_score": number,
  "consistency_score": number,
  "jargon_balance_score": number,
  "grammar_score": number,
  "avg_bullet_length_words": number,
  "longest_bullet": string,
  "readability_issues": []
}
`;

/**
 * ATS Anti-Patterns — 6 pts
 * Known things that break ATS parsers or get resumes auto-rejected.
 */
const antiPatternsPrompt = (resume) => `
Detect ATS anti-patterns in this resume text.

Resume: ${resume}

Score 0-100 on each (higher = fewer/no issues found):
1. no_images_or_graphics: No mention of charts, icons, or photo placeholders (0-100)
2. no_text_boxes: No indication of floating text boxes (0-100)
3. no_headers_footers: Contact info not repeated in header/footer (0-100)
4. no_abbreviation_overload: Common abbreviations are accompanied by full form on first use (0-100)
5. no_reference_placeholder: No "References available upon request" (wastes space) (0-100)
6. no_objective_statement: No outdated objective statement (should be summary instead) (0-100)

Also return:
- anti_patterns_found: array of specific anti-patterns detected
- critical_issues: array of ATS-breaking problems (0 = great)

Return ONLY this JSON:
{
  "no_images_or_graphics": number,
  "no_text_boxes": number,
  "no_headers_footers": number,
  "no_abbreviation_overload": number,
  "no_reference_placeholder": number,
  "no_objective_statement": number,
  "anti_patterns_found": [],
  "critical_issues": []
}
`;

// ─── 3. INDIVIDUAL SCORERS ──────────────────────────────────────────────────────

const callGroq = async (systemPrompt, userPrompt) => {
  if (!config.groqApiKey) throw new Error("ATS model is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.atsTimeoutMs);
  try {
    const response = await createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature: 0.1, 
      response_format: { type: "json_object" },
    }, { signal: controller.signal });
    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    return normalizeModelObject(JSON.parse(raw));
  } finally {
    clearTimeout(timeout);
  }
};
   
// ─── 4. DIMENSION SCORE CALCULATORS ────────────────────────────────────────────

const calcKeywordScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { exact_match_score = 0, semantic_match_score = 0, placement_score = 0, density_score = 0, title_match_score = 0 } = data;
  const base = (exact_match_score * 0.35) + (semantic_match_score * 0.20) + (placement_score * 0.20) + (density_score * 0.10) + (title_match_score * 0.15);
  const stuffingPenalty = data.keyword_stuffing_detected ? 15 : 0;
  return Math.max(0, Math.round(base - stuffingPenalty));
};

const calcFormatScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { structure_clarity = 0, date_format_consistency = 0, bullet_point_clarity = 0, section_order_score = 0, no_tables_or_columns = 0 } = data;
  let base = (structure_clarity * 0.25) + (date_format_consistency * 0.20) + (bullet_point_clarity * 0.20) + (section_order_score * 0.15) + (no_tables_or_columns * 0.20);
  if (data.has_tables) base -= 20;
  if (data.has_multi_columns) base -= 20;
  if (data.has_headers_footers) base -= 10;
  return Math.max(0, Math.round(base));
};

const calcImpactScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { action_verb_score = 0, quantification_score = 0, scope_indicators_score = 0, passive_language_penalty = 0, specificity_score = 0 } = data;
  return Math.round((action_verb_score * 0.25) + (quantification_score * 0.30) + (scope_indicators_score * 0.20) + (passive_language_penalty * 0.15) + (specificity_score * 0.10));
};

const calcCompletenessScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const sections = data.sections_present || {};
  const coreWeights = { contact_info: 20, professional_summary: 15, work_experience: 25, education: 15, skills: 15, projects: 5, certifications: 3, linkedin_or_portfolio: 2 };
  let presenceScore = 0;
  for (const [key, weight] of Object.entries(coreWeights)) {
    presenceScore += sections[key] ? weight : 0;
  }
  const qualityScores = Object.values(data.sections_quality || {});
  const avgQuality = qualityScores.length ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;
  return Math.round((presenceScore * 0.6) + (avgQuality * 0.4));
};

const calcAlignmentScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { seniority_match = 0, tech_stack_overlap = 0, industry_relevance = 0, career_trajectory = 0, education_fit = 0 } = data;
  return Math.round((seniority_match * 0.30) + (tech_stack_overlap * 0.30) + (industry_relevance * 0.20) + (career_trajectory * 0.15) + (education_fit * 0.05));
};

const calcContactScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { name_present = 0, email_present = 0, phone_present = 0, location_present = 0, linkedin_present = 0, portfolio_github_present = 0, email_professionalism = 0 } = data;
  return Math.round((name_present * 0.20) + (email_present * 0.20) + (phone_present * 0.15) + (location_present * 0.15) + (linkedin_present * 0.15) + (portfolio_github_present * 0.10) + (email_professionalism * 0.05));
};

const calcReadabilityScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { sentence_length_score = 0, clarity_score = 0, consistency_score = 0, jargon_balance_score = 0, grammar_score = 0 } = data;
  return Math.round((sentence_length_score * 0.20) + (clarity_score * 0.25) + (consistency_score * 0.20) + (jargon_balance_score * 0.15) + (grammar_score * 0.20));
};

const calcAntiPatternScore = (data) => {
  if (!data || Object.keys(data).length === 0) return 0;
  const { no_images_or_graphics = 0, no_text_boxes = 0, no_headers_footers = 0, no_abbreviation_overload = 0, no_reference_placeholder = 0, no_objective_statement = 0 } = data;
  return Math.round((no_images_or_graphics * 0.25) + (no_text_boxes * 0.20) + (no_headers_footers * 0.15) + (no_abbreviation_overload * 0.15) + (no_reference_placeholder * 0.10) + (no_objective_statement * 0.15));
};

// ─── 5. MAIN SCORER ────────────────────────────────────────────────────────────

/**
 * 
 * scoreResume — full MAANG-level ATS scoring
 *
 * @param {object} params
 * @param {string} params.resumeText   — full plain-text resume
 * @param {string} params.targetRole   — e.g. "Senior Software Engineer"
 * @param {string} [params.jobDescription] — optional JD paste for deeper analysis
 * @returns {Promise<ATSScoreResult>}
 */
export const scoreResume = async ({ resumeText, targetRole, jobDescription = "" }) => {
  if (!resumeText || resumeText.trim().length < 100) {
    throw new Error("Resume text too short to score meaningfully.");
  }

  // Run all dimension evaluations in parallel for speed
  const [
    keywordData,
    formatData,
    impactData,
    completenessData,
    alignmentData,
    contactData,
    readabilityData,
    antiPatternData,
  ] = (await Promise.allSettled([
    callGroq(SCORE_SYSTEM, keywordRelevancePrompt(resumeText, jobDescription, targetRole)),
    callGroq(SCORE_SYSTEM, formatParsabilityPrompt(resumeText)),
    callGroq(SCORE_SYSTEM, impactLanguagePrompt(resumeText)),
    callGroq(SCORE_SYSTEM, sectionCompletenessPrompt(resumeText, targetRole)),
    callGroq(SCORE_SYSTEM, roleAlignmentPrompt(resumeText, targetRole, jobDescription)),
    callGroq(SCORE_SYSTEM, contactInfoPrompt(resumeText)),
    callGroq(SCORE_SYSTEM, readabilityPrompt(resumeText)),
    callGroq(SCORE_SYSTEM, antiPatternsPrompt(resumeText)),
  ])).map((result) => result.status === "fulfilled" ? result.value : {});

  // Calculate 0-100 score per dimension
  const dimensionScores = {
    keywordRelevance: clampScore(calcKeywordScore(keywordData)),
    formatParsability: clampScore(calcFormatScore(formatData)),
    impactLanguage: clampScore(calcImpactScore(impactData)),
    sectionCompleteness: clampScore(calcCompletenessScore(completenessData)),
    roleAlignment: clampScore(calcAlignmentScore(alignmentData)),
    contactInfo: clampScore(calcContactScore(contactData)),
    readability: clampScore(calcReadabilityScore(readabilityData)),
    atsAntiPatterns: clampScore(calcAntiPatternScore(antiPatternData)),
  };

  // Weighted overall score
  let overallScore = 0;
  for (const [key, weight] of Object.entries(ATS_WEIGHTS)) {
    overallScore += (dimensionScores[key] / 100) * weight;
  }
  overallScore = clampScore(overallScore);

  // Tier classification
  const tier =
    overallScore >= 85 ? "Excellent — likely to pass ATS and impress recruiters" :
    overallScore >= 70 ? "Good — will pass most ATS, some improvements needed" :
    overallScore >= 55 ? "Fair — may pass ATS but will lose to optimized competitors" :
    overallScore >= 40 ? "Poor — likely filtered out by ATS before human review" :
    "Critical — major issues will prevent ATS parsing";

  // Priority recommendations
  const recommendations = generateRecommendations({
    dimensionScores,
    keywordData,
    formatData,
    impactData,
    completenessData,
    alignmentData,
    contactData,
    readabilityData,
    antiPatternData,
    targetRole,
  });

  return {
    overallScore,
    tier,
    dimensionScores,
    weights: ATS_WEIGHTS,
    details: {
      keyword: keywordData,
      format: formatData,
      impact: impactData,
      completeness: completenessData,
      alignment: alignmentData,
      contact: contactData,
      readability: readabilityData,
      antiPatterns: antiPatternData,
    },
    recommendations,
    scoredAt: new Date().toISOString(),
    targetRole,
    degraded: Object.values(dimensionScores).some((score) => score === 0),
  };
};

// ─── 6. RECOMMENDATION ENGINE ──────────────────────────────────────────────────

function generateRecommendations({ dimensionScores, keywordData, formatData, impactData, completenessData, alignmentData, contactData, readabilityData, antiPatternData, targetRole }) {
  const recs = [];

  // Sort dimensions by score to fix lowest first
  const sorted = Object.entries(dimensionScores).sort(([, a], [, b]) => a - b);

  for (const [dimension, score] of sorted) {
    if (score >= 80) continue; // no rec needed

    switch (dimension) {
      case "keywordRelevance":
        if ((keywordData.missing_keywords || []).length > 0) {
          recs.push({
            priority: score < 50 ? "critical" : "high",
            dimension: "Keyword Relevance",
            issue: `Missing ${keywordData.missing_keywords.length} important keywords for ${targetRole}`,
            fix: `Add these missing terms naturally into your experience and summary: ${keywordData.missing_keywords.slice(0, 5).join(", ")}`,
            impact: "ATS keyword match directly gates whether your resume is seen by a human",
          });
        }
        if (keywordData.keyword_stuffing_detected) {
          recs.push({
            priority: "high",
            dimension: "Keyword Relevance",
            issue: "Keyword stuffing detected",
            fix: "Remove keyword lists in unnatural places. ATS systems now penalize stuffing.",
            impact: "Modern ATS uses NLP — stuffing reads as spam and lowers your score",
          });
        }
        if (keywordData.placement_score < 60) {
          recs.push({
            priority: "medium",
            dimension: "Keyword Relevance",
            issue: "Keywords concentrated only in skills section",
            fix: "Mirror JD keywords into your summary and experience bullet points, not just the skills list",
            impact: "Keyword placement in context (not just a list) scores higher in ATS",
          });
        }
        break;

      case "formatParsability":
        if (formatData.has_tables) {
          recs.push({
            priority: "critical",
            dimension: "Format",
            issue: "Tables detected — most ATS parsers scramble table content",
            fix: "Replace tables with plain bulleted lists. No exceptions for ATS compatibility.",
            impact: "Tables are the #1 resume format killer — your data becomes unreadable",
          });
        }
        if ((formatData.format_issues || []).length > 0) {
          recs.push({
            priority: "high",
            dimension: "Format",
            issue: `${formatData.format_issues.length} format issues found`,
            fix: formatData.format_issues[0],
            impact: "Format issues cause ATS to fail parsing fields, dropping you from filtered searches",
          });
        }
        break;

      case "impactLanguage":
        if (impactData.quantification_score < 60) {
          const ratio = impactData.total_bullet_count > 0
            ? Math.round((impactData.quantified_bullet_count / impactData.total_bullet_count) * 100)
            : 0;
          recs.push({
            priority: score < 50 ? "critical" : "high",
            dimension: "Impact Language",
            issue: `Only ${ratio}% of bullets have quantifiable metrics`,
            fix: "Add numbers to at least 50% of bullets: users impacted, % improvement, $ revenue, team size, etc.",
            impact: "Quantified resumes are 40% more likely to advance past initial screening",
          });
        }
        if ((impactData.weak_phrases_found || []).length > 0) {
          recs.push({
            priority: "high",
            dimension: "Impact Language",
            issue: `Weak phrases found: "${impactData.weak_phrases_found.slice(0, 3).join('", "')}"`,
            fix: "Replace passive phrases with strong action verbs: Led, Engineered, Reduced, Scaled, Shipped",
            impact: "Passive language signals low initiative — a major recruiter red flag",
          });
        }
        break;

      case "sectionCompleteness":
        if ((completenessData.missing_sections || []).length > 0) {
          recs.push({
            priority: "high",
            dimension: "Section Completeness",
            issue: `Missing sections: ${completenessData.missing_sections.join(", ")}`,
            fix: `Add the missing sections. Each missing section is a null field in the ATS database.`,
            impact: "Recruiters filter by section presence — null fields exclude you from searches",
          });
        }
        if (!completenessData.sections_present?.professional_summary) {
          recs.push({
            priority: "high",
            dimension: "Section Completeness",
            issue: "No professional summary found",
            fix: "Add a 3-4 line summary targeting the specific role. This is the first thing ATS and recruiters read.",
            impact: "Summaries increase ATS relevance scores by establishing role context upfront",
          });
        }
        break;

      case "roleAlignment":
        if ((alignmentData.alignment_gaps || []).length > 0) {
          recs.push({
            priority: "medium",
            dimension: "Role Alignment",
            issue: `Alignment gaps: ${alignmentData.alignment_gaps.slice(0, 2).join("; ")}`,
            fix: "Bridge gaps by adding relevant projects, highlighting transferable skills, or adding certifications",
            impact: "Role alignment affects recruiter ranking even after ATS passes the resume",
          });
        }
        if (alignmentData.seniority_match < 50) {
          recs.push({
            priority: "high",
            dimension: "Role Alignment",
            issue: `Seniority mismatch: your resume reads as ${alignmentData.inferred_seniority_level} but role needs ${alignmentData.target_role_seniority}`,
            fix: "Adjust language and scope indicators to better match the target role's seniority expectations",
            impact: "Seniority mismatches cause auto-rejection before human review",
          });
        }
        break;

      case "contactInfo":
        if ((contactData.contact_issues || []).length > 0) {
          recs.push({
            priority: "medium",
            dimension: "Contact Info",
            issue: contactData.contact_issues[0],
            fix: "Ensure name, email, phone, location, and LinkedIn are all present and at the top of the resume",
            impact: "ATS can't send interview invites without complete contact info",
          });
        }
        break;

      case "readability":
        if (readabilityData.avg_bullet_length_words > 30) {
          recs.push({
            priority: "medium",
            dimension: "Readability",
            issue: `Average bullet is ${readabilityData.avg_bullet_length_words} words — too long`,
            fix: "Trim bullets to 15-20 words. One achievement per bullet. Remove filler words.",
            impact: "Recruiters spend 6-10 seconds scanning — long bullets lose them",
          });
        }
        if (readabilityData.consistency_score < 60) {
          recs.push({
            priority: "medium",
            dimension: "Readability",
            issue: "Inconsistent verb tense across roles",
            fix: "Use past tense for all past roles, present tense only for current role",
            impact: "Inconsistency signals poor attention to detail — a soft red flag for hiring managers",
          });
        }
        break;

      case "atsAntiPatterns":
        if ((antiPatternData.critical_issues || []).length > 0) {
          recs.push({
            priority: "critical",
            dimension: "ATS Anti-Patterns",
            issue: antiPatternData.critical_issues[0],
            fix: "Remove this immediately — it will cause ATS parsing failure",
            impact: "Critical ATS issues cause silent rejections — the system processes you as blank",
          });
        }
        if (antiPatternData.no_objective_statement < 70) {
          recs.push({
            priority: "low",
            dimension: "ATS Anti-Patterns",
            issue: "Outdated objective statement found",
            fix: "Replace with a modern professional summary targeting the role",
            impact: "Objective statements were replaced by summaries a decade ago — signals outdated knowledge",
          });
        }
        break;
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs.slice(0, 10); // Top 10 prioritized recommendations
}

// ─── 7. UTILITY: FORMAT SCORE RESULT FOR DISPLAY ───────────────────────────────

export const formatScoreForDisplay = (result) => {
  const bars = Object.entries(result.dimensionScores).map(([key, score]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    const weight = ATS_WEIGHTS[key];
    return `${label.padEnd(25)} ${score.toString().padStart(3)}/100  (weight: ${weight}%)`;
  }).join('\n');

  const recs = result.recommendations.map((r, i) =>
    `${i + 1}. [${r.priority.toUpperCase()}] ${r.dimension}: ${r.issue}\n   → ${r.fix}`
  ).join('\n\n');

  return `
ATS SCORE REPORT
════════════════════════════════════════
Overall Score: ${result.overallScore}/100
Status: ${result.tier}
Target Role: ${result.targetRole}
Scored At: ${result.scoredAt}

DIMENSION BREAKDOWN
────────────────────────────────────────
${bars}

TOP RECOMMENDATIONS
────────────────────────────────────────
${recs}
`.trim();
};
