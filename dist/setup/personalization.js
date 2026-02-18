/**
 * Setup Layer: Personalization Depth
 *
 * Evaluates how well the Second Brain is personalized to the user's
 * specific role, profession, and workflow through CLAUDE.md content,
 * skill naming, and agent configuration.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PLACEHOLDER_PATTERNS = [
    /\{\{[A-Z_]+\}\}/,       // {{PLACEHOLDER}}
    /\[your\s/i,              // [your ...
    /\[insert\s/i,            // [insert ...
    /\bTODO\b/,               // TODO
    /\bREPLACE_ME\b/,         // REPLACE_ME
];

const GENERIC_SKILL_NAMES = new Set([
    'test', 'example', 'demo', 'hello', 'sample', 'template', 'skill-1', 'skill-2',
]);

function extractAboutSection(content) {
    const headingPattern = /^(#{1,3})\s.*(about\s*me|who\s*(am\s*i|i\s*am)|role|context)/im;
    const match = content.match(headingPattern);
    if (!match) return null;

    const startIndex = match.index + match[0].length;
    const headingLevel = match[1].length;

    const rest = content.slice(startIndex);
    const nextHeading = rest.match(new RegExp(`^#{1,${headingLevel}}\\s`, 'm'));
    const endIndex = nextHeading ? startIndex + nextHeading.index : content.length;

    return content.slice(startIndex, endIndex).trim();
}

async function collectSkillNames(skillsDir) {
    const names = [];
    let entries;
    try {
        entries = await readdir(skillsDir);
    } catch {
        return names;
    }

    for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const fullPath = join(skillsDir, entry);

        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
                try {
                    await stat(join(fullPath, 'SKILL.md'));
                    names.push(entry);
                } catch {
                    // no SKILL.md
                }
            } else if (entry.endsWith('.md')) {
                names.push(entry.replace(/\.md$/, ''));
            }
        } catch {
            continue;
        }
    }

    return names;
}

export async function checkPersonalization(rootPath) {
    const checks = [];

    // Check 1: CLAUDE.md mentions specific role (4 pts)
    {
        let content = '';
        try {
            content = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
        } catch {
            // no CLAUDE.md
        }

        const aboutSection = content ? extractAboutSection(content) : null;

        if (aboutSection) {
            const hasPlaceholder = PLACEHOLDER_PATTERNS.some(p => p.test(aboutSection));

            if (hasPlaceholder) {
                checks.push({
                    name: 'CLAUDE.md mentions specific role',
                    status: 'fail',
                    points: 0,
                    maxPoints: 4,
                    message: 'About section contains placeholder text — replace with your actual role and context',
                });
            } else if (aboutSection.length > 50) {
                checks.push({
                    name: 'CLAUDE.md mentions specific role',
                    status: 'pass',
                    points: 4,
                    maxPoints: 4,
                    message: `Role/context section found with ${aboutSection.length} characters of personalized content`,
                });
            } else {
                checks.push({
                    name: 'CLAUDE.md mentions specific role',
                    status: 'warn',
                    points: 2,
                    maxPoints: 4,
                    message: `About section is thin (${aboutSection.length} chars) — add more detail about your role and domain`,
                });
            }
        } else {
            checks.push({
                name: 'CLAUDE.md mentions specific role',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No About Me / role section found in CLAUDE.md',
            });
        }
    }

    // Check 2: Skills match profession (3 pts)
    {
        const claudeSkills = await collectSkillNames(join(rootPath, '.claude', 'skills'));
        const codexSkills = await collectSkillNames(join(rootPath, '.codex', 'skills'));
        const allSkills = [...claudeSkills, ...codexSkills];

        const nonGeneric = allSkills.filter(name => !GENERIC_SKILL_NAMES.has(name.toLowerCase()));

        let status, points;
        if (nonGeneric.length >= 2) {
            status = 'pass';
            points = 3;
        } else if (nonGeneric.length === 1) {
            status = 'warn';
            points = 1;
        } else {
            status = 'fail';
            points = 0;
        }

        checks.push({
            name: 'Skills match profession',
            status,
            points,
            maxPoints: 3,
            message: nonGeneric.length > 0
                ? `${nonGeneric.length} profession-specific skill(s): ${nonGeneric.slice(0, 5).join(', ')}${nonGeneric.length > 5 ? '...' : ''}`
                : allSkills.length > 0
                    ? 'All skills have generic names — rename them to reflect your actual workflows'
                    : 'No skills found — create skills that match your profession',
        });
    }

    // Check 3: Agent configuration (3 pts)
    {
        const agentsDir = join(rootPath, '.claude', 'agents');
        let agentCount = 0;

        try {
            const entries = await readdir(agentsDir);
            for (const entry of entries) {
                if (entry.endsWith('.md')) {
                    try {
                        const s = await stat(join(agentsDir, entry));
                        if (s.isFile()) agentCount++;
                    } catch {
                        continue;
                    }
                }
            }
        } catch {
            // directory doesn't exist
        }

        let status, points;
        if (agentCount >= 2) {
            status = 'pass';
            points = 3;
        } else if (agentCount === 1) {
            status = 'warn';
            points = 1;
        } else {
            status = 'fail';
            points = 0;
        }

        checks.push({
            name: 'Agent configuration',
            status,
            points,
            maxPoints: 3,
            message: agentCount > 0
                ? `${agentCount} agent configuration(s) found in .claude/agents/`
                : 'No agent configurations found — add .md files to .claude/agents/ for specialized agents',
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Personalization Depth',
        points: totalPoints,
        maxPoints: 10,
        checks,
    };
}
