/**
 * Setup Layer: MCP Server Health
 *
 * Checks MCP server configuration quality — server count,
 * timeout configuration, scope correctness, and recommended
 * MCP servers for common use cases.
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

// Commonly recommended MCP servers by category
const RECOMMENDED_SERVERS = [
    { name: 'filesystem', category: 'core', desc: 'File system operations' },
    { name: 'memory', category: 'core', desc: 'Persistent knowledge graph' },
    { name: 'github', category: 'dev', desc: 'GitHub operations' },
    { name: 'postgres', category: 'data', aliases: ['postgresql', 'supabase'] },
    { name: 'slack', category: 'comms', desc: 'Team communication' },
    { name: 'google-analytics', category: 'analytics', aliases: ['ga4'] },
];

function getServerNames(config) {
    if (!config || typeof config !== 'object') return [];
    const servers = config.mcpServers || config;
    if (typeof servers !== 'object' || Array.isArray(servers)) return [];
    return Object.keys(servers);
}

function getServerConfigs(config) {
    if (!config || typeof config !== 'object') return {};
    return config.mcpServers || config;
}

export async function checkMcpHealth(rootPath) {
    const checks = [];
    const home = homedir();

    const [projectMcp, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.mcp.json')),
        readJson(join(home, '.claude.json')),
    ]);

    const projectServers = getServerNames(projectMcp);
    const userServers = getServerNames(userGlobal);
    const allServers = [...new Set([...projectServers, ...userServers])];

    // Check 1: MCP Server Count (3 pts)
    {
        const count = allServers.length;
        let status, points, message;
        if (count >= 3) {
            status = 'pass';
            points = 3;
            message = `${count} MCP server(s) configured: ${allServers.slice(0, 8).join(', ')}${count > 8 ? ` (+${count - 8} more)` : ''}`;
        } else if (count >= 1) {
            status = 'warn';
            points = 1;
            message = `Only ${count} MCP server(s) — consider adding more for extended capabilities`;
        } else {
            status = 'fail';
            points = 0;
            message = 'No MCP servers configured — MCP extends Claude with external tools and data';
        }
        checks.push({ name: 'MCP server count', status, points, maxPoints: 3, message });
    }

    // Check 2: Server Configuration Quality (3 pts)
    {
        const issues = [];
        const projectConfigs = getServerConfigs(projectMcp);
        const userConfigs = getServerConfigs(userGlobal);
        const allConfigs = { ...userConfigs, ...projectConfigs };

        for (const [name, config] of Object.entries(allConfigs)) {
            if (!config || typeof config !== 'object') continue;

            // Check for missing command/url
            const hasCommand = config.command || config.args;
            const hasUrl = config.url;
            if (!hasCommand && !hasUrl) {
                issues.push(`${name}: no command or URL defined`);
            }

            // Check for empty env blocks
            if (config.env && typeof config.env === 'object' && Object.keys(config.env).length === 0) {
                issues.push(`${name}: empty env block`);
            }

            // Check for disabled servers still in config
            if (config.disabled === true) {
                issues.push(`${name}: disabled but still in config — remove or comment out`);
            }
        }

        let status, points, message;
        if (allServers.length === 0) {
            status = 'pass';
            points = 3;
            message = 'No MCP servers to validate';
        } else if (issues.length === 0) {
            status = 'pass';
            points = 3;
            message = `${allServers.length} server(s) — all have valid configuration`;
        } else if (issues.length <= 2) {
            status = 'warn';
            points = 1;
            message = `Config issues: ${issues.join('; ')}`;
        } else {
            status = 'fail';
            points = 0;
            message = `${issues.length} configuration issues: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`;
        }
        checks.push({ name: 'Server configuration quality', status, points, maxPoints: 3, message });
    }

    // Check 3: Timeout Configuration (2 pts)
    {
        let hasTimeout = false;
        let timeoutValue = null;

        for (const config of [projectMcp, userGlobal]) {
            if (!config) continue;
            if (config.mcpTimeout) {
                hasTimeout = true;
                timeoutValue = config.mcpTimeout;
            }
        }

        let status, points, message;
        if (allServers.length === 0) {
            status = 'pass';
            points = 2;
            message = 'No MCP servers — timeout not applicable';
        } else if (hasTimeout) {
            const timeoutMs = typeof timeoutValue === 'number' ? timeoutValue : parseInt(timeoutValue, 10);
            if (timeoutMs < 5000) {
                status = 'warn';
                points = 1;
                message = `MCP timeout set to ${timeoutMs}ms — may be too low for slow servers`;
            } else if (timeoutMs > 120000) {
                status = 'warn';
                points = 1;
                message = `MCP timeout set to ${timeoutMs}ms — very high, may cause long hangs`;
            } else {
                status = 'pass';
                points = 2;
                message = `MCP timeout: ${timeoutMs}ms`;
            }
        } else {
            status = 'pass';
            points = 2;
            message = 'Using default MCP timeout';
        }
        checks.push({ name: 'Timeout configuration', status, points, maxPoints: 2, message });
    }

    // Check 4: Scope Correctness (2 pts)
    {
        // Servers that use auth tokens should be in user-level, not project-level
        const projectConfigs = getServerConfigs(projectMcp);
        const authInProject = [];

        for (const [name, config] of Object.entries(projectConfigs)) {
            if (!config || typeof config !== 'object') continue;
            const env = config.env || {};
            const hasAuthEnv = Object.keys(env).some(k =>
                /token|key|secret|password|auth/i.test(k)
            );
            if (hasAuthEnv) {
                authInProject.push(name);
            }
        }

        let status, points, message;
        if (projectServers.length === 0) {
            status = 'pass';
            points = 2;
            message = 'No project-level MCP servers';
        } else if (authInProject.length === 0) {
            status = 'pass';
            points = 2;
            message = 'Project-level servers properly scoped — no auth-bearing env vars';
        } else {
            status = 'warn';
            points = 1;
            message = `${authInProject.length} project-level server(s) have auth env vars: ${authInProject.join(', ')} — consider moving to user-level (~/.claude.json)`;
        }
        checks.push({ name: 'Scope correctness', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'MCP Server Health',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
