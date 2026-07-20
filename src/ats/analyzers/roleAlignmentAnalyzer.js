/**
 * roleAlignmentAnalyzer.js — Deterministic role alignment analyzer
 */

const SENIOR_SIGNALS = ["senior","sr.","sr ","lead","principal","staff","head of","director","chief","vp","vice president","architect","manager","10+ years","8+ years","9+ years","7+ years"];
const MID_SIGNALS = ["mid","ii","iii","3+ years","4+ years","5+ years","6+ years"];
const JUNIOR_SIGNALS = ["junior","jr.","jr ","associate","entry","entry-level","0-2 years","1+ year","1 year","2 years","recent graduate","fresh","fresher","intern"];
const YEAR_REGEX = /(\d{4})/g;
const DURATION_REGEX = /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi;

const inferSeniority = (text = "") => {
  const lower = text.toLowerCase();
  for (const signal of SENIOR_SIGNALS) { if (lower.includes(signal)) return "senior"; }
  for (const signal of MID_SIGNALS) { if (lower.includes(signal)) return "mid"; }
  for (const signal of JUNIOR_SIGNALS) { if (lower.includes(signal)) return "junior"; }

  const years = [];
  let match;
  const re = new RegExp(YEAR_REGEX.source, YEAR_REGEX.flags);
  while ((match = re.exec(text)) !== null) {
    const yr = parseInt(match[1]);
    if (yr >= 1990 && yr <= new Date().getFullYear()) years.push(yr);
  }
  if (years.length >= 2) {
    const span = Math.max(...years) - Math.min(...years);
    if (span >= 8) return "senior";
    if (span >= 4) return "mid";
    if (span >= 1) return "junior";
  }
  const durationRe = new RegExp(DURATION_REGEX.source, DURATION_REGEX.flags);
  const durationMatch = durationRe.exec(lower);
  if (durationMatch) {
    const yrs = parseInt(durationMatch[1]);
    if (yrs >= 7) return "senior";
    if (yrs >= 3) return "mid";
    return "junior";
  }
  return "junior";
};

const inferTargetSeniority = (targetRole = "") => {
  const lower = targetRole.toLowerCase();
  for (const signal of SENIOR_SIGNALS) { if (lower.includes(signal)) return "senior"; }
  for (const signal of MID_SIGNALS) { if (lower.includes(signal)) return "mid"; }
  for (const signal of JUNIOR_SIGNALS) { if (lower.includes(signal)) return "junior"; }
  return "mid";
};

const seniorityMatchScore = (inferred, target) => {
  const levels = ["junior", "mid", "senior", "staff"];
  const a = levels.indexOf(inferred);
  const b = levels.indexOf(target === "principal" ? "staff" : target);
  if (a === -1 || b === -1) return 60;
  const diff = Math.abs(a - b);
  return diff === 0 ? 100 : diff === 1 ? 60 : 25;
};

const ROLE_CORE_SKILLS = {
  devops: ["docker","kubernetes","ci/cd","terraform","aws","linux","ansible","git"],
  sre: ["kubernetes","prometheus","grafana","sla","slo","incident","aws","linux"],
  frontend: ["react","javascript","typescript","css","html","git","responsive"],
  backend: ["node.js","express","sql","mongodb","postgresql","api","rest","docker"],
  fullstack: ["react","node.js","javascript","mongodb","sql","docker","api","rest"],
  mern: ["react","node.js","express","mongodb","javascript"],
  "data scientist": ["python","sql","machine learning","pandas","tensorflow","statistics"],
  "data analyst": ["sql","python","excel","tableau","power bi","analytics"],
  "data engineer": ["python","spark","kafka","etl","sql","airflow","aws"],
  "product manager": ["roadmap","agile","scrum","kpis","metrics","user research"],
  designer: ["figma","prototyping","wireframing","ux","ui","design systems"],
  mobile: ["react native","ios","android","swift","kotlin","flutter"],
  security: ["penetration testing","siem","firewall","owasp","compliance","iam"],
  "ml engineer": ["python","tensorflow","pytorch","scikit-learn","mlops","docker"],
  "software engineer": ["python","java","javascript","git","docker","api","testing"],
  qa: ["testing","selenium","automation","cypress","jest","api testing"],
};

const resolveRoleSkills = (targetRole = "") => {
  const lower = targetRole.toLowerCase();
  for (const [role, skills] of Object.entries(ROLE_CORE_SKILLS)) {
    if (lower.includes(role)) return skills;
  }
  return ["git","api","sql","docker","testing","rest"];
};

const SECTION_HEADER_RE = /^(summary|profile|professional summary|experience|work experience|professional experience|employment|education|skills|technical skills|core skills|projects|certifications|awards|languages)\s*:?\s*$/i;
const isSkillsHeader = (header = "") => /(^| )(skills|technical skills|core skills)( |$)/i.test(header);
const escapeRegex = (value = "") => value.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
const containsTerm = (text = "", term = "") => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text);

const splitSections = (text = "") => {
  const sections = [];
  let current = { header: "other", lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (SECTION_HEADER_RE.test(trimmed)) {
      if (current.lines.length) sections.push(current);
      current = { header: trimmed.toLowerCase().replace(/:$/, ""), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);
  return sections;
};

const analyzeCoreSkillEvidence = (text = "", targetRole = "") => {
  const coreSkills = resolveRoleSkills(targetRole);
  const sections = splitSections(text);
  const evidenceText = sections.filter((section) => !isSkillsHeader(section.header)).map((section) => section.lines.join("\n")).join("\n");
  const skillsText = sections.filter((section) => isSkillsHeader(section.header)).map((section) => section.lines.join("\n")).join("\n");
  const supported = [];
  const skillOnly = [];
  const missing = [];

  for (const skill of coreSkills) {
    if (containsTerm(evidenceText, skill)) supported.push(skill);
    else if (containsTerm(skillsText, skill)) skillOnly.push(skill);
    else missing.push(skill);
  }

  const weightedMatched = supported.length + (skillOnly.length * 0.35);
  const score = coreSkills.length === 0 ? 60 : Math.round((weightedMatched / coreSkills.length) * 100);
  return { score, coreSkills, supported, skillOnly, missing };
};

const calcTitleMatchScore = (textLower = "", targetRole = "") => {
  if (!targetRole) return 50;
  const coreWords = targetRole
    .toLowerCase()
    .replace(/\b(senior|sr\.|jr\.|junior|lead|principal|staff|head|chief|associate)\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (coreWords.length === 0) return 50;
  const matched = coreWords.filter((w) => textLower.includes(w));
  return Math.round((matched.length / coreWords.length) * 100);
};

export const analyzeRoleAlignment = (resumeText = "", targetRole = "", jobDescription = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const textLower = text.toLowerCase();

  const inferredSeniority = inferSeniority(text);
  const targetSeniority = inferTargetSeniority(targetRole);
  const titleMatch = calcTitleMatchScore(textLower, targetRole);
  const skillEvidence = analyzeCoreSkillEvidence(text, targetRole);
  const skillsOverlap = skillEvidence.score;
  const seniorityMatch = seniorityMatchScore(inferredSeniority, targetSeniority);

  let score = Math.round(titleMatch * 0.3 + skillsOverlap * 0.4 + seniorityMatch * 0.3);
  score = Math.min(100, Math.max(0, score));

  const coreSkills = skillEvidence.coreSkills;
  const alignmentGaps = skillEvidence.missing;
  const alignmentStrengths = [...skillEvidence.supported, ...skillEvidence.skillOnly];

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (skillsOverlap >= 70) strengths.push(`Good technical overlap with ${targetRole} — ${alignmentStrengths.length} core skills found.`);
  if (seniorityMatch === 100) strengths.push(`Experience level matches the expected seniority for ${targetRole}.`);
  if (titleMatch >= 70) strengths.push("Resume title/role words align well with the target position.");

  if (skillsOverlap < 50) {
    weaknesses.push(`Core skill overlap is low — only ${alignmentStrengths.length} of ${coreSkills.length} expected skills found.`);
    recommendations.push(`Add these missing core skills to your resume: ${alignmentGaps.slice(0, 5).join(", ")}.`);
  }
  if (skillEvidence.skillOnly.length > 0) {
    weaknesses.push(`${skillEvidence.skillOnly.length} role skill${skillEvidence.skillOnly.length > 1 ? "s are" : " is"} listed without experience or project evidence.`);
    recommendations.push(`Support these skills with truthful bullets or remove them: ${skillEvidence.skillOnly.slice(0, 5).join(", ")}.`);
  }
  if (seniorityMatch < 60) {
    weaknesses.push(`Seniority mismatch: resume reads as ${inferredSeniority} but role expects ${targetSeniority}.`);
    recommendations.push(
      inferredSeniority === "junior" && targetSeniority !== "junior"
        ? "Highlight scope of impact, ownership, and years of experience more prominently."
        : "Tailor your summary to match the seniority level required by the role."
    );
  }
  if (titleMatch < 50 && targetRole) {
    weaknesses.push("Target role title or variants not clearly reflected in resume.");
    recommendations.push(`Include the role title "${targetRole}" in your summary or headline.`);
  }

  return {
    score,
    inferredSeniority,
    targetSeniority,
    alignmentGaps: alignmentGaps.slice(0, 8),
    alignmentStrengths: alignmentStrengths.slice(0, 8),
    unsupportedSkillMatches: skillEvidence.skillOnly.slice(0, 8),
    strengths,
    weaknesses,
    recommendations,
  };
};
