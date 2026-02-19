/**
 * Setup Layer: Team Readiness
 *
 * Evaluates whether the workspace is configured for agent teams —
 * the experimental multi-agent collaboration feature. Checks enablement,
 * agent definitions suitable for teamwork, and active team artifacts.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

async function readJson(filePath) {
    try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function dirExists(dirPath) {
    try {
        const s = await stat(dirPath);
        return s.isDirectory();
    } catch {
        return false;
    }
}

async function countEntries(dirPath) {
    try {
        const entries = await readdir(dirPath);
        return entries.filter(e => !e.startsWith('.')).length;
    } catch {
        return 0;
    }
}

export async function checkTeamReadiness(rootPath) {
    const checks = [];
    const home = homedir();

    // Read settings to check for teams enablement
    const [projectShared, projectLocal, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
    ]);

    // Also check ~/.claude/settings.json (user-level settings)
    const userSettings = await readJson(join(home, '.claude', 'settings.json'));

    const allConfigs = [projectShared, projectLocal, userGlobal, userSettings].filter(Boolean);

    // Check 1: Teams feature enabled (3 pts)
    {
        let teamsEnabled = false;
        let enableSource = '';

        for (const config of allConfigs) {
            const envBlock = config.env || {};
            if (envBlock.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1' ||
                envBlock.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === 1) {
                teamsEnabled = true;
                enableSource = config === projectShared ? 'project-shared' :
                    config === projectLocal ? 'project-local' :
                    config === userGlobal ? 'user-global' : 'user-settings';
                break;
            }
        }

        // Also check process.env
        if (!teamsEnabled && process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1') {
            teamsEnabled = true;
            enableSource = 'environment';
        }

        let status, points, message;
        if (teamsEnabled) {
            status = 'pass'; points = 3;
            message = `Agent teams enabled (${enableSource})`;
        } else {
            status = 'warn'; points = 1;
            message = 'Agent teams not enabled — set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in settings env block';
        }
        checks.push({ name: 'Teams feature enabled', status, points, maxPoints: 3, message });
    }

    // Check 2: Agent definitions for teamwork (3 pts)
    {
        const agentsDir = join(rootPath, '.claude', 'agents');
        let agentCount = 0;
        let agentsWithTools = 0;

        try {
            const entries = await readdir(agentsDir);
            for (const entry of entries) {
                if (!entry.endsWith('.md')) continue;
                agentCount++;
                try {
                    const content = await readFile(join(agentsDir, entry), 'utf-8');
                    const fm = content.match(FRONTMATTER_RE);
                    if (fm && /tools:/i.test(fm[1])) {
                        agentsWithTools++;
                    }
                } catch {
                    continue;
                }
            }
        } catch {
            // no agents dir
        }

        let status, points, message;
        if (agentCount >= 3 && agentsWithTools >= 2) {
            status = 'pass'; points = 3;
            message = `${agentCount} agents defined, ${agentsWithTools} with tool restrictions — good team candidates`;
        } else if (agentCount >= 2) {
            status = 'warn'; points = 2;
            message = `${agentCount} agents (${agentsWithTools} with tool restrictions) — add more specialized agents for team diversity`;
        } else if (agentCount >= 1) {
            status = 'warn'; points = 1;
            message = `${agentCount} agent defined — teams work best with 2+ specialized agents`;
        } else {
            status = 'fail'; points = 0;
            message = 'No agents in .claude/agents/ — teams need agent definitions to spawn teammates';
        }
        checks.push({ name: 'Agent definitions for teamwork', status, points, maxPoints: 3, message });
    }

    // Check 3: Active team artifacts (2 pts)
    {
        const teamsDir = join(home, '.claude', 'teams');
        const tasksDir = join(home, '.claude', 'tasks');

        const hasTeams = await dirExists(teamsDir);
        const hasTasks = await dirExists(tasksDir);

        let teamCount = 0;
        let taskCount = 0;

        if (hasTeams) teamCount = await countEntries(teamsDir);
        if (hasTasks) taskCount = await countEntries(tasksDir);

        let status, points, message;
        if (teamCount > 0 && taskCount > 0) {
            status = 'pass'; points = 2;
            message = `${teamCount} team config(s) and ${taskCount} task list(s) found — teams are being used`;
        } else if (teamCount > 0 || taskCount > 0) {
            status = 'warn'; points = 1;
            message = `Partial team artifacts: ${teamCount} team(s), ${taskCount} task list(s)`;
        } else {
            status = 'warn'; points = 1;
            message = 'No active team artifacts in ~/.claude/teams/ or ~/.claude/tasks/ — teams have not been used yet';
        }
        checks.push({ name: 'Active team artifacts', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Team Readiness',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
