/**
 * Second Brain Health Check — Type definitions
 *
 * QA validation tool for AI workspace configurations.
 * Checks setup quality and usage activity.
 */
export function getSetupGrade(points) {
    if (points >= 85)
        return { grade: 'A', label: 'Production-ready' };
    if (points >= 70)
        return { grade: 'B', label: 'Good foundation' };
    if (points >= 50)
        return { grade: 'C', label: 'Basic setup' };
    if (points >= 30)
        return { grade: 'D', label: 'Minimal' };
    return { grade: 'F', label: 'Barely configured' };
}
export function getUsageGrade(points) {
    if (points >= 85)
        return { grade: 'Active', label: 'Brain is compounding' };
    if (points >= 70)
        return { grade: 'Growing', label: 'Good momentum' };
    if (points >= 50)
        return { grade: 'Starting', label: 'Early days' };
    if (points >= 30)
        return { grade: 'Dormant', label: 'Not being used regularly' };
    return { grade: 'Empty', label: 'No usage activity detected' };
}
export function getFluencyGrade(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 80)
        return { grade: 'Expert', label: 'Advanced AI collaboration' };
    if (pct >= 60)
        return { grade: 'Proficient', label: 'Effective AI usage' };
    if (pct >= 40)
        return { grade: 'Developing', label: 'Learning to leverage AI' };
    if (pct >= 20)
        return { grade: 'Beginner', label: 'Basic AI interaction' };
    return { grade: 'Novice', label: 'Not yet leveraging AI effectively' };
}
//# sourceMappingURL=types.js.map