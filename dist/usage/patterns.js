/**
 * Usage Layer: Pattern Recognition
 *
 * Evaluates the health of the pattern-tracking system by checking
 * _pattern-tracker.md for candidates, promoted patterns, content
 * quality, and confidence progression.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const TRACKER_FILENAME = '_pattern-tracker.md';

const PATTERN_DIRS = [
    'memory/semantic/patterns',
    'memory/patterns',
    'brain-health',
];

/**
 * Try to read a file from multiple candidate paths. Returns content or null.
 */
async function readFirstExisting(rootPath, dirs, filename) {
    for (const dir of dirs) {
        try {
            const content = await readFile(join(rootPath, dir, filename), 'utf-8');
            return { content, dir };
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Count non-underscore-prefixed .md files larger than a given byte threshold
 * across multiple directories.
 */
async function countPatternFiles(rootPath, dirs, minBytes = 100) {
    const seen = new Set();
    let count = 0;

    for (const dir of dirs) {
        let entries;
        try {
            entries = await readdir(join(rootPath, dir));
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!entry.endsWith('.md')) continue;
            if (entry.startsWith('_')) continue;
            if (seen.has(entry)) continue;
            seen.add(entry);

            try {
                const s = await stat(join(rootPath, dir, entry));
                if (s.size > minBytes) count++;
            } catch {
                continue;
            }
        }
    }

    return count;
}

export async function checkPatterns(rootPath) {
    const checks = [];

    // Try to read the pattern tracker
    const tracker = await readFirstExisting(rootPath, PATTERN_DIRS, TRACKER_FILENAME);
    const trackerContent = tracker ? tracker.content : null;

    // Check 1: Pattern candidates tracked (8 pts)
    {
        let status, points, message;
        if (!trackerContent) {
            status = 'fail'; points = 0;
            message = 'No _pattern-tracker.md found in pattern directories';
        } else {
            // Count entries with "**Count**: N" where N > 0
            const countMatches = trackerContent.match(/\*\*Count\*\*:\s*(\d+)/g) || [];
            let nonZeroEntries = 0;
            for (const m of countMatches) {
                const num = parseInt(m.match(/(\d+)/)[1], 10);
                if (num > 0) nonZeroEntries++;
            }

            if (nonZeroEntries >= 3) {
                status = 'pass'; points = 8;
                message = `${nonZeroEntries} pattern candidates being tracked`;
            } else if (nonZeroEntries === 2) {
                status = 'warn'; points = 6;
                message = `${nonZeroEntries} pattern candidates — 3+ for full score`;
            } else if (nonZeroEntries === 1) {
                status = 'warn'; points = 3;
                message = '1 pattern candidate — keep identifying recurring patterns';
            } else {
                status = 'fail'; points = 0;
                message = 'Tracker exists but no pattern candidates with non-zero counts';
            }
        }
        checks.push({ name: 'Pattern candidates tracked', status, points, maxPoints: 8, message });
    }

    // Check 2: Promoted patterns (8 pts)
    {
        let status, points, message;
        let promotedCount = 0;

        // Try to parse promoted patterns table from tracker
        if (trackerContent) {
            // Look for a promoted patterns section with table rows
            const promotedSection = trackerContent.match(/(?:promoted|graduated|established).*?\n([\s\S]*?)(?:\n##|\n---|\Z)/i);
            if (promotedSection) {
                // Count table rows (lines starting with |, excluding header/separator)
                const rows = promotedSection[1].split('\n').filter(line =>
                    line.startsWith('|') && !line.match(/^\|\s*[-:]+/) && !line.match(/^\|\s*Pattern\s*\|/i)
                );
                promotedCount = rows.length;
            }
        }

        // Fallback: count pattern .md files > 100 bytes
        if (promotedCount === 0) {
            promotedCount = await countPatternFiles(rootPath, PATTERN_DIRS, 100);
        }

        if (promotedCount >= 3) {
            status = 'pass'; points = 8;
            message = `${promotedCount} promoted/established patterns`;
        } else if (promotedCount === 2) {
            status = 'warn'; points = 6;
            message = `${promotedCount} promoted patterns — 3+ for full score`;
        } else if (promotedCount === 1) {
            status = 'warn'; points = 3;
            message = '1 promoted pattern — promote more candidates as they prove reliable';
        } else {
            status = 'fail'; points = 0;
            message = 'No promoted patterns found';
        }
        checks.push({ name: 'Promoted patterns', status, points, maxPoints: 8, message });
    }

    // Check 3: Pattern files with content (5 pts)
    {
        const fileCount = await countPatternFiles(rootPath, PATTERN_DIRS, 100);
        let status, points, message;

        if (fileCount >= 3) {
            status = 'pass'; points = 5;
            message = `${fileCount} pattern files with substantive content`;
        } else if (fileCount >= 1) {
            status = 'warn'; points = 2;
            message = `${fileCount} pattern file(s) — aim for 3+ documented patterns`;
        } else {
            status = 'fail'; points = 0;
            message = 'No pattern files with content found';
        }
        checks.push({ name: 'Pattern files with content', status, points, maxPoints: 5, message });
    }

    // Check 4: Confidence progression (4 pts)
    {
        let status, points, message;
        if (!trackerContent) {
            status = 'fail'; points = 0;
            message = 'No pattern tracker — cannot assess confidence progression';
        } else {
            const hasHigh = /HIGH/i.test(trackerContent);
            const hasMedium = /MEDIUM/i.test(trackerContent);
            const hasLow = /LOW/i.test(trackerContent);

            const hasProgression = (hasHigh && hasMedium) || (hasMedium && hasLow);

            if (hasProgression) {
                status = 'pass'; points = 4;
                message = 'Pattern confidence levels show progression (patterns maturing over time)';
            } else {
                status = 'warn'; points = 1;
                message = 'Tracker exists but no confidence progression detected (need mix of HIGH/MEDIUM or MEDIUM/LOW)';
            }
        }
        checks.push({ name: 'Confidence progression', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Pattern Recognition',
        points: totalPoints,
        maxPoints: 25,
        checks,
    };
}
