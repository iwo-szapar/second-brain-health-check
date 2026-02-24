/**
 * Setup Layer: Settings Local Overrides
 *
 * Checks for user-local settings that override project defaults.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkSettingsLocal(rootPath) {
    const checks = [];
    let foundFile = null;
    let content = '';

    for (const file of ['.claude/settings.local.json', 'CLAUDE.local.md']) {
        try {
            const p = join(rootPath, file);
            const s = await stat(p);
            if (s.isFile()) { foundFile = file; content = await readFile(p, 'utf-8'); break; }
        } catch { /* not found */ }
    }

    // Check 1: Local settings file exists (2 pts)
    {
        let status, points, message;
        if (foundFile) {
            status = 'pass'; points = 2;
            message = `Local overrides file found: ${foundFile}`;
        } else {
            status = 'fail'; points = 0;
            message = 'No .claude/settings.local.json or CLAUDE.local.md — create one for user-specific overrides';
        }
        checks.push({ name: 'Local settings file', status, points, maxPoints: 2, message });
    }

    // Check 2: Settings have actual content (2 pts)
    {
        let status, points, message;
        if (!foundFile) {
            status = 'fail'; points = 0;
            message = 'No local settings file to evaluate';
        } else if (foundFile.endsWith('.json')) {
            try {
                const parsed = JSON.parse(content);
                const keys = Object.keys(parsed);
                if (keys.length >= 1 && content.trim() !== '{}') {
                    status = 'pass'; points = 2;
                    message = `Local settings has ${keys.length} override(s)`;
                } else {
                    status = 'warn'; points = 1;
                    message = 'Local settings file exists but is empty — add user-specific overrides';
                }
            } catch {
                status = 'warn'; points = 1;
                message = 'Local settings file exists but is not valid JSON';
            }
        } else {
            if (content.trim().length >= 50) {
                status = 'pass'; points = 2;
                message = `CLAUDE.local.md has ${content.trim().length} chars of local context`;
            } else {
                status = 'warn'; points = 1;
                message = 'CLAUDE.local.md exists but has minimal content';
            }
        }
        checks.push({ name: 'Local settings content', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Settings Local Overrides', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
