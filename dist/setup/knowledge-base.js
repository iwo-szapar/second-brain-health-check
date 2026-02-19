/**
 * Setup Layer: Knowledge Base Architecture
 *
 * Evaluates whether the workspace has a structured knowledge base
 * for pre-engineering Claude's context: .claude/docs/, .claude/knowledge/,
 * or similar directories with domain reference files that Claude reads
 * before working in specific areas.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const KNOWLEDGE_DIR_CANDIDATES = [
    ['.claude', 'docs'],
    ['.claude', 'knowledge'],
    ['.claude', 'context'],
    ['.claude', 'reference'],
];

async function findKnowledgeDir(rootPath) {
    for (const parts of KNOWLEDGE_DIR_CANDIDATES) {
        const dirPath = join(rootPath, ...parts);
        try {
            const s = await stat(dirPath);
            if (s.isDirectory()) return dirPath;
        } catch { continue; }
    }
    return null;
}

async function countFilesRecursive(dirPath, maxDepth, depth = 0) {
    if (depth > maxDepth) return { files: 0, dirs: 0 };
    let files = 0, dirs = 0;
    try {
        const entries = await readdir(dirPath);
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            const fullPath = join(dirPath, entry);
            try {
                const s = await stat(fullPath);
                if (s.isFile() && (entry.endsWith('.md') || entry.endsWith('.txt'))) {
                    files++;
                } else if (s.isDirectory()) {
                    dirs++;
                    const sub = await countFilesRecursive(fullPath, maxDepth, depth + 1);
                    files += sub.files;
                    dirs += sub.dirs;
                }
            } catch { continue; }
        }
    } catch { /* empty */ }
    return { files, dirs };
}

export async function checkKnowledgeBase(rootPath) {
    const checks = [];
    const knowledgeDir = await findKnowledgeDir(rootPath);

    // Check 1: Knowledge directory with reference content (4 pts)
    {
        if (!knowledgeDir) {
            checks.push({
                name: 'Knowledge base directory',
                status: 'fail', points: 0, maxPoints: 4,
                message: 'No .claude/docs/ or .claude/knowledge/ found — create a knowledge base so Claude can pre-load domain context per task area',
            });
        } else {
            const { files, dirs } = await countFilesRecursive(knowledgeDir, 3);
            const dirLabel = knowledgeDir.replace(rootPath, '').replace(/^\//, '');
            let status, points;
            if (files >= 10) {
                status = 'pass'; points = 4;
            } else if (files >= 5) {
                status = 'pass'; points = 3;
            } else if (files >= 2) {
                status = 'warn'; points = 2;
            } else if (files >= 1) {
                status = 'warn'; points = 1;
            } else {
                status = 'fail'; points = 0;
            }
            checks.push({
                name: 'Knowledge base directory',
                status, points, maxPoints: 4,
                message: `${files} reference file(s) in ${dirLabel}/ — ${dirs > 0 ? `organized into ${dirs} topic area(s)` : 'flat structure'}`,
            });
        }
    }

    // Check 2: CLAUDE.md cross-references knowledge files (3 pts)
    // The pattern: "Read this file when working on X" — files written FOR Claude
    {
        let claudeMdContent = '';
        try {
            claudeMdContent = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
        } catch { /* no CLAUDE.md */ }

        const knowledgeDirName = knowledgeDir ? knowledgeDir.replace(rootPath + '/', '') : '';
        const hasExplicitRef = knowledgeDirName.length > 0 && claudeMdContent.includes(knowledgeDirName);
        const hasReadWhenPattern = /read\s+(this|these)\s+when|when\s+working\s+(in|on)|see\s+also:/i.test(claudeMdContent);
        const hasFileTable = /\|\s*(area|when|file|functionality)\s*\|/i.test(claudeMdContent);

        let status, points, message;
        if (hasExplicitRef) {
            status = 'pass'; points = 3;
            message = 'CLAUDE.md references knowledge base by path — Claude loads domain context before working';
        } else if (hasReadWhenPattern || hasFileTable) {
            status = 'warn'; points = 2;
            message = 'CLAUDE.md has "read when" guidance or file tables — add explicit knowledge directory references';
        } else if (claudeMdContent.length > 0) {
            status = 'warn'; points = 1;
            message = 'CLAUDE.md exists but does not point to knowledge files — add "Read this file when working on X" references';
        } else {
            status = 'fail'; points = 0;
            message = 'No CLAUDE.md to cross-reference knowledge base';
        }
        checks.push({ name: 'CLAUDE.md references knowledge files', status, points, maxPoints: 3, message });
    }

    // Check 3: Knowledge domain breadth (3 pts)
    // Multiple topic areas = pre-engineered context across the full workflow
    {
        if (!knowledgeDir) {
            checks.push({
                name: 'Knowledge domain breadth',
                status: 'fail', points: 0, maxPoints: 3,
                message: 'No knowledge directory to evaluate',
            });
        } else {
            const { files, dirs } = await countFilesRecursive(knowledgeDir, 2);
            let status, points, message;
            if (dirs >= 5 || files >= 15) {
                status = 'pass'; points = 3;
                message = `${dirs} knowledge domains, ${files} reference files — comprehensive pre-session context architecture`;
            } else if (dirs >= 2 || files >= 5) {
                status = 'warn'; points = 2;
                message = `${dirs > 0 ? dirs + ' topic area(s)' : files + ' reference file(s)'} — expand with more domain-specific knowledge folders`;
            } else {
                status = 'warn'; points = 1;
                message = 'Knowledge base is small — add domain-specific reference guides for each major workflow area';
            }
            checks.push({ name: 'Knowledge domain breadth', status, points, maxPoints: 3, message });
        }
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Knowledge Base Architecture',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
