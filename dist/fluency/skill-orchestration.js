/**
 * Fluency Layer: Skill Orchestration Detection
 *
 * Scans SKILL.md files for Task/Skill/MCP tool references.
 * Users who build skills that orchestrate multiple tools show
 * advanced AI delegation — the hallmark of fluency.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Tool categories for classification
const TOOL_PATTERNS = {
    delegation: [
        /\bTask\b.*(?:subagent|agent)/i,
        /\bsubagent_type\b/,
        /launch.*agent/i,
        /spawn.*agent/i,
    ],
    skills: [
        /\bSkill\b.*(?:invoke|call|use)/i,
        /invoke.*skill/i,
        /\/\w+/,  // slash commands like /commit, /review
    ],
    mcp: [
        /\bmcp__\w+__\w+/,
    ],
    fileOps: [
        /\b(?:Read|Write|Edit|MultiEdit)\b/,
    ],
    search: [
        /\b(?:Grep|Glob|WebSearch|WebFetch)\b/,
    ],
    execution: [
        /\bBash\b/,
    ],
};

/**
 * Count distinct tool categories referenced in a skill file.
 */
function classifySkill(content) {
    const categories = new Set();

    for (const [category, patterns] of Object.entries(TOOL_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(content)) {
                categories.add(category);
                break;
            }
        }
    }

    return {
        categoryCount: categories.size,
        categories: [...categories],
        hasDelegation: categories.has('delegation'),
        hasMcp: categories.has('mcp'),
    };
}

export async function checkSkillOrchestration(rootPath) {
    const checks = [];
    const skillFiles = [];

    // Find all SKILL.md files
    const skillsDir = join(rootPath, '.claude', 'skills');
    try {
        const s = await stat(skillsDir);
        if (!s.isDirectory()) throw new Error('not a dir');
    } catch {
        return {
            name: 'Skill Orchestration',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'Skill orchestration detection',
                status: 'fail',
                points: 0,
                maxPoints: 10,
                message: 'No .claude/skills/ directory found',
            }],
        };
    }

    // Scan skills directory (2 levels: skills/name/SKILL.md and skills/group/name/SKILL.md)
    async function findSkillFiles(dir, depth) {
        if (depth > 2) return;
        let entries;
        try {
            entries = await readdir(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            const fullPath = join(dir, entry);
            try {
                const s = await stat(fullPath);
                if (s.isDirectory()) {
                    await findSkillFiles(fullPath, depth + 1);
                } else if (entry === 'SKILL.md' && s.size < 200000) {
                    skillFiles.push(fullPath);
                }
            } catch {
                continue;
            }
        }
    }

    await findSkillFiles(skillsDir, 0);

    if (skillFiles.length === 0) {
        return {
            name: 'Skill Orchestration',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'Skill orchestration detection',
                status: 'fail',
                points: 0,
                maxPoints: 10,
                message: 'No SKILL.md files found in .claude/skills/',
            }],
        };
    }

    // Classify each skill
    let orchestratingCount = 0;
    let delegatingCount = 0;
    let mcpCount = 0;

    for (const filePath of skillFiles) {
        try {
            const content = await readFile(filePath, 'utf-8');
            const classification = classifySkill(content);

            if (classification.categoryCount >= 2) orchestratingCount++;
            if (classification.hasDelegation) delegatingCount++;
            if (classification.hasMcp) mcpCount++;
        } catch {
            continue;
        }
    }

    const totalSkills = skillFiles.length;

    // Score based on orchestrating skills count
    let points, status;
    if (orchestratingCount >= 3) {
        points = 10;
        status = 'pass';
    } else if (orchestratingCount >= 2) {
        points = 7;
        status = 'pass';
    } else if (orchestratingCount >= 1) {
        points = 4;
        status = 'warn';
    } else {
        points = 0;
        status = 'fail';
    }

    checks.push({
        name: 'Skill orchestration detection',
        status,
        points,
        maxPoints: 10,
        message: orchestratingCount >= 3
            ? `${orchestratingCount}/${totalSkills} skills orchestrate multiple tool types (${delegatingCount} use delegation, ${mcpCount} use MCP)`
            : orchestratingCount >= 1
                ? `Only ${orchestratingCount}/${totalSkills} skill(s) use multi-tool orchestration — most skills are single-purpose`
                : `0/${totalSkills} skills use tool orchestration — skills are basic templates`,
    });

    return {
        name: 'Skill Orchestration',
        points: checks.reduce((s, c) => s + c.points, 0),
        maxPoints: 10,
        checks,
    };
}
