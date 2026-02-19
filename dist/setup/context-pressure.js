/**
 * Setup Layer: Context Pressure
 *
 * Checks whether the brain's context surface is lean or bloated.
 * Measures CLAUDE.md size, knowledge file distribution, total context
 * surface area, and progressive disclosure evidence.
 *
 * Traffic light zones:
 *   GREEN  (<30KB total context surface)
 *   YELLOW (30-75KB)
 *   RED    (75KB+)
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function getFileSizesSafe(dirPath, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth) return 0;
    let totalBytes = 0;
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const limited = entries.slice(0, 200);
        for (const entry of limited) {
            const fullPath = join(dirPath, entry.name);
            if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.json'))) {
                try {
                    const s = await stat(fullPath);
                    totalBytes += s.size;
                } catch { /* skip */ }
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                totalBytes += await getFileSizesSafe(fullPath, maxDepth, currentDepth + 1);
            }
        }
    } catch { /* dir doesn't exist */ }
    return totalBytes;
}

export async function checkContextPressure(rootPath) {
    const checks = [];
    let totalPoints = 0;
    const maxPoints = 10;

    // Check 1: CLAUDE.md not bloated (<6000 chars = good, >10000 = bloated)
    let claudeMdSize = 0;
    let claudeMdContent = '';
    try {
        claudeMdContent = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
        claudeMdSize = claudeMdContent.length;
    } catch { /* no CLAUDE.md */ }

    if (claudeMdSize === 0) {
        checks.push({
            name: 'CLAUDE.md size',
            status: 'fail',
            message: 'No CLAUDE.md found. Create one to give your AI context.',
            points: 0,
            maxPoints: 3,
        });
    } else if (claudeMdSize <= 6000) {
        checks.push({
            name: 'CLAUDE.md size',
            status: 'pass',
            message: `CLAUDE.md is ${claudeMdSize} chars — lean and focused.`,
            points: 3,
            maxPoints: 3,
        });
        totalPoints += 3;
    } else if (claudeMdSize <= 10000) {
        checks.push({
            name: 'CLAUDE.md size',
            status: 'warn',
            message: `CLAUDE.md is ${claudeMdSize} chars — getting long. Consider moving details to .claude/docs/.`,
            points: 1,
            maxPoints: 3,
        });
        totalPoints += 1;
    } else {
        checks.push({
            name: 'CLAUDE.md size',
            status: 'fail',
            message: `CLAUDE.md is ${claudeMdSize} chars — bloated. Move domain knowledge to .claude/docs/ or .claude/knowledge/.`,
            points: 0,
            maxPoints: 3,
        });
    }

    // Check 2: Knowledge files exist (not everything in CLAUDE.md)
    let hasKnowledgeFiles = false;
    let knowledgeFileCount = 0;
    for (const dir of ['.claude/docs', '.claude/knowledge']) {
        try {
            const entries = await readdir(join(rootPath, dir), { withFileTypes: true });
            const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'));
            if (mdFiles.length > 0) {
                hasKnowledgeFiles = true;
                knowledgeFileCount += mdFiles.length;
            }
        } catch { /* dir doesn't exist */ }
    }

    if (hasKnowledgeFiles) {
        checks.push({
            name: 'Knowledge file distribution',
            status: 'pass',
            message: `${knowledgeFileCount} knowledge files found — context is distributed, not crammed.`,
            points: 3,
            maxPoints: 3,
        });
        totalPoints += 3;
    } else {
        checks.push({
            name: 'Knowledge file distribution',
            status: claudeMdSize > 3000 ? 'warn' : 'fail',
            message: 'No knowledge files in .claude/docs/ or .claude/knowledge/. All context is in CLAUDE.md.',
            points: claudeMdSize > 3000 ? 1 : 0,
            maxPoints: 3,
        });
        if (claudeMdSize > 3000) totalPoints += 1;
    }

    // Check 3: Total context surface area
    let totalContextBytes = claudeMdSize;
    totalContextBytes += await getFileSizesSafe(join(rootPath, '.claude'), 3);
    const totalKB = Math.round(totalContextBytes / 1024);
    let zone;

    if (totalKB < 30) {
        zone = 'GREEN';
        checks.push({
            name: 'Context surface area',
            status: 'pass',
            message: `Total context: ${totalKB}KB (GREEN zone). Lean and efficient.`,
            points: 2,
            maxPoints: 2,
        });
        totalPoints += 2;
    } else if (totalKB < 75) {
        zone = 'YELLOW';
        checks.push({
            name: 'Context surface area',
            status: 'warn',
            message: `Total context: ${totalKB}KB (YELLOW zone). Getting heavy — consider pruning stale docs.`,
            points: 1,
            maxPoints: 2,
        });
        totalPoints += 1;
    } else {
        zone = 'RED';
        checks.push({
            name: 'Context surface area',
            status: 'fail',
            message: `Total context: ${totalKB}KB (RED zone). Too much context — Claude may struggle to prioritize. Archive unused docs.`,
            points: 0,
            maxPoints: 2,
        });
    }

    // Check 4: Progressive disclosure evidence (CLAUDE.md references external docs)
    const hasExternalRefs = /(?:Read|See|Refer to|Details in|Full docs:?)\s+[`"]?(?:\.claude\/|docs\/|memory\/|\.claude\/docs\/|\.claude\/knowledge\/)/im.test(claudeMdContent);
    if (hasExternalRefs) {
        checks.push({
            name: 'Progressive disclosure',
            status: 'pass',
            message: 'CLAUDE.md references external docs — progressive disclosure active.',
            points: 2,
            maxPoints: 2,
        });
        totalPoints += 2;
    } else if (claudeMdSize > 0) {
        checks.push({
            name: 'Progressive disclosure',
            status: claudeMdSize > 3000 ? 'warn' : 'fail',
            message: 'CLAUDE.md does not reference .claude/docs/ or knowledge files. Add "Read X before working on Y" pointers.',
            points: 0,
            maxPoints: 2,
        });
    } else {
        checks.push({
            name: 'Progressive disclosure',
            status: 'fail',
            message: 'No CLAUDE.md to evaluate for progressive disclosure.',
            points: 0,
            maxPoints: 2,
        });
    }

    return {
        name: 'Context Pressure',
        points: totalPoints,
        maxPoints,
        checks,
    };
}
