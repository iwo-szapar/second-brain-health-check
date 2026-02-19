/**
 * Setup Layer: Skills Configuration
 *
 * Evaluates the quality and count of skills defined in .claude/skills/
 * and .codex/skills/, checking frontmatter validity, relevance,
 * and instruction depth.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const GENERIC_NAMES = new Set([
    'test', 'hello', 'example', 'demo', 'sample', 'template', 'skill-1', 'skill-2',
]);

/**
 * Parse YAML frontmatter manually with regex.
 * Returns the raw frontmatter string if found, null otherwise.
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? match[1] : null;
}

/**
 * Collect skill info from a skills directory.
 * Looks for: subdirs containing SKILL.md, and flat .md files.
 */
async function collectSkills(skillsDir) {
    const skills = [];

    let entries;
    try {
        entries = await readdir(skillsDir);
    } catch {
        return skills;
    }

    for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const fullPath = join(skillsDir, entry);

        try {
            const s = await stat(fullPath);

            if (s.isDirectory()) {
                // Check for SKILL.md inside
                const skillMdPath = join(fullPath, 'SKILL.md');
                try {
                    const ss = await stat(skillMdPath);
                    if (ss.isFile()) {
                        const content = await readFile(skillMdPath, 'utf-8');
                        skills.push({
                            name: entry,
                            content,
                            frontmatter: parseFrontmatter(content),
                        });
                    }
                } catch {
                    // No SKILL.md in this subdir
                }
            } else if (entry.endsWith('.md') && s.isFile()) {
                const content = await readFile(fullPath, 'utf-8');
                const name = entry.replace(/\.md$/, '');
                skills.push({
                    name,
                    content,
                    frontmatter: parseFrontmatter(content),
                });
            }
        } catch {
            continue;
        }
    }

    return skills;
}

export async function checkSkills(rootPath) {
    const checks = [];

    const claudeSkillsDir = join(rootPath, '.claude', 'skills');
    const codexSkillsDir = join(rootPath, '.codex', 'skills');

    const claudeSkills = await collectSkills(claudeSkillsDir);
    const codexSkills = await collectSkills(codexSkillsDir);
    const allSkills = [...claudeSkills, ...codexSkills];

    // Check 1: Claude Code skills count (6 pts)
    {
        let status, points;
        if (claudeSkills.length >= 2) {
            status = 'pass';
            points = 6;
        } else if (claudeSkills.length === 1) {
            status = 'warn';
            points = 3;
        } else {
            status = 'fail';
            points = 0;
        }
        checks.push({
            name: 'Claude Code skills count',
            status,
            points,
            maxPoints: 6,
            message: `${claudeSkills.length} skill(s) found in .claude/skills/`,
        });
    }

    // Check 2: Codex compatibility (2 pts)
    {
        let codexExists = false;
        try {
            const s = await stat(codexSkillsDir);
            codexExists = s.isDirectory();
        } catch {
            // doesn't exist
        }
        checks.push({
            name: 'Codex compatibility',
            status: codexExists ? 'pass' : 'fail',
            points: codexExists ? 2 : 0,
            maxPoints: 2,
            message: codexExists
                ? '.codex/skills/ directory exists'
                : 'No .codex/skills/ directory — add one for Codex compatibility',
        });
    }

    // Check 3: Valid YAML frontmatter (4 pts)
    {
        if (allSkills.length === 0) {
            checks.push({
                name: 'Valid YAML frontmatter',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No skills to evaluate',
            });
        } else {
            const withFrontmatter = allSkills.filter(s => s.frontmatter !== null).length;
            const ratio = withFrontmatter / allSkills.length;
            let status, points;
            if (ratio >= 0.8) {
                status = 'pass';
                points = 4;
            } else if (ratio >= 0.5) {
                status = 'warn';
                points = 2;
            } else {
                status = 'fail';
                points = 0;
            }
            checks.push({
                name: 'Valid YAML frontmatter',
                status,
                points,
                maxPoints: 4,
                message: `${withFrontmatter}/${allSkills.length} skills have YAML frontmatter (${(ratio * 100).toFixed(0)}%)`,
            });
        }
    }

    // Check 4: Profession-relevant skills (4 pts)
    {
        if (allSkills.length === 0) {
            checks.push({
                name: 'Profession-relevant skills',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No skills to evaluate',
            });
        } else {
            const nonGeneric = allSkills.filter(s => !GENERIC_NAMES.has(s.name.toLowerCase())).length;
            const ratio = nonGeneric / allSkills.length;
            let status, points;
            if (ratio >= 0.8) {
                status = 'pass';
                points = 4;
            } else if (ratio >= 0.5) {
                status = 'warn';
                points = 2;
            } else {
                status = 'fail';
                points = 0;
            }
            checks.push({
                name: 'Profession-relevant skills',
                status,
                points,
                maxPoints: 4,
                message: `${nonGeneric}/${allSkills.length} skills have profession-relevant names (${(ratio * 100).toFixed(0)}%)`,
            });
        }
    }

    // Check 5: Clear instructions 200+ chars (4 pts)
    {
        if (allSkills.length === 0) {
            checks.push({
                name: 'Clear instructions (200+ chars)',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No skills to evaluate',
            });
        } else {
            const sufficient = allSkills.filter(s => s.content.trim().length >= 200).length;
            const ratio = sufficient / allSkills.length;
            let status, points;
            if (ratio >= 0.8) {
                status = 'pass';
                points = 4;
            } else if (ratio >= 0.5) {
                status = 'warn';
                points = 2;
            } else {
                status = 'fail';
                points = 0;
            }
            checks.push({
                name: 'Clear instructions (200+ chars)',
                status,
                points,
                maxPoints: 4,
                message: `${sufficient}/${allSkills.length} skills have 200+ characters of content (${(ratio * 100).toFixed(0)}%)`,
            });
        }
    }

    // Check 6: Frontmatter field depth (4 pts)
    // Skills with name + description are basic; model, allowed-tools, context show maturity
    {
        if (allSkills.length === 0) {
            checks.push({
                name: 'Frontmatter field depth',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No skills to evaluate',
            });
        } else {
            const ADVANCED_FIELDS = ['model', 'allowed-tools', 'allowedtools', 'context', 'disable-model-invocation'];
            let advancedCount = 0;
            let basicCount = 0;

            for (const skill of allSkills) {
                if (!skill.frontmatter) continue;
                const fm = skill.frontmatter.toLowerCase();
                const hasAdvanced = ADVANCED_FIELDS.some(f => fm.includes(f + ':'));
                if (hasAdvanced) {
                    advancedCount++;
                } else {
                    basicCount++;
                }
            }

            const withFrontmatter = advancedCount + basicCount;
            let status, points, message;

            if (advancedCount >= 3) {
                status = 'pass'; points = 4;
                message = `${advancedCount}/${withFrontmatter} skills use advanced frontmatter (model, allowed-tools, context)`;
            } else if (advancedCount >= 1) {
                status = 'warn'; points = 2;
                message = `${advancedCount}/${withFrontmatter} skills use advanced frontmatter — add model/tool restrictions to more skills`;
            } else if (withFrontmatter > 0) {
                status = 'warn'; points = 1;
                message = `${withFrontmatter} skills have basic frontmatter only — add model, allowed-tools, or context fields`;
            } else {
                status = 'fail'; points = 0;
                message = 'No skills have frontmatter — add YAML headers with name, description, model, allowed-tools';
            }
            checks.push({ name: 'Frontmatter field depth', status, points, maxPoints: 4, message });
        }
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Skills Configuration',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
