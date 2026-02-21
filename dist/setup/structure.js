/**
 * Setup Layer: Directory Structure
 *
 * Evaluates whether the project uses semantic directory naming,
 * has index files for navigation, and whether documented tree
 * structures in CLAUDE.md match the actual filesystem.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SEMANTIC_DIRS = [
    'memory', 'experiences', 'brain-health', 'clients', 'content',
    'projects', 'research', 'templates', 'workflows', 'pipeline',
    'growth', 'product', 'decisions', 'patterns', 'docs',
    'agent_docs', 'imports',
];

async function countIndexFiles(rootPath, depth, maxDepth, counter) {
    if (depth > maxDepth || counter.entries > 5000) return;
    let entries;
    try {
        entries = await readdir(rootPath);
    } catch {
        return;
    }

    for (const entry of entries) {
        counter.entries++;
        if (counter.entries > 5000) return;
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const entryLower = entry.toLowerCase();
        if (entryLower === '_index.md' || entryLower === 'index.md') {
            counter.count++;
            continue;
        }

        const fullPath = join(rootPath, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
                await countIndexFiles(fullPath, depth + 1, maxDepth, counter);
            }
        } catch {
            continue;
        }
    }
}

async function dirExistsAnywhere(rootPath, dirName, depth, maxDepth) {
    if (depth > maxDepth) return false;

    try {
        const s = await stat(join(rootPath, dirName));
        if (s.isDirectory()) return true;
    } catch {
        // not here
    }

    if (depth < maxDepth) {
        let entries;
        try {
            entries = await readdir(rootPath);
        } catch {
            return false;
        }
        let scanned = 0;
        for (const entry of entries) {
            if (scanned > 500) break;
            if (entry.startsWith('.') || entry === 'node_modules') continue;
            scanned++;
            const fullPath = join(rootPath, entry);
            try {
                const s = await stat(fullPath);
                if (s.isDirectory()) {
                    const found = await dirExistsAnywhere(fullPath, dirName, depth + 1, maxDepth);
                    if (found) return true;
                }
            } catch {
                continue;
            }
        }
    }

    return false;
}

export async function checkStructure(rootPath) {
    const checks = [];

    // Check 1: Semantic directory structure (5 pts)
    {
        const found = [];
        for (const dir of SEMANTIC_DIRS) {
            try {
                const s = await stat(join(rootPath, dir));
                if (s.isDirectory()) found.push(dir);
            } catch {
                // does not exist
            }
        }
        let status, points;
        if (found.length >= 3) {
            status = 'pass';
            points = 5;
        } else if (found.length >= 1) {
            status = 'warn';
            points = 2;
        } else {
            status = 'fail';
            points = 0;
        }
        checks.push({
            name: 'Semantic directory structure',
            status,
            points,
            maxPoints: 5,
            message: found.length > 0
                ? `${found.length} semantic directories found: ${found.join(', ')}`
                : 'No semantic directories found — organize knowledge into named folders',
        });
    }

    // Check 2: Index files for navigation (5 pts)
    {
        const counter = { count: 0, entries: 0 };
        await countIndexFiles(rootPath, 0, 3, counter);
        let status, points;
        if (counter.count >= 3) {
            status = 'pass';
            points = 5;
        } else if (counter.count >= 1) {
            status = 'warn';
            points = 2;
        } else {
            status = 'fail';
            points = 0;
        }
        checks.push({
            name: 'Index files for navigation',
            status,
            points,
            maxPoints: 5,
            message: counter.count > 0
                ? `${counter.count} index files found (index.md / _index.md / INDEX.md)`
                : 'No index files found — add index.md files to help the agent navigate',
        });
    }

    // Check 3: Documented tree matches reality (5 pts)
    {
        let claudeMd = '';
        try {
            claudeMd = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
        } catch {
            // no CLAUDE.md
        }

        const treePattern = /[├└│─]\s*([a-zA-Z_-]+)\//g;
        const documentedDirs = new Set();
        let match;
        while ((match = treePattern.exec(claudeMd)) !== null) {
            documentedDirs.add(match[1]);
        }

        if (documentedDirs.size === 0) {
            checks.push({
                name: 'Documented tree matches reality',
                status: 'warn',
                points: 1,
                maxPoints: 5,
                message: 'No folder tree found in CLAUDE.md — consider adding a directory overview',
            });
        } else {
            let existCount = 0;
            for (const dir of documentedDirs) {
                const exists = await dirExistsAnywhere(rootPath, dir, 0, 4);
                if (exists) existCount++;
            }
            const ratio = existCount / documentedDirs.size;
            let status, points;
            if (ratio >= 0.8) {
                status = 'pass';
                points = 5;
            } else if (ratio >= 0.5) {
                status = 'warn';
                points = 3;
            } else {
                status = 'warn';
                points = 1;
            }
            checks.push({
                name: 'Documented tree matches reality',
                status,
                points,
                maxPoints: 5,
                message: `${existCount}/${documentedDirs.size} documented directories exist on disk (${(ratio * 100).toFixed(0)}%)`,
            });
        }
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Directory Structure',
        points: totalPoints,
        maxPoints: 15,
        checks,
    };
}
