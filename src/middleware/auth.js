import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { PLAN_LIMITS } from '../config/plans.js';

const JWT_SECRET = config.jwtSecret;

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

export const checkQuota = (usageField) => (req, res, next) => {
    requireAuth(req, res, async () => {
        try {
            if (req.user.role === 'ADMIN' || req.user.id === 'master-admin') {
                req.consumeQuota = async () => {}; // No-op for admin
                return next();
            }

            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized: User not found' });
            }

            const limits = PLAN_LIMITS[user.planType] || PLAN_LIMITS.FREE;
            let limit = 0;
            let currentUsage = user[usageField] ?? 0;
            let timeStr = "";
            let dataToUpdateOnConsume = { [usageField]: { increment: 1 } };

            if (usageField === 'aiImprovements') {
                limit = limits.aiDailyLimit;
                const now = new Date();
                const lastReset = user.aiLastResetDate ? new Date(user.aiLastResetDate) : new Date(user.createdAt);
                
                // Check if it's a new day (UTC date change)
                if (now.getUTCFullYear() > lastReset.getUTCFullYear() || 
                    now.getUTCMonth() > lastReset.getUTCMonth() || 
                    now.getUTCDate() > lastReset.getUTCDate()) {
                    currentUsage = 0;
                    dataToUpdateOnConsume.aiImprovements = 1; // set to 1 because it's resetting and incrementing
                    dataToUpdateOnConsume.aiLastResetDate = now;
                }
                
                if (limit !== null && limit !== Infinity && currentUsage >= limit) {
                    return res.status(429).json({
                        success: false,
                        code: "AI_DAILY_LIMIT_REACHED",
                        message: `You've used today's ${limit} AI improvements. Your limit resets tomorrow.`
                    });
                }
            } 
            else if (usageField === 'resumeDownloads') {
                limit = limits.weeklyDownloadLimit;
                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                const now = new Date();
                const lastReset = user.lastDownloadReset ? new Date(user.lastDownloadReset) : new Date(user.createdAt);

                if (now - lastReset >= oneWeekMs) {
                    currentUsage = 0;
                    dataToUpdateOnConsume.resumeDownloads = 1;
                    dataToUpdateOnConsume.lastDownloadReset = now;
                } else if (limit !== null && limit !== Infinity && currentUsage >= limit) {
                    const timeLeftMs = oneWeekMs - (now - lastReset);
                    const days = Math.floor(timeLeftMs / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));

                    if (days > 0) timeStr += `${days}d `;
                    if (hours > 0) timeStr += `${hours}h `;
                    timeStr += `${minutes}m`;
                    
                    return res.status(403).json({
                        success: false,
                        code: "WEEKLY_DOWNLOAD_LIMIT_REACHED",
                        message: `You've used your free resume download for this week. Your quota resets in ${timeStr}. Upgrade to PRO for unlimited downloads.`
                    });
                }
            }

            req.user = {
                ...req.user,
                planType: user.planType,
                [usageField]: currentUsage,
                [`${usageField}Limit`]: limit
            };

            // Expose a function to increment the usage only after a successful operation
            req.consumeQuota = async () => {
                if (limit === null || limit === Infinity) return; // No need to track unlimited
                await prisma.user.update({
                    where: { id: user.id },
                    data: dataToUpdateOnConsume,
                });
            };

            next();
        } catch (error) {
            console.error('Usage tracking error:', error);
            return res.status(500).json({ success: false, message: 'Failed to validate usage limits.' });
        }
    });
};

// Keep backwards compatibility for any routes that might import it under the old name, but they shouldn't just assume it auto-consumes anymore.
export const consumeUsage = checkQuota;
