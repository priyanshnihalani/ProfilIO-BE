/**
 * sectionAnalyzer.js — Deterministic section completeness analyzer
 *
 * Input:  resumeText (string)
 * Output: { score, missingSections, presentSections, strengths, weaknesses, recommendations }
 */

const REQUIRED_SECTIONS = [
  {
    key: "contact",
    name: "Contact Information",
    patterns: [
      /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/,    // email
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,5}\b/, // phone (intl)
    ],
    headerPattern: null,
  },
  {
    key: "summary",
    name: "Professional Summary",
    patterns: [],
    headerPattern: /\b(summary|profile|objective|about me|about|professional summary|career objective|overview|statement|introduction)\b/i,
  },
  {
    key: "experience",
    name: "Work Experience",
    patterns: [],
    headerPattern: /\b(experience|employment|work history|professional experience|career history|work experience)\b/i,
  },
  {
    key: "skills",
    name: "Skills",
    patterns: [],
    headerPattern: /\b(skills|technologies|technical skills|core competencies|key skills|competencies|tech stack|tools)\b/i,
  },
  {
    key: "education",
    name: "Education",
    // Detect via degree keywords even when no explicit Education header present
    patterns: [
      /\b(b\.?s\.?|b\.?e\.?|b\.?tech|m\.?s\.?|m\.?tech|mba|ph\.?d|bachelor|master|degree|diploma)\b/i,
    ],
    headerPattern: /\b(education|academic|degree|university|college|school|qualification|studies)\b/i,
  },
];

const OPTIONAL_SECTIONS = [
  { key: "projects", name: "Projects", headerPattern: /\b(projects|portfolio|side projects|personal projects|open.?source)\b/i },
  { key: "certifications", name: "Certifications", headerPattern: /\b(certifications?|certificates?|licenses?|credentials?)\b/i },
  { key: "awards", name: "Awards / Achievements", headerPattern: /\b(awards?|achievements?|honors?|recognition|accomplishments?)\b/i },
  { key: "volunteer", name: "Volunteer / Community", headerPattern: /\b(volunteer|community|extracurricular|activities|leadership)\b/i },
];

const detectSection = (text, section) => {
  if (section.patterns && section.patterns.length > 0) {
    return section.patterns.some((p) => p.test(text));
  }
  if (section.headerPattern) return section.headerPattern.test(text);
  return false;
};

const contentDepthMultiplier = (text = "") => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 350) return 1.0;
  if (wordCount >= 200) return 0.97;
  if (wordCount >= 150) return 0.93;
  if (wordCount >= 100) return 0.88;
  return 0.80;
};

export const analyzeSections = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const presentSections = [];
  const missingSections = [];
  let deduction = 0;

  for (const section of REQUIRED_SECTIONS) {
    if (detectSection(text, section)) presentSections.push(section.name);
    else { missingSections.push(section.name); deduction += 15; }
  }
  for (const section of OPTIONAL_SECTIONS) {
    if (detectSection(text, section)) presentSections.push(section.name);
    else deduction += 3;
  }

  const rawScore = Math.max(0, 100 - deduction);
  const depth = contentDepthMultiplier(text);
  let score = Math.min(100, Math.max(0, Math.round(rawScore * depth)));

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (missingSections.length === 0) {
    strengths.push("All required resume sections are present.");
  } else {
    const reqMissing = REQUIRED_SECTIONS.filter((s) => missingSections.includes(s.name)).map((s) => s.name);
    if (reqMissing.length > 0) {
      weaknesses.push(`Missing required section${reqMissing.length > 1 ? "s" : ""}: ${reqMissing.join(", ")}.`);
      recommendations.push(`Add the following required sections: ${reqMissing.join(", ")}.`);
    }
  }
  if (presentSections.length >= 7) strengths.push(`Resume contains ${presentSections.length} sections, showing comprehensive coverage.`);

  const optionalMissing = OPTIONAL_SECTIONS.filter((s) => !presentSections.includes(s.name)).map((s) => s.name);
  if (optionalMissing.length > 0) recommendations.push(`Consider adding: ${optionalMissing.slice(0, 3).join(", ")} to strengthen your profile.`);

  return { score, presentSections, missingSections, strengths, weaknesses, recommendations };
};
