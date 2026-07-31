import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";

import {
    improveResumeSection,
    parseResumeToJSON,
} from "./genAI.js";

import { extractPdfText } from "./utils/extractPdfText.js";
import { generatePdfFromHtml } from "./utils/generatePdfWithPuppeteer.js";
import atsRoutes from "./src/ats/routes/atsRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import feedbackRoutes from "./src/routes/feedbackRoutes.js";
import { consumeUsage } from "./src/middleware/auth.js";
import { requireAuth } from "./src/middleware/auth.js";
import { atsRateLimit } from "./src/middleware/rateLimit.js";
import { validateScoreRequest } from "./src/ats/validation.js";
import { config } from "./src/config.js";
import { calculateAtsScore } from "./src/ats/AtsEngine.js";
const app = express();
const port = config.port;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
            if (!config.isProduction) console.warn("[cors] blocked origin", origin);
            return callback(new Error("Origin is not allowed by CORS."));
        },
        credentials: true,
    })
);

app.get("/api/health", (_req, res) => {
    res.json({ success: true, status: "ok" });
});

app.use("/api/ats", atsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/feedback", feedbackRoutes);

const upload = multer({
    storage: multer.memoryStorage(),
});

/**
 * Parse Resume
 */
app.post(
    "/api/resume/parse",
    requireAuth,
    upload.single("resume"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
            }

            const {
                mimetype,
                buffer,
                originalname,
            } = req.file;

            let rawText = "";
            let extractionMethod = "direct";

            // PDF — text-based extraction first, OCR fallback for scanned/image PDFs
            if (mimetype === "application/pdf") {
                try {
                    const result = await extractPdfText(buffer);
                    rawText = result.text;
                    extractionMethod = result.method;
                } catch (extractError) {
                    console.error("[Parse] PDF extraction failed:", extractError);
                }
            }

            // DOCX
            else if (
                mimetype ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                originalname.toLowerCase().endsWith(".docx")
            ) {
                const result = await mammoth.extractRawText({
                    buffer,
                });

                rawText = result.value;
            }

            // Unsupported
            else {
                return res.status(400).json({
                    success: false,
                    message:
                        "Unsupported file type. Please upload PDF or DOCX.",
                });
            }

            if (!rawText.trim()) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Unable to extract readable text from the uploaded resume. " +
                        "For image-based PDFs, OCR was attempted but returned no text. " +
                        "Try uploading the original DOCX, or use the JSON export from this app.",
                });
            }

            const structuredData =
                await parseResumeToJSON(rawText);

            return res.status(200).json({
                success: true,
                data: structuredData,
                extractionMethod,
            });
        } catch (error) {
            console.error(
                "Resume parsing error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Failed to parse resume.",
            });
        }
    }
);

/**
 * Generate text-based PDF via Puppeteer (server-side)
 */
app.post("/api/resume/generate-pdf", consumeUsage("resumeDownloads"), async (req, res) => {
    try {
        const { html, css, filename } = req.body;

        if (!html?.trim()) {
            return res.status(400).json({
                success: false,
                message: "HTML content is required.",
            });
        }

        const pdfBuffer = await generatePdfFromHtml(html, css || "");
        const safeName = (filename || "resume.pdf").replace(/[^\w.\-]/g, "_");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeName}"`
        );
        return res.send(pdfBuffer);
    } catch (error) {
        console.error("PDF generation error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate PDF.",
        });
    }
});

/**
 * Improve Resume Section
 */
app.post(
    "/api/resume/improve-section",
    consumeUsage("aiImprovements"),
    async (req, res) => {
        try {
            const { form, section } = req.body;

            if (!form || !section) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Form and section are required.",
                });
            }

            const content = form[section];

            if (!content) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Section content is empty.",
                });
            }

            const improvedContent =
                await improveResumeSection({
                    section,
                    content,
                    targetRole: form.targetRole,
                });

            return res.status(200).json({
                success: true,
                content: improvedContent,
            });
        } catch (error) {
            console.error(
                "Improve section error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to improve resume section.",
            });
        }
    }
);

app.post("/api/resume/score", requireAuth, atsRateLimit, async (req, res) => {
  try {
    const validation = validateScoreRequest(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const { resumeText, targetRole, jobDescription } = validation.value;
    const templateMetadata = req.body.templateMetadata || {};
    const selectedMissingKeywords = Array.isArray(req.body.selectedMissingKeywords) && req.body.selectedMissingKeywords.length > 0
      ? req.body.selectedMissingKeywords
      : null;

    const result = calculateAtsScore(resumeText, jobDescription || "", targetRole, templateMetadata, selectedMissingKeywords);

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("ATS score error:", error);
    return res.status(503).json({ success: false, message: "ATS scoring is temporarily unavailable." });
  }
});

/**
 * Score + Auto-Improve weak sections
 * POST /api/resume/score-and-improve
 * Body: { form, jobDescription?, selectedMissingKeywords? }
 *
 * Flow:
 *  1. Build resumeText from form fields
 *  2. Score it → find dimensions below threshold
 *  3. Map low scores to the affected sections
 *  4. Improve only those sections with ATS context injected
 *  5. Return: score report + improved form fields
 */
app.post("/api/resume/score-and-improve", consumeUsage("aiImprovements"), atsRateLimit, async (req, res) => {
  try {
    const { form, jobDescription } = req.body;
    const selectedMissingKeywords = Array.isArray(req.body.selectedMissingKeywords) && req.body.selectedMissingKeywords.length > 0
      ? req.body.selectedMissingKeywords
      : null;

    if (!form || !form.targetRole) {
      return res.status(400).json({
        success: false,
        message: "form and form.targetRole are required.",
      });
    }

    // 1. Build plain-text resume from form for scoring
    const resumeText = buildResumeText(form);

    // 2. Score it (deterministic)
    const scoreResult = calculateAtsScore(resumeText, jobDescription || "", form.targetRole, {}, selectedMissingKeywords);

    // 3. Decide which sections need improvement (score < 90)
    const THRESHOLD = 90;
    const DIMENSION_TO_SECTIONS = {
      keywordRelevance:    ["summary", "experience", "projects"],
      impactLanguage:      ["experience", "projects"],
      sectionCompleteness: ["summary", "experience", "education"],
      roleAlignment:       ["summary", "experience"],
      readability:         ["summary", "experience"],
    };

    const sectionsToImprove = new Set();
    for (const [dimension, score] of Object.entries(scoreResult.dimensionScores)) {
      if (score < THRESHOLD && DIMENSION_TO_SECTIONS[dimension]) {
        DIMENSION_TO_SECTIONS[dimension].forEach(s => {
          if (form[s]) sectionsToImprove.add(s); // only if section has content
        });
      }
    }

    // 4. Build ATS context to inject into each improvement prompt
    //    This is the key upgrade — the improver now knows *what* to fix
    const atsContext = buildAtsContext(scoreResult, selectedMissingKeywords);

    // 5. Improve all weak sections in parallel
    const improvements = await Promise.all(
      [...sectionsToImprove].map(async (section) => {
        const improved = await improveResumeSection({
          section,
          content: form[section],
          targetRole: form.targetRole,
          atsContext, // passed into genAI.js — see update below
        });
        return [section, improved];
      })
    );

    // 6. Merge improved sections back into form
    const improvedForm = { ...form };
    for (const [section, content] of improvements) {
      improvedForm[section] = preserveResumeInventory(section, form[section], content);
    }
    improvedForm.skills = form.skills;

    // 7. Recalculate the score for the improved resume
    const improvedResumeText = buildResumeText(improvedForm);
    const finalScoreResult = calculateAtsScore(improvedResumeText, jobDescription || "", form.targetRole, {}, selectedMissingKeywords);

    return res.status(200).json({
      success: true,
      data: {
        scoreResult: finalScoreResult,            // actual improved score report for the UI
        improvedForm,                             // updated form with fixed sections
        sectionsImproved: [...sectionsToImprove],
      },
    });
  } catch (error) {
    console.error("Score and improve error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten form fields into plain text for the ATS scorer */
function buildResumeText(form) {
  return [
    form.fullName, form.email, form.phone, form.location,
    form.linkedin, form.github, form.website,
    "SUMMARY", form.summary,
    "EXPERIENCE", form.experience,
    "EDUCATION", form.education,
    "SKILLS", form.skills,
    "PROJECTS", form.projects,
    "CERTIFICATIONS", form.certifications,
  ].filter(Boolean).join("\n\n");
}

/** Extract the most actionable context from the score result */
function buildAtsContext(scoreResult, selectedMissingKeywords = null) {
  const { recommendations, details } = scoreResult;
  const missing = details.keyword?.missing_keywords || [];
  const filteredMissing = Array.isArray(selectedMissingKeywords)
    ? missing.filter(kw => selectedMissingKeywords.includes(kw))
    : missing;

  return {
    missingKeywords: filteredMissing,
    unsupportedSkillKeywords: details.keyword?.unsupported_skill_keywords || [],
    weakPhrases: details.impact?.weak_phrases_found || [],
    criticalIssues: recommendations
      .filter(r => r.priority === "critical" || r.priority === "high")
      .map(r => r.fix),
    overallScore: scoreResult.overallScore,
    targetScore: 90,
  };
}

function countResumeBlocks(section, value = "") {
  const text = String(value || "").trim();
  if (!text) return { entries: 0, bullets: [] };

  const blocks = text
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);

  if (section !== "experience" && section !== "projects") {
    return { entries: blocks.length || 1, bullets: [] };
  }

  const fallbackBlocks = blocks.length > 0 ? blocks : [text];
  return {
    entries: fallbackBlocks.length,
    bullets: fallbackBlocks.map(block =>
      block
        .split(/\r?\n/)
        .filter(line => /^\s*[-*•]/.test(line))
        .length
    ),
  };
}

function preserveResumeInventory(section, originalContent = "", improvedContent = "") {
  if (!improvedContent || !String(improvedContent).trim()) return originalContent;
  if (section === "skills") return originalContent;
  if (section !== "experience" && section !== "projects") return improvedContent;

  const originalCounts = countResumeBlocks(section, originalContent);
  const improvedCounts = countResumeBlocks(section, improvedContent);
  const sameEntries = originalCounts.entries === improvedCounts.entries;
  const sameBullets =
    originalCounts.bullets.length === improvedCounts.bullets.length &&
    originalCounts.bullets.every((count, index) => count === improvedCounts.bullets[index]);

  return sameEntries && sameBullets ? improvedContent : originalContent;
}

app.use((error, _req, res, _next) => {
    console.error("[server] unhandled request error:", error);
    res.status(error.message === "Origin is not allowed by CORS." ? 403 : 500).json({
        success: false,
        message: error.message || "Internal server error.",
    });
});

app.listen(port, () => {
    console.log(
        `🚀 Server running on port ${port}`
    );
});

export default app;
