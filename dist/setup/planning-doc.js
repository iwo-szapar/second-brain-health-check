/**
 * Setup Layer: Planning Documentation
 *
 * Checks for PLANNING.md or architecture documentation.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PLANNING_FILES = [
    'PLANNING.md', 'ARCHITECTURE.md', 'docs/architecture.md',
    'docs/PLANNING.md', '.claude/docs/architecture.md',
];

export async function checkPlanningDoc(rootPath) {
    const checks = [];
    let foundPath = null;
    let content = '';

    for (const file of PLANNING_FILES) {
        try {
            const p = join(rootPath, file);
            const s = await stat(p);
            if (s.isFile()) {
                foundPath = file;
                content = await readFile(p, 'utf-8');
                break;
            }
        } catch { /* not found */ }
    }

    // Check 1: Planning doc exists (2 pts)
    {
        let status, points, message;
        if (foundPath && content.length > 100) {
            status = 'pass'; points = 2;
            message = `Planning doc found: ${foundPath} (${content.length} chars)`;
        } else {
            status = 'fail'; points = 0;
            message = 'No PLANNING.md or ARCHITECTURE.md found — create one for high-level project context';
        }
        checks.push({ name: 'Planning document exists', status, points, maxPoints: 2, message });
    }

    // Check 2: CLAUDE.md references the planning doc (2 pts)
    {
        let status, points, message;
        try {
            const claudeMd = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
            const hasRef = PLANNING_FILES.some(f => claudeMd.includes(f)) ||
                /planning|architecture/i.test(claudeMd);
            if (hasRef) {
                status = 'pass'; points = 2;
                message = 'CLAUDE.md references planning/architecture documentation';
            } else {
                status = 'fail'; points = 0;
                message = 'CLAUDE.md does not reference planning docs — add a link so AI discovers them';
            }
        } catch {
            status = 'fail'; points = 0;
            message = 'No CLAUDE.md found to check references';
        }
        checks.push({ name: 'CLAUDE.md references planning', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Planning Documentation', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
