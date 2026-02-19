/**
 * Setup Layer: Spec & Planning Artifacts
 *
 * Checks for the "two-session spec → execution split" pattern:
 * plan files, requirement specs, and structured planning documents
 * that capture what to build before the build session starts.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PLANNING_DIRS = ['plans', 'specs', 'planning', 'requirements'];
const REQUIREMENT_HEADINGS = /^#{1,3}\s.*(goal|objective|overview|requirement|acceptance|problem|solution|spec|feature|user story)/im;

async function findPlanningDir(rootPath) {
    for (const dirName of PLANNING_DIRS) {
        const dirPath = join(rootPath, dirName);
        try {
            const s = await stat(dirPath);
            if (s.isDirectory()) return dirPath;
        } catch { continue; }
    }
    // Also check docs/specs, docs/plans
    for (const sub of ['specs', 'plans', 'requirements']) {
        const dirPath = join(rootPath, 'docs', sub);
        try {
            const s = await stat(dirPath);
            if (s.isDirectory()) return dirPath;
        } catch { continue; }
    }
    return null;
}

export async function checkSpecPlanning(rootPath) {
    const planningDir = await findPlanningDir(rootPath);

    if (!planningDir) {
        return {
            name: 'Spec & Planning Artifacts',
            points: 0,
            maxPoints: 10,
            checks: [
                {
                    name: 'Spec/planning directory',
                    status: 'fail', points: 0, maxPoints: 4,
                    message: 'No plans/, specs/, or planning/ directory found — use spec files to capture requirements before execution',
                },
                {
                    name: 'Structured requirement headings',
                    status: 'fail', points: 0, maxPoints: 3,
                    message: 'No planning directory to evaluate',
                },
                {
                    name: 'Recent planning activity',
                    status: 'fail', points: 0, maxPoints: 3,
                    message: 'No planning directory to evaluate',
                },
            ],
        };
    }

    const checks = [];

    // Collect .md files once, reuse across checks
    let mdFiles = [];
    try {
        const entries = await readdir(planningDir);
        mdFiles = entries.filter(e => e.endsWith('.md') || e.endsWith('.txt'));
    } catch { /* empty dir */ }

    // Check 1: Spec/planning directory with markdown files (4 pts)
    {
        const dirLabel = planningDir.replace(rootPath, '').replace(/^\//, '');
        let status, points;
        if (mdFiles.length >= 5) {
            status = 'pass'; points = 4;
        } else if (mdFiles.length >= 2) {
            status = 'pass'; points = 3;
        } else if (mdFiles.length >= 1) {
            status = 'warn'; points = 2;
        } else {
            status = 'fail'; points = 0;
        }
        checks.push({
            name: 'Spec/planning directory',
            status, points, maxPoints: 4,
            message: mdFiles.length > 0
                ? `${mdFiles.length} planning file(s) in ${dirLabel}/`
                : `${dirLabel}/ directory exists but contains no markdown files`,
        });
    }

    // Check 2: Structured requirement headings (3 pts)
    {
        let structuredCount = 0;
        for (const file of mdFiles.slice(0, 20)) {
            try {
                const content = await readFile(join(planningDir, file), 'utf-8');
                if (REQUIREMENT_HEADINGS.test(content)) structuredCount++;
            } catch { continue; }
        }
        let status, points, message;
        if (structuredCount >= 3) {
            status = 'pass'; points = 3;
            message = `${structuredCount} planning files have structured requirement headings`;
        } else if (structuredCount >= 1) {
            status = 'warn'; points = 1;
            message = `${structuredCount} file(s) have structured headings — add ## Goals, ## Requirements, or ## Overview sections to all plan files`;
        } else {
            status = 'fail'; points = 0;
            message = 'Planning files lack structure — add ## Goals, ## Requirements, or ## Acceptance Criteria headings';
        }
        checks.push({ name: 'Structured requirement headings', status, points, maxPoints: 3, message });
    }

    // Check 3: Recent planning activity (3 pts)
    {
        let mostRecentDays = Infinity;
        for (const file of mdFiles) {
            try {
                const s = await stat(join(planningDir, file));
                const days = (Date.now() - s.mtimeMs) / (1000 * 60 * 60 * 24);
                if (days < mostRecentDays) mostRecentDays = days;
            } catch { continue; }
        }
        let status, points, message;
        if (mostRecentDays <= 7) {
            status = 'pass'; points = 3;
            message = `Planning file updated ${Math.floor(mostRecentDays)} day(s) ago — active spec-first workflow`;
        } else if (mostRecentDays <= 30) {
            status = 'pass'; points = 2;
            message = `Most recent planning file is ${Math.floor(mostRecentDays)} days old — planning is active`;
        } else if (mostRecentDays < Infinity) {
            status = 'warn'; points = 1;
            message = `Most recent planning file is ${Math.floor(mostRecentDays)} days old — consider refreshing your planning artifacts`;
        } else {
            status = 'fail'; points = 0;
            message = 'Could not determine recency of planning files';
        }
        checks.push({ name: 'Recent planning activity', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Spec & Planning Artifacts',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
