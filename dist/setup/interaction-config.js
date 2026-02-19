/**
 * Setup Layer: Interaction Configuration
 *
 * Evaluates terminal customization, keybindings, output styles,
 * and thinking mode settings — the daily productivity layer that
 * shapes how the user interacts with Claude Code.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
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

async function fileExists(filePath) {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function checkInteractionConfig(rootPath) {
    const checks = [];
    const home = homedir();

    // Read settings from all levels
    const [projectShared, projectLocal, userGlobal, userSettings] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
        readJson(join(home, '.claude', 'settings.json')),
    ]);

    const allConfigs = [projectShared, projectLocal, userGlobal, userSettings].filter(Boolean);

    // Check 1: Keybindings customization (3 pts)
    {
        const keybindingsPath = join(home, '.claude', 'keybindings.json');
        const keybindings = await readJson(keybindingsPath);

        let status, points, message;
        if (keybindings && Array.isArray(keybindings) && keybindings.length >= 3) {
            status = 'pass'; points = 3;
            message = `${keybindings.length} custom keybindings configured`;
        } else if (keybindings && Array.isArray(keybindings) && keybindings.length >= 1) {
            status = 'warn'; points = 2;
            message = `${keybindings.length} custom keybinding(s) — add more for faster workflows`;
        } else if (keybindings) {
            status = 'warn'; points = 1;
            message = 'Keybindings file exists but empty — run /keybindings to configure';
        } else {
            status = 'warn'; points = 1;
            message = 'No custom keybindings — run /keybindings to set up keyboard shortcuts';
        }
        checks.push({ name: 'Keybindings customization', status, points, maxPoints: 3, message });
    }

    // Check 2: Output style and display (3 pts)
    {
        let hasOutputStyle = false;
        let hasSpinnerConfig = false;
        let hasStatusLine = false;
        const features = [];

        for (const config of allConfigs) {
            if (config.outputStyle) { hasOutputStyle = true; features.push('output style'); }
            if (config.spinnerVerbs || config.spinnerTipsEnabled !== undefined) {
                hasSpinnerConfig = true; features.push('spinner');
            }
            if (config.statusLine) { hasStatusLine = true; features.push('status line'); }
        }

        // Also check for custom output styles directory
        const outputStylesDir = join(home, '.claude', 'output-styles');
        const hasCustomStyles = await fileExists(outputStylesDir);
        if (hasCustomStyles) features.push('custom output styles');

        const uniqueFeatures = [...new Set(features)];
        let status, points, message;

        if (uniqueFeatures.length >= 3) {
            status = 'pass'; points = 3;
            message = `Display configured: ${uniqueFeatures.join(', ')}`;
        } else if (uniqueFeatures.length >= 1) {
            status = 'warn'; points = 2;
            message = `Partial display config: ${uniqueFeatures.join(', ')} — add status line, output style, or spinner customization`;
        } else {
            status = 'warn'; points = 1;
            message = 'No display customization — configure output style, status line, or spinner verbs';
        }
        checks.push({ name: 'Output style and display', status, points, maxPoints: 3, message });
    }

    // Check 3: Thinking and effort configuration (2 pts)
    {
        let hasThinking = false;
        let hasEffort = false;
        const details = [];

        for (const config of allConfigs) {
            if (config.alwaysThinkingEnabled !== undefined) {
                hasThinking = true;
                details.push(`thinking=${config.alwaysThinkingEnabled ? 'on' : 'off'}`);
            }
            if (config.effortLevel) {
                hasEffort = true;
                details.push(`effort=${config.effortLevel}`);
            }
        }

        // Check env vars too
        if (process.env.CLAUDE_CODE_EFFORT_LEVEL) {
            hasEffort = true;
            details.push(`effort=${process.env.CLAUDE_CODE_EFFORT_LEVEL} (env)`);
        }

        let status, points, message;
        if (hasThinking && hasEffort) {
            status = 'pass'; points = 2;
            message = `Thinking and effort configured: ${details.join(', ')}`;
        } else if (hasThinking || hasEffort) {
            status = 'pass'; points = 2;
            message = `Partial config: ${details.join(', ')}`;
        } else {
            status = 'pass'; points = 1;
            message = 'Using default thinking and effort settings';
        }
        checks.push({ name: 'Thinking and effort configuration', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Interaction Configuration',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
