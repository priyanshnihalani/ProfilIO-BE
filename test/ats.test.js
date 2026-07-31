/**
 * ats.test.js — Deterministic ATS scoring engine tests
 * Run with: node --test test/ats.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { calculateAtsScore, WEIGHTS } from "../src/ats/AtsEngine.js";
import { analyzeKeywords }      from "../src/ats/analyzers/keywordAnalyzer.js";
import { analyzeImpact }        from "../src/ats/analyzers/impactAnalyzer.js";
import { analyzeSections }      from "../src/ats/analyzers/sectionAnalyzer.js";
import { analyzeRoleAlignment } from "../src/ats/analyzers/roleAlignmentAnalyzer.js";
import { analyzeContact }       from "../src/ats/analyzers/contactAnalyzer.js";
import { analyzeReadability }   from "../src/ats/analyzers/readabilityAnalyzer.js";
import { analyzeAntiPatterns }  from "../src/ats/analyzers/antiPatternAnalyzer.js";
import { analyzeFormat }        from "../src/ats/analyzers/formatAnalyzer.js";
import { clampScore, validateScoreRequest, normalizeModelObject } from "../src/ats/validation.js";

// ─── Resume fixtures ──────────────────────────────────────────────────────────

const DEVOPS_RESUME = `
John Smith
john.smith@gmail.com | +1 (512) 555-0192 | Austin, TX | linkedin.com/in/johnsmith

SUMMARY
Senior DevOps Engineer with 8 years of experience designing and operating
large-scale Kubernetes-based infrastructure on AWS. Expert in CI/CD pipelines,
Infrastructure as Code with Terraform, and observability with Prometheus and Grafana.

EXPERIENCE

Senior DevOps Engineer — Acme Corp (Jan 2020 – Present)
• Architected Kubernetes platform serving 500M+ requests/day, reducing deployment time by 60%.
• Automated infrastructure provisioning with Terraform and Ansible, cutting manual work by 80%.
• Led migration from Jenkins to GitHub Actions CI/CD pipeline, improving build speed by 45%.
• Deployed Prometheus/Grafana monitoring stack across 12 production clusters.
• Reduced AWS infrastructure costs by $1.2M annually through spot-instance optimization.

DevOps Engineer — TechBase (Mar 2017 – Dec 2019)
• Built Docker containerization strategy for 40+ microservices.
• Implemented ArgoCD GitOps workflow, enabling 10x faster releases.
• Designed Helm charts for standardized application deployment.
• Automated shell scripts reducing manual deployments by 70%.

SKILLS
Docker, Kubernetes, Helm, Terraform, Ansible, AWS, GCP, Azure, Linux, Bash,
Jenkins, GitHub Actions, ArgoCD, Prometheus, Grafana, Git, CI/CD, Nginx

EDUCATION
B.S. Computer Engineering — University of Texas at Austin, 2016

CERTIFICATIONS
AWS Certified DevOps Engineer – Professional | CKA (Certified Kubernetes Administrator)

PROJECTS
• Developed open-source Terraform module for zero-downtime EKS upgrades (450 GitHub stars).
• Built GitOps pipeline template used by 200+ engineers at Acme Corp.
`;

const REACT_RESUME = `
Sarah Johnson
sarah.johnson@gmail.com | (415) 555-0234 | San Francisco, CA | linkedin.com/in/sarahjohnson

PROFILE
Senior Frontend Engineer with 6 years of experience building responsive, accessible
React applications for high-traffic consumer products.

EXPERIENCE

Senior Frontend Engineer — ShopCo (Feb 2021 – Present)
• Engineered React component library adopted by 15 product teams, reducing UI dev time by 40%.
• Optimized Core Web Vitals (LCP reduced from 4.2s to 1.1s) increasing conversions by 12%.
• Implemented TypeScript migration across 80,000-line codebase, catching 200+ runtime bugs.
• Led accessibility (WCAG 2.1 AA) compliance effort, passing 3rd-party audit.

Frontend Engineer — MediaLab (Jun 2018 – Jan 2021)
• Built Redux state management for real-time dashboard serving 1M+ daily active users.
• Created Webpack 5 build pipeline reducing bundle size by 55%.
• Developed CSS design system with Tailwind CSS used across 8 products.
• Mentored 3 junior developers; pair-programmed weekly.

SKILLS
React, TypeScript, JavaScript, Redux, Webpack, Vite, HTML5, CSS3, Tailwind,
Next.js, GraphQL, REST API, Jest, React Testing Library, Git, Figma

EDUCATION
B.S. Computer Science — UC Berkeley, 2018

PROJECTS
• Open-source React accessibility linter with 1,200 GitHub stars.
• Personal blog built with Next.js, scoring 99/100 on Lighthouse.
`;

const FRESHER_RESUME = `
Priya Patel
priya.patel@gmail.com | (972) 555-0167 | Dallas, TX | linkedin.com/in/priyapatel

SUMMARY
Recent Computer Science graduate seeking an entry-level Software Engineer position.
Passionate about building scalable web applications and eager to grow professionally.

EDUCATION
B.S. Computer Science — University of Texas at Dallas, May 2024
GPA: 3.8/4.0 | Dean's List (2022-2024)

SKILLS
Python, JavaScript, React, Node.js, SQL, Git, HTML, CSS, Java, Data Structures,
Algorithms, REST APIs, MongoDB

PROJECTS

Personal Portfolio Website (React, Node.js)
• Designed and developed a responsive portfolio site using React and deployed on Vercel.
• Integrated a Node.js backend with REST API for contact form submissions.

Inventory Management System (Python, SQL)
• Built a Python Flask web application with PostgreSQL for tracking 500+ inventory items.
• Implemented CRUD operations, user authentication, and export to CSV.

Movie Recommendation App (JavaScript, MongoDB)
• Created a recommendation engine using collaborative filtering with 85% accuracy.
• Deployed on AWS EC2 with Docker containerization.

CERTIFICATIONS
AWS Certified Cloud Practitioner (2024)

EXPERIENCE
Software Engineering Intern — Tech Startup (May 2023 – Aug 2023)
• Developed 3 new REST API endpoints in Node.js reducing data fetch time by 25%.
• Fixed 15 bugs in the React frontend, improving user session stability.
• Participated in daily scrum meetings and sprint planning.
`;

const STUFFED_RESUME = `
Dev Guru
devguru@hotmail.com

OBJECTIVE
Seeking a synergistic paradigm-shifting role where I can leverage my innovative
skills as a rockstar developer ninja guru.

SKILLS
JavaScript JavaScript JavaScript JavaScript JavaScript JavaScript JavaScript
React React React React React React React React React React React React React
Node Node Node Node Node Node Node Node Node Node Node Node Node Node Node
Python Python Python Python Python Python Python Python Python Python Python
SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL

EXPERIENCE
Software Developer — Some Company
Responsible for working on JavaScript projects. Helped with React development.
Was in charge of Node.js tasks. Assisted with Python scripts.
Involved in SQL database work. Participated in team meetings.
Responsible for responsible for responsible for responsible for responsible for.

JavaScript JavaScript JavaScript React React React Node Node Node SQL SQL SQL
Python Python AWS AWS AWS Docker Docker Docker Git Git Git CI/CD CI/CD CI/CD
Synergy synergy leverage paradigm innovative disruptive game-changer rockstar ninja guru wizard

References available upon request.
`;

const INCOMPLETE_RESUME = `
Bob Builder
bob@example.com

EXPERIENCE
Worker — Some Place (2020 - 2022)
Did some stuff. Helped with things. Worked on projects. Was responsible for tasks.
Participated in meetings. Was part of a team. Involved in processes.

Worker — Another Place (2018 - 2020)
Helped with work. Assisted with responsibilities. Was in charge of nothing specific.
Tried to complete assignments. Attempted various tasks. Duties included random things.
`;

// ─── Archetype score tests ────────────────────────────────────────────────────

test("1. Strong DevOps resume scores 82-92", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.ok(result.overallScore >= 82 && result.overallScore <= 92,
    `Expected 82-92, got ${result.overallScore}`);
  assert.ok(result.tier.toLowerCase().includes("excellent") || result.tier.toLowerCase().includes("good"));
});

test("2. Strong React resume scores 75-90", () => {
  const result = calculateAtsScore(REACT_RESUME, "", "Frontend Engineer");
  assert.ok(result.overallScore >= 75 && result.overallScore <= 90,
    `Expected 75-90, got ${result.overallScore}`);
});

test("3. Fresher resume scores 65-80", () => {
  const result = calculateAtsScore(FRESHER_RESUME, "", "Software Engineer");
  assert.ok(result.overallScore >= 65 && result.overallScore <= 80,
    `Expected 65-80, got ${result.overallScore}`);
});

test("4. Keyword-stuffed resume scores < 60", () => {
  const result = calculateAtsScore(STUFFED_RESUME, "", "JavaScript Developer");
  assert.ok(result.overallScore < 60,
    `Expected < 60, got ${result.overallScore}`);
});

test("5. Resume missing education and skills scores < 55", () => {
  const result = calculateAtsScore(INCOMPLETE_RESUME, "", "Software Engineer");
  assert.ok(result.overallScore < 55,
    `Expected < 55, got ${result.overallScore}`);
});

// ─── Determinism ──────────────────────────────────────────────────────────────

test("calculateAtsScore is deterministic", () => {
  const r1 = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  const r2 = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.equal(r1.overallScore, r2.overallScore);
  assert.deepEqual(r1.dimensionScores, r2.dimensionScores);
});

// ─── Shape tests ──────────────────────────────────────────────────────────────

test("Result contains all required AtsAnalysisResult fields", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.ok(typeof result.overallScore === "number");
  assert.ok(typeof result.tier === "string");
  assert.ok(typeof result.targetRole === "string");
  assert.ok(typeof result.scoredAt === "string");
  assert.ok(result.dimensionScores && typeof result.dimensionScores === "object");
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(result.details && typeof result.details === "object");
});

test("dimensionScores contains all 9 expected keys", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  for (const key of ["keywordRelevance","formatParsability","impactLanguage","sectionCompleteness","roleAlignment","contactInfo","readability","atsAntiPatterns","enterpriseImpact"]) {
    assert.ok(key in result.dimensionScores, `Missing: ${key}`);
  }
});

test("All dimension scores are 0-100 integers", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  for (const [key, val] of Object.entries(result.dimensionScores)) {
    assert.ok(val >= 0 && val <= 100, `${key} out of range: ${val}`);
    assert.equal(val, Math.round(val), `${key} not integer: ${val}`);
  }
});

test("Overall score is never 100", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.ok(result.overallScore <= 97, `Score ${result.overallScore} exceeds cap of 97`);
});

test("Weights sum to exactly 100", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

// ...

test("[keywordAnalyzer] matched keywords found for DevOps resume", () => {
  const result = analyzeKeywords(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.ok(result.matchedKeywords.length > 0);
  assert.ok(result.score > 40);
});

test("details shape contains required sub-keys", () => {
  const result = calculateAtsScore(DEVOPS_RESUME, "", "DevOps Engineer");
  assert.ok(Array.isArray(result.details.keyword.missing_keywords));
  assert.ok(Array.isArray(result.details.keyword.matched_keywords));
  assert.ok(typeof result.details.keyword.keyword_stuffing_detected === "boolean");
  assert.ok(Array.isArray(result.details.impact.weak_phrases_found));
  assert.ok(typeof result.details.impact.quantified_bullet_count === "number");
  assert.ok(typeof result.details.impact.total_bullet_count === "number");
  assert.ok(Array.isArray(result.details.completeness.missing_sections));
  assert.ok(typeof result.details.alignment.inferred_seniority_level === "string");
  assert.ok(Array.isArray(result.details.alignment.alignment_gaps));
});

test("recommendations are well-formed objects", () => {
  const result = calculateAtsScore(FRESHER_RESUME, "", "Software Engineer");
  for (const rec of result.recommendations) {
    assert.ok(typeof rec.priority === "string");
    assert.ok(typeof rec.dimension === "string");
    assert.ok(typeof rec.issue === "string");
    assert.ok(typeof rec.fix === "string");
    assert.ok(typeof rec.impact === "string");
  }
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test("Handles null gracefully", () => {
  assert.doesNotThrow(() => {
    const r = calculateAtsScore(null, "", "Backend");
    assert.ok(r.overallScore >= 0 && r.overallScore <= 100);
  });
});

test("Empty string returns valid low score", () => {
  const result = calculateAtsScore("", "", "");
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
});

test("Handles structured resume object as input", () => {
  const obj = {
    summary: "Backend engineer with 5 years Node.js experience.",
    skills: ["Node.js", "SQL", "Docker", "AWS"],
    experience: [{ title: "Engineer", bullets: ["Reduced latency by 40%."] }],
    education: [{ degree: "B.S. Computer Science" }],
  };
  assert.doesNotThrow(() => {
    const r = calculateAtsScore(obj, "", "Backend Engineer");
    assert.ok(r.overallScore >= 0 && r.overallScore <= 100);
  });
});

// ─── Analyzer unit tests ──────────────────────────────────────────────────────

// DevOps test has been moved and updated above

test("[keywordAnalyzer] detects stuffing in stuffed resume", () => {
  const result = analyzeKeywords(STUFFED_RESUME, "", "JavaScript Developer");
  assert.ok(result.stuffingDetected === true);
  assert.ok(result.score < 70);
});

test("[keywordAnalyzer] unsupported skill keywords do not inflate ATS score", () => {
  const baseResume = `
Jane Doe
jane@example.com | (555) 111-2222 | Dallas, TX

SUMMARY
Frontend developer building user interfaces.

EXPERIENCE
Frontend Developer - Acme (Jan 2022 - Present)
- Built accessible UI components for 20 screens and reduced defects by 15%.
- Improved page performance by 25% through code splitting.

SKILLS
React, TypeScript, JavaScript, CSS, HTML, Git

EDUCATION
B.S. Computer Science
`;

  const skillStuffedResume = baseResume.replace(
    "React, TypeScript, JavaScript, CSS, HTML, Git",
    "React, TypeScript, JavaScript, CSS, HTML, Git, Kubernetes, Terraform, AWS, Docker, Prometheus, Grafana, CI/CD"
  );

  const base = calculateAtsScore(baseResume, "", "DevOps Engineer");
  const stuffed = calculateAtsScore(skillStuffedResume, "", "DevOps Engineer");

  assert.ok(stuffed.overallScore <= base.overallScore,
    `Unsupported skills should not improve score: base=${base.overallScore}, stuffed=${stuffed.overallScore}`);
  assert.ok(stuffed.details.keyword.unsupported_skill_keywords.length >= 4);
});

test("[impactAnalyzer] counts quantified bullets correctly", () => {
  const text = `
    • Reduced latency by 40% through caching.
    • Increased revenue by $1.2M via optimization.
    • Built a feature for the team.
    • Responsible for maintaining the database.
  `;
  const result = analyzeImpact(text);
  assert.ok(result.quantifiedBulletCount >= 2);
  assert.ok(result.weakPhrasesFound.length >= 1);
});

test("[impactAnalyzer] gives floor score for empty text", () => {
  const result = analyzeImpact("");
  assert.ok(result.score >= 25 && result.score <= 35);
  assert.equal(result.totalBulletCount, 0);
});

test("[sectionAnalyzer] all sections present in DevOps resume", () => {
  const result = analyzeSections(DEVOPS_RESUME);
  assert.ok(result.presentSections.length >= 5);
  assert.ok(result.score >= 60);
});

test("[sectionAnalyzer] flags missing sections in incomplete resume", () => {
  const result = analyzeSections(INCOMPLETE_RESUME);
  assert.ok(result.missingSections.length >= 2);
  assert.ok(result.score < 70);
});

test("[roleAlignmentAnalyzer] infers senior for DevOps resume", () => {
  const result = analyzeRoleAlignment(DEVOPS_RESUME, "Senior DevOps Engineer", "");
  assert.equal(result.inferredSeniority, "senior");
  assert.ok(result.score >= 50);
});

test("[roleAlignmentAnalyzer] infers junior for fresher resume", () => {
  const result = analyzeRoleAlignment(FRESHER_RESUME, "Software Engineer", "");
  assert.ok(["junior", "mid"].includes(result.inferredSeniority));
});

test("[contactAnalyzer] extracts all fields from DevOps resume", () => {
  const result = analyzeContact(DEVOPS_RESUME);
  assert.ok(result.emailFound !== null);
  assert.ok(result.phoneFound !== null);
  assert.ok(result.linkedinFound !== null);
  assert.ok(result.score >= 70);
});

test("[readabilityAnalyzer] strong resume gets decent readability score", () => {
  const result = analyzeReadability(DEVOPS_RESUME);
  assert.ok(result.score >= 55);
});

test("[antiPatternAnalyzer] clean resume scores 80+", () => {
  const result = analyzeAntiPatterns(DEVOPS_RESUME);
  assert.ok(result.score >= 80, `Expected >= 80, got ${result.score}`);
  assert.equal(result.criticalIssues.length, 0);
});

test("[antiPatternAnalyzer] detects anti-patterns in stuffed resume", () => {
  const result = analyzeAntiPatterns(STUFFED_RESUME);
  assert.ok(result.antiPatternsFound.length >= 3);
  assert.ok(result.score < 60);
});

test("[formatAnalyzer] consistent date format scores well", () => {
  const result = analyzeFormat("Experience\nJan 2020 – Present\nJan 2018 – Dec 2019\nEducation\nB.S. CS");
  assert.ok(result.dateConsistencyScore >= 80);
});

// ─── Validation utilities ─────────────────────────────────────────────────────

test("validateScoreRequest rejects invalid input", () => {
  assert.match(validateScoreRequest({}).error, /100 readable characters/);
  assert.match(validateScoreRequest({ resumeText: "x".repeat(100) }).error, /targetRole/);
  const valid = validateScoreRequest({ resumeText: "x".repeat(100), targetRole: "Engineer" });
  assert.equal(valid.value.targetRole, "Engineer");
});

test("clampScore handles edge cases", () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore("invalid"), 0);
  assert.equal(clampScore(75.7), 76);
});
