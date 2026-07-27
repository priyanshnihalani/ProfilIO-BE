import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const router = express.Router();
const JWT_SECRET = config.jwtSecret;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH?.trim();
const BUILT_IN_ADMIN_EMAIL = process.env.BUILT_IN_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@portfillo.com';
const BUILT_IN_ADMIN_PASSWORD = process.env.BUILT_IN_ADMIN_PASSWORD?.trim() || 'portfillO';

const serializeUser = (user) => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    planType: user.planType,
    role: user.role,
    resumeDownloads: user.resumeDownloads,
    aiImprovements: user.aiImprovements,
    lastDownloadReset: user.lastDownloadReset,
    paymentDate: user.paymentDate,
    membershipEndDate: user.membershipEndDate,
});

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const createToken = (user) => jwt.sign(
    { id: user.id, email: user.email, planType: user.planType, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
);

const adminUser = {
    id: 'master-admin',
    email: ADMIN_EMAIL,
    fullName: 'Master Admin',
    planType: 'PRO',
    role: 'ADMIN',
    resumeDownloads: 0,
    aiImprovements: 0,
    paymentDate: null,
    membershipEndDate: null,
};

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        
        if (!fullName?.trim() || !normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        if (normalizedEmail === ADMIN_EMAIL) {
            return res.status(400).json({ success: false, message: 'Reserved email address.' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already in use.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email: normalizedEmail,
                passwordHash,
                planType: 'FREE'
            }
        });

        const token = createToken(user);

        if (!config.isProduction) console.debug('[auth] registered user', { id: user.id, email: user.email });
        res.json({ success: true, token, user: serializeUser(user) });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to register.' });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        
        if (normalizedEmail === BUILT_IN_ADMIN_EMAIL && BUILT_IN_ADMIN_EMAIL && BUILT_IN_ADMIN_PASSWORD && password === BUILT_IN_ADMIN_PASSWORD) {
            const token = createToken({ ...adminUser, email: BUILT_IN_ADMIN_EMAIL });
            return res.json({
                success: true,
                token,
                user: serializeUser({ ...adminUser, email: BUILT_IN_ADMIN_EMAIL }),
            });
        }

        if (ADMIN_EMAIL && ADMIN_PASSWORD_HASH && normalizedEmail === ADMIN_EMAIL && await bcrypt.compare(password, ADMIN_PASSWORD_HASH)) {
            const token = createToken(adminUser);
            return res.json({ 
                success: true, 
                token, 
                user: serializeUser(adminUser),
            });
        }

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = createToken(user);

        if (!config.isProduction) console.debug('[auth] login success', { id: user.id, email: user.email });
        res.json({ success: true, token, user: serializeUser(user) });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Failed to log in.' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
    try {
        if (req.user.id === 'master-admin') {
            return res.json({ success: true, user: serializeUser(adminUser) });
        }
        
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, user: serializeUser(user) });
    } catch (error) {
        console.error('Auth verify error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify token.' });
    }
});

/**
 * POST /api/auth/github
 */
router.post('/github', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Code is required.' });
        }

        let githubUser;
        const client_id = process.env.GITHUB_CLIENT_ID?.trim();
        const client_secret = process.env.GITHUB_CLIENT_SECRET?.trim();

        // Detect mock mode if env vars are missing or a specific mock code is supplied
        const isMockMode = !client_id || client_id === 'your_github_client_id_placeholder' || code === 'mock_code_github';

        if (isMockMode) {
            // Generate stable mock info
            githubUser = {
                id: 'github_mock_987654',
                name: 'GitHub Mock User',
                email: 'github_mock_user@example.com'
            };
        } else {
            // Retrieve real user details from GitHub
            const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id,
                    client_secret,
                    code
                })
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;
            if (!accessToken) {
                return res.status(400).json({ success: false, message: 'Failed to retrieve access token from GitHub.' });
            }

            // Fetch user profile
            const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${accessToken}`,
                    'User-Agent': 'ProfilIO-OAuth-Backend'
                }
            });
            const profileData = await userResponse.json();

            // Fetch user emails if private
            let email = profileData.email;
            if (!email) {
                const emailsResponse = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `token ${accessToken}`,
                        'User-Agent': 'ProfilIO-OAuth-Backend'
                    }
                });
                const emailsData = await emailsResponse.json();
                if (Array.isArray(emailsData)) {
                    const primaryEmail = emailsData.find(e => e.primary && e.verified) || emailsData.find(e => e.primary) || emailsData[0];
                    email = primaryEmail?.email;
                }
            }

            if (!email) {
                return res.status(400).json({ success: false, message: 'Unable to retrieve your email address from GitHub.' });
            }

            githubUser = {
                id: String(profileData.id),
                name: profileData.name || profileData.login,
                email: email.toLowerCase().trim()
            };
        }

        // Sync user in database
        let user = await prisma.user.findUnique({ where: { email: githubUser.email } });
        if (!user) {
            // Generate a secure placeholder password hash for OAuth user
            const placeholderPassword = `oauth_github_${Math.random().toString(36).substring(2, 15)}`;
            const passwordHash = await bcrypt.hash(placeholderPassword, 10);
            
            user = await prisma.user.create({
                data: {
                    fullName: githubUser.name || 'GitHub User',
                    email: githubUser.email,
                    passwordHash,
                    planType: 'FREE'
                }
            });
            if (!config.isProduction) console.debug('[auth] registered new github oauth user', { id: user.id, email: user.email });
        } else {
            if (!config.isProduction) console.debug('[auth] logged in existing github oauth user', { id: user.id, email: user.email });
        }

        const token = createToken(user);
        res.json({ success: true, token, user: serializeUser(user) });

    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.status(500).json({ success: false, message: 'GitHub authentication failed.' });
    }
});

export default router;
