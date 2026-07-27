import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const JWT_SECRET = config.jwtSecret;
const PLAN_LIMITS = {
    FREE: {
        resumeDownloads: 1,
        aiImprovements: Infinity,
    },
    STARTER: {
        resumeDownloads: 2,
        aiImprovements: Infinity,
    },
    PRO: {
        resumeDownloads: 2,
        aiImprovements: Infinity,
    },
};

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, role, planType }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
};

export const requirePremium = (req, res, next) => {
    requireAuth(req, res, () => {
        if (req.user.role === 'ADMIN') {
            return next();
        }

        if (req.user.planType === 'FREE') {
            return res.status(403).json({ success: false, message: 'Forbidden: Requires Starter or Pro plan.' });
        }
        next();
    });
};

export const consumeUsage = (usageField) => (req, res, next) => {
    requireAuth(req, res, async () => {
        try {
            if (req.user.role === 'ADMIN' || req.user.id === 'master-admin') {
                return next();
            }


            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized: User not found' });
            }

            const limit = PLAN_LIMITS[user.planType]?.[usageField] ?? 0;
            let currentUsage = user[usageField] ?? 0;

            // Short-circuit: no DB write needed when limit is unlimited
            if (limit === Infinity) {
                req.user = { ...req.user, planType: user.planType };
                return next();
            }

            if (usageField === 'resumeDownloads') {
                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                const now = new Date();
                const lastReset = user.lastDownloadReset ? new Date(user.lastDownloadReset) : new Date(user.createdAt);

                if (now - lastReset >= oneWeekMs) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            resumeDownloads: 0,
                            lastDownloadReset: now,
                        },
                    });
                    currentUsage = 0;
                }
            }

            if (currentUsage >= limit) {
                if (usageField === 'resumeDownloads') {
                    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                    const now = new Date();
                    const lastReset = user.lastDownloadReset ? new Date(user.lastDownloadReset) : new Date(user.createdAt);
                    const timeLeftMs = oneWeekMs - (now - lastReset);
                    const days = Math.floor(timeLeftMs / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));

                    let timeStr = "";
                    if (days > 0) timeStr += `${days}d `;
                    if (hours > 0) timeStr += `${hours}h `;
                    timeStr += `${minutes}m`;

                    return res.status(403).json({
                        success: false,
                        message: `Weekly limit reached. Your quota resets in ${timeStr}. Upgrade to PRO for unlimited downloads.`,
                    });
                }

                return res.status(403).json({
                    success: false,
                    message: `You have reached your ${usageField === 'resumeDownloads' ? 'resume download' : 'AI improvement'} limit for the ${user.planType} plan.`,
                });
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { [usageField]: { increment: 1 } },
            });

            req.user = {
                ...req.user,
                planType: user.planType,
                [usageField]: currentUsage + 1,
            };

            next();
        } catch (error) {
            console.error('Usage tracking error:', error);
            return res.status(500).json({ success: false, message: 'Failed to validate usage limits.' });
        }
    });
};
