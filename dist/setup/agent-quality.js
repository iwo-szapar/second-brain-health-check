/**
 * Setup Layer: Agent Configuration Depth
 *
 * Evaluates whether custom agents (.claude/agents/*.md) are properly
 * configured with tool restrictions, model selection, skill integration,
 * and memory — not just present as empty shells.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

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

async function collectAgents(rootPath) {
    const agents = [];
    const agentsDir = join(rootPath, '.claude', 'agents');
    let entries;
    try {
        entries = await readdir(agentsDir);
    } catch {
        return agents;
    }

    for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        const filePath = join(agentsDir, entry);
        try {
            const s = await stat(filePath);
            if (!s.isFile()) continue;
            const content = await readFile(filePath, 'utf-8');
            const frontmatter = parseFrontmatter(content);
            const bodyStart = content.match(FRONTMATTER_RE);
            const body = bodyStart ? content.slice(bodyStart[0].length).trim() : content.trim();
            agents.push({
                name: entry.replace(/\.md$/, ''),
                frontmatter,
                body,
                bodyLength: body.length,
            });
        } catch {
            continue;
        }
    }

    return agents;
}

export async function checkAgentQuality(rootPath) {
    const checks = [];
    const agents = await collectAgents(rootPath);

    // Check 1: Agent count and configuration presence (3 pts)
    {
        let status, points, message;
        if (agents.length >= 3) {
            const withFrontmatter = agents.filter(a => a.frontmatter !== null).length;
            if (withFrontmatter >= agents.length * 0.7) {
                status = 'pass'; points = 3;
                message = `${agents.length} agents, ${withFrontmatter} with structured frontmatter`;
            } else {
                status = 'warn'; points = 2;
                message = `${agents.length} agents but only ${withFrontmatter} have frontmatter — add YAML headers for tool/model control`;
            }
        } else if (agents.length >= 1) {
            status = 'warn'; points = 1;
            message = `${agents.length} agent(s) found — consider adding specialized agents for different task types`;
        } else {
            status = 'fail'; points = 0;
            message = 'No custom agents in .claude/agents/ — agents enable task-specific tool restrictions and model selection';
        }
        checks.push({ name: 'Agent definitions', status, points, maxPoints: 3, message });
    }

    // Check 2: Tool restriction discipline (3 pts)
    {
        let status, points, message;
        if (agents.length === 0) {
            status = 'fail'; points = 0;
            message = 'No agents to evaluate';
        } else {
            // Check for `tools:` in frontmatter — agents with constrained toolsets
            const withToolRestrictions = agents.filter(a => {
                if (!a.frontmatter) return false;
                return a.frontmatter.tools !== undefined;
            }).length;

            const pct = withToolRestrictions / agents.length;

            if (pct >= 0.5) {
                status = 'pass'; points = 3;
                message = `${withToolRestrictions}/${agents.length} agents have explicit tool restrictions — good least-privilege practice`;
            } else if (withToolRestrictions >= 1) {
                status = 'warn'; points = 2;
                message = `${withToolRestrictions}/${agents.length} agents restrict tools — scope more agents to reduce blast radius`;
            } else {
                status = 'warn'; points = 1;
                message = 'No agents define tool restrictions — all agents have full tool access by default';
            }
        }
        checks.push({ name: 'Tool restriction discipline', status, points, maxPoints: 3, message });
    }

    // Check 3: Model and skill integration (2 pts)
    {
        let status, points, message;
        if (agents.length === 0) {
            status = 'fail'; points = 0;
            message = 'No agents to evaluate';
        } else {
            const withModel = agents.filter(a => a.frontmatter?.model).length;
            const withSkills = agents.filter(a => a.frontmatter?.skills).length;
            const withMemory = agents.filter(a => a.frontmatter?.memory).length;

            const features = [];
            if (withModel > 0) features.push(`${withModel} with model selection`);
            if (withSkills > 0) features.push(`${withSkills} with skill integration`);
            if (withMemory > 0) features.push(`${withMemory} with agent memory`);

            if (features.length >= 2) {
                status = 'pass'; points = 2;
                message = `Advanced agent configuration: ${features.join(', ')}`;
            } else if (features.length === 1) {
                status = 'warn'; points = 1;
                message = `Partial agent configuration: ${features[0]}`;
            } else {
                status = 'warn'; points = 1;
                message = 'Agents lack model/skills/memory frontmatter — consider adding for better task routing';
            }
        }
        checks.push({ name: 'Model and skill integration', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Agent Configuration Depth',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
