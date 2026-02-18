/**
 * Usage Layer: Review Loop
 *
 * Checks whether the user has active quality tracking, growth logging,
 * and pattern confidence tracking — signs of a healthy review and
 * improvement feedback loop.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

const TRACKER_FILENAME = '_pattern-tracker.md';

const PATTERN_DIRS = [
    'memory/semantic/patterns',
    'memory/patterns',
    'brain-health',
];

/**
 * Try to read a file from multiple candidate paths. Returns content or null.
 */
async function tryReadFile(rootPath, relativePaths) {
    for (const relPath of relativePaths) {
        try {
            return await readFile(join(rootPath, relPath), 'utf-8');
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Check if a file exists at any of the given paths. Returns { exists, content }.
 */
async function checkFileExists(rootPath, relativePaths) {
    const content = await tryReadFile(rootPath, relativePaths);
    if (content !== null) {
        return { exists: true, content, empty: content.trim().length === 0 };
    }
    return { exists: false, content: null, empty: true };
}

export async function checkReviewLoop(rootPath) {
    const checks = [];

    // Check 1: Quality tracking active (6 pts)
    {
        const result = await checkFileExists(rootPath, [
            'brain-health/quality-metrics.md',
            'memory/quality-metrics.md',
        ]);

        let status, points, message;
        if (result.exists && !result.empty && DATE_PATTERN.test(result.content)) {
            status = 'pass'; points = 6;
            message = 'Quality metrics file has dated entries — active quality tracking';
        } else if (result.exists) {
            status = 'warn'; points = 2;
            message = result.empty
                ? 'Quality metrics file exists but is empty'
                : 'Quality metrics file exists but no dated entries found';
        } else {
            status = 'fail'; points = 0;
            message = 'No quality-metrics.md found in brain-health/ or memory/';
        }
        checks.push({ name: 'Quality tracking active', status, points, maxPoints: 6, message });
    }

    // Check 2: Growth log populated (5 pts)
    {
        const result = await checkFileExists(rootPath, [
            'brain-health/growth-log.md',
            'memory/growth-log.md',
        ]);

        let status, points, message;
        if (result.exists && !result.empty) {
            status = 'pass'; points = 5;
            message = 'Growth log has entries — tracking brain evolution';
        } else if (result.exists) {
            status = 'warn'; points = 1;
            message = 'Growth log file exists but is empty';
        } else {
            status = 'fail'; points = 0;
            message = 'No growth-log.md found in brain-health/ or memory/';
        }
        checks.push({ name: 'Growth log populated', status, points, maxPoints: 5, message });
    }

    // Check 3: Pattern confidence tracking (4 pts)
    {
        let trackerContent = null;
        for (const dir of PATTERN_DIRS) {
            try {
                trackerContent = await readFile(join(rootPath, dir, TRACKER_FILENAME), 'utf-8');
                break;
            } catch {
                continue;
            }
        }

        let status, points, message;
        if (trackerContent) {
            const hasConfidence = /MEDIUM|HIGH/i.test(trackerContent);
            const countMatches = trackerContent.match(/\*\*Count\*\*:\s*(\d+)/g) || [];
            const hasNonZero = countMatches.some(m => {
                const num = parseInt(m.match(/(\d+)/)[1], 10);
                return num > 0;
            });

            if (hasConfidence && hasNonZero) {
                status = 'pass'; points = 4;
                message = 'Pattern tracker has confidence levels and active counts';
            } else {
                status = 'warn'; points = 1;
                message = 'Pattern tracker exists but missing confidence keywords or active counts';
            }
        } else {
            status = 'fail'; points = 0;
            message = 'No _pattern-tracker.md found';
        }
        checks.push({ name: 'Pattern confidence tracking', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Review Loop',
        points: totalPoints,
        maxPoints: 15,
        checks,
    };
}
