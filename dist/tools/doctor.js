/**
 * doctor — Diagnostic tool for email-based triage.
 *
 * Outputs a pasteable block with: version, OS, env vars (redacted),
 * key paths, Factory connectivity, and MCP config.
 *
 * Created after Timo's 26-email debug chain (2026-03-13).
 * User pastes the block in a support email — eliminates multi-email debug.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { VERSION } from '../version.js';

/**
 * Redact a token to show only prefix + first 4 chars.
 * "sbk_afb5f226_Rk9X..." → "sbk_afb5... (set)"
 */
function redactToken(value) {
    if (!value) return 'not set';
    if (value.length <= 8) return '****** (set)';
    return value.substring(0, 8) + '... (set)';
}

/**
 * Check if a path exists, return status string.
 */
function pathStatus(p) {
    try {
        return existsSync(p) ? 'found' : 'not found';
    } catch {
        return 'error checking';
    }
}

/**
 * Read MCP servers from .claude/settings.json (CLI config).
 */
function readMcpConfig(rootPath) {
    const paths = [
        join(rootPath, '.claude', 'settings.json'),
        join(rootPath, '.claude.json'),
    ];
    for (const p of paths) {
        try {
            if (existsSync(p)) {
                const data = JSON.parse(readFileSync(p, 'utf8'));
                const servers = data.mcpServers || {};
                const names = Object.keys(servers);
                if (names.length === 0) return 'no MCP servers configured';
                return names.map(name => {
                    const s = servers[name];
                    const url = s.url || (s.args ? `stdio: ${s.args[0] || s.command}` : s.command || 'unknown');
                    return `  ${name}: ${url}`;
                }).join('\n');
            }
        } catch { /* skip */ }
    }
    return 'no config file found';
}

/**
 * Check .mcp.json (VSCode extension config).
 */
function readVscodeMcpConfig(rootPath) {
    const mcpJsonPath = join(rootPath, '.mcp.json');
    try {
        if (!existsSync(mcpJsonPath)) return 'not found';
        const data = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
        const servers = data.mcpServers || data.servers || {};
        const names = Object.keys(servers);
        return names.length > 0 ? names.join(', ') : 'empty';
    } catch {
        return 'parse error';
    }
}

/**
 * Ping Factory to check connectivity.
 */
async function checkFactoryConnectivity() {
    const url = 'https://second-brain-factory.com/api/mcp/validate';
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        // 401 = endpoint reachable, just no token. That's good.
        return `reachable (HTTP ${res.status})`;
    } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        return isAbort ? 'unreachable (timeout 5s)' : `unreachable (${err.message || 'network error'})`;
    }
}

/**
 * Run full diagnostics and return formatted output.
 */
export async function runDoctor(rootPath) {
    const root = rootPath ? resolve(rootPath) : process.cwd();
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';

    const connectivity = await checkFactoryConnectivity();
    const mcpConfig = readMcpConfig(root);
    const vscodeMcp = readVscodeMcpConfig(root);

    const lines = [
        '╔══════════════════════════════════════════════════╗',
        '║           MemoryOS Doctor Diagnostic             ║',
        '╚══════════════════════════════════════════════════╝',
        '',
        '── System ──',
        `  Version:    ${VERSION}`,
        `  Package:    @iwo-szapar/second-brain-health-check`,
        `  OS:         ${process.platform} (${process.arch})`,
        `  Node:       ${process.version}`,
        `  Shell:      ${process.env.SHELL || process.env.COMSPEC || 'unknown'}`,
        `  Home:       ${homeDir}`,
        `  CWD:        ${root}`,
        '',
        '── Tokens ──',
        `  SBK_TOKEN:              ${redactToken(process.env.SBK_TOKEN)}`,
        `  SBF_TOKEN:              ${redactToken(process.env.SBF_TOKEN)}`,
        `  UPGRADE_BRAIN_API_KEY:  ${redactToken(process.env.UPGRADE_BRAIN_API_KEY)}`,
        `  GUIDE_TOKEN:            ${redactToken(process.env.GUIDE_TOKEN)}`,
        '',
        '── Paths ──',
        `  ~/.claude/              ${pathStatus(join(homeDir, '.claude'))}`,
        `  .claude/                ${pathStatus(join(root, '.claude'))}`,
        `  CLAUDE.md               ${pathStatus(join(root, 'CLAUDE.md'))}`,
        `  .claude/settings.json   ${pathStatus(join(root, '.claude', 'settings.json'))}`,
        `  .mcp.json               ${pathStatus(join(root, '.mcp.json'))}`,
        `  .health-check.json      ${pathStatus(join(root, '.health-check.json'))}`,
        '',
        '── Factory Connectivity ──',
        `  second-brain-factory.com: ${connectivity}`,
        '',
        '── MCP Config (CLI) ──',
        mcpConfig,
        '',
        '── MCP Config (VSCode) ──',
        `  .mcp.json: ${vscodeMcp}`,
        '',
        '────────────────────────────────────────────────────',
        'Copy this block and paste in your support email.',
    ];

    return lines.join('\n');
}
