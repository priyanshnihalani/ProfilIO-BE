/**
 * formatAnalyzer.js — Deterministic format parsability analyzer
 */

const DATE_FORMATS = [
  { id: "MMM_YYYY",   pattern: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/gi },
  { id: "MM/YYYY",    pattern: /\b(?:0?[1-9]|1[0-2])\/\d{4}\b/g },
  { id: "MONTH_YYYY", pattern: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi },
  { id: "YYYY",       pattern: /\b(19|20)\d{2}\b/g },
  { id: "YYYY-MM",    pattern: /\b\d{4}-(?:0[1-9]|1[0-2])\b/g },
];

const PRESENT_TERMS = /\b(present|current|now|ongoing)\b/i;
const SECTION_HEADER_PATTERNS = [
  { name: "Contact",    pattern: /\b(contact|email|phone|linkedin)\b/i,   order: 0 },
  { name: "Summary",    pattern: /\b(summary|profile|objective|about)\b/i, order: 1 },
  { name: "Experience", pattern: /\b(experience|employment|work history)\b/i, order: 2 },
  { name: "Education",  pattern: /\b(education|degree|university|college)\b/i, order: 3 },
  { name: "Skills",     pattern: /\b(skills|technologies|competencies)\b/i, order: 4 },
];
const BULLET_CHARS_REGEX = /^[\s]*([•·▪○■→–—\-*>])\s/m;

const detectDateFormats = (text = "") => {
  const found = new Set();
  let remainingText = text;

  // Order patterns from most specific to least specific
  const patternsInOrder = [
    { id: "MONTH_YYYY", pattern: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi },
    { id: "MMM_YYYY",   pattern: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/gi },
    { id: "MM/YYYY",    pattern: /\b(?:0?[1-9]|1[0-2])\/\d{4}\b/g },
    { id: "YYYY-MM",    pattern: /\b\d{4}-(?:0[1-9]|1[0-2])\b/g },
    { id: "YYYY",       pattern: /\b(19|20)\d{2}\b/g },
  ];

  for (const { id, pattern } of patternsInOrder) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(remainingText)) {
      found.add(id);
      remainingText = remainingText.replace(re, " [DATE] ");
    }
  }

  if (PRESENT_TERMS.test(text)) found.add("PRESENT");
  return Array.from(found);
};

const dateConsistencyScore = (dateFormats = []) => {
  const realFormats = dateFormats.filter((f) => f !== "PRESENT");
  if (realFormats.length === 0) return 70;
  if (realFormats.length === 1) return 100;
  if (realFormats.length === 2) return 80;
  if (realFormats.length === 3) return 55;
  return 30;
};

const structureClarityScore = (text = "") => {
  const present = SECTION_HEADER_PATTERNS.filter(({ pattern }) => pattern.test(text));
  if (present.length >= 5) return 100;
  if (present.length === 4) return 85;
  if (present.length === 3) return 70;
  if (present.length === 2) return 50;
  if (present.length === 1) return 35;
  return 20;
};

const bulletConsistencyScore = (text = "") => {
  const lines = text.split("\n");
  const bulletMarkers = new Set();
  for (const line of lines) {
    const m = BULLET_CHARS_REGEX.exec(line);
    if (m) bulletMarkers.add(m[1]);
  }
  if (bulletMarkers.size === 0) return 80;
  if (bulletMarkers.size === 1) return 100;
  if (bulletMarkers.size === 2) return 75;
  return 50;
};

const sectionOrderScore = (text = "") => {
  const positions = [];
  for (const { pattern, order } of SECTION_HEADER_PATTERNS) {
    const match = text.search(pattern);
    if (match !== -1) positions.push({ order, pos: match });
  }
  if (positions.length < 2) return 80;
  positions.sort((a, b) => a.pos - b.pos);
  let outOfOrder = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].order < positions[i - 1].order) outOfOrder++;
  }
  return Math.round(100 - (outOfOrder / (positions.length - 1)) * 60);
};

const detectScrambledColumns = (text = "") => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 10) return false;
  let alternations = 0;
  for (let i = 1; i < Math.min(lines.length, 30); i++) {
    const prev = lines[i - 1].split(/\s+/).length;
    const curr = lines[i].split(/\s+/).length;
    if ((prev <= 3 && curr >= 8) || (prev >= 8 && curr <= 3)) alternations++;
  }
  return alternations > 6;
};

export const analyzeFormat = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const dateFormats = detectDateFormats(text);
  const dcScore = dateConsistencyScore(dateFormats);
  const scScore = structureClarityScore(text);
  const bcScore = bulletConsistencyScore(text);
  const soScore = sectionOrderScore(text);
  const scrambled = detectScrambledColumns(text);

  let score = Math.round(scScore * 0.30 + dcScore * 0.25 + bcScore * 0.25 + soScore * 0.20);
  if (scrambled) score = Math.max(0, score - 20);
  score = Math.min(100, Math.max(0, score));

  const formatIssues = [];
  if (dateFormats.filter((f) => f !== "PRESENT").length > 2) formatIssues.push(`Inconsistent date formats: ${dateFormats.join(", ")}.`);
  if (scScore < 60) formatIssues.push("Missing standard section headers (Experience, Education, Skills).");
  if (bcScore < 70) formatIssues.push("Mixed bullet point characters detected.");
  if (soScore < 60) formatIssues.push("Section order doesn't follow ATS-preferred sequence.");
  if (scrambled) formatIssues.push("Text appears scrambled — possible multi-column layout artifact.");

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (dcScore >= 90 && dateFormats.length > 0) strengths.push("Consistent date formatting throughout the resume.");
  if (scScore >= 85) strengths.push("Clear section headers make parsing easy for ATS systems.");
  if (bcScore === 100) strengths.push("Uniform bullet point style across all sections.");

  if (scrambled) {
    weaknesses.push("Possible multi-column layout detected — ATS may read text out of order.");
    recommendations.push("Use a single-column layout for maximum ATS compatibility.");
  }
  formatIssues.forEach((issue) => { if (!weaknesses.includes(issue)) weaknesses.push(issue); });
  if (dateFormats.filter((f) => f !== "PRESENT").length > 2) {
    recommendations.push('Standardize date formats — use "Month YYYY" or "MM/YYYY" consistently throughout.');
  }
  if (scScore < 60) recommendations.push("Add clear section headers (EXPERIENCE, EDUCATION, SKILLS) in plain text.");

  return {
    score, formatIssues, dateFormats, hasMultipleColumns: scrambled,
    structureClarityScore: scScore, dateConsistencyScore: dcScore,
    bulletConsistencyScore: bcScore, sectionOrderScore: soScore,
    strengths, weaknesses, recommendations,
  };
};
