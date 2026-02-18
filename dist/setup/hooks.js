/**
 * Setup Layer: Hooks Configuration
 *
 * Evaluates whether .claude/settings.json contains hooks for lifecycle
 * automation, checks for tool lifecycle hooks, and verifies that
 * referenced hook scripts exist on disk.
 */
import { readFile, access } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';

function extractScriptPaths(command) {
    const paths = [];
    const matches = command.match(/[\w./$~-]+\.(?:sh|py|js|ts)\b/g) || [];
    for (const m of matches) {
        paths.push(m);
    }
    return paths;
}

export async function checkHooks(rootPath) {
    const checks = [];
    const settingsPath = join(rootPath, '.claude', 'settings.json');

    let settings = null;
    try {
        const raw = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
    } catch {
        // No settings or invalid JSON
    }

    if (!settings) {
        return {
            name: 'Hooks Configuration',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'Settings with hooks configured',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No .claude/settings.json found or invalid JSON',
            }, {
                name: 'Tool lifecycle hooks',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No settings file to evaluate',
            }, {
                name: 'Hook scripts valid',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No settings file to evaluate',
            }],
        };
    }

    const hooks = settings.hooks || {};
    const hookEvents = Object.keys(hooks);

    // Check 1: Settings with hooks configured (4 pts)
    {
        let totalHooks = 0;
        for (const event of hookEvents) {
            const eventHooks = hooks[event];
            if (Array.isArray(eventHooks)) {
                totalHooks += eventHooks.length;
            }
        }

        let status, points;
        if (hookEvents.length >= 3) {
            status = 'pass';
            points = 4;
        } else if (hookEvents.length === 2) {
            status = 'warn';
            points = 3;
        } else if (hookEvents.length === 1) {
            status = 'warn';
            points = 2;
        } else {
            status = 'warn';
            points = 1;
        }

        checks.push({
            name: 'Settings with hooks configured',
            status,
            points,
            maxPoints: 4,
            message: hookEvents.length > 0
                ? `${totalHooks} hook(s) across ${hookEvents.length} lifecycle event(s): ${hookEvents.join(', ')}`
                : 'Settings file exists but no hooks configured',
        });
    }

    // Check 2: Tool lifecycle hooks (3 pts)
    {
        const hasPreToolUse = hookEvents.includes('PreToolUse');
        const hasPostToolUse = hookEvents.includes('PostToolUse');
        const hasToolHooks = hasPreToolUse || hasPostToolUse;

        let status, points;
        if (hasToolHooks) {
            status = 'pass';
            points = 3;
        } else if (hookEvents.length > 0) {
            status = 'warn';
            points = 1;
        } else {
            status = 'fail';
            points = 0;
        }

        checks.push({
            name: 'Tool lifecycle hooks',
            status,
            points,
            maxPoints: 3,
            message: hasToolHooks
                ? `Tool lifecycle hooks found: ${[hasPreToolUse && 'PreToolUse', hasPostToolUse && 'PostToolUse'].filter(Boolean).join(', ')}`
                : hookEvents.length > 0
                    ? 'Hooks exist but none for PreToolUse/PostToolUse — add tool guards for safety'
                    : 'No hooks configured',
        });
    }

    // Check 3: Hook scripts valid (3 pts)
    {
        const allPaths = [];
        let hasInlineOnly = true;

        for (const event of hookEvents) {
            const eventHooks = hooks[event];
            if (!Array.isArray(eventHooks)) continue;

            for (const hook of eventHooks) {
                const command = hook.command || hook.cmd || '';
                if (typeof command !== 'string') continue;

                const scriptPaths = extractScriptPaths(command);
                if (scriptPaths.length > 0) {
                    hasInlineOnly = false;
                    allPaths.push(...scriptPaths);
                }
            }
        }

        if (allPaths.length === 0 && hookEvents.length > 0) {
            checks.push({
                name: 'Hook scripts valid',
                status: hasInlineOnly ? 'pass' : 'fail',
                points: hasInlineOnly ? 3 : 0,
                maxPoints: 3,
                message: hasInlineOnly
                    ? 'Hooks use inline commands (no external script files)'
                    : 'No hook scripts found',
            });
        } else if (allPaths.length > 0) {
            let existCount = 0;
            for (const scriptPath of allPaths) {
                let resolved = scriptPath;
                resolved = resolved.replace(/\$CLAUDE_PROJECT_DIR/g, rootPath);
                resolved = resolved.replace(/\$\{CLAUDE_PROJECT_DIR\}/g, rootPath);
                if (!isAbsolute(resolved)) {
                    resolved = join(rootPath, resolved);
                }
                try {
                    await access(resolved);
                    existCount++;
                } catch {
                    // file doesn't exist
                }
            }

            let status, points;
            if (existCount === allPaths.length) {
                status = 'pass';
                points = 3;
            } else if (existCount > 0) {
                status = 'warn';
                points = 1;
            } else {
                status = 'fail';
                points = 0;
            }

            checks.push({
                name: 'Hook scripts valid',
                status,
                points,
                maxPoints: 3,
                message: `${existCount}/${allPaths.length} referenced hook script(s) exist on disk`,
            });
        } else {
            checks.push({
                name: 'Hook scripts valid',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No hooks to evaluate',
            });
        }
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Hooks Configuration',
        points: totalPoints,
        maxPoints: 10,
        checks,
    };
}
