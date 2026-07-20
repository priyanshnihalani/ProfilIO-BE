/**
 * antiPatternAnalyzer.js — Deterministic ATS anti-pattern detector
 */

const GENERIC_BUZZWORDS = [
  "synergy", "leverage", "paradigm", "guru", "ninja", "rockstar", "wizard",
  "thought leader", "visionary", "disruptive", "game-changer", "innovative",
  "passionate about", "hard-working", "team player", "go-getter", "self-starter",
  "detail-oriented", "results-driven", "dynamic", "proactive", "forward-thinking",
  "out-of-the-box", "world-class",
];

const OBJECTIVE_STATEMENT_PATTERNS = [
  /\bobjective\s*:/i,
  /\bcareer objective\b/i,
  /\bseeking\s+(a|an)?\s+position/i,
  /\blooking\s+for\s+(a|an)?\s+(new\s+)?(job|opportunity|role|position)/i,
];

const REFERENCES_PATTERNS = [
  /references?\s+available\s+(upon\s+request|on\s+request)/i,
  /references?\s+provided\s+upon\s+request/i,
  /will\s+provide\s+references/i,
];

const EMOJI_REGEX = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{25AA}\u{25AB}\u{25B6}\u{25C0}]/u;
const ALL_CAPS_LINE_REGEX = /^[A-Z\s.,!?&/()-]{20,}$/m;

const COMMON_WORDS = new Set([
  "the","and","or","in","a","an","of","to","for","with","on","at","by",
  "is","are","was","were","be","been","have","has","had","do","does","did",
  "will","would","could","should","may","might","this","that","these","those",
  "i","my","me","we","our","you","your","it","its",
]);

const KEYWORD_STUFFING_EXCLUSIONS = new Set([
  "aws", "gcp", "azure", "cloud", "devops", "engineer", "engineering", "software", 
  "developer", "development", "project", "management", "manager", "team", "systems", 
  "system", "data", "application", "applications", "services", "service", "platform", 
  "platforms", "technology", "technologies", "business", "design", "designed", 
  "implement", "implemented", "manage", "managed", "lead", "led", "support", 
  "supported", "build", "built", "infrastructure", "client", "clients", "customer", 
  "customers", "process", "processes", "technical", "user", "users", "using",
]);

const detectKeywordStuffing = (text = "") => {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!COMMON_WORDS.has(w) && !KEYWORD_STUFFING_EXCLUSIONS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).filter(([, count]) => count >= 12).map(([word]) => word);
};

export const analyzeAntiPatterns = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const textLower = text.toLowerCase();
  const antiPatternsFound = [];
  const criticalIssues = [];
  let deduction = 0;

  const foundBuzzwords = GENERIC_BUZZWORDS.filter((bw) => textLower.includes(bw.toLowerCase()));
  if (foundBuzzwords.length > 0) {
    antiPatternsFound.push(`Generic buzzwords detected: ${foundBuzzwords.slice(0, 4).join(", ")}`);
    deduction += Math.min(20, foundBuzzwords.length * 4);
  }

  const hasReferences = REFERENCES_PATTERNS.some((p) => p.test(text));
  if (hasReferences) {
    antiPatternsFound.push('"References available upon request" wastes valuable space.');
    deduction += 10;
  }

  const hasObjective = OBJECTIVE_STATEMENT_PATTERNS.some((p) => p.test(text));
  if (hasObjective) {
    antiPatternsFound.push("Outdated objective statement detected — replace with a targeted professional summary.");
    deduction += 10;
  }

  if (EMOJI_REGEX.test(text)) {
    antiPatternsFound.push("Emoji or decorative symbols detected — these break ATS parsers.");
    criticalIssues.push("Emoji/symbols cause ATS parsing failure — remove them.");
    deduction += 15;
  }

  const stuffedWords = detectKeywordStuffing(text);
  if (stuffedWords.length > 0) {
    antiPatternsFound.push(`Keyword stuffing detected: "${stuffedWords.slice(0, 3).join('", "')}" appear 7+ times.`);
    criticalIssues.push("Keyword stuffing triggers ATS spam filters — reduce repetition.");
    deduction += 20;
  }

  const capsMatches = text.match(ALL_CAPS_LINE_REGEX) || [];
  if (capsMatches.length > 2) {
    antiPatternsFound.push("Multiple all-caps lines detected — may indicate non-parseable headers.");
    deduction += 8;
  }

  let score = Math.max(0, 100 - deduction);

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (antiPatternsFound.length === 0) strengths.push("No ATS anti-patterns detected — resume is clean.");

  if (foundBuzzwords.length > 0) {
    weaknesses.push(`Vague buzzwords reduce credibility: ${foundBuzzwords.slice(0, 3).join(", ")}.`);
    recommendations.push("Replace buzzwords with specific accomplishments. Instead of 'innovative', show the innovation.");
  }
  if (hasReferences) {
    weaknesses.push('"References available upon request" is assumed — remove it to save space.');
    recommendations.push("Delete the references line and use that space for another achievement.");
  }
  if (hasObjective) {
    weaknesses.push("Objective statements are outdated — they focus on what you want, not what you offer.");
    recommendations.push("Replace the objective with a 3-4 line professional summary tailored to the target role.");
  }
  if (stuffedWords.length > 0) {
    weaknesses.push("Keyword stuffing detected — this is penalized by modern ATS NLP.");
    recommendations.push("Each key term should appear 1-2 times in natural context, not repeated in lists.");
  }

  return { score, antiPatternsFound, criticalIssues, foundBuzzwords, stuffedWords, strengths, weaknesses, recommendations };
};
