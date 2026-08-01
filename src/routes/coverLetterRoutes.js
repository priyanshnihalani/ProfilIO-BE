import express from 'express';
import { requireAuth, checkQuota } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { generateCoverLetter, refineCoverLetter } from '../../genAI.js';
import { generatePdfFromHtml } from '../../utils/generatePdfWithPuppeteer.js';
import { PLAN_LIMITS } from '../config/plans.js';

const router = express.Router();

// Ensure the user is on the PRO plan
const requirePremium = async (req, res, next) => {
    try {
        if (req.user.role?.toUpperCase() === 'ADMIN' || req.user.id === 'master-admin') {
            return next();
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || user.planType !== 'PRO') {
            return res.status(403).json({ 
                success: false, 
                message: "Cover Letter Generator is a Pro-only feature. Please upgrade your plan." 
            });
        }
        next();
    } catch (e) {
        res.status(500).json({ success: false, message: "Server error checking plan." });
    }
};

/**
 * GET /api/cover-letter
 * List all cover letters for the authenticated PRO user
 */
router.get('/', requireAuth, requirePremium, async (req, res) => {
    try {
        const letters = await prisma.coverLetter.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });
        res.json({ success: true, coverLetters: letters });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch cover letters." });
    }
});

/**
 * GET /api/cover-letter/:id
 * Get a specific cover letter
 */
router.get('/:id', requireAuth, requirePremium, async (req, res) => {
    try {
        const letter = await prisma.coverLetter.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!letter) return res.status(404).json({ success: false, message: "Not found." });
        res.json({ success: true, coverLetter: letter });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch cover letter." });
    }
});

/**
 * POST /api/cover-letter
 * Save a new or existing cover letter
 */
router.post('/', requireAuth, requirePremium, async (req, res) => {
    try {
        const { 
            id, resumeProfileId, resumeData, jobTitle, companyName, 
            jobDescription, hiringManagerName, companyLocation, 
            jobPostingUrl, tone, content, templateId, fullName 
        } = req.body;
        
        let letter;
        if (id) {
            letter = await prisma.coverLetter.findFirst({ where: { id, userId: req.user.id } });
            if (!letter) return res.status(404).json({ success: false, message: "Not found." });
            
            letter = await prisma.coverLetter.update({
                where: { id },
                data: { resumeProfileId, resumeData, jobTitle, companyName, jobDescription, hiringManagerName, companyLocation, jobPostingUrl, tone, content, templateId, fullName }
            });
        } else {
            letter = await prisma.coverLetter.create({
                data: {
                    userId: req.user.id,
                    resumeProfileId, resumeData, jobTitle, companyName, jobDescription, hiringManagerName, companyLocation, jobPostingUrl, tone, content, templateId, fullName
                }
            });
        }
        res.json({ success: true, coverLetter: letter });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to save cover letter." });
    }
});

/**
 * DELETE /api/cover-letter/:id
 */
router.delete('/:id', requireAuth, requirePremium, async (req, res) => {
    try {
        const letter = await prisma.coverLetter.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!letter) return res.status(404).json({ success: false, message: "Not found." });
        
        await prisma.coverLetter.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete cover letter." });
    }
});

/**
 * POST /api/cover-letter/generate
 * Uses AI Quota
 */
router.post('/generate', requireAuth, requirePremium, checkQuota('aiImprovements'), async (req, res) => {
    try {
        const { resumeProfileId, resumeData, jobTitle, companyName, jobDescription, hiringManagerName, companyLocation, jobPostingUrl, tone, instructions } = req.body;
        
        let finalResumeData = resumeData;

        if (resumeProfileId) {
            const resume = await prisma.resumeProfile.findFirst({
                where: { id: resumeProfileId, userId: req.user.id }
            });
            if (!resume) return res.status(404).json({ success: false, message: "Resume profile not found." });
            finalResumeData = resume.data;
        }

        if (!finalResumeData) {
            return res.status(400).json({ success: false, message: "Resume data is required." });
        }

        const content = await generateCoverLetter({
            resumeData: finalResumeData,
            jobTitle, companyName, jobDescription, hiringManagerName, companyLocation, jobPostingUrl, tone, instructions
        });

        // Consume quota ONLY on success
        await req.consumeQuota();

        res.json({ success: true, content });
    } catch (error) {
        console.error("Cover Letter AI Generation Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate cover letter." });
    }
});

/**
 * POST /api/cover-letter/regenerate
 * Uses AI Quota
 */
router.post('/regenerate', requireAuth, requirePremium, checkQuota('aiImprovements'), async (req, res) => {
    try {
        const { currentContent, instruction } = req.body;
        
        if (!currentContent || !instruction) {
            return res.status(400).json({ success: false, message: "Missing content or instructions." });
        }

        const content = await refineCoverLetter({ currentContent, instruction });

        await req.consumeQuota();

        res.json({ success: true, content });
    } catch (error) {
        console.error("Cover Letter AI Refine Error:", error);
        res.status(500).json({ success: false, message: "Failed to refine cover letter." });
    }
});

/**
 * POST /api/cover-letter/generate-pdf
 */
router.post('/generate-pdf', requireAuth, requirePremium, async (req, res) => {
    try {
        const { html, css, filename } = req.body;
        if (!html) return res.status(400).json({ success: false, message: "HTML content required." });

        const safeFilename = (filename || "Cover_Letter").replace(/[^a-zA-Z0-9_-]/g, '_');
        
        const pdfBuffer = await generatePdfFromHtml(html, css);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });

        res.end(pdfBuffer);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate PDF." });
    }
});

export default router;
