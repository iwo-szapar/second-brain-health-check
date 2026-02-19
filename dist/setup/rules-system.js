/**
 * Setup Layer: Rules System
 *
 * Evaluates the modular rules system (.claude/rules/) which provides
 * path-specific policy files — a parallel configuration layer to CLAUDE.md
 * for scoped instructions.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function countRuleFiles(dirPath) {
    const results = { total: 0, withContent: 0, paths: [] };
    try {
        const entries = await readdir(dirPath, { recursive: true });
        for (const entry of entries) {
            if (!entry.endsWith('.md') && !entry.endsWith('.txt')) continue;
            results.total++;
            try {
                const content = await readFile(join(dirPath, entry), 'utf-8');
                if (content.trim().length >= 50) {
                    results.withContent++;
                    results.paths.push(entry);
                }
            } catch {
                continue;
            }
        }
    } catch {
        // dir doesn't exist
    }
    return results;
}

export async function checkRulesSystem(rootPath) {
    const checks = [];
    const home = homedir();

    // Scan all rules locations
    const projectRulesDir = join(rootPath, '.claude', 'rules');
    const userRulesDir = join(home, '.claude', 'rules');

    const [projectRules, userRules] = await Promise.all([
        countRuleFiles(projectRulesDir),
        countRuleFiles(userRulesDir),
    ]);

    const totalRules = projectRules.total + userRules.total;
    const totalWithContent = projectRules.withContent + userRules.withContent;

    // Check 1: Rules files present (3 pts)
    {
        let status, points, message;
        if (totalWithContent >= 3) {
            status = 'pass'; points = 3;
            message = `${totalWithContent} rule files with content (${projectRules.withContent} project, ${userRules.withContent} user-level)`;
        } else if (totalWithContent >= 1) {
            status = 'warn'; points = 2;
            message = `${totalWithContent} rule file(s) — add more path-specific rules for granular control`;
        } else if (totalRules > 0) {
            status = 'warn'; points = 1;
            message = `${totalRules} rule file(s) found but empty or too short (<50 chars)`;
        } else {
            status = 'warn'; points = 1;
            message = 'No .claude/rules/ directory — rules provide path-specific instructions beyond CLAUDE.md';
        }
        checks.push({ name: 'Rules files present', status, points, maxPoints: 3, message });
    }

    // Check 2: Rules scope diversity (3 pts)
    // Check if rules cover different areas (not all in one directory)
    {
        let status, points, message;
        if (totalWithContent === 0) {
            status = 'warn'; points = 1;
            message = 'No rules to evaluate scope diversity';
        } else {
            // Count unique top-level directories in rule paths
            const dirs = new Set();
            for (const p of [...projectRules.paths, ...userRules.paths]) {
                const parts = p.split('/');
                if (parts.length > 1) {
                    dirs.add(parts[0]);
                } else {
                    dirs.add('root');
                }
            }

            const hasMultiLevel = projectRules.withContent > 0 && userRules.withContent > 0;

            if (dirs.size >= 3 || (dirs.size >= 2 && hasMultiLevel)) {
                status = 'pass'; points = 3;
                message = `Rules span ${dirs.size} scope(s)${hasMultiLevel ? ' across project and user levels' : ''} — good coverage`;
            } else if (dirs.size >= 2 || hasMultiLevel) {
                status = 'warn'; points = 2;
                message = `Rules in ${dirs.size} scope(s) — expand to more path-specific contexts`;
            } else {
                status = 'warn'; points = 1;
                message = 'All rules in a single scope — consider adding path-specific rules for different project areas';
            }
        }
        checks.push({ name: 'Rules scope diversity', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Rules System',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
