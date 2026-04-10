/**
 * Setup Layer: Brain Health Infrastructure
 *
 * Evaluates brain health tracking infrastructure. Branches on backend:
 * - supabase: Checks health_check_runs history, observer pipeline, onboarding
 * - filesystem: Original checks (brain-health/ dir, tracking files, guides)
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getMemoryOSStats } from '../utils/memoryos-stats.js';

async function exists(filePath) {
    try { await stat(filePath); return true; } catch { return false; }
}

/**
 * SQL-backed brain health checks.
 */
async function checkBrainHealthSQL(rootPath, stats) {
    const checks = [];

    // Check 1: Health tracking infrastructure (4 pts)
    // Does .health-check.json exist with run history?
    {
        let runCount = 0;
        try {
            const content = await readFile(join(rootPath, '.health-check.json'), 'utf-8');
            const data = JSON.parse(content);
            runCount = data.runs?.length ?? 0;
        } catch { /* no history */ }

        let status, points, message;
        if (runCount >= 3) {
            status = 'pass'; points = 4;
            message = `Health check has ${runCount} historical runs — trend tracking active`;
        } else if (runCount >= 1) {
            status = 'warn'; points = 2;
            message = `${runCount} health check run(s) — schedule daily runs for trend tracking`;
        } else {
            status = 'fail'; points = 0;
            message = 'No health check history — run health check regularly to track brain growth';
        }
        checks.push({ name: 'Health tracking history', status, points, maxPoints: 4, message });
    }

    // Check 2: Observer pipeline (3 pts)
    // Is auto-observer actively capturing knowledge?
    {
        const { observerCount, observerLast7d, distinctSources } = stats;
        let status, points, message;
        if (observerLast7d > 0) {
            status = 'pass'; points = 3;
            message = `Observer captured ${observerLast7d} items this week (${observerCount} total from auto-observer, ${distinctSources} distinct sources)`;
        } else if (observerCount > 0) {
            status = 'warn'; points = 1;
            message = `Observer has ${observerCount} total captures but none this week — check hooks (accumulate-learnings.sh, drain-learnings.sh)`;
        } else {
            status = 'fail'; points = 0;
            message = 'No auto-observer captures found — set up observer hooks for automatic knowledge extraction';
        }
        checks.push({ name: 'Observer pipeline', status, points, maxPoints: 3, message });
    }

    // Check 3: Getting started guide (3 pts) — same as filesystem
    {
        const guideFiles = [
            join(rootPath, 'ONBOARDING_SUMMARY.md'), join(rootPath, 'README.md'),
            join(rootPath, 'readme.md'), join(rootPath, 'Readme.md'),
            join(rootPath, 'GETTING_STARTED.md'), join(rootPath, 'agent_docs', 'README.md'),
        ];
        let foundGuide = null;
        for (const filePath of guideFiles) {
            if (await exists(filePath)) { foundGuide = filePath.replace(rootPath + '/', ''); break; }
        }
        checks.push({
            name: 'Getting started guide',
            status: foundGuide ? 'pass' : 'fail',
            points: foundGuide ? 3 : 0, maxPoints: 3,
            message: foundGuide ? `Getting started guide found: ${foundGuide}` : 'No onboarding guide found — add README.md, GETTING_STARTED.md, or ONBOARDING_SUMMARY.md',
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Brain Health Infrastructure', points: totalPoints, maxPoints: 10, checks };
}

/**
 * Original filesystem-based brain health checks.
 */
async function checkBrainHealthFilesystem(rootPath) {
    const checks = [];

    // Check 1: Brain health directory (4 pts)
    {
        const primaryDir = join(rootPath, 'brain-health');
        const fallback1 = join(rootPath, 'memory', 'semantic', 'patterns');
        const fallback2 = join(rootPath, 'memory', 'patterns');
        const hasPrimary = await exists(primaryDir);
        const hasFallback = !hasPrimary && (await exists(fallback1) || await exists(fallback2));
        let status, points, message;
        if (hasPrimary) { status = 'pass'; points = 4; message = 'brain-health/ directory found'; }
        else if (hasFallback) { status = 'warn'; points = 2; message = 'Brain health tracked via memory patterns directory (fallback) — consider adding dedicated brain-health/ directory'; }
        else { status = 'fail'; points = 0; message = 'No brain-health/ directory or memory/patterns/ fallback found'; }
        checks.push({ name: 'Brain health directory', status, points, maxPoints: 4, message });
    }

    // Check 2: Tracking files present (3 pts)
    {
        const trackingFiles = ['growth-log.md', 'quality-metrics.md', 'pattern-confidence.md'];
        const searchDirs = [
            join(rootPath, 'brain-health'), join(rootPath, 'memory'),
            join(rootPath, 'memory', 'semantic'), join(rootPath, 'memory', 'patterns'),
            join(rootPath, 'memory', 'semantic', 'patterns'),
        ];
        let foundCount = 0;
        const foundFiles = [];
        for (const fileName of trackingFiles) {
            for (const dir of searchDirs) {
                if (await exists(join(dir, fileName))) { foundCount++; foundFiles.push(fileName); break; }
            }
        }
        let status, points;
        if (foundCount >= 2) { status = 'pass'; points = 3; }
        else if (foundCount === 1) { status = 'warn'; points = 1; }
        else { status = 'fail'; points = 0; }
        checks.push({
            name: 'Tracking files present', status, points, maxPoints: 3,
            message: foundCount > 0 ? `${foundCount}/3 tracking files found: ${foundFiles.join(', ')}` : 'No tracking files found (growth-log.md, quality-metrics.md, pattern-confidence.md)',
        });
    }

    // Check 3: Getting started guide (3 pts)
    {
        const guideFiles = [
            join(rootPath, 'ONBOARDING_SUMMARY.md'), join(rootPath, 'README.md'),
            join(rootPath, 'readme.md'), join(rootPath, 'Readme.md'),
            join(rootPath, 'GETTING_STARTED.md'), join(rootPath, 'agent_docs', 'README.md'),
        ];
        let foundGuide = null;
        for (const filePath of guideFiles) {
            if (await exists(filePath)) { foundGuide = filePath.replace(rootPath + '/', ''); break; }
        }
        checks.push({
            name: 'Getting started guide',
            status: foundGuide ? 'pass' : 'fail',
            points: foundGuide ? 3 : 0, maxPoints: 3,
            message: foundGuide ? `Getting started guide found: ${foundGuide}` : 'No onboarding guide found — add README.md, GETTING_STARTED.md, or ONBOARDING_SUMMARY.md',
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Brain Health Infrastructure', points: totalPoints, maxPoints: 10, checks };
}

export async function checkBrainHealth(rootPath) {
    const stats = await getMemoryOSStats(rootPath);
    if (stats) return checkBrainHealthSQL(rootPath, stats);
    return checkBrainHealthFilesystem(rootPath);
}
