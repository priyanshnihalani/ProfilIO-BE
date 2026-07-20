/**
 * contactAnalyzer.js — Deterministic contact information analyzer
 */

const EMAIL_REGEX = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,5}\b/;
const LOCATION_REGEX = /\b[A-Z][a-zA-Z\s.'-]{2,30},\s*(?:[A-Z]{2}|[A-Z][a-zA-Z\s]{2,20})\b/;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i;
const UNPROFESSIONAL_EMAIL_REGEX = /^(?:.*(?:cool|hot|sexy|ninja|guru|rockstar|wizard|beast|gamer|xox|lol|swag|pro|hack).*|.*\d{3,}.*)@/i;

const detectName = (text = "") => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8);
  const NAME_PATTERN = /^[A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+){1,3}$/;
  return lines.some((line) => NAME_PATTERN.test(line));
};

export const analyzeContact = (resumeText = "") => {
  const text = typeof resumeText === "string" ? resumeText : "";

  const emailMatch = EMAIL_REGEX.exec(text);
  const emailFound = emailMatch ? emailMatch[0] : null;
  const phoneMatch = PHONE_REGEX.exec(text);
  const phoneFound = phoneMatch ? phoneMatch[0].trim() : null;
  const locationMatch = LOCATION_REGEX.exec(text);
  const locationFound = locationMatch ? locationMatch[0].trim() : null;
  const linkedinMatch = LINKEDIN_REGEX.exec(text);
  const linkedinFound = linkedinMatch ? linkedinMatch[0] : null;
  const nameFound = detectName(text);

  let emailProfessional = true;
  if (emailFound && UNPROFESSIONAL_EMAIL_REGEX.test(emailFound)) emailProfessional = false;

  let score = 0;
  if (emailFound) score += emailProfessional ? 25 : 20;
  if (phoneFound) score += 20;
  if (locationFound) score += 20;
  if (linkedinFound) score += 20;
  if (nameFound) score += 15;
  score = Math.min(100, Math.max(0, score));

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (emailFound) {
    if (emailProfessional) strengths.push("Professional email address found.");
    else {
      weaknesses.push(`Email "${emailFound}" appears unprofessional.`);
      recommendations.push("Use a professional email like firstname.lastname@gmail.com.");
    }
  } else {
    weaknesses.push("No email address detected.");
    recommendations.push("Add a professional email address to your resume.");
  }
  if (phoneFound) strengths.push("Phone number present.");
  else {
    weaknesses.push("No phone number detected.");
    recommendations.push("Include a phone number for recruiters to reach you.");
  }
  if (locationFound) strengths.push(`Location detected: ${locationFound}.`);
  else {
    weaknesses.push("No location (City, State) detected.");
    recommendations.push("Add your city and state/country — ATS uses this for location-based filtering.");
  }
  if (linkedinFound) strengths.push("LinkedIn profile URL present.");
  else {
    weaknesses.push("No LinkedIn URL found.");
    recommendations.push("Add your LinkedIn profile URL — recruiters verify candidates there.");
  }
  if (!nameFound) {
    weaknesses.push("Candidate name not clearly identified at the top.");
    recommendations.push("Ensure your full name appears prominently at the very top of the resume.");
  }

  return { score, emailFound, phoneFound, locationFound, linkedinFound, nameFound, emailProfessional, strengths, weaknesses, recommendations };
};
