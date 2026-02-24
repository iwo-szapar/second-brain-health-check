/**
 * Setup Layer: CLAUDE.md Quality
 *
 * Evaluates the quality and completeness of the CLAUDE.md file,
 * checking for quick start rules, role context, profession-specific
 * patterns, gotchas, project structure, and appropriate length.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Resolve @filename imports in CLAUDE.md content.
 * Reads referenced files and appends their content for analysis.
 * Only follows one level of imports to avoid cycles.
 */
async function resolveImports(rootPath, content) {
    const importPattern = /@([\w./\-]+\.(?:md|txt))/g;
    const seen = new Set();
    const importedFiles = [];
    const extra = [];
    let match;

    while ((match = importPattern.exec(content)) !== null) {
        const importPath = match[1];
        if (seen.has(importPath)) continue;
        seen.add(importPath);
        try {
            const importedContent = await readFile(join(rootPath, importPath), 'utf-8');
            extra.push(importedContent);
            importedFiles.push(importPath);
        } catch {
            // File not found or unreadable — skip silently
        }
    }

    return {
        combined: extra.length > 0 ? content + '\n' + extra.join('\n') : content,
        importedFiles,
    };
}

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

    // Resolve @-imported files so content checks scan the full effective context
    const { combined, importedFiles } = await resolveImports(rootPath, content);

    // Check 1: Quick Start with numbered rules (5 pts)
    {
        const hasHeading = /^#{1,3}\s.*quick\s*start/im.test(combined);
        const numberedRules = (combined.match(/^\d+\.\s/gm) || []).length;
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
        const hasAbout = /^#{1,3}\s.*(about\s*me|who\s*(am\s*i|i\s*am)|role|context)/im.test(combined);
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
            new RegExp(p, p === p.toUpperCase() ? '' : 'i').test(combined)
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
        const hasGotchaHeading = /^#{1,3}\s.*(gotcha|pitfall|avoid|mistake|warning)/im.test(combined);
        const hasNeverAlways = /\b(never|always)\b/gi.test(combined);
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
        const hasTreeChars = /[├└│─]/.test(combined);
        const hasTablePaths = /\|.*(?:src\/|lib\/|api\/)/.test(combined);
        const indentedPaths = (combined.match(/^\s{2,}[\w./-]+\/[\w./-]+/gm) || []).length;
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
    // Length is measured on CLAUDE.md itself — @-imported files provide additional context
    {
        const len = content.length;
        const inRange = len >= 2000 && len <= 6000;
        const importSuffix = importedFiles.length > 0
            ? ` (+ ${importedFiles.length} imported file${importedFiles.length > 1 ? 's' : ''}: ${importedFiles.join(', ')})`
            : '';
        checks.push({
            name: 'Appropriate length (2K-6K chars)',
            status: inRange ? 'pass' : 'warn',
            points: inRange ? 2 : 1,
            maxPoints: 2,
            message: `CLAUDE.md is ${len.toLocaleString()} characters${importSuffix}${inRange ? '' : len < 2000 ? ' — consider adding more detail' : ' — consider splitting into linked files'}`,
        });
    }

    // Check 7: CLAUDE.md freshness (3 pts)
    {
        let status, points, message;
        try {
            const s = await stat(join(rootPath, 'CLAUDE.md'));
            const daysSinceModified = (Date.now() - s.mtimeMs) / (1000 * 60 * 60 * 24);

            if (daysSinceModified <= 14) {
                status = 'pass'; points = 3;
                message = `CLAUDE.md modified ${Math.floor(daysSinceModified)} day(s) ago — actively maintained`;
            } else if (daysSinceModified <= 30) {
                status = 'warn'; points = 2;
                message = `CLAUDE.md last modified ${Math.floor(daysSinceModified)} days ago — review for staleness`;
            } else {
                status = 'warn'; points = 1;
                message = `CLAUDE.md last modified ${Math.floor(daysSinceModified)} days ago — likely contains outdated instructions`;
            }
        } catch {
            status = 'warn'; points = 1;
            message = 'Could not determine CLAUDE.md modification date';
        }
        checks.push({ name: 'CLAUDE.md freshness', status, points, maxPoints: 3, message });
    }

    // Check 8: Hierarchical context files (3 pts)
    // Subdirectory CLAUDE.md or TODO.md files = advanced layered context architecture
    {
        const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__']);
        const rootClaudeMd = join(rootPath, 'CLAUDE.md');
        const subContextFiles = [];

        async function findSubContextFiles(dir, depth) {
            if (depth > 4) return;
            let entries;
            try { entries = await readdir(dir); } catch { return; }
            for (const entry of entries) {
                if (entry.startsWith('.') && entry !== '.claude') continue;
                if (SKIP_DIRS.has(entry)) continue;
                const fullPath = join(dir, entry);
                try {
                    const s = await stat(fullPath);
                    if (s.isFile() && (entry === 'CLAUDE.md' || entry === 'TODO.md') && fullPath !== rootClaudeMd) {
                        subContextFiles.push(fullPath);
                    } else if (s.isDirectory()) {
                        await findSubContextFiles(fullPath, depth + 1);
                    }
                } catch { continue; }
            }
        }

        await findSubContextFiles(rootPath, 0);

        let status, points, message;
        if (subContextFiles.length >= 3) {
            status = 'pass'; points = 3;
            message = `${subContextFiles.length} subdirectory CLAUDE.md/TODO.md files — hierarchical per-project context layering`;
        } else if (subContextFiles.length >= 1) {
            status = 'warn'; points = 2;
            message = `${subContextFiles.length} subdirectory context file(s) — consider adding CLAUDE.md files in each major project subfolder`;
        } else {
            status = 'fail'; points = 0;
            message = 'Only root CLAUDE.md — consider per-directory CLAUDE.md or TODO.md files for project-specific context';
        }
        checks.push({ name: 'Hierarchical context files', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'CLAUDE.md Quality',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
