const buckets = new Map();

export const createRateLimit = ({ windowMs, max, key = (req) => req.user?.id || req.ip }) =>
    (req, res, next) => {
        const now = Date.now();
        const id = key(req);
        const current = buckets.get(id);
        if (!current || current.resetAt <= now) {
            buckets.set(id, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (current.count >= max) {
            const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
            res.setHeader("Retry-After", String(retryAfter));
            return res.status(429).json({ success: false, message: "Too many ATS requests. Please retry shortly." });
        }
        current.count += 1;
        next();
    };

export const atsRateLimit = createRateLimit({ windowMs: 60_000, max: 5 });
