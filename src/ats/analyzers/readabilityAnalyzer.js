/**
 * readabilityAnalyzer.js — Deterministic readability analyzer
 */

const extractBullets = (text = "") => {
  return text
    .split(/\n/)
    .map((b) => b.trim())
    .filter((b) => /^[•·▪○■→\-*>]/.test(b))
    .map((b) => b.replace(/^[-*•·▪○■→>]\s*/, "").trim())
    .filter((b) => b.length > 8);
};

const wordCount = (str = "") => str.split(/\s+/).filter(Boolean).length;

const bulletLengthScore = (bullets = []) => {
  if (bullets.length === 0) return 60;
  const lengths = bullets.map(wordCount);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const longBullets = lengths.filter((l) => l > 35).length;
  const shortBullets = lengths.filter((l) => l < 5).length;
  let score = 100;
  if (avg > 35) score -= 30;
  else if (avg > 25) score -= 15;
  else if (avg < 5) score -= 25;
  else if (avg < 8) score -= 10;
  score -= longBullets * 5;
  score -= shortBullets * 3;
  return Math.min(100, Math.max(0, score));
};

const consistencyScore = (bullets = []) => {
  if (bullets.length < 3) return 70;
  const startsWithCap = bullets.filter((b) => /^[A-Z]/.test(b)).length;
  const endsWithPeriod = bullets.filter((b) => /[.;]$/.test(b)).length;
  const capRatio = startsWithCap / bullets.length;
  const periodRatio = endsWithPeriod / bullets.length;
  const punctConsistency = periodRatio > 0.7 || periodRatio < 0.2 ? 100 : 60;
  const capScore = capRatio >= 0.8 ? 100 : Math.round(capRatio * 100);
  return Math.round((capScore * 0.6) + (punctConsistency * 0.4));
};

const densityScore = (text = "") => {
  const words = wordCount(text);
  if (words >= 500) return 100;
  if (words >= 350) return 90;
  if (words >= 200) return 75;
  if (words >= 100) return 60;
  return 40;
};

const clarityScore = (text = "") => {
  const sentences = text.split(/[.!?]\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 70;
  const longSentences = sentences.filter((s) => wordCount(s) > 50).length;
  const runOnRatio = longSentences / sentences.length;
  return Math.round(Math.max(0, 100 - runOnRatio * 100));
};

export const analyzeReadability = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const bullets = extractBullets(text);
  const totalBullets = bullets.length;
  const lengths = bullets.map(wordCount);
  const avgBulletLength = totalBullets > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / totalBullets) : 0;
  const longBulletCount = lengths.filter((l) => l > 35).length;

  const blScore = bulletLengthScore(bullets);
  const csScore = consistencyScore(bullets);
  const dScore = densityScore(text);
  const clScore = clarityScore(text);

  let score = Math.round(blScore * 0.35 + csScore * 0.30 + dScore * 0.20 + clScore * 0.15);
  score = Math.min(100, Math.max(0, score));

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (avgBulletLength >= 10 && avgBulletLength <= 25) strengths.push(`Bullet length is good — average ${avgBulletLength} words per bullet.`);
  if (csScore >= 80) strengths.push("Consistent capitalization and formatting across bullets.");
  if (dScore >= 85) strengths.push("Resume has strong content density across sections.");

  if (avgBulletLength > 35) {
    weaknesses.push(`Bullets are too long — average ${avgBulletLength} words. Aim for 10-25.`);
    recommendations.push("Trim bullets to 10-25 words. One achievement per bullet. Remove filler.");
  } else if (avgBulletLength < 8 && totalBullets > 0) {
    weaknesses.push("Bullets are too short — not enough detail to demonstrate impact.");
    recommendations.push("Expand bullet points to describe what you did and the result achieved.");
  }
  if (longBulletCount > 2) {
    weaknesses.push(`${longBulletCount} bullets exceed 35 words — too verbose.`);
    recommendations.push("Split or shorten overly long bullets into concise, focused statements.");
  }
  if (csScore < 60) {
    weaknesses.push("Inconsistent capitalization or punctuation across bullets.");
    recommendations.push("Start every bullet with a capital letter and keep punctuation consistent.");
  }
  if (dScore < 60) {
    weaknesses.push("Resume appears thin on content.");
    recommendations.push("Add more detail to experience and projects to reach 350+ words.");
  }

  return { score, avgBulletLength, longBulletCount, totalBullets, strengths, weaknesses, recommendations };
};
