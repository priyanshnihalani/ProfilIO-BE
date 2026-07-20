import { toText } from "./resumeUtils.js";

/**
 * Evaluates experience descriptions for action verbs, impact statements, and metrics.
 */
export const analyzeExperience = (resumeData) => {
    let strongBullets = 0;
    let weakBullets = 0;
    const recommendations = [];

    // Passive/weak phrases that ATS experts flag
    const weakVerbs = [
        "helped", "worked on", "assisted with", "responsible for",
        "was in charge", "participated in", "involved in", "tasked with"
    ];

    // Strong ATS action verbs (comprehensive list)
    const actionVerbs = [
        "architected", "spearheaded", "engineered", "optimized", "reduced",
        "increased", "developed", "implemented", "designed", "led", "launched",
        "built", "delivered", "automated", "migrated", "improved", "created",
        "established", "drove", "managed", "owned", "shipped", "executed",
        "streamlined", "scaled", "coordinated", "directed", "mentored",
        "trained", "analyzed", "resolved", "achieved", "generated",
        "accelerated", "consolidated", "transformed", "pioneered",
        "negotiated", "secured", "revamped", "orchestrated", "initiated",
        "contributed", "enhanced", "restructured", "oversaw", "supervised"
    ];

    // Regex for quantifiable metrics
    const metricRegex = /(\d+[%x+]|\$[\d,.]+|\d+k\b|\d+M\b|\d+,\d{3}|\b\d{2,}\b)/i;

    const experiences = resumeData.experience || [];

    if (!Array.isArray(experiences) || experiences.length === 0) {
        return {
            score: 0,
            strongBullets: 0,
            weakBullets: 0,
            recommendations: ["Add professional experience to improve your ATS score."]
        };
    }

    experiences.forEach(exp => {
        const descText = [
            toText(exp.description),
            toText(exp.responsibilities),
            toText(exp.achievements),
            toText(exp.bullets)
        ].join("\n");

        if (!descText.trim()) return;

        // Split into bullet-like segments
        const bullets = descText
            .split(/\n|•|·|—|–/)
            .map(b => b.trim().replace(/^[-*]\s*/, ""))
            .filter(b => b.length > 10);

        bullets.forEach(bullet => {
            const lowerBullet = bullet.toLowerCase();
            const hasMetric = metricRegex.test(bullet); // Use original case for $ matching
            const hasWeakVerb = weakVerbs.some(v => lowerBullet.includes(v));
            const hasActionVerb = actionVerbs.some(v =>
                lowerBullet.startsWith(v) ||
                lowerBullet.includes(" " + v + " ") ||
                lowerBullet.includes(" " + v + "d ") ||
                lowerBullet.includes(" " + v + "ed ")
            );

            if (hasMetric && (hasActionVerb || !hasWeakVerb)) {
                // Has metric + action verb or at least no weak verb = strong
                strongBullets++;
            } else if (hasActionVerb && !hasWeakVerb) {
                // Action verb without metric = decent but could be stronger
                strongBullets++;
            } else {
                weakBullets++;
            }
        });
    });

    if (weakBullets > strongBullets) {
        recommendations.push("Replace passive phrases ('worked on', 'helped') with strong action verbs ('engineered', 'spearheaded').");
        recommendations.push("Add quantifiable metrics (%, $, numbers) to demonstrate your impact.");
    }
    if (weakBullets > 0 && strongBullets > 0) {
        recommendations.push(`${strongBullets} of your bullets are strong. Strengthen the remaining ${weakBullets} with metrics and action verbs.`);
    }

    const totalBullets = strongBullets + weakBullets;
    let score = 15;
    if (totalBullets > 0) {
        const strongRatio = strongBullets / totalBullets;
        score = Math.max(3, Math.round(strongRatio * 15));
    } else {
        score = 5;
    }

    return { score, strongBullets, weakBullets, recommendations };
};
