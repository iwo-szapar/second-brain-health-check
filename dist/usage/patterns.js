/**
 * Usage Layer: Pattern Recognition
 *
 * Evaluates pattern tracking health. Branches on backend:
 * - supabase: Queries memory_knowledge for patterns, insights, confidence spread
 * - filesystem: Original _pattern-tracker.md parsing
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getMemoryOSStats } from '../utils/memoryos-stats.js';

const TRACKER_FILENAME = '_pattern-tracker.md';
const PATTERN_DIRS = ['memory/semantic/patterns', 'memory/patterns', 'brain-health'];

async function readFirstExisting(rootPath, dirs, filename) {
    for (const dir of dirs) {
        try { return { content: await readFile(join(rootPath, dir, filename), 'utf-8'), dir }; }
        catch { continue; }
    }
    return null;
}

async function countPatternFiles(rootPath, dirs, minBytes = 100) {
    const seen = new Set();
    let count = 0;
    for (const dir of dirs) {
        let entries;
        try { entries = await readdir(join(rootPath, dir)); } catch { continue; }
        for (const entry of entries) {
            if (!entry.endsWith('.md') || entry.startsWith('_') || seen.has(entry)) continue;
            seen.add(entry);
            try { const s = await stat(join(rootPath, dir, entry)); if (s.size > minBytes) count++; }
            catch { continue; }
        }
    }
    return count;
}

/**
 * SQL-backed pattern checks.
 */
async function checkPatternsSQL(stats) {
    const checks = [];

    // Check 1: Pattern candidates tracked (8 pts)
    {
        const { patternCount } = stats;
        let status, points, message;
        if (patternCount >= 5) {
            status = 'pass'; points = 8;
            message = `${patternCount} patterns tracked in MemoryOS database`;
        } else if (patternCount >= 2) {
            status = 'warn'; points = 4;
            message = `${patternCount} patterns — aim for 5+ recurring patterns`;
        } else {
            status = 'fail'; points = 0;
            message = patternCount === 1
                ? '1 pattern found — keep identifying recurring conventions'
                : 'No patterns in database — save recurring conventions as type=pattern';
        }
        checks.push({ name: 'Pattern candidates tracked', status, points, maxPoints: 8, message });
    }

    // Check 2: Confidence spread (4 pts)
    {
        const { confidenceSpread, confidenceValues } = stats;
        let status, points, message;
        if (confidenceSpread >= 3) {
            status = 'pass'; points = 4;
            message = `Confidence values show ${confidenceSpread} distinct levels (${confidenceValues.join(', ')}) — patterns maturing over time`;
        } else if (confidenceSpread === 2) {
            status = 'warn'; points = 2;
            message = `${confidenceSpread} confidence levels — patterns will mature as you validate them`;
        } else if (stats.patternCount > 0) {
            status = 'warn'; points = 1;
            message = 'All patterns at same confidence — adjust as patterns prove reliable or unreliable';
        } else {
            status = 'fail'; points = 0;
            message = 'No patterns to assess confidence';
        }
        checks.push({ name: 'Confidence progression', status, points, maxPoints: 4, message });
    }

    // Check 3: Knowledge freshness (8 pts)
    // For young brains (<90 days), show growth velocity instead
    {
        const { brainAgeDays, freshnessRatio, freshIn90d, total, addedLast30d, addedLast7d } = stats;
        let status, points, message;

        if (brainAgeDays < 90) {
            // Young brain — score growth velocity instead of freshness
            const weeklyRate = addedLast7d;
            if (weeklyRate >= 5) {
                status = 'pass'; points = 8;
                message = `Brain is ${brainAgeDays} days old — growing at ${weeklyRate} items/week (${addedLast30d} this month)`;
            } else if (weeklyRate >= 1) {
                status = 'warn'; points = 4;
                message = `Brain is ${brainAgeDays} days old — ${weeklyRate} items this week. Aim for 5+/week`;
            } else {
                status = 'fail'; points = 0;
                message = `Brain is ${brainAgeDays} days old but no items added this week`;
            }
        } else {
            // Mature brain — score freshness ratio
            const pct = Math.round(freshnessRatio * 100);
            if (freshnessRatio >= 0.5) {
                status = 'pass'; points = 8;
                message = `${freshIn90d}/${total} items (${pct}%) updated or created in last 90 days`;
            } else if (freshnessRatio >= 0.25) {
                status = 'warn'; points = 4;
                message = `${pct}% of knowledge is fresh (last 90 days) — review and validate older items`;
            } else {
                status = 'fail'; points = 0;
                message = `Only ${pct}% of knowledge is fresh — brain may be going stale`;
            }
        }
        checks.push({ name: 'Knowledge freshness', status, points, maxPoints: 8, message });
    }

    // Check 4: Insight generation (5 pts)
    {
        const { insightCount, lessonCount } = stats;
        const combined = insightCount + lessonCount;
        let status, points, message;
        if (insightCount >= 3) {
            status = 'pass'; points = 5;
            message = `${insightCount} insights + ${lessonCount} lessons — non-obvious connections being captured`;
        } else if (combined >= 2) {
            status = 'warn'; points = 2;
            message = `${insightCount} insight(s), ${lessonCount} lesson(s) — use /reflect to synthesize more`;
        } else {
            status = 'fail'; points = 0;
            message = 'Few insights/lessons captured — run /reflect to synthesize patterns into higher-order insights';
        }
        checks.push({ name: 'Insight generation', status, points, maxPoints: 5, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Pattern Recognition', points: totalPoints, maxPoints: 25, checks };
}

/**
 * Original filesystem-based pattern checks.
 */
async function checkPatternsFilesystem(rootPath) {
    const checks = [];
    const tracker = await readFirstExisting(rootPath, PATTERN_DIRS, TRACKER_FILENAME);
    const trackerContent = tracker ? tracker.content : null;

    // Check 1: Pattern candidates tracked (8 pts)
    {
        let status, points, message;
        if (!trackerContent) {
            status = 'fail'; points = 0;
            message = 'No _pattern-tracker.md found in pattern directories';
        } else {
            const countMatches = trackerContent.match(/\*\*Count\*\*:\s*(\d+)/g) || [];
            let nonZeroEntries = 0;
            for (const m of countMatches) { const num = parseInt(m.match(/(\d+)/)[1], 10); if (num > 0) nonZeroEntries++; }
            if (nonZeroEntries >= 3) { status = 'pass'; points = 8; message = `${nonZeroEntries} pattern candidates being tracked`; }
            else if (nonZeroEntries === 2) { status = 'warn'; points = 6; message = `${nonZeroEntries} pattern candidates — 3+ for full score`; }
            else if (nonZeroEntries === 1) { status = 'warn'; points = 3; message = '1 pattern candidate — keep identifying recurring patterns'; }
            else { status = 'fail'; points = 0; message = 'Tracker exists but no pattern candidates with non-zero counts'; }
        }
        checks.push({ name: 'Pattern candidates tracked', status, points, maxPoints: 8, message });
    }

    // Check 2: Promoted patterns (8 pts)
    {
        let promotedCount = 0;
        if (trackerContent) {
            const promotedSection = trackerContent.match(/(?:promoted|graduated|established).*?\n([\s\S]*?)(?:\n##|\n---|\Z)/i);
            if (promotedSection) {
                const rows = promotedSection[1].split('\n').filter(line =>
                    line.startsWith('|') && !line.match(/^\|\s*[-:]+/) && !line.match(/^\|\s*Pattern\s*\|/i));
                promotedCount = rows.length;
            }
        }
        if (promotedCount === 0) promotedCount = await countPatternFiles(rootPath, PATTERN_DIRS, 100);
        let status, points;
        if (promotedCount >= 3) { status = 'pass'; points = 8; }
        else if (promotedCount === 2) { status = 'warn'; points = 6; }
        else if (promotedCount === 1) { status = 'warn'; points = 3; }
        else { status = 'fail'; points = 0; }
        checks.push({ name: 'Promoted patterns', status, points, maxPoints: 8,
            message: promotedCount > 0 ? `${promotedCount} promoted/established patterns` : 'No promoted patterns found' });
    }

    // Check 3: Pattern files with content (5 pts)
    {
        const fileCount = await countPatternFiles(rootPath, PATTERN_DIRS, 100);
        let status, points;
        if (fileCount >= 3) { status = 'pass'; points = 5; }
        else if (fileCount >= 1) { status = 'warn'; points = 2; }
        else { status = 'fail'; points = 0; }
        checks.push({ name: 'Pattern files with content', status, points, maxPoints: 5,
            message: fileCount > 0 ? `${fileCount} pattern files with substantive content` : 'No pattern files with content found' });
    }

    // Check 4: Confidence progression (4 pts)
    {
        let status, points, message;
        if (!trackerContent) { status = 'fail'; points = 0; message = 'No pattern tracker — cannot assess confidence progression'; }
        else {
            const hasHigh = /HIGH/i.test(trackerContent);
            const hasMedium = /MEDIUM/i.test(trackerContent);
            const hasLow = /LOW/i.test(trackerContent);
            const hasProgression = (hasHigh && hasMedium) || (hasMedium && hasLow);
            if (hasProgression) { status = 'pass'; points = 4; message = 'Pattern confidence levels show progression (patterns maturing over time)'; }
            else { status = 'warn'; points = 1; message = 'Tracker exists but no confidence progression detected (need mix of HIGH/MEDIUM or MEDIUM/LOW)'; }
        }
        checks.push({ name: 'Confidence progression', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Pattern Recognition', points: totalPoints, maxPoints: 25, checks };
}

export async function checkPatterns(rootPath) {
    const stats = await getMemoryOSStats(rootPath);
    if (stats) return checkPatternsSQL(stats);
    return checkPatternsFilesystem(rootPath);
}
