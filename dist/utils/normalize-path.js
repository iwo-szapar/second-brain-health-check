/**
 * normalizePath — Single source of truth for all path operations.
 *
 * Handles:
 * - Windows backslash → forward slash
 * - Drive letter case normalization (c:/ → C:/)
 * - .claude path doubling prevention (.claude/.claude/ → .claude/)
 * - Home directory boundary check (optional)
 *
 * Created to replace ad-hoc path fixes scattered across 15 files
 * after Timo's Windows debugging incident (2026-03-13).
 */
import { resolve } from 'node:path';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Normalize a file path for consistent cross-platform use.
 *
 * @param {string} inputPath - Raw path to normalize
 * @param {object} [options]
 * @param {string} [options.homeDir] - Home directory for boundary check. Defaults to $HOME/$USERPROFILE.
 * @param {boolean} [options.checkBoundary=false] - If true, throws when path is outside homeDir.
 * @returns {string} Normalized absolute path with forward slashes
 */
export function normalizePath(inputPath, { homeDir, checkBoundary = false } = {}) {
    if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('normalizePath: inputPath must be a non-empty string');
    }

    // Resolve to absolute
    let normalized = resolve(inputPath);

    // Windows: backslash → forward slash
    normalized = normalized.replace(/\\/g, '/');

    // Windows: uppercase drive letter (c:/ → C:/)
    if (IS_WINDOWS && /^[a-z]:\//.test(normalized)) {
        normalized = normalized[0].toUpperCase() + normalized.slice(1);
    }

    // Collapse .claude/.claude/ duplication (any depth)
    normalized = normalized.replace(/\/\.claude(\/\.claude)+/g, '/.claude');

    // Boundary check
    if (checkBoundary) {
        const home = homeDir || process.env.HOME || process.env.USERPROFILE || '/';
        const normalizedHome = home.replace(/\\/g, '/');
        const comparePath = IS_WINDOWS ? normalized.toLowerCase() : normalized;
        const compareHome = IS_WINDOWS ? normalizedHome.toLowerCase() : normalizedHome;

        if (comparePath !== compareHome && !comparePath.startsWith(compareHome + '/')) {
            throw new Error(
                `Path must be inside your home directory.\n` +
                `Home: ${home}\nResolved: ${normalized}\n` +
                `Hint: copy the repo inside ~ first.`
            );
        }
    }

    return normalized;
}
