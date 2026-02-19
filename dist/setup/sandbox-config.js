/**
 * Setup Layer: Sandbox Configuration
 *
 * Checks whether sandboxing is enabled, network controls,
 * excluded commands, and autoAllowBashIfSandboxed settings.
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

export async function checkSandboxConfig(rootPath) {
    const checks = [];
    const home = homedir();

    const [projectShared, projectLocal, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
    ]);

    // Merge sandbox settings (project overrides user)
    const sandbox = projectLocal?.sandbox || projectShared?.sandbox || userGlobal?.sandbox || null;

    // Check 1: Sandbox Enabled (3 pts)
    {
        let status, points, message;
        if (!sandbox) {
            status = 'warn';
            points = 1;
            message = 'No sandbox configuration found — commands run unsandboxed by default';
        } else if (sandbox.enabled === true) {
            status = 'pass';
            points = 3;
            message = 'Sandbox is enabled — bash commands run in isolated environment';
        } else if (sandbox.enabled === false) {
            status = 'warn';
            points = 1;
            message = 'Sandbox explicitly disabled — bash commands have full system access';
        } else {
            status = 'warn';
            points = 1;
            message = 'Sandbox configuration exists but enabled state is unclear';
        }
        checks.push({ name: 'Sandbox enabled', status, points, maxPoints: 3, message });
    }

    // Check 2: Network Controls (2 pts)
    {
        let status, points, message;
        if (!sandbox) {
            status = 'warn';
            points = 0;
            message = 'No sandbox — network controls not configured';
        } else {
            const hasAllowedDomains = Array.isArray(sandbox.allowedDomains) && sandbox.allowedDomains.length > 0;
            const allowsUnixSockets = sandbox.allowUnixSockets === true;
            const hasProxyPorts = Array.isArray(sandbox.additionalProxyPorts) && sandbox.additionalProxyPorts.length > 0;

            const details = [];
            if (hasAllowedDomains) details.push(`${sandbox.allowedDomains.length} allowed domain(s)`);
            if (allowsUnixSockets) details.push('unix sockets allowed');
            if (hasProxyPorts) details.push(`${sandbox.additionalProxyPorts.length} proxy port(s)`);

            if (sandbox.enabled !== true) {
                status = 'warn';
                points = 0;
                message = 'Sandbox disabled — network controls have no effect';
            } else if (hasAllowedDomains) {
                status = 'pass';
                points = 2;
                message = `Network controls configured: ${details.join(', ')}`;
            } else {
                status = 'pass';
                points = 2;
                message = 'Sandbox enabled with default network restrictions';
            }
        }
        checks.push({ name: 'Network controls', status, points, maxPoints: 2, message });
    }

    // Check 3: Excluded Commands (2 pts)
    {
        let status, points, message;
        if (!sandbox) {
            status = 'warn';
            points = 0;
            message = 'No sandbox configured — excluded commands check not applicable';
        } else {
            const excluded = Array.isArray(sandbox.excludedCommands) ? sandbox.excludedCommands : [];
            const dangerousExclusions = excluded.filter(cmd =>
                /^(rm|sudo|chmod|chown|kill|pkill|dd|mkfs|fdisk)$/i.test(cmd)
            );

            if (excluded.length === 0) {
                status = 'pass';
                points = 2;
                message = 'No commands excluded from sandbox — full isolation';
            } else if (dangerousExclusions.length > 0) {
                status = 'fail';
                points = 0;
                message = `${dangerousExclusions.length} dangerous command(s) excluded from sandbox: ${dangerousExclusions.join(', ')} — these bypass sandbox entirely`;
            } else if (excluded.length <= 5) {
                status = 'pass';
                points = 2;
                message = `${excluded.length} command(s) excluded from sandbox: ${excluded.join(', ')}`;
            } else {
                status = 'warn';
                points = 1;
                message = `${excluded.length} commands excluded from sandbox — many exclusions reduce sandbox effectiveness`;
            }
        }
        checks.push({ name: 'Excluded commands', status, points, maxPoints: 2, message });
    }

    // Check 4: Auto-Allow Bash (1 pt)
    {
        let status, points, message;
        if (!sandbox) {
            status = 'warn';
            points = 0;
            message = 'No sandbox configured — auto-allow check not applicable';
        } else if (sandbox.autoAllowBashIfSandboxed === true && sandbox.enabled === true) {
            status = 'pass';
            points = 1;
            message = 'Bash auto-allowed inside sandbox — good balance of safety and productivity';
        } else if (sandbox.autoAllowBashIfSandboxed === true && sandbox.enabled !== true) {
            status = 'warn';
            points = 0;
            message = 'autoAllowBashIfSandboxed is true but sandbox is not enabled — auto-allow has no effect';
        } else {
            status = 'pass';
            points = 1;
            message = 'Bash requires manual approval even in sandbox';
        }
        checks.push({ name: 'Auto-allow bash', status, points, maxPoints: 1, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Sandbox Configuration',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
