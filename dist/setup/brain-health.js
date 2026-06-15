/**
 * Setup Layer: Brain Health Infrastructure
 *
 * Evaluates whether the project has brain health tracking infrastructure,
 * including a dedicated directory, tracking files, and getting started guides.
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

async function exists(filePath) {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function checkBrainHealth(rootPath) {
    const checks = [];

    // Check 1: Brain health directory (4 pts)
    {
        const primaryDir = join(rootPath, 'brain-health');
        const fallback1 = join(rootPath, 'memory', 'semantic', 'patterns');
        const fallback2 = join(rootPath, 'memory', 'patterns');

        const hasPrimary = await exists(primaryDir);
        const hasFallback = !hasPrimary && (await exists(fallback1) || await exists(fallback2));

        let status, points, message;
        if (hasPrimary) {
            status = 'pass';
            points = 4;
            message = 'brain-health/ directory found';
        } else if (hasFallback) {
            status = 'warn';
            points = 2;
            message = 'Brain health tracked via memory patterns directory (fallback) — consider adding dedicated brain-health/ directory';
        } else {
            status = 'fail';
            points = 0;
            message = 'No brain-health/ directory or memory/patterns/ fallback found';
        }

        checks.push({ name: 'Brain health directory', status, points, maxPoints: 4, message });
    }

    // Check 2: Tracking files present (3 pts)
    {
        const trackingFiles = [
            'growth-log.md',
            'quality-metrics.md',
            'pattern-confidence.md',
        ];

        const searchDirs = [
            join(rootPath, 'brain-health'),
            join(rootPath, 'memory'),
            join(rootPath, 'memory', 'semantic'),
            join(rootPath, 'memory', 'patterns'),
            join(rootPath, 'memory', 'semantic', 'patterns'),
        ];

        let foundCount = 0;
        const foundFiles = [];
        for (const fileName of trackingFiles) {
            let fileFound = false;
            for (const dir of searchDirs) {
                if (await exists(join(dir, fileName))) {
                    fileFound = true;
                    break;
                }
            }
            if (fileFound) {
                foundCount++;
                foundFiles.push(fileName);
            }
        }

        let status, points;
        if (foundCount >= 2) {
            status = 'pass';
            points = 3;
        } else if (foundCount === 1) {
            status = 'warn';
            points = 1;
        } else {
            status = 'fail';
            points = 0;
        }

        checks.push({
            name: 'Tracking files present',
            status,
            points,
            maxPoints: 3,
            message: foundCount > 0
                ? `${foundCount}/3 tracking files found: ${foundFiles.join(', ')}`
                : 'No tracking files found (growth-log.md, quality-metrics.md, pattern-confidence.md)',
        });
    }

    // Check 3: Getting started guide (3 pts)
    {
        const guideFiles = [
            join(rootPath, 'ONBOARDING_SUMMARY.md'),
            join(rootPath, 'README.md'),
            join(rootPath, 'readme.md'),
            join(rootPath, 'Readme.md'),
            join(rootPath, 'GETTING_STARTED.md'),
            join(rootPath, 'agent_docs', 'README.md'),
        ];

        let foundGuide = null;
        for (const filePath of guideFiles) {
            if (await exists(filePath)) {
                foundGuide = filePath.replace(rootPath + '/', '');
                break;
            }
        }

        checks.push({
            name: 'Getting started guide',
            status: foundGuide ? 'pass' : 'fail',
            points: foundGuide ? 3 : 0,
            maxPoints: 3,
            message: foundGuide
                ? `Getting started guide found: ${foundGuide}`
                : 'No onboarding guide found — add README.md, GETTING_STARTED.md, or ONBOARDING_SUMMARY.md',
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Brain Health Infrastructure',
        points: totalPoints,
        maxPoints: 10,
        checks,
    };
}
