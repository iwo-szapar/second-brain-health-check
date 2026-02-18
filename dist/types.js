/**
 * Second Brain Health Check — Type definitions
 *
 * QA validation tool for AI workspace configurations.
 * Checks setup quality and usage activity.
 */
export function getSetupGrade(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 85)
        return { grade: 'A', label: 'Production-ready' };
    if (pct >= 70)
        return { grade: 'B', label: 'Good foundation' };
    if (pct >= 50)
        return { grade: 'C', label: 'Basic setup' };
    if (pct >= 30)
        return { grade: 'D', label: 'Minimal' };
    return { grade: 'F', label: 'Barely configured' };
}
export function getUsageGrade(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 85)
        return { grade: 'Active', label: 'Brain is compounding' };
    if (pct >= 70)
        return { grade: 'Growing', label: 'Good momentum' };
    if (pct >= 50)
        return { grade: 'Starting', label: 'Early days' };
    if (pct >= 30)
        return { grade: 'Dormant', label: 'Not being used regularly' };
    return { grade: 'Empty', label: 'No usage activity detected' };
}
export function getFluencyGrade(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 85)
        return { grade: 'Expert', label: 'Advanced AI collaboration' };
    if (pct >= 70)
        return { grade: 'Proficient', label: 'Effective AI usage' };
    if (pct >= 50)
        return { grade: 'Developing', label: 'Learning to leverage AI' };
    if (pct >= 30)
        return { grade: 'Beginner', label: 'Basic AI interaction' };
    return { grade: 'Novice', label: 'Not yet leveraging AI effectively' };
}
export function normalizeScore(points, maxPoints) {
    if (maxPoints <= 0) return 0;
    return Math.round((points / maxPoints) * 100);
}
//# sourceMappingURL=types.js.map