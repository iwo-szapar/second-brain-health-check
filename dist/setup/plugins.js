/**
 * Setup Layer: Plugin Coverage
 *
 * Checks installed Claude Code plugins, compares against recommended
 * plugins, and detects third-party/community plugin usage.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const RECOMMENDED_PLUGINS = [
    { id: 'context7@claude-plugins-official', name: 'Context7', category: 'docs', description: 'Live documentation lookup for any library' },
    { id: 'feature-dev@claude-plugins-official', name: 'Feature Dev', category: 'dev', description: 'Guided feature development with codebase understanding' },
    { id: 'security-guidance@claude-plugins-official', name: 'Security Guidance', category: 'security', description: 'Security best practices and vulnerability detection' },
    { id: 'playground@claude-plugins-official', name: 'Playground', category: 'dev', description: 'Interactive HTML playground generator' },
    { id: 'canvas@claude-plugins-official', name: 'Canvas', category: 'ui', description: 'Terminal UI canvases for calendars, documents, flights' },
    { id: 'claude-hud@claude-plugins-official', name: 'Claude HUD', category: 'ui', description: 'Status line display for Claude Code' },
];

/**
 * Read and parse a JSON file, returning null on any error.
 */
async function readJson(filePath) {
    try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Extract enabled plugin IDs from an enabledPlugins object.
 * Only includes plugins where the value is `true`.
 */
function getEnabledPlugins(config) {
    const plugins = config?.enabledPlugins;
    if (!plugins || typeof plugins !== 'object') return [];
    return Object.entries(plugins)
        .filter(([, enabled]) => enabled === true)
        .map(([id]) => id);
}

export async function checkPlugins(rootPath) {
    const checks = [];

    // Read both project-level and user-level settings
    const projectSettingsPath = join(rootPath, '.claude', 'settings.json');
    const userSettingsPath = join(homedir(), '.claude.json');

    const [projectSettings, userSettings] = await Promise.all([
        readJson(projectSettingsPath),
        readJson(userSettingsPath),
    ]);

    const projectPlugins = getEnabledPlugins(projectSettings);
    const userPlugins = getEnabledPlugins(userSettings);

    // Merge into unique set
    const allPlugins = [...new Set([...projectPlugins, ...userPlugins])];

    // ---------------------------------------------------------------
    // Check 1: Plugins Installed (3 pts)
    // ---------------------------------------------------------------
    {
        const count = allPlugins.length;

        let status, points, message;
        if (count >= 3) {
            status = 'pass';
            points = 3;
            message = `${count} plugin(s) active`;
        } else if (count >= 1) {
            status = 'warn';
            points = 1;
            message = `Only ${count} plugin(s) — consider adding more`;
        } else {
            status = 'fail';
            points = 0;
            message = 'No plugins installed — plugins extend Claude Code capabilities';
        }

        checks.push({
            name: 'Plugins installed',
            status,
            points,
            maxPoints: 3,
            message,
        });
    }

    // ---------------------------------------------------------------
    // Check 2: Plugin Recommendations (2 pts)
    // ---------------------------------------------------------------
    {
        const installedSet = new Set(allPlugins);
        const installedRecommended = RECOMMENDED_PLUGINS.filter(p => installedSet.has(p.id));
        const missingRecommended = RECOMMENDED_PLUGINS.filter(p => !installedSet.has(p.id));
        const coveragePct = RECOMMENDED_PLUGINS.length > 0
            ? (installedRecommended.length / RECOMMENDED_PLUGINS.length) * 100
            : 0;

        let status, points, message;
        if (coveragePct >= 50) {
            status = 'pass';
            points = 2;
            message = `${installedRecommended.length}/${RECOMMENDED_PLUGINS.length} recommended plugins installed (${Math.round(coveragePct)}% coverage)`;
        } else {
            status = 'warn';
            points = 1;
            const missingNames = missingRecommended.map(p => p.name).join(', ');
            message = `${installedRecommended.length}/${RECOMMENDED_PLUGINS.length} recommended plugins (${Math.round(coveragePct)}%) — missing: ${missingNames}`;
        }

        checks.push({
            name: 'Plugin recommendations',
            status,
            points,
            maxPoints: 2,
            message,
        });
    }

    // ---------------------------------------------------------------
    // Check 3: Third-Party Plugins (1 pt — bonus)
    // ---------------------------------------------------------------
    {
        const thirdPartyPlugins = allPlugins.filter(id => !id.endsWith('@claude-plugins-official'));

        let status, points, message;
        if (thirdPartyPlugins.length > 0) {
            status = 'pass';
            points = 1;
            message = `Using community plugins — advanced setup (${thirdPartyPlugins.length} third-party)`;
        } else {
            status = 'pass';
            points = 1;
            message = 'Using official plugins';
        }

        checks.push({
            name: 'Third-party plugins',
            status,
            points,
            maxPoints: 1,
            message,
        });
    }

    // ---------------------------------------------------------------
    // Aggregate
    // ---------------------------------------------------------------
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Plugin Coverage',
        points: totalPoints,
        maxPoints: 6,
        checks,
    };
}
