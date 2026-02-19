/**
 * Setup Layer: Settings Hierarchy
 *
 * Validates the 5-level settings override chain:
 *   CLI > project local > project shared > user local > user global
 *
 * Checks for conflicting settings across levels, shadow settings
 * that never take effect, and whether settings are placed in the
 * appropriate scope (project vs user vs global).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function readJson(filePath) {
    try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function flattenObject(obj, prefix = '') {
    const result = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result;
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, fullKey));
        } else {
            result[fullKey] = value;
        }
    }
    return result;
}

const PROJECT_SCOPED_KEYS = new Set([
    'hooks', 'permissions', 'mcpServers', 'enabledPlugins',
]);

const USER_SCOPED_KEYS = new Set([
    'model', 'language', 'alwaysThinkingEnabled', 'statusLine',
    'apiKeyHelper', 'forceLoginMethod', 'forceLoginOrgUUID',
]);

export async function checkSettingsHierarchy(rootPath) {
    const checks = [];
    const home = homedir();

    const [projectShared, projectLocal, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
    ]);

    const levels = [
        { name: 'project-shared', data: projectShared, path: '.claude/settings.json' },
        { name: 'project-local', data: projectLocal, path: '.claude/settings.local.json' },
        { name: 'user-global', data: userGlobal, path: '~/.claude.json' },
    ];

    const activeLevels = levels.filter(l => l.data !== null);

    // Check 1: Settings Layer Coverage (4 pts)
    {
        const count = activeLevels.length;
        let status, points, message;
        if (count >= 2) {
            status = 'pass';
            points = 4;
            message = `${count} settings level(s) configured: ${activeLevels.map(l => l.name).join(', ')}`;
        } else if (count === 1) {
            status = 'warn';
            points = 2;
            message = `Only 1 settings level (${activeLevels[0].name}) — consider separating shared vs personal settings`;
        } else {
            status = 'fail';
            points = 0;
            message = 'No settings files found — Claude Code is running with defaults only';
        }
        checks.push({ name: 'Settings layer coverage', status, points, maxPoints: 4, message });
    }

    // Check 2: Shadow Settings Detection (4 pts)
    {
        const shadowedKeys = [];
        const projectLocalFlat = projectLocal ? flattenObject(projectLocal) : {};
        const projectSharedFlat = projectShared ? flattenObject(projectShared) : {};
        const userGlobalFlat = userGlobal ? flattenObject(userGlobal) : {};
        const mergedKeys = new Set(['permissions.allow', 'permissions.deny', 'hooks']);

        if (projectLocal && projectShared) {
            for (const key of Object.keys(projectSharedFlat)) {
                if (mergedKeys.has(key.split('.').slice(0, 2).join('.'))) continue;
                if (key in projectLocalFlat && JSON.stringify(projectLocalFlat[key]) !== JSON.stringify(projectSharedFlat[key])) {
                    shadowedKeys.push({ key, shadowed: 'project-shared', by: 'project-local' });
                }
            }
        }

        if (projectLocal && userGlobal) {
            for (const key of Object.keys(userGlobalFlat)) {
                if (mergedKeys.has(key.split('.').slice(0, 2).join('.'))) continue;
                if (key in projectLocalFlat && JSON.stringify(projectLocalFlat[key]) !== JSON.stringify(userGlobalFlat[key])) {
                    shadowedKeys.push({ key, shadowed: 'user-global', by: 'project-local' });
                }
            }
        }

        if (projectShared && userGlobal) {
            for (const key of Object.keys(userGlobalFlat)) {
                if (mergedKeys.has(key.split('.').slice(0, 2).join('.'))) continue;
                if (key in projectSharedFlat && JSON.stringify(projectSharedFlat[key]) !== JSON.stringify(userGlobalFlat[key])) {
                    shadowedKeys.push({ key, shadowed: 'user-global', by: 'project-shared' });
                }
            }
        }

        let status, points, message;
        if (activeLevels.length < 2) {
            status = 'pass';
            points = 4;
            message = 'Only one settings level — no shadow conflicts possible';
        } else if (shadowedKeys.length === 0) {
            status = 'pass';
            points = 4;
            message = 'No shadowed settings detected across levels';
        } else if (shadowedKeys.length <= 3) {
            status = 'warn';
            points = 2;
            const examples = shadowedKeys.slice(0, 3).map(s => `${s.key} (${s.shadowed} overridden by ${s.by})`).join('; ');
            message = `${shadowedKeys.length} shadowed setting(s): ${examples}`;
        } else {
            status = 'fail';
            points = 0;
            message = `${shadowedKeys.length} shadowed settings — significant configuration confusion. Review which level each setting belongs in`;
        }
        checks.push({ name: 'Shadow settings detection', status, points, maxPoints: 4, message });
    }

    // Check 3: Scope Appropriateness (4 pts)
    {
        const misplaced = [];

        if (userGlobal) {
            for (const key of PROJECT_SCOPED_KEYS) {
                if (userGlobal[key] && typeof userGlobal[key] === 'object' && Object.keys(userGlobal[key]).length > 0) {
                    if (key === 'hooks') {
                        misplaced.push(`${key} in user-global (should be project-shared for team visibility)`);
                    }
                }
            }
        }

        if (projectShared) {
            for (const key of USER_SCOPED_KEYS) {
                if (projectShared[key] !== undefined) {
                    misplaced.push(`${key} in project-shared (personal preference forced on team)`);
                }
            }
        }

        let status, points, message;
        if (activeLevels.length === 0) {
            status = 'pass';
            points = 4;
            message = 'No settings to evaluate';
        } else if (misplaced.length === 0) {
            status = 'pass';
            points = 4;
            message = 'Settings are placed in appropriate scopes';
        } else if (misplaced.length <= 2) {
            status = 'warn';
            points = 2;
            message = `${misplaced.length} misplaced setting(s): ${misplaced.join('; ')}`;
        } else {
            status = 'fail';
            points = 0;
            message = `${misplaced.length} misplaced settings: ${misplaced.slice(0, 3).join('; ')}${misplaced.length > 3 ? ` (+${misplaced.length - 3} more)` : ''}`;
        }
        checks.push({ name: 'Scope appropriateness', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Settings Hierarchy',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
