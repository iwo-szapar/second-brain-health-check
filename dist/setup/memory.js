/**
 * Setup Layer: Memory System
 *
 * Evaluates memory infrastructure. Branches on backend:
 * - supabase: Queries memory_knowledge, memory_decisions tables
 * - filesystem: Original checks (memory/ directory structure)
 */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getMemoryOSStats } from '../utils/memoryos-stats.js';

async function countMdFiles(dirPath, depth, maxDepth, counter) {
    if (depth > maxDepth || counter.entries > 500) return;
    let entries;
    try { entries = await readdir(dirPath); } catch { return; }
    for (const entry of entries) {
        counter.entries++;
        if (counter.entries > 500) return;
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dirPath, entry);
        try {
            const s = await stat(fullPath);
            if (s.isDirectory()) await countMdFiles(fullPath, depth + 1, maxDepth, counter);
            else if (entry.endsWith('.md')) counter.count++;
        } catch { continue; }
    }
}

async function dirExists(path) {
    try { const s = await stat(path); return s.isDirectory(); } catch { return false; }
}

async function countPopulatedFiles(dirPath, minBytes) {
    let count = 0;
    try {
        const entries = await readdir(dirPath);
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            try { const s = await stat(join(dirPath, entry)); if (s.isFile() && s.size > minBytes) count++; }
            catch { continue; }
        }
    } catch { /* dir doesn't exist */ }
    return count;
}

/**
 * SQL-backed memory checks via Supabase PostgREST.
 */
async function checkMemorySQL(rootPath) {
    const checks = [];
    const stats = await getMemoryOSStats(rootPath);

    if (!stats) {
        // Supabase configured but query failed — degrade gracefully
        checks.push({
            name: 'MemoryOS connection',
            status: 'warn', points: 2, maxPoints: 4,
            message: 'Supabase credentials found but query failed — check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local',
        });
        checks.push({ name: 'Knowledge volume', status: 'fail', points: 0, maxPoints: 4, message: 'Cannot query — connection failed' });
        checks.push({ name: 'Knowledge type diversity', status: 'fail', points: 0, maxPoints: 4, message: 'Cannot query — connection failed' });
        checks.push({ name: 'Decision logging', status: 'fail', points: 0, maxPoints: 3, message: 'Cannot query — connection failed' });
        return { name: 'Memory System', points: 2, maxPoints: 15, checks };
    }

    // Check 1: Data layer configured (4 pts)
    {
        const { total } = stats;
        let status, points, message;
        if (total > 0) {
            status = 'pass'; points = 4;
            message = `MemoryOS SQL connected — ${total} knowledge items in database`;
        } else {
            status = 'warn'; points = 2;
            message = 'MemoryOS SQL connected but database is empty';
        }
        checks.push({ name: 'MemoryOS data layer', status, points, maxPoints: 4, message });
    }

    // Check 2: Knowledge volume (4 pts)
    {
        const { total } = stats;
        let status, points, message;
        if (total >= 20) {
            status = 'pass'; points = 4;
            message = `${total} knowledge items — healthy volume`;
        } else if (total >= 5) {
            status = 'warn'; points = 2;
            message = `${total} knowledge items — aim for 20+ as your brain grows`;
        } else {
            status = 'fail'; points = 0;
            message = `${total} knowledge items — brain is just getting started`;
        }
        checks.push({ name: 'Knowledge volume', status, points, maxPoints: 4, message });
    }

    // Check 3: Type diversity (4 pts)
    {
        const { distinctTypes, typeDistribution } = stats;
        const typeList = Object.entries(typeDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([t, c]) => `${t}:${c}`)
            .join(', ');
        let status, points, message;
        if (distinctTypes >= 3) {
            status = 'pass'; points = 4;
            message = `${distinctTypes} knowledge types used (${typeList})`;
        } else if (distinctTypes === 2) {
            status = 'warn'; points = 2;
            message = `${distinctTypes} types (${typeList}) — diversify with insights, lessons, patterns`;
        } else {
            status = 'fail'; points = 0;
            message = distinctTypes === 1
                ? `Only 1 type used (${typeList}) — add patterns, insights, and lessons`
                : 'No knowledge items found';
        }
        checks.push({ name: 'Knowledge type diversity', status, points, maxPoints: 4, message });
    }

    // Check 4: Decision logging (3 pts)
    {
        const { decisionCount, decisionsWithOptions } = stats;
        let status, points, message;
        if (decisionCount >= 5) {
            status = 'pass'; points = 3;
            message = `${decisionCount} decisions logged (${decisionsWithOptions} with alternatives considered)`;
        } else if (decisionCount >= 1) {
            status = 'warn'; points = 1;
            message = `${decisionCount} decision(s) — log more choices with rationale to build institutional memory`;
        } else {
            status = 'fail'; points = 0;
            message = 'No decisions logged — use memory_decisions to capture choices with alternatives and rationale';
        }
        checks.push({ name: 'Decision logging', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Memory System', points: totalPoints, maxPoints: 15, checks };
}

/**
 * Original filesystem-based memory checks (for non-SQL users).
 */
async function checkMemoryFilesystem(rootPath) {
    const checks = [];

    // Check 1: Memory dir with subdirectories (4 pts)
    {
        const memoryPath = join(rootPath, 'memory');
        const memExists = await dirExists(memoryPath);
        let subdirCount = 0;
        if (memExists) {
            try {
                const entries = await readdir(memoryPath);
                for (const entry of entries) {
                    if (entry.startsWith('.')) continue;
                    try { const s = await stat(join(memoryPath, entry)); if (s.isDirectory()) subdirCount++; }
                    catch { continue; }
                }
            } catch { /* read error */ }
        }
        let status, points, message;
        if (memExists && subdirCount >= 2) { status = 'pass'; points = 4; message = `memory/ has ${subdirCount} subdirectories`; }
        else if (memExists) { status = 'warn'; points = 2; message = `memory/ exists but only has ${subdirCount} subdirector${subdirCount === 1 ? 'y' : 'ies'}`; }
        else { status = 'fail'; points = 0; message = 'No memory/ directory found — create one to store learned patterns'; }
        checks.push({ name: 'Memory dir with subdirectories', status, points, maxPoints: 4, message });
    }

    // Check 2: Patterns directory (3 pts)
    {
        const patternPaths = [join(rootPath, 'memory', 'patterns'), join(rootPath, 'memory', 'semantic', 'patterns')];
        let found = false;
        for (const p of patternPaths) { if (await dirExists(p)) { found = true; break; } }
        checks.push({
            name: 'Patterns directory', status: found ? 'pass' : 'fail',
            points: found ? 3 : 0, maxPoints: 3,
            message: found ? 'Patterns directory found for storing learned patterns' : 'No memory/patterns/ or memory/semantic/patterns/ directory',
        });
    }

    // Check 3: Style/voice files populated (4 pts)
    {
        const styleDirs = [join(rootPath, 'memory', 'style-voice'), join(rootPath, 'memory', 'personal'), join(rootPath, 'memory', 'company')];
        let totalPopulated = 0;
        for (const dir of styleDirs) { totalPopulated += await countPopulatedFiles(dir, 100); }
        let status, points;
        if (totalPopulated >= 2) { status = 'pass'; points = 4; }
        else if (totalPopulated === 1) { status = 'warn'; points = 2; }
        else { status = 'fail'; points = 0; }
        checks.push({
            name: 'Style/voice files populated', status, points, maxPoints: 4,
            message: totalPopulated > 0
                ? `Found ${totalPopulated} style/voice/personal file${totalPopulated === 1 ? '' : 's'} with content (>100 bytes) — need 2+`
                : 'No style, voice, or personal files found — teach the agent your communication style',
        });
    }

    // Check 4: Examples and workflow content (4 pts)
    {
        const searchDirs = [
            join(rootPath, 'memory', 'examples'), join(rootPath, 'memory', 'workflows'),
            join(rootPath, 'experiences'), join(rootPath, '.claude', 'skills'), join(rootPath, '.claude', 'commands'),
        ];
        const counter = { count: 0, entries: 0 };
        for (const dir of searchDirs) { await countMdFiles(dir, 0, 3, counter); }
        let status, points;
        if (counter.count >= 3) { status = 'pass'; points = 4; }
        else if (counter.count >= 1) { status = 'warn'; points = 2; }
        else { status = 'fail'; points = 0; }
        checks.push({
            name: 'Examples and workflow content', status, points, maxPoints: 4,
            message: counter.count > 0 ? `${counter.count} example/workflow markdown files found` : 'No example or workflow files found — add real examples to improve agent output',
        });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    return { name: 'Memory System', points: totalPoints, maxPoints: 15, checks };
}

export async function checkMemory(rootPath) {
    // Try SQL path first
    const stats = await getMemoryOSStats(rootPath);
    if (stats) return checkMemorySQL(rootPath);
    return checkMemoryFilesystem(rootPath);
}
