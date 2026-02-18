/**
 * Fluency Layer: Context-Aware Skills
 *
 * Checks whether skills Read from memory/, patterns/, docs/ or other
 * knowledge directories. Skills that pull context from the knowledge base
 * are fundamentally more effective than isolated scripts.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Brain directories that indicate knowledge-awareness when referenced
const BRAIN_DIR_PATTERN = /(?:memory|patterns|docs|knowledge|brain|research|experiences|decisions|workflows|templates|learnings|insights|playbooks|references)\/[\w./-]+/g;

// Stronger signal: explicit Read/consult directives pointing to brain dirs
const DIRECTIVE_PATTERN = /(?:Read|Consult|Load|Check|Reference|See)\s+.*(?:memory|patterns|docs|knowledge|brain|research|experiences)\/[\w./-]+/gi;

export async function checkContextAwareSkills(rootPath) {
    const checks = [];
    const skillFiles = [];

    // Find all skill files (SKILL.md + knowledge/*.md inside skill dirs)
    const skillsDir = join(rootPath, '.claude', 'skills');
    try {
        const s = await stat(skillsDir);
        if (!s.isDirectory()) throw new Error('not a dir');
    } catch {
        return {
            name: 'Context-Aware Skills',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'Knowledge-aware skills',
                status: 'fail',
                points: 0,
                maxPoints: 10,
                message: 'No .claude/skills/ directory found',
            }],
        };
    }

    // Scan for SKILL.md files
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
            name: 'Context-Aware Skills',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'Knowledge-aware skills',
                status: 'fail',
                points: 0,
                maxPoints: 10,
                message: 'No SKILL.md files found in .claude/skills/',
            }],
        };
    }

    let knowledgeAwareCount = 0;
    let totalRefCount = 0;

    for (const filePath of skillFiles) {
        try {
            const content = await readFile(filePath, 'utf-8');
            const brainRefs = content.match(BRAIN_DIR_PATTERN) || [];
            const directiveRefs = content.match(DIRECTIVE_PATTERN) || [];
            const hasContextRef = brainRefs.length > 0 || directiveRefs.length > 0;

            if (hasContextRef) {
                knowledgeAwareCount++;
                totalRefCount += brainRefs.length + directiveRefs.length;
            }
        } catch {
            continue;
        }
    }

    const totalSkills = skillFiles.length;
    const ratio = totalSkills > 0 ? knowledgeAwareCount / totalSkills : 0;

    let points, status;
    if (ratio >= 0.4) {
        points = 10;
        status = 'pass';
    } else if (ratio >= 0.25) {
        points = 7;
        status = 'pass';
    } else if (ratio >= 0.1) {
        points = 4;
        status = 'warn';
    } else {
        points = 0;
        status = 'fail';
    }

    checks.push({
        name: 'Knowledge-aware skills',
        status,
        points,
        maxPoints: 10,
        message: ratio >= 0.4
            ? `${knowledgeAwareCount}/${totalSkills} skills (${(ratio * 100).toFixed(0)}%) reference knowledge directories (${totalRefCount} total refs)`
            : ratio > 0
                ? `Only ${knowledgeAwareCount}/${totalSkills} skills (${(ratio * 100).toFixed(0)}%) leverage your knowledge base — most are isolated`
                : `0/${totalSkills} skills reference knowledge directories — skills don't leverage your accumulated knowledge`,
    });

    return {
        name: 'Context-Aware Skills',
        points: checks.reduce((s, c) => s + c.points, 0),
        maxPoints: 10,
        checks,
    };
}
