/**
 * Setup Layer: Config Hygiene
 *
 * Evaluates config file sizes, duplicate MCP servers, stale permission
 * patterns, and settings organization to detect bloated or unmaintained
 * Claude Code configurations.
 */
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Read and parse a JSON file, returning null on any error.
 */
async function readJson(filePath) {
    try {
        const raw = await readFile(filePath, 'utf-8');
        return { raw, parsed: JSON.parse(raw) };
    } catch {
        return null;
    }
}

/**
 * Read a file as raw text, returning null on any error.
 */
async function readText(filePath) {
    try {
        return await readFile(filePath, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Check whether a file/path exists on disk.
 */
async function pathExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Count lines in a string.
 */
function countLines(text) {
    if (!text) return 0;
    return text.split('\n').length;
}

export async function checkConfigHygiene(rootPath) {
    const checks = [];
    const home = homedir();

    // Paths
    const settingsPath = join(rootPath, '.claude', 'settings.json');
    const settingsLocalPath = join(rootPath, '.claude', 'settings.local.json');
    const userClaudeJsonPath = join(home, '.claude.json');
    const projectMcpJsonPath = join(rootPath, '.mcp.json');

    // Read all config files in parallel
    const [settingsResult, settingsLocalResult, userClaudeResult, projectMcpResult] = await Promise.all([
        readText(settingsPath),
        readText(settingsLocalPath),
        readText(userClaudeJsonPath),
        readJson(projectMcpJsonPath),
    ]);

    // -------------------------------------------------------------------
    // Check 1: Config Size (2 pts)
    // -------------------------------------------------------------------
    {
        const settingsLines = countLines(settingsResult);
        const settingsLocalLines = countLines(settingsLocalResult);
        const userClaudeLines = countLines(userClaudeResult);
        const totalLines = settingsLines + settingsLocalLines + userClaudeLines;

        const fileSummary = [];
        if (settingsResult !== null) fileSummary.push(`.claude/settings.json (${settingsLines})`);
        if (settingsLocalResult !== null) fileSummary.push(`.claude/settings.local.json (${settingsLocalLines})`);
        if (userClaudeResult !== null) fileSummary.push(`~/.claude.json (${userClaudeLines})`);

        let status, points, message;
        if (fileSummary.length === 0) {
            status = 'pass';
            points = 2;
            message = 'No config files found — clean slate';
        } else if (totalLines < 500) {
            status = 'pass';
            points = 2;
            message = `Config files total ${totalLines} lines — ${fileSummary.join(', ')}`;
        } else if (totalLines <= 1000) {
            status = 'warn';
            points = 1;
            message = `Config files total ${totalLines} lines — consider cleaning up stale entries (${fileSummary.join(', ')})`;
        } else {
            status = 'fail';
            points = 0;
            message = `Config files total ${totalLines} lines — likely contains stale or duplicate entries (${fileSummary.join(', ')})`;
        }

        checks.push({ name: 'Config size', status, points, maxPoints: 2, message });
    }

    // -------------------------------------------------------------------
    // Check 2: Duplicate MCP Servers (2 pts)
    // -------------------------------------------------------------------
    {
        // Parse mcpServers from project .mcp.json and user ~/.claude.json
        let projectServers = {};
        let userServers = {};

        if (projectMcpResult?.parsed) {
            projectServers = projectMcpResult.parsed.mcpServers || {};
        }

        try {
            if (userClaudeResult) {
                const userParsed = JSON.parse(userClaudeResult);
                userServers = userParsed.mcpServers || {};
            }
        } catch {
            // malformed JSON — skip
        }

        const projectNames = new Set(Object.keys(projectServers));
        const userNames = new Set(Object.keys(userServers));
        const duplicates = [...projectNames].filter(name => userNames.has(name));

        let status, points, message;
        if (projectNames.size === 0 && userNames.size === 0) {
            status = 'pass';
            points = 2;
            message = 'No MCP servers configured in either project or user config';
        } else if (duplicates.length === 0) {
            status = 'pass';
            points = 2;
            message = `No duplicate MCP servers between .mcp.json (${projectNames.size} servers) and ~/.claude.json (${userNames.size} servers)`;
        } else {
            status = 'warn';
            points = 1;
            message = `${duplicates.length} MCP server(s) defined in both .mcp.json and ~/.claude.json (shadowing): ${duplicates.join(', ')}`;
        }

        checks.push({ name: 'Duplicate MCP servers', status, points, maxPoints: 2, message });
    }

    // -------------------------------------------------------------------
    // Check 3: Stale Permission Patterns (2 pts)
    // -------------------------------------------------------------------
    {
        let settingsLocalParsed = null;
        try {
            if (settingsLocalResult) {
                settingsLocalParsed = JSON.parse(settingsLocalResult);
            }
        } catch {
            // malformed JSON
        }

        const permissions = settingsLocalParsed?.permissions || {};
        const allowList = Array.isArray(permissions.allow) ? permissions.allow : [];
        const patternCount = allowList.length;

        // Check for patterns referencing file paths that don't exist
        const stalePatterns = [];
        for (const entry of allowList) {
            const value = typeof entry === 'string' ? entry : (entry?.pattern || '');
            if (typeof value !== 'string') continue;

            // Extract file paths from permission patterns (e.g., "Bash(npm run build:*)" won't have paths,
            // but "Read(/Users/iwo/some/file.txt)" or "Write(/path/to/file)" will)
            const pathMatch = value.match(/\(([/~][^)]+)\)/);
            if (pathMatch) {
                let filePath = pathMatch[1];
                // Remove glob suffixes for existence check
                filePath = filePath.replace(/\*.*$/, '').replace(/\/$/, '');
                if (filePath && filePath.length > 1) {
                    const exists = await pathExists(filePath);
                    if (!exists) {
                        stalePatterns.push(value.length > 60 ? value.substring(0, 57) + '...' : value);
                    }
                }
            }
        }

        let status, points, message;
        if (!settingsLocalParsed) {
            status = 'pass';
            points = 2;
            message = 'No .claude/settings.local.json found — no permission patterns to evaluate';
        } else if (patternCount > 100) {
            status = 'fail';
            points = 0;
            message = `${patternCount} permission patterns — config is accumulating unchecked permissions`;
        } else if (patternCount >= 50) {
            status = 'warn';
            points = 1;
            message = `${patternCount} permission patterns — review for stale entries` +
                (stalePatterns.length > 0 ? ` (${stalePatterns.length} reference non-existent paths)` : '');
        } else if (stalePatterns.length > 0) {
            status = 'warn';
            points = 1;
            message = `${patternCount} permission patterns, ${stalePatterns.length} reference non-existent paths: ${stalePatterns.slice(0, 3).join('; ')}${stalePatterns.length > 3 ? ` (+${stalePatterns.length - 3} more)` : ''}`;
        } else {
            status = 'pass';
            points = 2;
            message = `${patternCount} permission pattern(s) — all referenced paths exist`;
        }

        checks.push({ name: 'Stale permission patterns', status, points, maxPoints: 2, message });
    }

    // -------------------------------------------------------------------
    // Check 4: Settings Organization (1 pt)
    // -------------------------------------------------------------------
    {
        let settingsParsed = null;
        let settingsLocalParsed = null;

        try {
            if (settingsResult) settingsParsed = JSON.parse(settingsResult);
        } catch {
            // malformed
        }
        try {
            if (settingsLocalResult) settingsLocalParsed = JSON.parse(settingsLocalResult);
        } catch {
            // malformed
        }

        const hooksInSettings = settingsParsed?.hooks && Object.keys(settingsParsed.hooks).length > 0;
        const hooksInLocal = settingsLocalParsed?.hooks && Object.keys(settingsLocalParsed.hooks).length > 0;

        let status, points, message;
        if (hooksInSettings) {
            status = 'pass';
            points = 1;
            message = 'Hooks defined in .claude/settings.json — shareable with team';
        } else if (hooksInLocal && !hooksInSettings) {
            status = 'warn';
            points = 0;
            message = 'Hooks in .claude/settings.local.json won\'t be shared with team — move to .claude/settings.json';
        } else {
            // No hooks anywhere
            status = 'pass';
            points = 1;
            message = 'No hooks configured — no organization issue';
        }

        checks.push({ name: 'Settings organization', status, points, maxPoints: 1, message });
    }

    // -------------------------------------------------------------------
    // Aggregate
    // -------------------------------------------------------------------
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Config Hygiene',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
