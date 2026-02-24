/**
 * Setup Layer: Validate Command
 *
 * Checks for a validation skill/command that enforces quality before shipping.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const VALIDATE_PATHS = ['.claude/commands/validate.md', '.claude/skills/validate/SKILL.md'];
const QUALITY_KEYWORDS_RE = /\b(test|lint|build|check|verify|assert|validate|typecheck|ci|pipeline)\b/i;

async function findValidateSkill(rootPath) {
    for (const p of VALIDATE_PATHS) {
        try {
            const fullPath = join(rootPath, p);
            const s = await stat(fullPath);
            if (s.isFile()) return { path: p, content: await readFile(fullPath, 'utf-8') };
        } catch { /* not found */ }
    }
    for (const dir of ['.claude/skills', '.claude/commands']) {
        try {
            const entries = await readdir(join(rootPath, dir));
            for (const entry of entries) {
                if (entry.toLowerCase().includes('validate') || entry.toLowerCase().includes('check')) {
                    const p = join(rootPath, dir, entry);
                    const s = await stat(p);
                    if (s.isFile() && entry.endsWith('.md')) {
                        return { path: `${dir}/${entry}`, content: await readFile(p, 'utf-8') };
                    }
                    if (s.isDirectory()) {
                        try {
                            const skillFile = join(p, 'SKILL.md');
                            await stat(skillFile);
                            return { path: `${dir}/${entry}/SKILL.md`, content: await readFile(skillFile, 'utf-8') };
                        } catch { /* no SKILL.md */ }
                    }
                }
            }
        } catch { /* dir not found */ }
    }
    return null;
}

export async function checkValidateCommand(rootPath) {
    const checks = [];
    const skill = await findValidateSkill(rootPath);

    // Check 1: Validate skill exists (3 pts)
    {
        let status, points, message;
        if (skill) {
            status = 'pass'; points = 3;
            message = `Validate command found: ${skill.path}`;
        } else {
            status = 'fail'; points = 0;
            message = 'No validate skill/command — create .claude/commands/validate.md to enforce quality gates';
        }
        checks.push({ name: 'Validate command exists', status, points, maxPoints: 3, message });
    }

    // Check 2: Validate skill quality (3 pts)
    {
        let status, points, message;
        if (!skill) {
            status = 'fail'; points = 0;
            message = 'No validate skill to evaluate';
        } else if (skill.content.length >= 200 && QUALITY_KEYWORDS_RE.test(skill.content)) {
            status = 'pass'; points = 3;
            message = 'Validate skill has meaningful content with quality check keywords';
        } else if (skill.content.length > 0) {
            status = 'warn'; points = 1;
            message = 'Validate skill exists but is minimal — add test/lint/build/check instructions';
        } else {
            status = 'fail'; points = 0;
            message = 'Validate skill is empty';
        }
        checks.push({ name: 'Validate command quality', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Validate Command', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
