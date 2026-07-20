/**
 * impactAnalyzer.js — Deterministic impact language analyzer
 *
 * Input:  resumeText (string)
 * Output: { score, weakPhrasesFound, quantifiedBulletCount, totalBulletCount,
 *           actionVerbCount, strengths, weaknesses, recommendations }
 *
 * Score = (actionVerbRatio * 35) + (quantRatio * 40) + (noWeakPhrasePenalty * 25)
 */

const STRONG_ACTION_VERBS = new Set([
  "architected","spearheaded","engineered","optimized","reduced","increased",
  "developed","implemented","designed","led","launched","built","delivered",
  "automated","migrated","improved","created","established","drove","managed",
  "owned","shipped","executed","streamlined","scaled","coordinated","directed",
  "mentored","trained","analyzed","resolved","achieved","generated","accelerated",
  "consolidated","transformed","pioneered","negotiated","secured","revamped",
  "orchestrated","initiated","enhanced","restructured","oversaw","supervised",
  "deployed","configured","integrated","refactored","debugged","monitored",
  "maintained","planned","defined","evaluated","modernized","overhauled",
  "redesigned","prototyped","authored","contributed","championed","enabled",
  "facilitated","formulated","grew","hired","identified","introduced",
  "leveraged","minimized","partnered","prioritized","produced","proposed",
  "published","recruited","researched","shaped","simplified","solved","tested",
  // FAANG-specific enterprise verbs
  "orchestrated at scale","architected globally","transformed enterprise",
  "scaled microservices","revolutionized infrastructure","dominated markets",
  "disrupted industries","leveraged ai/ml","innovated breakthrough",
  "pioneered solutions","advanced technology","implemented enterprise",
  "establish global standards","secure infrastructure","optimize performance",
  "enhance user experience","drive business impact","maximize efficiency",
  "expandmarketreach","generate revenue","reduce costs","increase adoption",
]);

const WEAK_PHRASES = [
  "responsible for",
  "worked on",
  "helped with",
  "assisted with",
  "was in charge of",
  "participated in",
  "involved in",
  "tasked with",
  "duties included",
  "tried to",
  "attempted to",
  "was part of",
  "contributed to",
  "helped to",
  "supported the",
];

const METRIC_REGEX = /(\d+\s*%|\$[\d,]+\.?\d*[kKmMbB]?|\d+[kKmMbB]\b|\d+x\b|\d+[+\-]\s|\b\d{2,}(?:,\d{3})*\b|\b#\s?\d+\b|\d+\s*million|\d+\s*billion|\d+\s*m|\d+\s*k|\d+M users|\d+M daily active users|\$\d+M|\$\d+B|\d+% improvement|\d+% reduction|\$\d+M ARR|\$\d+M savings|\d+TB|\d+PB|\d+ GB|\d+ TB|\d+\s+minutes? per day|\d+\s+requests\/second|\d+\s+TPS|\d+\s+concurrent users|\d+\s+TB bandwidth|\d+\s+GB storage|\d+\s+GB data|\d+\s+TB data|\d+\s+millions of users|\d+\s+million daily users)/i;

// FAANG-specific enterprise metrics
const ENTERPRISE_METRIC_KEYWORDS = [
  "users", "daily active users", "monthly active users", "engagement", "adoption",
  "revenue", "arr", "growth", "improvement", "reduction", "savings", "cost",
  "efficiency", "performance", "scalability", "throughput", "latency",
  "availability", "reliability", "uptime", "storage", "bandwidth", "data",
  "team size", "budget", "market share", "customer base", "market cap",
  "million", "billion", "terabyte", "petabyte", "millions", "billions",
  "enterprise", "global", "worldwide", "international", "multi-region",
];

const isEnterpriseMetric = (text) => {
  const lowerText = text.toLowerCase();
  return ENTERPRISE_METRIC_KEYWORDS.some(keyword => lowerText.includes(keyword)) &&
         (// Check for accompanying numbers
          /\d+/.test(text) &&
          (/".*\d+.*"/.test(text) ||
           // Multiple indicators of enterprise-level metrics
           (text.match(/\d+/g) || []).length >= 2));
};

const extractBullets = (text = "") => {
  return text
    .split(/\n/)
    .map((b) => b.trim())
    .filter((b) => /^[•·▪○■→\-*>]/.test(b))
    .map((b) => b.replace(/^[•·▪○■→\-*>]\s*/, "").trim())
    .filter((b) => b.length > 12);
};

const startsWithActionVerb = (bullet = "") => {
  const firstWord = bullet
    .toLowerCase()
    .replace(/^[^a-z]*/, "")
    .split(/\s+/)[0]
    .replace(/[^a-z]/g, "");
  return STRONG_ACTION_VERBS.has(firstWord);
};

export const analyzeImpact = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const bullets = extractBullets(text);
  const totalBulletCount = bullets.length;

  let actionVerbCount = 0;
  let quantifiedBulletCount = 0;
  const weakPhrasesFound = [];
  const textLower = text.toLowerCase();

  WEAK_PHRASES.forEach((phrase) => {
    if (textLower.includes(phrase)) weakPhrasesFound.push(phrase);
  });

  bullets.forEach((bullet) => {
    if (startsWithActionVerb(bullet)) actionVerbCount++;
    if (METRIC_REGEX.test(bullet)) quantifiedBulletCount++;
  });

  const actionVerbRatio = totalBulletCount > 0 ? actionVerbCount / totalBulletCount : 0;
  const quantRatio = totalBulletCount > 0 ? quantifiedBulletCount / totalBulletCount : 0;
  const noWeakPhrasePenalty = Math.max(0, 1 - weakPhrasesFound.length * 0.12);

  let score = Math.round(
    (actionVerbRatio * 35) +
    (quantRatio * 40) +
    (noWeakPhrasePenalty * 25)
  );

  if (totalBulletCount === 0) score = 30;
  score = Math.min(100, Math.max(0, score));

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (actionVerbRatio >= 0.7) strengths.push(`${actionVerbCount} of ${totalBulletCount} bullets start with strong action verbs.`);
  if (quantRatio >= 0.4) strengths.push(`${quantifiedBulletCount} bullet${quantifiedBulletCount !== 1 ? "s" : ""} include quantifiable metrics.`);

  if (actionVerbRatio < 0.5 && totalBulletCount > 0) {
    weaknesses.push(`Only ${actionVerbCount} of ${totalBulletCount} bullets use strong action verbs.`);
    recommendations.push("Start more bullets with strong verbs: Engineered, Optimized, Reduced, Launched, Automated.");
  }
  if (quantRatio < 0.3 && totalBulletCount > 0) {
    weaknesses.push("Most bullets lack quantifiable metrics.");
    recommendations.push("Add numbers to at least 40% of bullets — e.g., 'Reduced load time by 35%', '$2M ARR growth'.");
  }
  if (weakPhrasesFound.length > 0) {
    weaknesses.push(`Weak passive phrases detected: "${weakPhrasesFound.slice(0, 3).join('", "')}"${weakPhrasesFound.length > 3 ? " and more" : ""}.`);
    recommendations.push(`Replace passive phrases like "responsible for" or "worked on" with direct action verbs.`);
  }
  if (totalBulletCount === 0) {
    weaknesses.push("No bullet-point experience found — impact scoring is limited.");
    recommendations.push("Add detailed bullet points under each role describing your achievements.");
  }

  return { score, weakPhrasesFound, quantifiedBulletCount, totalBulletCount, actionVerbCount, strengths, weaknesses, recommendations };
};
