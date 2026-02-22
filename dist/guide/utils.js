/**
 * Guide Tools — Shared Utilities
 *
 * Helpers for reading health check state, estimating tokens, and resolving paths.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/**
 * Estimate token count from character count (rough: chars / 4).
 */
export function estimateTokens(chars) {
    return Math.round(chars / 4);
}

/**
 * Read and parse .health-check.json from a project root.
 * Returns { runs: [] } if file doesn't exist.
 */
export async function readHealthCheckState(rootPath) {
    const filePath = resolve(rootPath, '.health-check.json');
    try {
        const content = await readFile(filePath, 'utf-8');
        const state = JSON.parse(content);
        if (!Array.isArray(state.runs)) state.runs = [];
        return state;
    } catch {
        return { runs: [] };
    }
}

/**
 * Resolve and validate a project root path.
 * Falls back to cwd if not provided.
 */
export async function resolveProjectRoot(path) {
    const rootPath = resolve(path || process.cwd());
    try {
        const s = await stat(rootPath);
        if (!s.isDirectory()) throw new Error(`"${rootPath}" is not a directory.`);
    } catch (err) {
        if (err.code === 'ENOENT') throw new Error(`"${rootPath}" does not exist.`);
        throw err;
    }
    return rootPath;
}

/**
 * Safely read a file, returning null if it doesn't exist.
 */
export async function readFileSafe(filePath) {
    try {
        return await readFile(filePath, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Get all .md files in a directory (non-recursive).
 * Returns array of { name, path, size, tokens }.
 */
export async function getMdFiles(dirPath) {
    const results = [];
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.md')) {
                const fullPath = join(dirPath, entry.name);
                try {
                    const s = await stat(fullPath);
                    results.push({
                        name: entry.name,
                        path: fullPath,
                        size: s.size,
                        tokens: estimateTokens(s.size),
                    });
                } catch { /* skip */ }
            }
        }
    } catch { /* dir doesn't exist */ }
    return results;
}
