/**
 * Usage Layer: Memory Evolution
 *
 * Checks whether memory is actively growing and being connected.
 * Branches on backend:
 * - supabase: Growth rate, embedding coverage, link density
 * - filesystem: File modification rates, MEMORY.md, file count
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getMemoryOSStats } from '../utils/memoryos-stats.js';

async function collectFileStats(dir, depth = 0, maxDepth = 3, maxEntries = 500) {
    const files = [];
    if (depth > maxDepth) return files;
    let entries;
    try { entries = await readdir(dir); } catch { return files; }
    for (const entry of entries.slice(0, maxEntries)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) files.push(...await collectFileStats(fullPath, depth + 1, maxDepth, maxEntries));
            else if (entry.endsWith('.md')) files.push({ path: fullPath, stat: s });
        } catch { continue; }
    }
    return files;
}

async function getOldestBirthtime(rootPath) {
    let oldest = Infinity;
    let entries;
    try { entries = await readdir(rootPath); } catch { return null; }
    for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        try { const s = await stat(join(rootPath, entry)); if (s.birthtimeMs < oldest) oldest = s.birthtimeMs; }
        catch { continue; }
    }
    return oldest === Infinity ? null : oldest;
}

async function readMemoryMd(rootPath) {
    const candidates = [
        join(rootPath, 'memory', 'MEMORY.md'), join(rootPath, 'MEMORY.md'),
        join(rootPath, 'memory', 'memory.md'), join(rootPath, 'memory', 'Memory.md'),
    ];
    for (const path of candidates) {
        try { return await readFile(path, 'utf-8'); } catch { continue; }
    }
    return null;
}

/**
 * SQL-backed memory evolution checks.
 */
async function checkMemoryEvolutionSQL(stats) {
    const checks = [];

    // Check 1: Growth rate (8 pts)
    {
        const { addedLast30d, addedLast7d, total } = stats;
        const monthlyRate = addedLast30d;
        let status, points, message;
        if (monthlyRate >= 3) {
            status = 'pass'; points = 8;
            message = `${addedLast30d} items added this month, ${addedLast7d} this week (${total} total)`;
        } else if (monthlyRate >= 1) {
            status = 'warn'; points = 4;
            message = `${monthlyRate} item(s) added this month — aim for 3+/month for healthy growth`;
        } else {
            status = 'fail'; points = 0;
            message = total > 0
                ? `${total} items in database but none added this month — brain is stagnating`
                : 'No knowledge items found';
        }
        checks.push({ name: 'Knowledge growth rate', status, points, maxPoints: 8, message });
    }

    // Check 2: Embedding coverage (6 pts)
    // Exclude items < 7 days old from penalty (they may not have been backfilled yet)
    {
        const { embeddingCount, total, addedLast7d } = stats;
        const eligibleTotal = Math.max(total - addedLast7d, 0);
        const coverage = eligibleTotal > 0 ? embeddingCount / eligibleTotal : (total === 0 ? 0 : 1);
        const pct = Math.round(coverage * 100);

        let status, points, message;
        if (eligibleTotal === 0) {
            // All items are < 7 days old — give full credit
            status = 'pass'; points = 6;
            message = `All ${total} items are less than 7 days old — embedding backfill not yet expected`;
        } else if (coverage >= 0.6) {
            status = 'pass'; points = 6;
            message = `${embeddingCount}/${eligibleTotal} eligible items have embeddings (${pct}%) — semantic search active`;
        } else if (coverage >= 0.3) {
            status = 'warn'; points = 3;
            message = `${pct}% embedding coverage (${embeddingCount}/${eligibleTotal}) — run backfill-embeddings to improve semantic search`;
        } else {
            status = 'fail'; points = 0;
            message = `${pct}% embedding coverage — run \`node scripts/backfill-embeddings.mjs\` to enable semantic search`;
        }
        checks.push({ name: 'Embedding coverage', status, points, maxPoints: 6, message });
    }

    // Check 3: Link density (6 pts)
    // Only score if brain is > 60 days old and has 50+ items
    {
        const { linkCount, linksPerItem, total, brainAgeDays } = stats;
        let status, points, message;

        if (total < 50 || brainAgeDays < 60) {
            // Too young/small to penalize for low link density
            if (linkCount > 0) {
                status = 'pass'; points = 6;
                message = `${linkCount} knowledge links (${linksPerItem.toFixed(2)}/item) — good start for a ${brainAgeDays}-day-old brain`;
            } else {
                status = 'warn'; points = 3;
                message = `Brain is ${brainAgeDays} days old with ${total} items — links will become important as knowledge grows. Run /link suggest`;
            }
        } else {
            if (linksPerItem >= 0.1) {
                status = 'pass'; points = 6;
                message = `${linkCount} links across ${total} items (${linksPerItem.toFixed(2)}/item) — knowledge graph is connected`;
            } else if (linksPerItem >= 0.02) {
                status = 'warn'; points = 3;
                message = `${linkCount} links for ${total} items (${linksPerItem.toFixed(2)}/item) — run /link suggest to connect related knowledge`;
            } else {
                status = 'fail'; points = 0;
                message = `${linkCount} links for ${total} items — knowledge is isolated. Run /link suggest to build connections`;
            }
        }
        checks.push({ name: 'Knowledge link density', status, points, maxPoints: 6, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Memory Evolution', points: totalPoints, maxPoints: 20, checks };
}

/**
 * Original filesystem-based memory evolution checks.
 */
async function checkMemoryEvolutionFilesystem(rootPath) {
    const checks = [];
    const memoryDir = join(rootPath, 'memory');

    // Check 1: Memory files evolving (8 pts)
    {
        let status, points, message;
        const oldestBirth = await getOldestBirthtime(memoryDir);
        if (oldestBirth === null) { status = 'fail'; points = 0; message = 'No memory/ directory found'; }
        else {
            const files = await collectFileStats(memoryDir);
            const cutoff = oldestBirth + 24 * 60 * 60 * 1000;
            const modifiedCount = files.filter(f => f.stat.mtimeMs > cutoff).length;
            const total = files.length;
            const ratio = total > 0 ? modifiedCount / total : 0;
            if (ratio >= 0.3) { status = 'pass'; points = 8; message = `${modifiedCount}/${total} memory files modified after initial setup (${(ratio * 100).toFixed(0)}%)`; }
            else if (modifiedCount > 0) { status = 'warn'; points = 4; message = `${modifiedCount}/${total} files modified (${(ratio * 100).toFixed(0)}%) — aim for 30%+ evolving`; }
            else { status = 'fail'; points = 0; message = total > 0 ? `${total} memory files but none modified after setup — brain is static` : 'No markdown files in memory/'; }
        }
        checks.push({ name: 'Memory files evolving', status, points, maxPoints: 8, message });
    }

    // Check 2: Auto memory populated (6 pts)
    {
        const content = await readMemoryMd(rootPath);
        let status, points, message;
        if (content === null) { status = 'fail'; points = 0; message = 'No MEMORY.md found in memory/ or project root'; }
        else {
            const lineCount = content.split('\n').filter(l => l.trim().length > 0).length;
            if (lineCount >= 10) { status = 'pass'; points = 6; message = `MEMORY.md has ${lineCount} non-empty lines of accumulated knowledge`; }
            else if (lineCount >= 3) { status = 'warn'; points = 3; message = `MEMORY.md has ${lineCount} lines — keep building auto-memory`; }
            else { status = 'fail'; points = 0; message = `MEMORY.md has only ${lineCount} line(s) — barely populated`; }
        }
        checks.push({ name: 'Auto memory populated', status, points, maxPoints: 6, message });
    }

    // Check 3: Memory growth (6 pts)
    {
        const files = await collectFileStats(memoryDir);
        const fileCount = files.length;
        let status, points;
        if (fileCount >= 10) { status = 'pass'; points = 6; }
        else if (fileCount >= 5) { status = 'warn'; points = 3; }
        else if (fileCount >= 1) { status = 'warn'; points = 1; }
        else { status = 'fail'; points = 0; }
        checks.push({ name: 'Memory growth', status, points, maxPoints: 6,
            message: fileCount > 0 ? `${fileCount} markdown files in memory/ — healthy knowledge base` : 'No markdown files found in memory/' });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Memory Evolution', points: totalPoints, maxPoints: 20, checks };
}

export async function checkMemoryEvolution(rootPath) {
    const stats = await getMemoryOSStats(rootPath);
    if (stats) return checkMemoryEvolutionSQL(stats);
    return checkMemoryEvolutionFilesystem(rootPath);
}
