/**
 * Setup Layer: CLAUDE.md Quality
 *
 * Evaluates the quality and completeness of the CLAUDE.md file,
 * checking for quick start rules, role context, profession-specific
 * patterns, gotchas, project structure, and appropriate length.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DOMAIN_PATTERNS = [
    'MEDDPICC', 'sprint', 'SEO', 'billable', 'KPI', 'HIPAA',
    'litigation', 'TypeScript', 'pytest', 'API', 'endpoint',
    'schema', 'migration', 'deploy',
];

export async function checkClaudeMd(rootPath) {
    const checks = [];
    let content = '';

    try {
        content = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
    } catch {
        return {
            name: 'CLAUDE.md Quality',
            points: 0,
            maxPoints: 20,
            checks: [{
                name: 'CLAUDE.md exists',
                status: 'fail',
                points: 0,
                maxPoints: 20,
                message: 'No CLAUDE.md found at project root',
            }],
        };
    }

    // Check 1: Quick Start with numbered rules (5 pts)
    {
        const hasHeading = /^#{1,3}\s.*quick\s*start/im.test(content);
        const numberedRules = (content.match(/^\d+\.\s/gm) || []).length;
        let status, points, message;

        if (hasHeading && numberedRules >= 3) {
            status = 'pass';
            points = 5;
            message = `Quick Start section found with ${numberedRules} numbered rules`;
        } else if (hasHeading) {
            status = 'warn';
            points = 2;
            message = `Quick Start heading found but only ${numberedRules} numbered rules (need 3+)`;
        } else {
            status = 'fail';
            points = 0;
            message = 'No Quick Start section with numbered rules found';
        }

        checks.push({ name: 'Quick Start with numbered rules', status, points, maxPoints: 5, message });
    }

    // Check 2: About Me with role context (3 pts)
    {
        const hasAbout = /^#{1,3}\s.*(about\s*me|who\s*(am\s*i|i\s*am)|role|context)/im.test(content);
        checks.push({
            name: 'About Me with role context',
            status: hasAbout ? 'pass' : 'fail',
            points: hasAbout ? 3 : 0,
            maxPoints: 3,
            message: hasAbout
                ? 'Role/context section found'
                : 'No About Me / role context section found — add one so the AI knows who you are',
        });
    }

    // Check 3: Profession-specific rules (5 pts)
    {
        const found = DOMAIN_PATTERNS.filter(p =>
            new RegExp(p, p === p.toUpperCase() ? '' : 'i').test(content)
        );
        let status, points;
        if (found.length >= 2) {
            status = 'pass';
            points = 5;
        } else if (found.length === 1) {
            status = 'warn';
            points = 2;
        } else {
            status = 'fail';
            points = 0;
        }
        checks.push({
            name: 'Profession-specific rules',
            status,
            points,
            maxPoints: 5,
            message: found.length > 0
                ? `${found.length} domain pattern(s) found: ${found.join(', ')}`
                : 'No profession-specific patterns detected — add domain rules (e.g., API conventions, compliance, workflows)',
        });
    }

    // Check 4: Gotchas section (3 pts)
    {
        const hasGotchaHeading = /^#{1,3}\s.*(gotcha|pitfall|avoid|mistake|warning)/im.test(content);
        const hasNeverAlways = /\b(never|always)\b/gi.test(content);
        let status, points, message;

        if (hasGotchaHeading) {
            status = 'pass';
            points = 3;
            message = 'Gotchas/pitfalls section found';
        } else if (hasNeverAlways) {
            status = 'warn';
            points = 1;
            message = 'No explicit Gotchas section, but never/always rules detected inline';
        } else {
            status = 'fail';
            points = 0;
            message = 'No gotchas or pitfall warnings found — add common mistakes to avoid';
        }

        checks.push({ name: 'Gotchas section', status, points, maxPoints: 3, message });
    }

    // Check 5: Project structure with folder tree (2 pts)
    {
        const hasTreeChars = /[├└│─]/.test(content);
        const hasTablePaths = /\|.*(?:src\/|lib\/|api\/)/.test(content);
        const indentedPaths = (content.match(/^\s{2,}[\w./-]+\/[\w./-]+/gm) || []).length;
        const hasStructure = hasTreeChars || hasTablePaths || indentedPaths >= 3;

        checks.push({
            name: 'Project structure with folder tree',
            status: hasStructure ? 'pass' : 'fail',
            points: hasStructure ? 2 : 0,
            maxPoints: 2,
            message: hasStructure
                ? 'Project structure documentation found'
                : 'No folder tree or project structure found — add a visual directory layout',
        });
    }

    // Check 6: Appropriate length 2K-6K chars (2 pts)
    {
        const len = content.length;
        const inRange = len >= 2000 && len <= 6000;
        checks.push({
            name: 'Appropriate length (2K-6K chars)',
            status: inRange ? 'pass' : 'warn',
            points: inRange ? 2 : 1,
            maxPoints: 2,
            message: `CLAUDE.md is ${len.toLocaleString()} characters${inRange ? '' : len < 2000 ? ' — consider adding more detail' : ' — consider splitting into linked files'}`,
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'CLAUDE.md Quality',
        points: totalPoints,
        maxPoints: 20,
        checks,
    };
}
