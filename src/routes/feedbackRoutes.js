import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const buildTransport = () => {
    const host = process.env.FEEDBACK_SMTP_HOST?.trim();
    const port = Number(process.env.FEEDBACK_SMTP_PORT || 587);
    const user = process.env.FEEDBACK_SMTP_USER?.trim();
    const pass = process.env.FEEDBACK_SMTP_PASS?.trim();

    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
};

router.post('/', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim().slice(0, 120);
        const email = String(req.body.email || '').trim().slice(0, 160);
        const message = String(req.body.message || '').trim().slice(0, 4000);
        const rating = Number(req.body.rating || 0);
        const page = String(req.body.page || '').trim().slice(0, 300);

        if (!message) {
            return res.status(400).json({ success: false, message: 'Please enter your feedback.' });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        }

        const to = "priyansh.nihalani@gmail.com";
        const authEmail = process.env.FEEDBACK_FROM_EMAIL?.trim() || process.env.FEEDBACK_SMTP_USER?.trim();
        const from = name ? `"${name}" <${authEmail}>` : authEmail;
        const transport = buildTransport();

        if (!transport || !to || !from) {
            return res.status(503).json({
                success: false,
                message: 'Feedback email is not configured yet.',
            });
        }

        const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : null;
        const submittedAt = new Date().toISOString();

        await transport.sendMail({
            from,
            to,
            replyTo: email || undefined,
            subject: `ProfilIO feedback${safeRating ? ` (${safeRating}/5)` : ''}`,
            text: [
                'New feedback submitted from ProfilIO.',
                '',
                `Name: ${name || 'Not provided'}`,
                `Email: ${email || 'Not provided'}`,
                `Rating: ${safeRating ? `${safeRating}/5` : 'Not provided'}`,
                `Page: ${page || 'Not provided'}`,
                `Submitted: ${submittedAt}`,
                '',
                'Message:',
                message,
            ].join('\n'),
        });

        return res.json({ success: true, message: 'Thanks for the feedback.' });
    } catch (error) {
        console.error('Feedback submission error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send feedback.' });
    }
});

export default router;
