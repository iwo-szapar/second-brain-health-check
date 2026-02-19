/**
 * Fluency Layer: Delegation Patterns
 *
 * Measures how well the brain uses multi-tier orchestration:
 * skills that invoke other skills, agents with scoped toolsets,
 * and intentional model routing across different task types.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// Delegation signals in skill/agent content
const DELEGATION_PATTERNS = {
    taskTool: /\bTask\s+tool\b|\bsubagent\b|\bspawn\b.*\bagent\b|\bTask\(\b/i,
    skillInvocation: /\/[a-z][-a-z0-9]+/g,    // slash command references
    agentRef: /\.claude\/agents\/|agent[_-]?type|subagent_type/i,
    mcpTool: /mcp__[a-z]/i,
};

function parseFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) return null;
    const fields = {};
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim();
            fields[key] = val;
        }
    }
    return fields;
}

async function collectMdFiles(dirPath) {
    const files = [];
    let entries;
    try {
        entries = await readdir(dirPath, { recursive: true });
    } catch {
        return files;
    }

    for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        try {
            const fullPath = join(dirPath, entry);
            const s = await stat(fullPath);
            if (!s.isFile()) continue;
            const content = await readFile(fullPath, 'utf-8');
            const frontmatter = parseFrontmatter(content);
            files.push({ name: entry, content, frontmatter });
        } catch {
            continue;
        }
    }
    return files;
}

export async function checkDelegationPatterns(rootPath) {
    const checks = [];

    const skills = await collectMdFiles(join(rootPath, '.claude', 'skills'));
    const agents = await collectMdFiles(join(rootPath, '.claude', 'agents'));
    const commands = await collectMdFiles(join(rootPath, '.claude', 'commands'));
    const allFiles = [...skills, ...agents, ...commands];

    // Check 1: Multi-tier orchestration (4 pts)
    // Skills/commands that delegate to agents or other skills
    {
        let status, points, message;
        if (allFiles.length === 0) {
            status = 'fail'; points = 0;
            message = 'No skills, agents, or commands to evaluate';
        } else {
            let delegatingFiles = 0;
            const delegationTypes = new Set();

            for (const file of allFiles) {
                let delegates = false;
                if (DELEGATION_PATTERNS.taskTool.test(file.content)) {
                    delegates = true;
                    delegationTypes.add('task-delegation');
                }
                if (DELEGATION_PATTERNS.agentRef.test(file.content)) {
                    delegates = true;
                    delegationTypes.add('agent-reference');
                }
                // Count slash command references (but filter self-references and common words)
                const slashRefs = file.content.match(DELEGATION_PATTERNS.skillInvocation) || [];
                const meaningfulRefs = slashRefs.filter(r =>
                    r.length > 3 &&
                    !/^\/(the|and|or|but|for|with|from|this|that|not|all|any|can|will|may)$/.test(r)
                );
                if (meaningfulRefs.length >= 2) {
                    delegates = true;
                    delegationTypes.add('skill-chaining');
                }
                if (delegates) delegatingFiles++;
            }

            if (delegatingFiles >= 3 && delegationTypes.size >= 2) {
                status = 'pass'; points = 4;
                message = `${delegatingFiles} files use delegation (${[...delegationTypes].join(', ')}) — strong orchestration patterns`;
            } else if (delegatingFiles >= 1) {
                status = 'warn'; points = 2;
                message = `${delegatingFiles} file(s) delegate work — build more multi-tier workflows`;
            } else {
                status = 'fail'; points = 0;
                message = 'No delegation patterns detected — skills/commands work in isolation';
            }
        }
        checks.push({ name: 'Multi-tier orchestration', status, points, maxPoints: 4, message });
    }

    // Check 2: Tool scoping across agents (3 pts)
    {
        let status, points, message;
        if (agents.length === 0) {
            status = 'warn'; points = 1;
            message = 'No agents defined — tool scoping requires custom agents';
        } else {
            const withTools = agents.filter(a => a.frontmatter?.tools).length;
            const withAllowedTools = agents.filter(a => {
                if (!a.frontmatter) return false;
                return a.frontmatter['allowed-tools'] !== undefined ||
                    a.frontmatter['allowedtools'] !== undefined ||
                    a.frontmatter.tools !== undefined;
            }).length;

            const scopedPct = withAllowedTools / agents.length;

            if (scopedPct >= 0.5) {
                status = 'pass'; points = 3;
                message = `${withAllowedTools}/${agents.length} agents have scoped toolsets — good least-privilege design`;
            } else if (withAllowedTools >= 1) {
                status = 'warn'; points = 2;
                message = `${withAllowedTools}/${agents.length} agents scope tools — more agents should constrain their capabilities`;
            } else {
                status = 'warn'; points = 1;
                message = 'No agents restrict their tool access — all operate with full permissions';
            }
        }
        checks.push({ name: 'Tool scoping discipline', status, points, maxPoints: 3, message });
    }

    // Check 3: Model routing intentionality (3 pts)
    // Different agents/skills using different models for different purposes
    {
        let status, points, message;
        const modelsUsed = new Set();
        let filesWithModel = 0;

        for (const file of allFiles) {
            if (!file.frontmatter?.model) continue;
            filesWithModel++;
            modelsUsed.add(file.frontmatter.model.toLowerCase());
        }

        if (filesWithModel === 0) {
            status = 'warn'; points = 1;
            message = 'No model selection in skills/agents — everything uses the default model';
        } else if (modelsUsed.size >= 2) {
            status = 'pass'; points = 3;
            message = `${modelsUsed.size} different models across ${filesWithModel} files — intentional model routing (${[...modelsUsed].join(', ')})`;
        } else {
            status = 'warn'; points = 2;
            message = `${filesWithModel} files specify model but all use ${[...modelsUsed][0]} — consider using cheaper models for simple tasks`;
        }
        checks.push({ name: 'Model routing', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Delegation Patterns',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
