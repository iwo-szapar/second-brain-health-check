/**
 * Fluency Layer: Reference Integrity
 *
 * Verifies that file paths and cross-references in CLAUDE.md and skills
 * actually resolve to real files on disk. Broken references mean the
 * brain is telling Claude to look at things that don't exist.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Match file paths in various formats
const PATH_PATTERNS = [
    /`([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5})`/g,                    // backtick-wrapped paths
    /\|\s*`?([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5})`?\s*\|/g,        // table cell paths
    /(?:read|see|check|refer to|documented in)\s+`?([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5})`?/gi,
];

const DIR_PATTERNS = [
    /`([a-zA-Z0-9_./-]+\/)`/g,
    /\|\s*`?([a-zA-Z0-9_./-]+\/)`?\s*\|/g,
];

const EXCLUDE_PATTERNS = [
    /^https?:\/\//,
    /^[A-Z_]+\./,          // ENV_VAR.something
    /^\d+\.\d+/,           // version numbers
    /^node_modules\//,
    /example\./i,
    /\.com$|\.org$|\.io$/,
    /^[a-z]+\.[a-z]+$/,    // bare module names like "process.env"
    /^src\//,               // source code paths (not brain content)
    /^lib\//,               // library paths
    /^api\//,               // API endpoint paths
    /^packages\//,          // monorepo package paths
    /^supabase\//,          // migration paths
    /^scripts\//,           // script paths
    /^tests?\//,            // test paths
    /^public\//,            // static asset paths
    /^dist\//,              // build output paths
    /^\.github\//,          // CI config paths
    /^integrations\//,      // integration paths
    /^[^/]+\.sh$/,          // bare script names without path (hook references)
    /^[^/]+\.py$/,          // bare Python script names
];

// Stricter path patterns for skills — only match references to documentation-like files
// that a skill might point Claude to read
const SKILL_PATH_PATTERNS = [
    /`((?:docs|memory|\.claude|content|product|growth|plans|brain-health)\/[a-zA-Z0-9_./-]+\.(?:md|json|txt))`/g,
    /\|\s*`?((?:docs|memory|\.claude|content|product|growth|plans|brain-health)\/[a-zA-Z0-9_./-]+\.(?:md|json|txt))`?\s*\|/g,
    /(?:read|see|check|refer to|documented in)\s+`?((?:docs|memory|\.claude|content|product|growth|plans|brain-health)\/[a-zA-Z0-9_./-]+\.(?:md|json|txt))`?/gi,
];

function extractPaths(content) {
    const paths = new Set();

    for (const pattern of PATH_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
            const p = match[1];
            if (p && !EXCLUDE_PATTERNS.some(ex => ex.test(p))) {
                paths.add(p);
            }
        }
    }

    for (const pattern of DIR_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
            const p = match[1];
            if (p && !EXCLUDE_PATTERNS.some(ex => ex.test(p))) {
                paths.add(p);
            }
        }
    }

    return [...paths];
}

function extractPathsStrict(content) {
    const paths = new Set();
    for (const pattern of SKILL_PATH_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
            const p = match[1];
            if (p && !EXCLUDE_PATTERNS.some(ex => ex.test(p))) {
                paths.add(p);
            }
        }
    }
    return [...paths];
}

async function pathExists(fullPath) {
    try {
        await stat(fullPath);
        return true;
    } catch {
        return false;
    }
}

export async function checkReferenceIntegrity(rootPath) {
    const checks = [];

    // Check 1: CLAUDE.md references resolve (5 pts)
    {
        let claudeMdContent = '';
        const claudeMdPaths = [
            join(rootPath, 'CLAUDE.md'),
            join(rootPath, '.claude', 'CLAUDE.md'),
        ];

        for (const p of claudeMdPaths) {
            try {
                claudeMdContent = await readFile(p, 'utf-8');
                break;
            } catch {
                continue;
            }
        }

        if (!claudeMdContent) {
            checks.push({
                name: 'CLAUDE.md references resolve',
                status: 'fail', points: 0, maxPoints: 5,
                message: 'No CLAUDE.md found to check references',
            });
        } else {
            const refs = extractPaths(claudeMdContent);

            if (refs.length === 0) {
                checks.push({
                    name: 'CLAUDE.md references resolve',
                    status: 'warn', points: 2, maxPoints: 5,
                    message: 'No file references detected in CLAUDE.md — consider adding links to key docs',
                });
            } else {
                const broken = [];
                const resolved = [];

                for (const ref of refs) {
                    const fullPath = resolve(rootPath, ref);
                    if (await pathExists(fullPath)) {
                        resolved.push(ref);
                    } else {
                        broken.push(ref);
                    }
                }

                let status, points, message;
                if (broken.length === 0) {
                    status = 'pass'; points = 5;
                    message = `All ${refs.length} file references in CLAUDE.md resolve to real paths`;
                } else if (broken.length <= 3) {
                    status = 'warn'; points = 3;
                    message = `${broken.length}/${refs.length} broken references: ${broken.slice(0, 3).join(', ')}`;
                } else {
                    status = 'fail'; points = 1;
                    message = `${broken.length}/${refs.length} references are broken: ${broken.slice(0, 3).join(', ')} — Claude will waste tokens looking for these`;
                }
                checks.push({ name: 'CLAUDE.md references resolve', status, points, maxPoints: 5, message });
            }
        }
    }

    // Check 2: Skill references resolve (5 pts)
    {
        const skillsDir = join(rootPath, '.claude', 'skills');
        let skillContents = [];

        try {
            const entries = await readdir(skillsDir, { recursive: true });
            for (const entry of entries) {
                if (!entry.endsWith('.md')) continue;
                try {
                    const content = await readFile(join(skillsDir, entry), 'utf-8');
                    skillContents.push({ name: entry, content });
                } catch {
                    continue;
                }
            }
        } catch {
            // no skills dir
        }

        if (skillContents.length === 0) {
            checks.push({
                name: 'Skill references resolve',
                status: 'warn', points: 2, maxPoints: 5,
                message: 'No skills found to check references',
            });
        } else {
            let totalRefs = 0;
            let brokenRefs = 0;
            const brokenExamples = [];

            for (const skill of skillContents) {
                const refs = extractPathsStrict(skill.content);
                for (const ref of refs) {
                    totalRefs++;
                    const fullPath = resolve(rootPath, ref);
                    if (!(await pathExists(fullPath))) {
                        brokenRefs++;
                        if (brokenExamples.length < 3) {
                            brokenExamples.push(`${ref} (in ${skill.name})`);
                        }
                    }
                }
            }

            let status, points, message;
            if (totalRefs === 0) {
                status = 'pass'; points = 4;
                message = `${skillContents.length} skills checked — no file path references found`;
            } else if (brokenRefs === 0) {
                status = 'pass'; points = 5;
                message = `All ${totalRefs} file references across ${skillContents.length} skills resolve`;
            } else if (brokenRefs <= 3) {
                status = 'warn'; points = 3;
                message = `${brokenRefs}/${totalRefs} broken skill references: ${brokenExamples.join('; ')}`;
            } else {
                status = 'fail'; points = 1;
                message = `${brokenRefs}/${totalRefs} skill references broken — skills point to files that don't exist`;
            }
            checks.push({ name: 'Skill references resolve', status, points, maxPoints: 5, message });
        }
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Reference Integrity',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
