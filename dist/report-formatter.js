/**
 * Report Formatter
 *
 * Converts health check results into a readable markdown report.
 */
function progressBar(points, maxPoints, width = 20) {
    const filled = Math.round((points / maxPoints) * width);
    const empty = width - filled;
    return '|'.repeat(filled) + '.'.repeat(empty);
}
function statusIcon(status) {
    switch (status) {
        case 'pass': return '[pass]';
        case 'warn': return '[warn]';
        case 'fail': return '[fail]';
        default: return '[----]';
    }
}
function formatLayer(layer) {
    const bar = progressBar(layer.points, layer.maxPoints);
    const lines = [];
    lines.push(`${layer.name.padEnd(30)} ${bar}  ${layer.points}/${layer.maxPoints}`);
    for (const check of layer.checks) {
        lines.push(`  ${statusIcon(check.status)} ${check.message}`);
    }
    return lines.join('\n');
}
export function formatReport(report) {
    const lines = [];
    lines.push('================================================================');
    lines.push('  SECOND BRAIN HEALTH CHECK');
    lines.push('================================================================');
    lines.push('');
    lines.push(`SETUP QUALITY:    ${report.setup.totalPoints}/${report.setup.maxPoints} (${report.setup.grade} - ${report.setup.gradeLabel})`);
    lines.push(`USAGE ACTIVITY:   ${report.usage.totalPoints}/${report.usage.maxPoints} (${report.usage.grade} - ${report.usage.gradeLabel})`);
    if (report.fluency) {
        lines.push(`AI FLUENCY:       ${report.fluency.totalPoints}/${report.fluency.maxPoints} (${report.fluency.grade} - ${report.fluency.gradeLabel})`);
    }
    lines.push('');
    // Setup breakdown
    lines.push('----------------------------------------------------------------');
    lines.push('SETUP QUALITY BREAKDOWN');
    lines.push('----------------------------------------------------------------');
    lines.push('');
    for (const layer of report.setup.layers) {
        lines.push(formatLayer(layer));
        lines.push('');
    }
    // Usage breakdown
    lines.push('----------------------------------------------------------------');
    lines.push('USAGE ACTIVITY BREAKDOWN');
    lines.push('----------------------------------------------------------------');
    lines.push('');
    for (const layer of report.usage.layers) {
        lines.push(formatLayer(layer));
        lines.push('');
    }
    // Fluency breakdown
    if (report.fluency) {
        lines.push('----------------------------------------------------------------');
        lines.push('AI FLUENCY BREAKDOWN');
        lines.push('----------------------------------------------------------------');
        lines.push('');
        for (const layer of report.fluency.layers) {
            lines.push(formatLayer(layer));
            lines.push('');
        }
    }
    // Top fixes
    if (report.topFixes.length > 0) {
        lines.push('----------------------------------------------------------------');
        lines.push('TOP FIXES (highest impact)');
        lines.push('----------------------------------------------------------------');
        lines.push('');
        report.topFixes.forEach((fix, i) => {
            lines.push(`${i + 1}. ${fix.title} (${fix.impact})`);
            lines.push(`   ${fix.description}`);
            lines.push('');
        });
    }
    lines.push('================================================================');
    lines.push('  Build a properly configured Second Brain:');
    lines.push('  https://www.iwoszapar.com/second-brain-ai');
    lines.push('================================================================');
    return lines.join('\n');
}
export function formatFixSuggestions(report, focus) {
    const lines = [];
    // Determine focus
    let targetCategory;
    if (focus === 'auto') {
        const scores = [
            { cat: 'setup', score: report.setup.totalPoints / report.setup.maxPoints },
            { cat: 'usage', score: report.usage.totalPoints / report.usage.maxPoints },
        ];
        if (report.fluency) {
            scores.push({ cat: 'fluency', score: report.fluency.totalPoints / report.fluency.maxPoints });
        }
        scores.sort((a, b) => a.score - b.score);
        targetCategory = scores[0].cat;
    }
    else {
        targetCategory = focus;
    }
    const targetReport = targetCategory === 'setup' ? report.setup
        : targetCategory === 'fluency' && report.fluency ? report.fluency
        : report.usage;
    const reportName = targetCategory === 'setup' ? 'SETUP QUALITY'
        : targetCategory === 'fluency' ? 'AI FLUENCY'
        : 'USAGE ACTIVITY';
    lines.push('================================================================');
    lines.push(`  FIX PLAN: ${reportName}`);
    lines.push(`  Current: ${targetReport.totalPoints}/${targetReport.maxPoints} (${targetReport.grade})`);
    lines.push('================================================================');
    lines.push('');
    // Find the weakest layer
    const sortedLayers = [...targetReport.layers].sort((a, b) => (a.points / a.maxPoints) - (b.points / b.maxPoints));
    const weakest = sortedLayers[0];
    if (!weakest) {
        lines.push('No issues found — your setup looks good!');
        return lines.join('\n');
    }
    lines.push(`WEAKEST AREA: ${weakest.name} (${weakest.points}/${weakest.maxPoints})`);
    lines.push('');
    // List all failing/warning checks in this layer
    const failingChecks = weakest.checks.filter(c => c.status !== 'pass');
    lines.push('ISSUES TO FIX:');
    lines.push('');
    failingChecks.forEach((check, i) => {
        const pointsToGain = check.maxPoints - check.points;
        lines.push(`${i + 1}. ${check.name} (+${pointsToGain} pts)`);
        lines.push(`   Status: ${check.status}`);
        lines.push(`   ${check.message}`);
        lines.push('');
    });
    // Also show other weak layers
    if (sortedLayers.length > 1) {
        lines.push('OTHER AREAS TO IMPROVE:');
        lines.push('');
        for (const layer of sortedLayers.slice(1, 3)) {
            const ratio = layer.points / layer.maxPoints;
            if (ratio < 0.8) {
                lines.push(`- ${layer.name}: ${layer.points}/${layer.maxPoints}`);
            }
        }
    }
    lines.push('');
    lines.push('================================================================');
    return lines.join('\n');
}
//# sourceMappingURL=report-formatter.js.map
