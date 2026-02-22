/**
 * Guide Tool 5: weekly_pulse
 *
 * Shows score deltas, CE pattern trends, notable events, and a suggestion.
 * Reads .health-check.json only — no filesystem scanning.
 */
import { readHealthCheckState, resolveProjectRoot } from './utils.js';

function getTier(pct) {
    if (pct >= 85) return 'Expert';
    if (pct >= 70) return 'Proficient';
    if (pct >= 50) return 'Developing';
    if (pct >= 30) return 'Beginner';
    return 'Novice';
}

export async function runWeeklyPulse(period, path) {
    const rootPath = await resolveProjectRoot(path);
    const state = await readHealthCheckState(rootPath);

    if (state.runs.length === 0) {
        return {
            content: [{
                type: 'text',
                text: 'No health check history found.\n\n' +
                    'Run `check_health` first to establish a baseline, then run `weekly_pulse` to track progress.',
            }],
        };
    }

    const latest = state.runs[state.runs.length - 1];
    const now = new Date(latest.timestamp);

    // Find comparison point
    let comparison = null;
    const effectivePeriod = period || 'since_last';

    if (effectivePeriod === 'since_last' && state.runs.length >= 2) {
        comparison = state.runs[state.runs.length - 2];
    } else if (effectivePeriod === '7d' || effectivePeriod === '30d') {
        const daysBack = effectivePeriod === '7d' ? 7 : 30;
        const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
        for (let i = state.runs.length - 2; i >= 0; i--) {
            const runDate = new Date(state.runs[i].timestamp);
            if (runDate <= cutoff) {
                comparison = state.runs[i];
                break;
            }
        }
        if (!comparison && state.runs.length >= 2) {
            comparison = state.runs[0];
        }
    } else if (state.runs.length >= 2) {
        comparison = state.runs[state.runs.length - 2];
    }

    const lines = [];
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    lines.push(`WEEKLY PULSE \u2014 ${dateStr}`);

    if (comparison) {
        const compDate = new Date(comparison.timestamp);
        const daysAgo = Math.round((now.getTime() - compDate.getTime()) / (24 * 60 * 60 * 1000));
        const compDateStr = compDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        lines.push(`Compared to: ${compDateStr} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)`);
        lines.push('');

        // Overall
        const overallDiff = latest.overallPct - comparison.overallPct;
        const overallArrow = overallDiff > 0 ? ' \u25B2' : overallDiff < 0 ? ' \u25BC' : '';
        const overallDelta = overallDiff !== 0 ? ` (${overallDiff > 0 ? '+' : ''}${overallDiff})` : ' (stable)';
        lines.push(`Overall: ${comparison.overallPct} \u2192 ${latest.overallPct}${overallDelta}${overallArrow}`);

        // Dimensions
        for (const dim of [
            { name: 'Setup', old: comparison.setup, new: latest.setup },
            { name: 'Usage', old: comparison.usage, new: latest.usage },
            { name: 'Fluency', old: comparison.fluency, new: latest.fluency },
        ]) {
            const diff = dim.new - dim.old;
            const arrow = diff > 0 ? ' \u25B2' : diff < 0 ? ' \u25BC' : '';
            const delta = diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff})` : ' (stable)';
            lines.push(`  ${dim.name.padEnd(10)} ${dim.old} \u2192 ${dim.new}${delta}${arrow}`);
        }

        // CE Patterns
        if (latest.cePatterns && comparison.cePatterns) {
            lines.push('');
            lines.push('CE Patterns:');
            const compMap = {};
            for (const p of comparison.cePatterns) compMap[p.name] = p.pct;

            const patternDeltas = [];
            for (const p of latest.cePatterns) {
                const oldPct = compMap[p.name] ?? null;
                patternDeltas.push({
                    name: p.name,
                    oldPct,
                    newPct: p.pct,
                    diff: oldPct !== null ? p.pct - oldPct : 0,
                });
            }
            patternDeltas.sort((a, b) => b.diff - a.diff);

            for (const pd of patternDeltas) {
                if (pd.oldPct !== null && pd.diff !== 0) {
                    const arrow = pd.diff > 0 ? '\u25B2' : '\u25BC';
                    lines.push(`  ${arrow} ${pd.name}: ${pd.oldPct}% \u2192 ${pd.newPct}% (${pd.diff > 0 ? '+' : ''}${pd.diff})`);
                } else {
                    lines.push(`  = ${pd.name}: ${pd.newPct}% (stable)`);
                }
            }

            // Events
            const events = [];
            for (const pd of patternDeltas) {
                if (pd.oldPct === null) continue;
                const oldTier = getTier(pd.oldPct);
                const newTier = getTier(pd.newPct);
                if (oldTier !== newTier && pd.diff > 0) {
                    events.push(`${pd.name} crossed into ${newTier} tier`);
                }
                if (oldTier !== newTier && pd.diff < 0) {
                    events.push(`${pd.name} dropped to ${newTier} tier`);
                }
            }

            // Streaks
            if (state.runs.length >= 4) {
                const recentRuns = state.runs.slice(-4);
                for (const dimName of ['setup', 'usage', 'fluency']) {
                    let streak = 0;
                    for (let i = 1; i < recentRuns.length; i++) {
                        if (recentRuns[i][dimName] > recentRuns[i - 1][dimName]) streak++;
                        else streak = 0;
                    }
                    if (streak >= 3) {
                        events.push(`${streak}-run improvement streak on ${dimName.charAt(0).toUpperCase() + dimName.slice(1)}`);
                    }
                }
            }

            if (events.length > 0) {
                lines.push('');
                lines.push('Events:');
                for (const e of events) lines.push(`  \u2022 ${e}`);
            }

            // Suggestion
            const staleOrLow = patternDeltas
                .filter(pd => pd.diff <= 0)
                .sort((a, b) => a.newPct - b.newPct);

            if (staleOrLow.length > 0) {
                const suggest = staleOrLow[0];
                lines.push('');
                lines.push(`Suggestion: ${suggest.name} (${suggest.newPct}%) is ${suggest.diff < 0 ? 'declining' : 'your weakest stable pattern'}.`);
                const advice = {
                    'Three-Layer Memory': 'Create memory/episodic/, memory/semantic/, and memory/goals/ directories.',
                    'Hooks as Guardrails': 'Add hooks in .claude/settings.json to automate quality checks.',
                    'Context Surfaces': 'Run context_pressure to identify what\'s consuming your context budget.',
                    'Self-Correction Protocol': 'Add a review loop: check_health after changes, track patterns over time.',
                    'Compound Learning': 'Start capturing learnings after each session in memory/semantic/.',
                    'Knowledge Files as RAM': 'Move domain details from CLAUDE.md to .claude/docs/ files.',
                    'Progressive Disclosure': 'Add "Read X before working on Y" pointers in CLAUDE.md.',
                };
                if (advice[suggest.name]) lines.push(advice[suggest.name]);
                lines.push('~15 min estimated.');
            }
        }
    } else {
        lines.push('');
        lines.push('First run \u2014 no comparison data yet.');
        lines.push('');
        lines.push(`Overall: ${latest.overallPct}%`);
        lines.push(`  Setup:   ${latest.setup}%`);
        lines.push(`  Usage:   ${latest.usage}%`);
        lines.push(`  Fluency: ${latest.fluency}%`);
        if (latest.cePatterns) {
            lines.push('');
            lines.push('CE Patterns:');
            for (const p of [...latest.cePatterns].sort((a, b) => b.pct - a.pct)) {
                lines.push(`  ${p.name}: ${p.pct}%`);
            }
        }
        lines.push('');
        lines.push('Run check_health again after making improvements to see your pulse.');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
}
