/**
 * Usage Layer: Memory Evolution
 *
 * Checks whether memory files are actively evolving over time,
 * not just created once and abandoned. Measures file modification
 * rates, auto-memory population, and overall memory growth.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Recursively collect file stats from a directory.
 */
async function collectFileStats(dir, depth = 0, maxDepth = 3, maxEntries = 500) {
    const files = [];
    if (depth > maxDepth) return files;

    let entries;
    try {
        entries = await readdir(dir);
    } catch {
        return files;
    }

    for (const entry of entries.slice(0, maxEntries)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
                const sub = await collectFileStats(fullPath, depth + 1, maxDepth, maxEntries);
                files.push(...sub);
            } else if (entry.endsWith('.md')) {
                files.push({ path: fullPath, stat: s });
            }
        } catch {
            continue;
        }
    }

    return files;
}

/**
 * Find the oldest file birthtime in a directory tree.
 */
async function getOldestBirthtime(rootPath) {
    let oldest = Infinity;
    let entries;
    try {
        entries = await readdir(rootPath);
    } catch {
        return null;
    }

    for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        try {
            const s = await stat(join(rootPath, entry));
            if (s.birthtimeMs < oldest) {
                oldest = s.birthtimeMs;
            }
        } catch {
            continue;
        }
    }

    return oldest === Infinity ? null : oldest;
}

/**
 * Try to read MEMORY.md from multiple candidate paths.
 */
async function readMemoryMd(rootPath) {
    const candidates = [
        join(rootPath, 'memory', 'MEMORY.md'),
        join(rootPath, 'MEMORY.md'),
        join(rootPath, 'memory', 'memory.md'),
        join(rootPath, 'memory', 'Memory.md'),
    ];

    for (const path of candidates) {
        try {
            return await readFile(path, 'utf-8');
        } catch {
            continue;
        }
    }
    return null;
}

export async function checkMemoryEvolution(rootPath) {
    const checks = [];
    const memoryDir = join(rootPath, 'memory');

    // Check 1: Memory files evolving (8 pts)
    {
        let status, points, message;
        const oldestBirth = await getOldestBirthtime(memoryDir);

        if (oldestBirth === null) {
            status = 'fail'; points = 0;
            message = 'No memory/ directory found';
        } else {
            const files = await collectFileStats(memoryDir);
            const oneDayMs = 24 * 60 * 60 * 1000;
            const cutoff = oldestBirth + oneDayMs;
            const modifiedFiles = files.filter(f => f.stat.mtimeMs > cutoff);
            const total = files.length;
            const modifiedCount = modifiedFiles.length;
            const ratio = total > 0 ? modifiedCount / total : 0;

            if (ratio >= 0.3) {
                status = 'pass'; points = 8;
                message = `${modifiedCount}/${total} memory files modified after initial setup (${(ratio * 100).toFixed(0)}%)`;
            } else if (modifiedCount > 0) {
                status = 'warn'; points = 4;
                message = `${modifiedCount}/${total} files modified (${(ratio * 100).toFixed(0)}%) — aim for 30%+ evolving`;
            } else {
                status = 'fail'; points = 0;
                message = total > 0
                    ? `${total} memory files but none modified after setup — brain is static`
                    : 'No markdown files in memory/';
            }
        }
        checks.push({ name: 'Memory files evolving', status, points, maxPoints: 8, message });
    }

    // Check 2: Auto memory populated (6 pts)
    {
        let status, points, message;
        const content = await readMemoryMd(rootPath);

        if (content === null) {
            status = 'fail'; points = 0;
            message = 'No MEMORY.md found in memory/ or project root';
        } else {
            const lineCount = content.split('\n').filter(l => l.trim().length > 0).length;

            if (lineCount >= 10) {
                status = 'pass'; points = 6;
                message = `MEMORY.md has ${lineCount} non-empty lines of accumulated knowledge`;
            } else if (lineCount >= 3) {
                status = 'warn'; points = 3;
                message = `MEMORY.md has ${lineCount} lines — keep building auto-memory`;
            } else {
                status = 'fail'; points = 0;
                message = `MEMORY.md has only ${lineCount} line(s) — barely populated`;
            }
        }
        checks.push({ name: 'Auto memory populated', status, points, maxPoints: 6, message });
    }

    // Check 3: Memory growth (6 pts)
    {
        let status, points, message;
        const files = await collectFileStats(memoryDir);
        const fileCount = files.length;

        if (fileCount >= 10) {
            status = 'pass'; points = 6;
            message = `${fileCount} markdown files in memory/ — healthy knowledge base`;
        } else if (fileCount >= 5) {
            status = 'warn'; points = 3;
            message = `${fileCount} memory files — aim for 10+ as your brain grows`;
        } else if (fileCount >= 1) {
            status = 'warn'; points = 1;
            message = `Only ${fileCount} memory file(s) — brain is just getting started`;
        } else {
            status = 'fail'; points = 0;
            message = 'No markdown files found in memory/';
        }
        checks.push({ name: 'Memory growth', status, points, maxPoints: 6, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Memory Evolution',
        points: totalPoints,
        maxPoints: 20,
        checks,
    };
}
