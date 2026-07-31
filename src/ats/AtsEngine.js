/**
 * AtsEngine.js — Deterministic ATS Scoring Engine
 *
 * Orchestrates 8 pure-function analyzers with specified weights.
 * No AI calls. Same input → same output.
 *
 * Weights (sum = 100):
 *   keywordRelevance    22%
 *   formatParsability   16%
 *   impactLanguage      15%
 *   sectionCompleteness 12%
 *   roleAlignment       10%
 *   contactInfo          8%
 *   readability          6%
 *   atsAntiPatterns      6%
 *   enterpriseImpact     5%
 */

import { analyzeKeywords }      from "./analyzers/keywordAnalyzer.js";
import { analyzeImpact }        from "./analyzers/impactAnalyzer.js";
import { analyzeSections }      from "./analyzers/sectionAnalyzer.js";
import { analyzeRoleAlignment } from "./analyzers/roleAlignmentAnalyzer.js";
import { analyzeContact }       from "./analyzers/contactAnalyzer.js";
import { analyzeReadability }   from "./analyzers/readabilityAnalyzer.js";
import { analyzeAntiPatterns }  from "./analyzers/antiPatternAnalyzer.js";
import { analyzeFormat }        from "./analyzers/formatAnalyzer.js";
import { analyzeEnterpriseImpact } from "./analyzers/enterpriseImpactAnalyzer.js";

export const WEIGHTS = {
  keywordRelevance:     22,
  formatParsability:    16,
  impactLanguage:       15,
  sectionCompleteness:  12,
  roleAlignment:        10,
  contactInfo:           8,
  readability:           6,
  atsAntiPatterns:       6,
  enterpriseImpact:     5,
};

const getTier = (score) => {
  if (score >= 85) return "Excellent — likely to pass ATS and impress recruiters";
  if (score >= 70) return "Good — will pass most ATS, some improvements needed";
  if (score >= 55) return "Fair — may pass ATS but will lose to optimized competitors";
  if (score >= 40) return "Poor — likely filtered out by ATS before human review";
  return "Critical — major issues will prevent ATS parsing";
};

const clamp = (value) => Math.round(Math.min(100, Math.max(0, Number(value) || 0)));

const SECTION_HEADER_MAP = [
  { key: "summary", label: "Summary", pattern: /^(summary|profile|objective|professional summary|career objective)\s*:?\s*$/i },
  { key: "experience", label: "Experience", pattern: /^(experience|work experience|professional experience|employment|work history)\s*:?\s*$/i },
  { key: "education", label: "Education", pattern: /^(education|academic|qualification|qualifications)\s*:?\s*$/i },
  { key: "skills", label: "Skills", pattern: /^(skills|technical skills|core skills|technologies|tech stack|tools)\s*:?\s*$/i },
  { key: "projects", label: "Projects", pattern: /^(projects|portfolio|side projects|personal projects|open.?source)\s*:?\s*$/i },
  { key: "certifications", label: "Certifications", pattern: /^(certifications?|certificates?|licenses?|credentials?)\s*:?\s*$/i },
];

const getResumeLines = (text = "") => text
  .split(/\r?\n/)
  .map((text, index) => ({ index: index + 1, text: text.trim() }))
  .filter((line) => line.text);

const splitResumeSections = (text = "") => {
  const sections = {};
  let currentKey = "header";
  let currentLabel = "Header";
  let startLine = 1;

  for (const { index, text: line } of getResumeLines(text)) {
    const matched = SECTION_HEADER_MAP.find((section) => section.pattern.test(line));
    if (matched) {
      currentKey = matched.key;
      currentLabel = matched.label;
      startLine = index + 1;
      if (!sections[currentKey]) sections[currentKey] = { key: currentKey, label: currentLabel, startLine, lines: [] };
      continue;
    }

    if (!sections[currentKey]) sections[currentKey] = { key: currentKey, label: currentLabel, startLine, lines: [] };
    sections[currentKey].lines.push({ index, text: line });
  }

  return sections;
};

const findKeywordLineMatches = (resumeText = "", keywords = []) => {
  const lines = getResumeLines(resumeText);
  return keywords.slice(0, 12).map((keyword) => {
    const escaped = String(keyword).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const matchedLine = lines.find((line) => regex.test(line.text));
    return {
      keyword,
      status: matchedLine ? "found" : "missing",
      line: matchedLine?.index || null,
      evidence: matchedLine?.text || null,
    };
  });
};

const buildLineLevelIssues = (resumeText = "", analyzerResults = {}) => {
  const issues = [];
  const lines = getResumeLines(resumeText);
  const weakPhrases = analyzerResults.impactLanguage?.weakPhrasesFound || [];
  const missingKeywords = analyzerResults.keywordRelevance?.missingKeywords || [];

  for (const phrase of weakPhrases) {
    const line = lines.find((candidate) => candidate.text.toLowerCase().includes(String(phrase).toLowerCase()));
    if (line) {
      issues.push({
        line: line.index,
        section: "Impact Language",
        severity: "high",
        issue: `Weak phrase "${phrase}" reduces impact.`,
        fix: "Rewrite this line with a direct action verb and a measurable result.",
        evidence: line.text,
      });
    }
  }

  const bulletLines = lines.filter((line) => /^[-*•]/.test(line.text));
  for (const line of bulletLines.slice(0, 40)) {
    const wordCount = line.text.split(/\s+/).filter(Boolean).length;
    const hasMetric = /(\d+\s*%|\$[\d,]+|\b\d{2,}(?:,\d{3})*\b|\d+x\b)/i.test(line.text);
    const firstWord = line.text.replace(/^[-*•]\s*/, "").split(/\s+/)[0]?.toLowerCase();
    const startsSoftly = ["worked", "helped", "assisted", "responsible", "supported"].includes(firstWord);

    if (!hasMetric && wordCount >= 8) {
      issues.push({
        line: line.index,
        section: "Experience",
        severity: "medium",
        issue: "Bullet has no measurable result.",
        fix: "Add a number such as percentage improvement, revenue, users, volume, time saved, or team size.",
        evidence: line.text,
      });
    }

    if (startsSoftly) {
      issues.push({
        line: line.index,
        section: "Experience",
        severity: "medium",
        issue: "Bullet starts with a weak verb.",
        fix: "Start with a stronger verb such as Built, Led, Reduced, Automated, Improved, Shipped, or Scaled.",
        evidence: line.text,
      });
    }
  }

  for (const keyword of missingKeywords.slice(0, 5)) {
    issues.push({
      line: null,
      section: "Keyword Relevance",
      severity: "high",
      issue: `Missing job keyword: ${keyword}.`,
      fix: "Add this only if truthful, preferably in Summary, Experience, or Projects with supporting context.",
      evidence: null,
    });
  }

  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.line}-${issue.issue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
};

const buildSectionScores = (resumeText = "", analyzerResults = {}) => {
  const sections = splitResumeSections(resumeText);
  const keyword = analyzerResults.keywordRelevance || {};
  const impact = analyzerResults.impactLanguage || {};
  const completeness = analyzerResults.sectionCompleteness || {};

  const scoreSection = (key, label) => {
    const section = sections[key];
    const text = section?.lines.map((line) => line.text).join("\n") || "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const bulletCount = section?.lines.filter((line) => /^[-*•]/.test(line.text)).length || 0;
    const hasMetric = /(\d+\s*%|\$[\d,]+|\b\d{2,}(?:,\d{3})*\b|\d+x\b)/i.test(text);
    const isMissing = (completeness.missingSections || []).some((name) => name.toLowerCase().includes(label.toLowerCase()));

    let score = isMissing || !text.trim() ? 20 : 70;
    const notes = [];

    if (!text.trim()) notes.push(`${label} content is missing or too hard for ATS to identify.`);
    if (wordCount >= 35) score += 10;
    else if (key !== "skills" && key !== "education") notes.push(`${label} is thin; add more role-specific detail.`);
    if (bulletCount >= 3) score += 10;
    if ((key === "experience" || key === "projects") && hasMetric) score += 10;
    if ((key === "experience" || key === "projects") && !hasMetric && text.trim()) notes.push("Add quantified outcomes to strengthen this section.");
    if (key === "skills" && (keyword.skillOnlyKeywords || []).length > 3) {
      score -= 10;
      notes.push("Several skills are not supported elsewhere in the resume.");
    }
    if (key === "experience" && (impact.weakPhrasesFound || []).length > 0) {
      score -= 8;
      notes.push("Weak phrases appear in experience content.");
    }

    return {
      key,
      label,
      score: clamp(score),
      wordCount,
      bulletCount,
      notes,
    };
  };

  return ["summary", "experience", "skills", "projects", "education", "certifications"]
    .map((key) => scoreSection(key, SECTION_HEADER_MAP.find((section) => section.key === key)?.label || key));
};

const buildParserSimulation = (resumeText = "", analyzerResults = {}) => {
  const contact = analyzerResults.contactInfo || {};
  const sections = analyzerResults.sectionCompleteness || {};
  const lines = getResumeLines(resumeText);
  const firstNameLikeLine = lines.slice(0, 6).find((line) => /^[A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+){1,3}$/.test(line.text));
  const companyLines = lines.filter((line) => /\|/.test(line.text) && !/^[-*•]/.test(line.text)).slice(0, 8);
  const dateMatches = [...resumeText.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s?\d{4}\s*(?:-|–|to)\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s?\d{4})\b/gi)]
    .map((match) => match[0])
    .slice(0, 8);

  return {
    name: firstNameLikeLine?.text || null,
    email: contact.emailFound || null,
    phone: contact.phoneFound || null,
    location: contact.locationFound || null,
    linkedin: contact.linkedinFound || null,
    sectionsDetected: sections.presentSections || [],
    missingSections: sections.missingSections || [],
    companiesOrRoles: companyLines.map((line) => line.text),
    dates: dateMatches,
  };
};

const addImpactEstimates = (recommendations = [], dimensionScores = {}) => {
  const scoreByDimension = {
    "Keyword Relevance": dimensionScores.keywordRelevance,
    "Format": dimensionScores.formatParsability,
    "Impact Language": dimensionScores.impactLanguage,
    "Section Completeness": dimensionScores.sectionCompleteness,
    "Role Alignment": dimensionScores.roleAlignment,
    "Contact Info": dimensionScores.contactInfo,
    "Readability": dimensionScores.readability,
    "ATS Anti-Patterns": dimensionScores.atsAntiPatterns,
  };

  return recommendations.map((rec) => {
    const score = scoreByDimension[rec.dimension] ?? 75;
    const estimatedScoreGain = rec.priority === "critical"
      ? Math.max(8, Math.round((100 - score) * 0.22))
      : rec.priority === "high"
        ? Math.max(5, Math.round((100 - score) * 0.15))
        : rec.priority === "medium"
          ? Math.max(3, Math.round((100 - score) * 0.09))
          : 1;
    return { ...rec, estimatedScoreGain };
  });
};

const buildRecommendations = (dimensionScores, analyzerResults, targetRole, templateMetadata = {}) => {
  const recs = [];
  const sorted = Object.entries(dimensionScores).sort(([, a], [, b]) => a - b);

  for (const [dim, dimScore] of sorted) {
    if (dimScore >= 82) continue;

    const result = analyzerResults[dim] || {};
    const analyzerRec = (result.recommendations || [])[0];
    const analyzerWeakness = (result.weaknesses || [])[0];

    switch (dim) {
      case "keywordRelevance": {
        const missing = result.missingKeywords || [];
        if (missing.length > 0) {
          recs.push({
            priority: dimScore < 50 ? "critical" : "high",
            dimension: "Keyword Relevance",
            issue: `Missing ${missing.length} important keyword${missing.length > 1 ? "s" : ""} for ${targetRole || "the target role"}.`,
            fix: `Naturally add these terms to your experience and summary: ${missing.slice(0, 5).join(", ")}.`,
            impact: "ATS keyword matching directly gates whether your resume reaches a human reviewer.",
          });
        }
        if (result.stuffingDetected) {
          recs.push({
            priority: "high",
            dimension: "Keyword Relevance",
            issue: "Keyword stuffing detected.",
            fix: "Each key term should appear 1-2 times in context — not repeated in keyword dumps.",
            impact: "Modern ATS uses NLP; stuffing is flagged as spam and lowers your score.",
          });
        }
        const unsupported = result.skillOnlyKeywords || [];
        if (unsupported.length > 0) {
          recs.push({
            priority: dimScore < 70 ? "high" : "medium",
            dimension: "Keyword Relevance",
            issue: `${unsupported.length} matched keyword${unsupported.length > 1 ? "s are" : " is"} only listed in the skills section.`,
            fix: `Keep only truthful skills and support them in summary, experience, or projects: ${unsupported.slice(0, 5).join(", ")}.`,
            impact: "ATS keyword matches are stronger when the skill appears in work evidence, not just a keyword list.",
          });
        }
        break;
      }
      case "formatParsability": {
        if (result.hasMultipleColumns) {
          // Only recommend switching to single-column if the user isn't already using a two-column template.
          // Two-column templates are a deliberate choice and the resume text exported is ATS-safe plain text.
          if (!templateMetadata.isTwoColumn) {
            recs.push({
              priority: "critical",
              dimension: "Format",
              issue: "Multi-column layout may cause scrambled text in ATS parsers.",
              fix: "Switch to a single-column layout for maximum ATS compatibility.",
              impact: "Two-column resumes are misread by ~80% of ATS systems.",
            });
          }
        } else if (analyzerRec) {
          recs.push({
            priority: dimScore < 50 ? "critical" : "high",
            dimension: "Format",
            issue: analyzerWeakness || "Format issues detected.",
            fix: analyzerRec,
            impact: "Format issues prevent ATS from extracting your data into its database fields.",
          });
        }
        break;
      }
      case "impactLanguage": {
        const total = result.totalBulletCount || 0;
        const quant = result.quantifiedBulletCount || 0;
        if (total > 0 && quant / total < 0.3) {
          recs.push({
            priority: dimScore < 50 ? "critical" : "high",
            dimension: "Impact Language",
            issue: `Only ${quant} of ${total} bullets have quantifiable metrics.`,
            fix: "Add numbers to at least 40% of bullets: % improvement, $ value, team size, user count.",
            impact: "Quantified resumes are significantly more likely to advance past initial screening.",
          });
        }
        const weak = result.weakPhrasesFound || [];
        if (weak.length > 0) {
          recs.push({
            priority: "high",
            dimension: "Impact Language",
            issue: `Weak phrases found: "${weak.slice(0, 3).join('", "')}"`,
            fix: "Replace passive phrases with direct action verbs: Engineered, Reduced, Scaled, Shipped.",
            impact: "Passive language signals low initiative — a recruiter red flag.",
          });
        }
        break;
      }
      case "sectionCompleteness": {
        const missing = result.missingSections || [];
        if (missing.length > 0) {
          recs.push({
            priority: "high",
            dimension: "Section Completeness",
            issue: `Missing section${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
            fix: "Add the missing sections — each missing section is a null field in the ATS database.",
            impact: "Recruiters filter by section presence — null fields exclude you from searches.",
          });
        }
        break;
      }
      case "roleAlignment": {
        const gaps = result.alignmentGaps || [];
        if (gaps.length > 0) {
          recs.push({
            priority: "medium",
            dimension: "Role Alignment",
            issue: `Missing core skills for ${targetRole || "target role"}: ${gaps.slice(0, 4).join(", ")}.`,
            fix: "Add relevant skills through projects, certifications, or expanded experience bullets.",
            impact: "Alignment gaps lower recruiter ranking even after passing ATS.",
          });
        } else if (analyzerRec) {
          let impact = "Seniority mismatches trigger auto-rejection before human review.";
          if ((analyzerWeakness || "").toLowerCase().includes("skills are listed") || (analyzerWeakness || "").toLowerCase().includes("skill is listed")) {
            impact = "Skills listed without context or evidence are heavily discounted by modern ATS algorithms.";
          } else if ((analyzerWeakness || "").toLowerCase().includes("title")) {
            impact = "ATS parsers match role titles in your history against the target job description.";
          }
          recs.push({
            priority: dimScore < 50 ? "high" : "medium",
            dimension: "Role Alignment",
            issue: analyzerWeakness || "Seniority or skills mismatch detected.",
            fix: analyzerRec,
            impact,
          });
        }
        break;
      }
      case "contactInfo": {
        if (analyzerRec) {
          recs.push({
            priority: "medium",
            dimension: "Contact Info",
            issue: analyzerWeakness || "Incomplete contact information.",
            fix: analyzerRec,
            impact: "ATS cannot schedule interviews without complete contact details.",
          });
        }
        break;
      }
      case "readability": {
        if (result.avgBulletLength > 35) {
          recs.push({
            priority: "medium",
            dimension: "Readability",
            issue: `Average bullet length is ${result.avgBulletLength} words — too long.`,
            fix: "Trim bullets to 10-25 words. One achievement per bullet.",
            impact: "Recruiters spend 6-10 seconds scanning — verbose bullets lose them.",
          });
        } else if (analyzerRec) {
          recs.push({
            priority: "low",
            dimension: "Readability",
            issue: analyzerWeakness || "Readability issues found.",
            fix: analyzerRec,
            impact: "Poor readability hurts recruiter review even after passing ATS.",
          });
        }
        break;
      }
      case "atsAntiPatterns": {
        const critical = result.criticalIssues || [];
        if (critical.length > 0) {
          recs.push({
            priority: "critical",
            dimension: "ATS Anti-Patterns",
            issue: critical[0],
            fix: "Remove this immediately — it causes ATS parsing failure.",
            impact: "Critical ATS issues cause silent rejections.",
          });
        } else if (analyzerRec) {
          recs.push({
            priority: "low",
            dimension: "ATS Anti-Patterns",
            issue: analyzerWeakness || "Anti-patterns detected.",
            fix: analyzerRec,
            impact: "Anti-patterns reduce ATS score and recruiter trust.",
          });
        }
        break;
      }
    }
  }

  const seen = new Set();
  return recs.filter(({ fix }) => {
    if (seen.has(fix)) return false;
    seen.add(fix);
    return true;
  }).slice(0, 10);
};

/**
 * calculateAtsScore — deterministic weighted ATS scoring
 *
 * @param {string|object} resumeInput   – plain text OR resume JSON object
 * @param {string}        [jobDescription]
 * @param {string}        [targetRole]
 * @param {object}        [templateMetadata]  – kept for backward compat, unused
 * @returns {object} AtsAnalysisResult
 */
export const calculateAtsScore = (resumeInput = "", jobDescription = "", targetRole = "", templateMetadata = {}, selectedMissingKeywords = null) => {
  // Normalize input to plain text
  let resumeText = "";
  if (typeof resumeInput === "string") {
    resumeText = resumeInput;
  } else if (resumeInput && typeof resumeInput === "object") {
    const flatten = (val) => {
      if (!val) return "";
      if (typeof val === "string") return val;
      if (typeof val === "number") return String(val);
      if (Array.isArray(val)) return val.map(flatten).join(" ");
      if (typeof val === "object") return Object.values(val).map(flatten).join(" ");
      return "";
    };
    resumeText = flatten(resumeInput);
  }
  resumeText = resumeText.trim();

  // Run all analyzers
  const keyword     = analyzeKeywords(resumeText, jobDescription, targetRole, selectedMissingKeywords);
  const format      = analyzeFormat(resumeText);
  
  // Override false-positive multi-column warning if template is explicitly single-column
  if (templateMetadata && templateMetadata.isTwoColumn === false) {
    if (format.hasMultipleColumns) {
      format.hasMultipleColumns = false;
      format.score = Math.min(100, format.score + 20); // Restore format score
      
      if (format.weaknesses) {
        format.weaknesses = format.weaknesses.filter(
          w => !w.toLowerCase().includes("multi-column") && !w.toLowerCase().includes("scrambled")
        );
      }
      if (format.recommendations) {
        format.recommendations = format.recommendations.filter(
          r => !r.toLowerCase().includes("single-column") && !r.toLowerCase().includes("multi-column")
        );
      }
      if (format.formatIssues) {
        format.formatIssues = format.formatIssues.filter(
          i => !i.toLowerCase().includes("scrambled") && !i.toLowerCase().includes("multi-column")
        );
      }
    }
  }

  const impact      = analyzeImpact(resumeText);
  const sections    = analyzeSections(resumeText);
  const alignment   = analyzeRoleAlignment(resumeText, targetRole, jobDescription);
  const contact     = analyzeContact(resumeText);
  const readability = analyzeReadability(resumeText);
  const antiPattern = analyzeAntiPatterns(resumeText);
  const enterprise   = analyzeEnterpriseImpact(resumeText, targetRole, jobDescription);

  const dimensionScores = {
    keywordRelevance:    clamp(keyword.score),
    formatParsability:   clamp(format.score),
    impactLanguage:      clamp(impact.score),
    sectionCompleteness: clamp(sections.score),
    roleAlignment:       clamp(alignment.score),
    contactInfo:         clamp(contact.score),
    readability:         clamp(readability.score),
    atsAntiPatterns:     clamp(antiPattern.score),
    enterpriseImpact:    clamp(enterprise.score),
  };

  // Weighted average
  let overallScore = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    overallScore += (dimensionScores[key] / 100) * weight;
  }

  // Diminishing returns above 90
  if (overallScore > 90) overallScore = 90 + (overallScore - 90) * 0.3;

  const unsupportedKeywordCount = keyword.skillOnlyKeywords?.length || 0;
  const supportedKeywordCount = keyword.supportedKeywords?.length || 0;
  if (unsupportedKeywordCount >= 4 && unsupportedKeywordCount > supportedKeywordCount) {
    overallScore -= Math.min(8, Math.round((unsupportedKeywordCount - supportedKeywordCount) * 0.75));
  }

  const isPolishedResume =
    dimensionScores.impactLanguage >= 80 &&
    dimensionScores.contactInfo >= 90 &&
    dimensionScores.readability >= 85 &&
    dimensionScores.atsAntiPatterns >= 90 &&
    dimensionScores.sectionCompleteness >= 50;
  if (isPolishedResume) {
    const metricBonus = Math.min(4, Math.floor((impact.quantifiedBulletCount || 0) / 2));
    const evidenceBonus = Math.min(3, Math.floor((keyword.supportedKeywords || []).length / 4));
    overallScore += 3 + metricBonus + evidenceBonus;
  }

  // Hard cap at 97
  overallScore = Math.min(97, Math.round(overallScore));

  const tier = getTier(overallScore);

  const analyzerResults = {
    keywordRelevance:    keyword,
    formatParsability:   format,
    impactLanguage:      impact,
    sectionCompleteness: sections,
    roleAlignment:       alignment,
    contactInfo:         contact,
    readability:         readability,
    atsAntiPatterns:     antiPattern,
  };
  const recommendations = addImpactEstimates(
    buildRecommendations(dimensionScores, analyzerResults, targetRole, templateMetadata),
    dimensionScores
  );
  const sectionScores = buildSectionScores(resumeText, analyzerResults);
  const parserSimulation = buildParserSimulation(resumeText, analyzerResults);
  const lineLevelIssues = buildLineLevelIssues(resumeText, analyzerResults);
  const keywordEvidence = findKeywordLineMatches(resumeText, [
    ...(keyword.matchedKeywords || []),
    ...(keyword.missingKeywords || []),
  ]);

  return {
    overallScore,
    tier,
    targetRole: targetRole || "",
    scoredAt: new Date().toISOString(),
    dimensionScores,

    // Legacy breakdown shape
    breakdown: {
      keywordScore:      dimensionScores.keywordRelevance,
      formatScore:       dimensionScores.formatParsability,
      impactScore:       dimensionScores.impactLanguage,
      completenessScore: dimensionScores.sectionCompleteness,
      alignmentScore:    dimensionScores.roleAlignment,
      contactScore:      dimensionScores.contactInfo,
      readabilityScore:  dimensionScores.readability,
      antiPatternScore:  dimensionScores.atsAntiPatterns,
      enterpriseScore:   dimensionScores.enterpriseImpact,
    },

    recommendations,

    details: {
      keyword: {
        missing_keywords:          keyword.missingKeywords  || [],
        matched_keywords:          keyword.matchedKeywords  || [],
        supported_keywords:        keyword.supportedKeywords || [],
        unsupported_skill_keywords: keyword.skillOnlyKeywords || [],
        keyword_stuffing_detected: keyword.stuffingDetected || false,
        keyword_density:           keyword.keywordDensity   || 0,
      },
      impact: {
        weak_phrases_found:      impact.weakPhrasesFound       || [],
        quantified_bullet_count: impact.quantifiedBulletCount  || 0,
        total_bullet_count:      impact.totalBulletCount       || 0,
        action_verb_count:       impact.actionVerbCount        || 0,
      },
      completeness: {
        missing_sections: sections.missingSections || [],
        present_sections: sections.presentSections || [],
      },
      alignment: {
        inferred_seniority_level: alignment.inferredSeniority  || "unknown",
        target_seniority:         alignment.targetSeniority    || "unknown",
        alignment_gaps:           alignment.alignmentGaps      || [],
        alignment_strengths:      alignment.alignmentStrengths || [],
        unsupported_skill_matches: alignment.unsupportedSkillMatches || [],
      },
      format: {
        format_issues:     format.formatIssues       || [],
        date_formats:      format.dateFormats        || [],
        has_multi_columns: format.hasMultipleColumns || false,
      },
      contact: {
        email_found:        contact.emailFound        || null,
        phone_found:        contact.phoneFound        || null,
        location_found:     contact.locationFound     || null,
        linkedin_found:     contact.linkedinFound     || null,
        email_professional: contact.emailProfessional !== false,
      },
      sectionScores,
      parserSimulation,
      lineLevelIssues,
      keywordEvidence,
      antiPatterns: {
        anti_patterns_found: antiPattern.antiPatternsFound || [],
        critical_issues:     antiPattern.criticalIssues    || [],
      },
    },

    strengths: [
      ...keyword.strengths,
      ...format.strengths,
      ...impact.strengths,
      ...sections.strengths,
      ...alignment.strengths,
      ...contact.strengths,
    ].slice(0, 8),

    weaknesses: [
      ...keyword.weaknesses,
      ...impact.weaknesses,
      ...sections.weaknesses,
      ...alignment.weaknesses,
      ...contact.weaknesses,
      ...antiPattern.weaknesses,
    ].slice(0, 8),
  };
};
