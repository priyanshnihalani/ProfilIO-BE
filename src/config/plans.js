export const PLAN_LIMITS = {
    FREE: {
        aiDailyLimit: 5,
        resumeProfileLimit: 1,
        weeklyDownloadLimit: 1,
        premiumTemplates: false,
        fullATS: false,
        price: 0
    },
    PRO: {
        aiDailyLimit: 5,
        resumeProfileLimit: 3,
        weeklyDownloadLimit: Infinity, // unlimited
        premiumTemplates: true,
        fullATS: true,
        price: 149
    },
    STARTER: {
        aiDailyLimit: 5,
        resumeProfileLimit: 1,
        weeklyDownloadLimit: 1,
        premiumTemplates: false,
        fullATS: false,
        price: 0
    }
};
