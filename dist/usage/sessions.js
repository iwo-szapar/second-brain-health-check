/**
 * Usage Layer: Session Activity
 *
 * Measures how actively the Second Brain is being used by scanning
 * session logs, episodic memory, and experience files.
 *
 * Checks session count, activity span across days, minimum threshold,
 * and recency of the most recent session.
 */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SESSION_DIRS = [
    'memory/episodic/sessions',
    'memory/episodic',
    'experiences',
];

/**
 * Recursively collect .md files from a directory.
 */
async function collectMdFiles(dir, depth = 0, maxDepth = 3, maxEntries = 500) {
    const files = [];
    if (depth > maxDepth) return files;

    let entries;
    try {
        entries = await readdir(dir);
    } catch {
        return files;
    }

    for (const entry of entries.slice(0, maxEntries)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
                const sub = await collectMdFiles(fullPath, depth + 1, maxDepth, maxEntries);
                files.push(...sub);
            } else if (entry.endsWith('.md')) {
                files.push({ path: fullPath, name: entry, stat: s });
            }
        } catch {
            continue;
        }
    }

    return files;
}

/**
 * Extract a YYYY-MM-DD date string from a filename, or return null.
 */
function parseDateFromFilename(name) {
    const match = name.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}

export async function checkSessions(rootPath) {
    const checks = [];

    // Collect all .md files from session directories
    const allFiles = [];
    for (const dir of SESSION_DIRS) {
        const files = await collectMdFiles(join(rootPath, dir));
        allFiles.push(...files);
    }

    // Deduplicate by path
    const seen = new Set();
    const uniqueFiles = [];
    for (const f of allFiles) {
        if (!seen.has(f.path)) {
            seen.add(f.path);
            uniqueFiles.push(f);
        }
    }

    const sessionCount = uniqueFiles.length;

    // Check 1: Session logs exist (8 pts)
    {
        let status, points, message;
        if (sessionCount >= 5) {
            status = 'pass'; points = 8;
            message = `${sessionCount} session log files found`;
        } else if (sessionCount >= 3) {
            status = 'warn'; points = 6;
            message = `${sessionCount} session logs — aim for 5+ for full score`;
        } else if (sessionCount >= 1) {
            status = 'warn'; points = 3;
            message = `Only ${sessionCount} session log(s) found — keep logging sessions`;
        } else {
            status = 'fail'; points = 0;
            message = 'No session logs found in memory/episodic/sessions/, memory/episodic/, or experiences/';
        }
        checks.push({ name: 'Session logs exist', status, points, maxPoints: 8, message });
    }

    // Check 2: Activity spans multiple days (8 pts)
    {
        const uniqueDates = new Set();
        for (const f of uniqueFiles) {
            const dateStr = parseDateFromFilename(f.name);
            if (dateStr) {
                uniqueDates.add(dateStr);
            } else {
                // Fall back to mtime
                const d = new Date(f.stat.mtimeMs);
                uniqueDates.add(d.toISOString().slice(0, 10));
            }
        }

        const dayCount = uniqueDates.size;
        let status, points, message;
        if (dayCount >= 14) {
            status = 'pass'; points = 8;
            message = `Activity spans ${dayCount} unique days`;
        } else if (dayCount >= 7) {
            status = 'warn'; points = 5;
            message = `Activity spans ${dayCount} days — 14+ days earns full score`;
        } else if (dayCount >= 1) {
            status = 'warn'; points = 2;
            message = `Activity spans only ${dayCount} day(s) — use your brain across more days`;
        } else {
            status = 'fail'; points = 0;
            message = 'No activity dates detected';
        }
        checks.push({ name: 'Activity spans multiple days', status, points, maxPoints: 8, message });
    }

    // Check 3: Minimum session count (5 pts)
    {
        let status, points, message;
        if (sessionCount >= 5) {
            status = 'pass'; points = 5;
            message = `${sessionCount} sessions meets the minimum threshold`;
        } else if (sessionCount >= 3) {
            status = 'warn'; points = 3;
            message = `${sessionCount} sessions — 5+ needed for full score`;
        } else if (sessionCount >= 1) {
            status = 'warn'; points = 1;
            message = `Only ${sessionCount} session(s) — build the habit`;
        } else {
            status = 'fail'; points = 0;
            message = 'No sessions found';
        }
        checks.push({ name: 'Minimum session count', status, points, maxPoints: 5, message });
    }

    // Check 4: Recent activity (4 pts)
    {
        let status, points, message;
        if (uniqueFiles.length === 0) {
            status = 'fail'; points = 0;
            message = 'No session files to check recency';
        } else {
            const mostRecentMs = Math.max(...uniqueFiles.map(f => f.stat.mtimeMs));
            const daysAgo = (Date.now() - mostRecentMs) / (1000 * 60 * 60 * 24);

            if (daysAgo <= 7) {
                status = 'pass'; points = 4;
                message = `Most recent activity ${daysAgo < 1 ? 'today' : Math.floor(daysAgo) + ' day(s) ago'}`;
            } else if (daysAgo <= 14) {
                status = 'warn'; points = 2;
                message = `Most recent activity ${Math.floor(daysAgo)} days ago — try to use it weekly`;
            } else {
                status = 'fail'; points = 0;
                message = `Most recent activity ${Math.floor(daysAgo)} days ago — brain is going stale`;
            }
        }
        checks.push({ name: 'Recent activity', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Session Activity',
        points: totalPoints,
        maxPoints: 25,
        checks,
    };
}
