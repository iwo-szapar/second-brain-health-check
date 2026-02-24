/**
 * Setup Layer: MCP Security
 *
 * Detects plaintext secrets in MCP configuration files,
 * checks scope appropriateness, git-tracked secrets,
 * and permission allow-list leaks.
 */
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

// Patterns that indicate a secret value (applied to raw file content or JSON values)
const SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/,
    /key-[a-zA-Z0-9]{20,}/,
    /token-[a-zA-Z0-9]{20,}/,
    /Bearer\s+[a-zA-Z0-9._-]{20,}/,
    /eyJ[a-zA-Z0-9._-]{40,}/,                                          // JWT
    /https?:\/\/[^\s"']*[?&](token|key|apikey|api_key)=[a-zA-Z0-9]{10,}/i,  // URL-embedded tokens
];

// Field names whose values should be treated as potential secrets
const SENSITIVE_FIELDS = /^(apikey|api_key|apiKey|token|secret|password|authorization|api-key)$/i;

// Match long hex/alphanumeric strings that look like secrets (32+ chars)
const LONG_SECRET_RE = /^[a-zA-Z0-9_-]{32,}$/;

/**
 * Recursively walk a JSON object, testing string values for secrets.
 * Returns true if any secret-like value is found.
 */
function jsonContainsSecrets(obj, parentKey = '') {
    if (typeof obj === 'string') {
        // Check named patterns
        for (const pat of SECRET_PATTERNS) {
            if (pat.test(obj)) return true;
        }
        // Check if the parent field name is sensitive and value looks like a token
        if (SENSITIVE_FIELDS.test(parentKey) && LONG_SECRET_RE.test(obj)) {
            return true;
        }
        return false;
    }
    if (Array.isArray(obj)) {
        return obj.some((item) => jsonContainsSecrets(item, parentKey));
    }
    if (obj && typeof obj === 'object') {
        return Object.entries(obj).some(([key, val]) => jsonContainsSecrets(val, key));
    }
    return false;
}

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
 * Check whether a file exists.
 */
async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Scan a raw file string for secret patterns (non-JSON fallback).
 */
function rawContainsSecrets(content) {
    for (const pat of SECRET_PATTERNS) {
        if (pat.test(content)) return true;
    }
    return false;
}

export async function checkMcpSecurity(rootPath) {
    const checks = [];

    // ---------------------------------------------------------------
    // Gather files to scan (both project-level AND user-level)
    // ---------------------------------------------------------------
    const filesToScan = []; // { path, label, json, scope: 'project' | 'user' }
    const home = homedir();

    // .mcp.json (project-level MCP config)
    const mcpJsonPath = join(rootPath, '.mcp.json');
    const mcpJson = await readJson(mcpJsonPath);
    if (mcpJson) filesToScan.push({ path: mcpJsonPath, label: '.mcp.json', json: mcpJson, scope: 'project' });

    // .mcp/ directory — scan all JSON files inside
    const mcpDirPath = join(rootPath, '.mcp');
    try {
        const entries = await readdir(mcpDirPath);
        for (const entry of entries) {
            if (!entry.endsWith('.json')) continue;
            const fullPath = join(mcpDirPath, entry);
            const parsed = await readJson(fullPath);
            if (parsed) filesToScan.push({ path: fullPath, label: `.mcp/${entry}`, json: parsed, scope: 'project' });
        }
    } catch {
        // directory doesn't exist — fine
    }

    // .claude.json at project level
    const claudeJsonPath = join(rootPath, '.claude.json');
    const claudeJson = await readJson(claudeJsonPath);
    if (claudeJson) filesToScan.push({ path: claudeJsonPath, label: '.claude.json (project)', json: claudeJson, scope: 'project' });

    // ~/.claude.json (user-level — contains mcpServers for most setups)
    const userClaudeJsonPath = join(home, '.claude.json');
    const userClaudeJson = await readJson(userClaudeJsonPath);
    if (userClaudeJson) filesToScan.push({ path: userClaudeJsonPath, label: '~/.claude.json', json: userClaudeJson, scope: 'user' });

    // ---------------------------------------------------------------
    // Check 1: Secret Detection in MCP configs (3 pts)
    // ---------------------------------------------------------------
    {
        const filesWithSecrets = [];

        for (const file of filesToScan) {
            const hasSecrets = file.json
                ? jsonContainsSecrets(file.json)
                : rawContainsSecrets(await readFile(file.path, 'utf-8').catch(() => ''));
            if (hasSecrets) filesWithSecrets.push(file.label);
        }

        let status, points;
        if (filesToScan.length === 0) {
            status = 'warn';
            points = 1;
            checks.push({
                name: 'Secret detection in MCP configs',
                status,
                points,
                maxPoints: 3,
                message: 'No MCP config files found at project or user level — cannot verify secret hygiene',
            });
        } else if (filesWithSecrets.length === 0) {
            status = 'pass';
            points = 3;
            checks.push({
                name: 'Secret detection in MCP configs',
                status,
                points,
                maxPoints: 3,
                message: `No API keys or tokens found in MCP config files (scanned ${filesToScan.length} file(s))`,
            });
        } else {
            status = 'fail';
            points = 0;
            checks.push({
                name: 'Secret detection in MCP configs',
                status,
                points,
                maxPoints: 3,
                message: `API keys or tokens found in ${filesWithSecrets.length} MCP config file(s): ${filesWithSecrets.join(', ')} — secrets in config files get committed to git and exposed to anyone with repo access. Move them to environment variables instead.`,
            });
        }
    }

    // ---------------------------------------------------------------
    // Check 2: Scope Appropriateness (2 pts)
    // ---------------------------------------------------------------
    {
        // Count project-level servers that have secrets
        let projectServersWithSecrets = 0;

        // Only .mcp.json and .mcp/ files are project-scoped
        const projectFiles = filesToScan.filter(
            (f) => f.label === '.mcp.json' || f.label.startsWith('.mcp/')
        );

        for (const file of projectFiles) {
            // Check each server entry
            const servers = file.json?.mcpServers || file.json?.servers || file.json || {};
            if (typeof servers === 'object' && !Array.isArray(servers)) {
                for (const [, config] of Object.entries(servers)) {
                    if (jsonContainsSecrets(config)) {
                        projectServersWithSecrets++;
                    }
                }
            }
        }

        let status, points;
        if (projectFiles.length === 0) {
            status = 'pass';
            points = 2;
            checks.push({
                name: 'MCP scope appropriateness',
                status,
                points,
                maxPoints: 2,
                message: 'No project-level MCP server configs found',
            });
        } else if (projectServersWithSecrets === 0) {
            status = 'pass';
            points = 2;
            checks.push({
                name: 'MCP scope appropriateness',
                status,
                points,
                maxPoints: 2,
                message: 'MCP servers in this project do not contain API keys — secrets stored at the right level',
            });
        } else if (projectServersWithSecrets > 3) {
            status = 'warn';
            points = 1;
            checks.push({
                name: 'MCP scope appropriateness',
                status,
                points,
                maxPoints: 2,
                message: `${projectServersWithSecrets} MCP server(s) in this project contain API keys — project-level config (.mcp.json) is shared with the repo. Move secrets to your personal config (~/.claude.json) so they don't leak.`,
            });
        } else {
            status = 'warn';
            points = 1;
            checks.push({
                name: 'MCP scope appropriateness',
                status,
                points,
                maxPoints: 2,
                message: `${projectServersWithSecrets} MCP server(s) contain API keys in project config — move to ~/.claude.json so the token is personal and not repo-visible`,
            });
        }
    }

    // ---------------------------------------------------------------
    // Check 3: Git-tracked secrets (2 pts)
    // ---------------------------------------------------------------
    {
        let gitTracked = false;
        let gitIgnored = false;
        let mcpJsonHasSecrets = false;

        // Check if .mcp.json exists and has secrets
        if (mcpJson) {
            mcpJsonHasSecrets = jsonContainsSecrets(mcpJson);
        }

        // Check if .mcp.json is tracked by git (using execFileSync for safety)
        try {
            execFileSync('git', ['ls-files', '--error-unmatch', '.mcp.json'], {
                cwd: rootPath,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            gitTracked = true;
        } catch {
            // not tracked
        }

        // Check if .gitignore includes .mcp.json
        try {
            const gitignore = await readFile(join(rootPath, '.gitignore'), 'utf-8');
            if (gitignore.split('\n').some((line) => line.trim() === '.mcp.json' || line.trim() === '.mcp.json*')) {
                gitIgnored = true;
            }
        } catch {
            // no .gitignore
        }

        let status, points;
        if (gitTracked && mcpJsonHasSecrets) {
            status = 'fail';
            points = 0;
            checks.push({
                name: 'Git-tracked MCP secrets',
                status,
                points,
                maxPoints: 2,
                message: 'Secrets found in git-tracked .mcp.json — add .mcp.json to .gitignore and rotate compromised keys',
            });
        } else if (gitIgnored) {
            status = 'pass';
            points = 2;
            checks.push({
                name: 'Git-tracked MCP secrets',
                status,
                points,
                maxPoints: 2,
                message: 'MCP config properly gitignored',
            });
        } else if (!mcpJson) {
            status = 'pass';
            points = 2;
            checks.push({
                name: 'Git-tracked MCP secrets',
                status,
                points,
                maxPoints: 2,
                message: 'No .mcp.json file present — no git-tracking risk',
            });
        } else if (!mcpJsonHasSecrets) {
            status = 'pass';
            points = 2;
            checks.push({
                name: 'Git-tracked MCP secrets',
                status,
                points,
                maxPoints: 2,
                message: '.mcp.json has no API keys — safe to commit',
            });
        } else {
            // Has secrets but not git-tracked — good
            status = 'pass';
            points = 2;
            checks.push({
                name: 'Git-tracked MCP secrets',
                status,
                points,
                maxPoints: 2,
                message: '.mcp.json contains API keys but is not committed to git — keys stay private',
            });
        }
    }

    // ---------------------------------------------------------------
    // Check 4: Settings permission leaks (1 pt)
    // ---------------------------------------------------------------
    {
        const settingsLocalPath = join(rootPath, '.claude', 'settings.local.json');
        const settingsLocal = await readJson(settingsLocalPath);

        let leaksFound = 0;

        if (settingsLocal) {
            const permissions = settingsLocal.permissions || {};
            const allowList = permissions.allow || [];

            if (Array.isArray(allowList)) {
                for (const entry of allowList) {
                    const value = typeof entry === 'string' ? entry : (entry?.pattern || '');
                    if (typeof value === 'string') {
                        let entryHasLeak = false;
                        for (const pat of SECRET_PATTERNS) {
                            if (pat.test(value)) {
                                entryHasLeak = true;
                                break;
                            }
                        }
                        // Also check for long alphanumeric strings in authorization contexts
                        if (!entryHasLeak && /(?:Bearer|token|key|secret|authorization)/i.test(value)) {
                            const matches = value.match(/[a-zA-Z0-9_-]{32,}/g);
                            if (matches && matches.length > 0) {
                                entryHasLeak = true;
                            }
                        }
                        if (entryHasLeak) leaksFound++;
                    }
                }
            }
        }

        let status, points;
        if (!settingsLocal) {
            status = 'pass';
            points = 1;
            checks.push({
                name: 'Settings permission leaks',
                status,
                points,
                maxPoints: 1,
                message: 'No .claude/settings.local.json found — no permission leak risk',
            });
        } else if (leaksFound === 0) {
            status = 'pass';
            points = 1;
            checks.push({
                name: 'Settings permission leaks',
                status,
                points,
                maxPoints: 1,
                message: 'Permission allow-list does not contain embedded secrets',
            });
        } else {
            status = 'warn';
            points = 0;
            checks.push({
                name: 'Settings permission leaks',
                status,
                points,
                maxPoints: 1,
                message: `${leaksFound} permission allow pattern(s) contain embedded API keys/tokens — remove secrets from permission patterns`,
            });
        }
    }

    // ---------------------------------------------------------------
    // Aggregate
    // ---------------------------------------------------------------
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'MCP Security',
        points: totalPoints,
        maxPoints: 8,
        checks,
    };
}
