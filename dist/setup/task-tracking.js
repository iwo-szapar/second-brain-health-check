/**
 * Setup Layer: Task Tracking
 *
 * Checks for active task tracking files or directories.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const TASK_PATHS = ['TASK.md', 'TODO.md', 'tasks/', '.claude/tasks/'];

export async function checkTaskTracking(rootPath) {
    const checks = [];
    let found = false;
    let foundPath = '';

    for (const p of TASK_PATHS) {
        try {
            const fullPath = join(rootPath, p);
            const s = await stat(fullPath);
            if (s.isFile() || s.isDirectory()) { found = true; foundPath = p; break; }
        } catch { /* not found */ }
    }

    // Check 1: Task tracking exists (2 pts)
    {
        let status, points, message;
        if (found) {
            status = 'pass'; points = 2;
            message = `Task tracking found: ${foundPath}`;
        } else {
            status = 'fail'; points = 0;
            message = 'No TASK.md, TODO.md, or tasks/ directory — create one for active work context';
        }
        checks.push({ name: 'Task tracking exists', status, points, maxPoints: 2, message });
    }

    // Check 2: CLAUDE.md references task tracking (2 pts)
    {
        let status, points, message;
        try {
            const claudeMd = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
            const hasRef = /task|todo|backlog/i.test(claudeMd) &&
                (claudeMd.includes('TASK.md') || claudeMd.includes('TODO.md') ||
                 claudeMd.includes('tasks/') || /task.*track/i.test(claudeMd));
            if (hasRef) {
                status = 'pass'; points = 2;
                message = 'CLAUDE.md references task tracking system';
            } else {
                status = 'fail'; points = 0;
                message = 'CLAUDE.md does not reference task tracking — add a link so AI knows about current work';
            }
        } catch {
            status = 'fail'; points = 0;
            message = 'No CLAUDE.md found to check references';
        }
        checks.push({ name: 'CLAUDE.md references tasks', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Task Tracking', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
