/**
 * Setup Layer: Permissions Audit
 *
 * Validates permission mode appropriateness, tool permission syntax,
 * over-permissive configs, under-permissive configs, and deny rules
 * that may silently block needed tools.
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

const VALID_TOOL_PREFIXES = [
    'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
    'WebFetch', 'WebSearch', 'Task', 'NotebookEdit', 'mcp__',
    'Skill', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode',
    'ToolSearch', 'SendMessage', 'TodoWrite',
    'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskOutput', 'TaskStop',
    'TeamCreate', 'TeamDelete',
    'ReadMcpResourceTool', 'ListMcpResourcesTool',
];

// Dangerous permission patterns that grant overly broad access
const DANGEROUS_PATTERNS = [
    /^Bash\(\*\)$/,               // Allow any bash command
    /^Bash\(rm\s/,                // Allow rm commands
    /^Bash\(sudo\s/,              // Allow sudo
    /^Write\(\*\)$/,              // Write anywhere
    /^Edit\(\*\)$/,               // Edit anywhere
];

export async function checkPermissionsAudit(rootPath) {
    const checks = [];
    const home = homedir();

    const [projectShared, projectLocal, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
    ]);

    // Merge permission data from all levels
    const allPermissions = [];
    if (projectShared?.permissions) allPermissions.push({ level: 'project-shared', perms: projectShared.permissions });
    if (projectLocal?.permissions) allPermissions.push({ level: 'project-local', perms: projectLocal.permissions });
    if (userGlobal?.permissions) allPermissions.push({ level: 'user-global', perms: userGlobal.permissions });

    // Check 1: Permission Mode (3 pts)
    {
        const modes = [];
        for (const { level, perms } of allPermissions) {
            if (perms.defaultMode) modes.push({ level, mode: perms.defaultMode });
        }

        // Also check if bypassPermissions is set globally
        const hasBypass = allPermissions.some(({ perms }) => perms.defaultMode === 'bypassPermissions');

        let status, points, message;
        if (allPermissions.length === 0) {
            status = 'warn';
            points = 1;
            message = 'No permission configuration found — using Claude Code defaults';
        } else if (hasBypass) {
            status = 'fail';
            points = 0;
            message = 'bypassPermissions mode active — all tool calls execute without confirmation. High risk for destructive operations';
        } else if (modes.length > 0) {
            status = 'pass';
            points = 3;
            message = `Permission mode(s): ${modes.map(m => `${m.mode} (${m.level})`).join(', ')}`;
        } else {
            status = 'pass';
            points = 3;
            message = 'Permissions configured without explicit mode — using defaults with allow/deny rules';
        }
        checks.push({ name: 'Permission mode', status, points, maxPoints: 3, message });
    }

    // Check 2: Over-Permissive Rules (3 pts)
    {
        const dangerousRules = [];

        for (const { level, perms } of allPermissions) {
            const allowList = Array.isArray(perms.allow) ? perms.allow : [];
            for (const entry of allowList) {
                const pattern = typeof entry === 'string' ? entry : (entry?.pattern || '');
                if (typeof pattern !== 'string') continue;

                for (const dangerPat of DANGEROUS_PATTERNS) {
                    if (dangerPat.test(pattern)) {
                        dangerousRules.push({ pattern, level });
                        break;
                    }
                }
            }
        }

        let status, points, message;
        if (allPermissions.length === 0) {
            status = 'warn';
            points = 1;
            message = 'No permission rules configured — using defaults (consider adding explicit rules)';
        } else if (dangerousRules.length === 0) {
            status = 'pass';
            points = 3;
            message = 'No over-permissive rules detected';
        } else if (dangerousRules.length <= 2) {
            status = 'warn';
            points = 1;
            const examples = dangerousRules.map(r => `"${r.pattern}" (${r.level})`).join('; ');
            message = `${dangerousRules.length} risky rule(s): ${examples}`;
        } else {
            status = 'fail';
            points = 0;
            message = `${dangerousRules.length} over-permissive rules — review and scope down broad patterns`;
        }
        checks.push({ name: 'Over-permissive rules', status, points, maxPoints: 3, message });
    }

    // Check 3: Deny Rules Review (3 pts)
    {
        const denyRules = [];
        const potentiallyBlockingDenies = [];

        for (const { level, perms } of allPermissions) {
            const denyList = Array.isArray(perms.deny) ? perms.deny : [];
            for (const entry of denyList) {
                const pattern = typeof entry === 'string' ? entry : (entry?.pattern || '');
                if (typeof pattern !== 'string') continue;
                denyRules.push({ pattern, level });

                // Detect denies that block common tools entirely
                if (/^(Bash|Read|Write|Edit|Glob|Grep|WebFetch|WebSearch|Task)$/.test(pattern)) {
                    potentiallyBlockingDenies.push({ pattern, level });
                }
            }
        }

        let status, points, message;
        if (denyRules.length === 0) {
            status = 'pass';
            points = 3;
            message = 'No deny rules configured';
        } else if (potentiallyBlockingDenies.length > 0) {
            status = 'warn';
            points = 1;
            const examples = potentiallyBlockingDenies.map(r => `${r.pattern} (${r.level})`).join('; ');
            message = `${denyRules.length} deny rule(s), ${potentiallyBlockingDenies.length} block entire tool type(s): ${examples}`;
        } else {
            status = 'pass';
            points = 3;
            message = `${denyRules.length} deny rule(s) — all scoped to specific patterns`;
        }
        checks.push({ name: 'Deny rules review', status, points, maxPoints: 3, message });
    }

    // Check 4: Permission Syntax Validity (3 pts)
    {
        const invalidPatterns = [];
        let totalPatterns = 0;

        for (const { level, perms } of allPermissions) {
            const allowList = Array.isArray(perms.allow) ? perms.allow : [];
            const denyList = Array.isArray(perms.deny) ? perms.deny : [];

            for (const entry of [...allowList, ...denyList]) {
                const pattern = typeof entry === 'string' ? entry : (entry?.pattern || '');
                if (typeof pattern !== 'string' || !pattern) continue;
                totalPatterns++;

                // Validate tool prefix
                const hasValidPrefix = VALID_TOOL_PREFIXES.some(p => pattern.startsWith(p));
                if (!hasValidPrefix) {
                    invalidPatterns.push({ pattern: pattern.length > 50 ? pattern.substring(0, 47) + '...' : pattern, level });
                }
            }
        }

        let status, points, message;
        if (totalPatterns === 0) {
            status = 'warn';
            points = 1;
            message = 'No permission patterns to validate — no allow/deny rules configured';
        } else if (invalidPatterns.length === 0) {
            status = 'pass';
            points = 3;
            message = `${totalPatterns} permission pattern(s) — all have valid tool prefixes`;
        } else if (invalidPatterns.length <= 3) {
            status = 'warn';
            points = 1;
            const examples = invalidPatterns.map(p => `"${p.pattern}" (${p.level})`).join('; ');
            message = `${invalidPatterns.length}/${totalPatterns} pattern(s) have invalid tool prefix: ${examples}`;
        } else {
            status = 'fail';
            points = 0;
            message = `${invalidPatterns.length}/${totalPatterns} patterns have invalid tool prefixes — these rules will never match`;
        }
        checks.push({ name: 'Permission syntax validity', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Permissions Audit',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
