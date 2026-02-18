/**
 * Usage Layer: Compound Evidence
 *
 * Detects whether the brain's tooling (skills, hooks, goals) has
 * evolved after initial setup — evidence that the system compounds
 * over time rather than remaining static.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

/**
 * Get the oldest file birthtime in a directory (non-recursive, top-level entries only).
 * Returns timestamp in ms, or null if directory is empty/missing.
 */
async function getOldestBirthtime(dirPath) {
    let oldest = Infinity;
    let entries;
    try {
        entries = await readdir(dirPath);
    } catch {
        return null;
    }

    for (const entry of entries) {
        if (entry === 'node_modules') continue;
        try {
            const s = await stat(join(dirPath, entry));
            if (s.birthtimeMs < oldest) {
                oldest = s.birthtimeMs;
            }
        } catch {
            continue;
        }
    }

    return oldest === Infinity ? null : oldest;
}

/**
 * Calculate the setup cutoff: oldest file birthtime in the brain root + 2 days.
 */
async function getSetupCutoff(rootPath) {
    const oldest = await getOldestBirthtime(rootPath);
    if (oldest === null) return null;
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    return oldest + twoDaysMs;
}

/**
 * Count directories in a path that have been modified after a cutoff timestamp.
 */
async function countModifiedDirs(dirPath, cutoffMs) {
    let count = 0;
    let entries;
    try {
        entries = await readdir(dirPath);
    } catch {
        return 0;
    }

    for (const entry of entries) {
        if (entry.startsWith('.') && entry !== '.claude') continue;
        const fullPath = join(dirPath, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory() && s.mtimeMs > cutoffMs) {
                count++;
            }
        } catch {
            continue;
        }
    }

    return count;
}

/**
 * Check if any files in a directory (or the file itself) were modified after cutoff.
 */
async function hasModifiedFiles(paths, cutoffMs) {
    for (const p of paths) {
        try {
            const s = await stat(p);
            if (s.mtimeMs > cutoffMs) return true;

            // If it's a directory, check its children
            if (s.isDirectory()) {
                const entries = await readdir(p);
                for (const entry of entries) {
                    try {
                        const cs = await stat(join(p, entry));
                        if (cs.mtimeMs > cutoffMs) return true;
                    } catch {
                        continue;
                    }
                }
            }
        } catch {
            continue;
        }
    }
    return false;
}

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

export async function checkCompoundEvidence(rootPath) {
    const checks = [];

    const setupCutoff = await getSetupCutoff(rootPath);

    // If we can't determine setup time, use a fallback (everything passes if files exist)
    const cutoff = setupCutoff || 0;

    // Check 1: Skills evolved post-setup (5 pts)
    {
        const skillsDir = join(rootPath, '.claude', 'skills');
        let status, points, message;

        if (cutoff === 0) {
            // Can't determine setup time — check if skills exist at all
            let skillCount = 0;
            try {
                const entries = await readdir(skillsDir);
                for (const entry of entries) {
                    try {
                        const s = await stat(join(skillsDir, entry));
                        if (s.isDirectory()) skillCount++;
                    } catch {
                        continue;
                    }
                }
            } catch {
                // no skills dir
            }

            if (skillCount >= 2) {
                status = 'pass'; points = 5;
                message = `${skillCount} skill directories found (unable to determine setup date)`;
            } else if (skillCount === 1) {
                status = 'warn'; points = 2;
                message = '1 skill directory found';
            } else {
                status = 'fail'; points = 0;
                message = 'No .claude/skills/ directory or skill subdirectories found';
            }
        } else {
            const modifiedCount = await countModifiedDirs(skillsDir, cutoff);

            if (modifiedCount >= 2) {
                status = 'pass'; points = 5;
                message = `${modifiedCount} skill directories modified after initial setup`;
            } else if (modifiedCount === 1) {
                status = 'warn'; points = 2;
                message = '1 skill directory modified post-setup — keep building skills';
            } else {
                status = 'fail'; points = 0;
                message = 'No skills evolved after initial setup';
            }
        }
        checks.push({ name: 'Skills evolved post-setup', status, points, maxPoints: 5, message });
    }

    // Check 2: Hooks evolved post-setup (5 pts)
    {
        const settingsPath = join(rootPath, '.claude', 'settings.json');
        const hooksDir = join(rootPath, '.claude', 'hooks');
        let status, points, message;

        if (cutoff === 0) {
            // Fallback: check existence
            const anyExists = await hasModifiedFiles([settingsPath, hooksDir], 0);
            if (anyExists) {
                status = 'pass'; points = 5;
                message = 'Hooks/settings files exist (unable to determine setup date)';
            } else {
                status = 'fail'; points = 0;
                message = 'No .claude/settings.json or .claude/hooks/ found';
            }
        } else {
            const modified = await hasModifiedFiles([settingsPath, hooksDir], cutoff);

            if (modified) {
                status = 'pass'; points = 5;
                message = 'Hooks or settings evolved after initial setup';
            } else {
                status = 'fail'; points = 0;
                message = 'No hooks or settings changes detected after setup';
            }
        }
        checks.push({ name: 'Hooks evolved post-setup', status, points, maxPoints: 5, message });
    }

    // Check 3: Goal or alignment tracking (5 pts)
    {
        const goalFiles = [
            'memory/alignment-log.md',
            'memory/goals/current.md',
            'memory/personal/goals.md',
        ];

        let status, points, message;
        let anyFileExists = false;
        let anyHasDates = false;

        for (const relPath of goalFiles) {
            try {
                const content = await readFile(join(rootPath, relPath), 'utf-8');
                anyFileExists = true;
                if (DATE_PATTERN.test(content)) {
                    anyHasDates = true;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (anyHasDates) {
            status = 'pass'; points = 5;
            message = 'Goal/alignment tracking has dated entries — active direction-setting';
        } else if (anyFileExists) {
            status = 'warn'; points = 2;
            message = 'Goal/alignment files exist but no dated entries — add timestamps to track progress';
        } else {
            status = 'fail'; points = 0;
            message = 'No alignment-log.md, goals/current.md, or personal/goals.md found';
        }
        checks.push({ name: 'Goal or alignment tracking', status, points, maxPoints: 5, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Compound Evidence',
        points: totalPoints,
        maxPoints: 15,
        checks,
    };
}
