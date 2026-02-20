/**
 * Usage Layer: Cross-Reference Quality
 *
 * Detects whether memory/knowledge files reference each other,
 * indicating a connected knowledge graph rather than isolated notes.
 *
 * Auto-detects "brain directories" from:
 * 1. Known semantic dirs that exist on disk (from SEMANTIC_DIRS)
 * 2. Directories referenced in CLAUDE.md
 * 3. The .claude/ directory itself
 *
 * Classifies references as strong/medium/weak to filter noise.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Known Second Brain dirs — structure.ts originals + common alternatives
const SEMANTIC_DIRS = [
    // Original structure.ts list
    'memory', 'experiences', 'brain-health', 'clients', 'content',
    'projects', 'research', 'templates', 'workflows', 'pipeline',
    'growth', 'product', 'decisions', 'patterns', 'docs',
    'agent_docs', 'imports',
    // Common alternative names users might use
    'knowledge', 'brain', 'notes', 'reference', 'references',
    'resources', 'context', 'learnings', 'insights', 'playbooks',
    'procedures', 'processes', 'frameworks', 'guides',
    'journal', 'logs', 'archive', 'vault',
];

// Always considered brain dirs regardless of naming
const ALWAYS_BRAIN = ['.claude', '.codex'];

/**
 * Auto-detect which directories are "brain directories" for this project.
 * Returns a Set of top-level directory names that count as knowledge dirs.
 */
async function detectBrainDirs(rootPath) {
    const brainDirs = new Set();

    // 1. Add .claude/.codex if they exist
    for (const dir of ALWAYS_BRAIN) {
        try {
            const s = await stat(join(rootPath, dir));
            if (s.isDirectory()) brainDirs.add(dir);
        } catch {
            // skip
        }
    }

    // 2. Check which SEMANTIC_DIRS actually exist on disk
    for (const dir of SEMANTIC_DIRS) {
        try {
            const s = await stat(join(rootPath, dir));
            if (s.isDirectory()) brainDirs.add(dir);
        } catch {
            // skip
        }
    }

    // 3. Parse CLAUDE.md for additional directory references
    try {
        const claudeMd = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
        // Match paths like `docs/SETUP.md`, `knowledge/patterns/`, etc.
        const pathRefs = claudeMd.match(/(?:`|"|')?([\w][\w-]*)\/([\w./-]+)(?:`|"|')?/g) || [];
        for (const ref of pathRefs) {
            const clean = ref.replace(/[`"']/g, '');
            const topDir = clean.split('/')[0];
            // Only add if it actually exists and isn't a code directory
            const codeDirs = ['src', 'lib', 'api', 'node_modules', 'dist', 'build', 'public', 'test', 'tests'];
            if (!codeDirs.includes(topDir)) {
                try {
                    const s = await stat(join(rootPath, topDir));
                    if (s.isDirectory()) brainDirs.add(topDir);
                } catch {
                    // doesn't exist, skip
                }
            }
        }
    } catch {
        // no CLAUDE.md
    }

    return brainDirs;
}

/**
 * Classify a reference found in a file as strong, medium, or weak.
 *
 * Strong (2 pts): Explicit "Read/See/Check" directive, or path into a brain dir
 * Medium (1 pt):  Markdown link syntax, or "Related:/See also:" context
 * Weak   (0 pts): Bare file path mention (likely a code path, not a knowledge link)
 */
function classifyRef(line, refPath, brainDirs) {
    // Strong: explicit directive before a path
    if (/(?:Read|See|Refer to|Check|Load|Reference|Consult)\s/i.test(line)) {
        return 'strong';
    }

    // Strong: path points INTO a known brain directory
    const topDir = refPath.split('/')[0];
    if (brainDirs.has(topDir)) {
        return 'strong';
    }

    // Medium: markdown link syntax [text](path)
    if (/\[.*?\]\(.*?\)/.test(line)) {
        return 'medium';
    }

    // Medium: appears in a "Related:" or "See also:" context
    if (/(?:Related|See also|References|Context|Depends on|Links|Source):/i.test(line)) {
        return 'medium';
    }

    // Weak: bare file path mention
    return 'weak';
}

/**
 * Scan all markdown files in brain directories for cross-references.
 */
async function scanCrossRefs(rootPath, brainDirs) {
    const results = {
        totalFiles: 0,
        filesWithRefs: 0,
        strongRefs: 0,
        mediumRefs: 0,
        weakRefs: 0,
    };

    // Build regex to match paths containing any brain dir
    // e.g., memory/semantic/patterns/api.md, .claude/skills/foo/SKILL.md
    const brainDirArray = [...brainDirs];
    if (brainDirArray.length === 0) return results;

    const brainDirPattern = new RegExp(
        '(?:' + brainDirArray.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')' +
        '/[\\w./-]+',
        'g'
    );

    async function scanDir(dir, depth) {
        if (depth > 3) return;
        let entries;
        try {
            entries = await readdir(dir);
        } catch {
            return;
        }

        const MAX_ENTRIES = 200;
        for (const entry of entries.slice(0, MAX_ENTRIES)) {
            if (entry.startsWith('.') || entry === 'node_modules') continue;
            const fullPath = join(dir, entry);
            try {
                const s = await stat(fullPath);
                if (s.isDirectory()) {
                    await scanDir(fullPath, depth + 1);
                } else if (entry.endsWith('.md') && s.size < 100000) {
                    results.totalFiles++;
                    const content = await readFile(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    let fileHasRef = false;

                    for (const line of lines) {
                        const matches = line.match(brainDirPattern);
                        if (!matches) continue;

                        for (const ref of matches) {
                            // Don't count self-references
                            const relPath = relative(rootPath, fullPath);
                            if (ref === relPath) continue;

                            const level = classifyRef(line, ref, brainDirs);
                            if (level === 'strong') {
                                results.strongRefs++;
                                fileHasRef = true;
                            } else if (level === 'medium') {
                                results.mediumRefs++;
                                fileHasRef = true;
                            } else {
                                results.weakRefs++;
                            }
                        }
                    }

                    if (fileHasRef) results.filesWithRefs++;
                }
            } catch {
                continue;
            }
        }
    }

    // Scan each brain directory
    for (const dir of brainDirArray) {
        await scanDir(join(rootPath, dir), 0);
    }

    // Also scan CLAUDE.md itself
    try {
        const claudeMdPath = join(rootPath, 'CLAUDE.md');
        const s = await stat(claudeMdPath);
        if (s.isFile()) {
            results.totalFiles++;
            const content = await readFile(claudeMdPath, 'utf-8');
            const lines = content.split('\n');
            let fileHasRef = false;

            for (const line of lines) {
                const matches = line.match(brainDirPattern);
                if (!matches) continue;

                for (const ref of matches) {
                    const level = classifyRef(line, ref, brainDirs);
                    if (level === 'strong') {
                        results.strongRefs++;
                        fileHasRef = true;
                    } else if (level === 'medium') {
                        results.mediumRefs++;
                        fileHasRef = true;
                    } else {
                        results.weakRefs++;
                    }
                }
            }
            if (fileHasRef) results.filesWithRefs++;
        }
    } catch {
        // no CLAUDE.md
    }

    return results;
}

export async function checkCrossReferences(rootPath) {
    const checks = [];

    // Step 1: Auto-detect brain directories
    const brainDirs = await detectBrainDirs(rootPath);

    if (brainDirs.size === 0) {
        return {
            name: 'Cross-Reference Quality',
            points: 0,
            maxPoints: 15,
            checks: [{
                name: 'Brain directories detected',
                status: 'fail',
                points: 0,
                maxPoints: 15,
                message: 'No knowledge directories found to scan for cross-references',
            }],
        };
    }

    // Check 1: Brain directories detected (2 pts)
    checks.push({
        name: 'Brain directories detected',
        status: brainDirs.size >= 3 ? 'pass' : 'warn',
        points: brainDirs.size >= 3 ? 2 : 1,
        maxPoints: 2,
        message: `${brainDirs.size} knowledge directories: ${[...brainDirs].join(', ')}`,
    });

    // Step 2: Scan for cross-references
    const refs = await scanCrossRefs(rootPath, brainDirs);
    const qualityRefs = refs.strongRefs + refs.mediumRefs; // ignore weak

    // Check 2: Files contain cross-references (5 pts)
    const refRatio = refs.totalFiles > 0 ? refs.filesWithRefs / refs.totalFiles : 0;
    checks.push({
        name: 'Files with cross-references',
        status: refRatio >= 0.2 ? 'pass' : refRatio > 0 ? 'warn' : 'fail',
        points: refRatio >= 0.2 ? 5 : refRatio > 0 ? 2 : 0,
        maxPoints: 5,
        message: refs.totalFiles === 0
            ? 'No markdown files found in knowledge directories'
            : `${refs.filesWithRefs}/${refs.totalFiles} files contain cross-references (${(refRatio * 100).toFixed(0)}%)`,
    });

    // Check 3: Strong references (intentional linking) (5 pts)
    checks.push({
        name: 'Strong cross-references',
        status: refs.strongRefs >= 5 ? 'pass' : refs.strongRefs >= 2 ? 'warn' : 'fail',
        points: refs.strongRefs >= 5 ? 5 : refs.strongRefs >= 2 ? 3 : refs.strongRefs >= 1 ? 1 : 0,
        maxPoints: 5,
        message: `${refs.strongRefs} strong refs (explicit directives or brain-dir paths), ${refs.mediumRefs} medium, ${refs.weakRefs} weak (ignored)`,
    });

    // Check 4: Connected knowledge (files linking to each other, not just CLAUDE.md linking out) (3 pts)
    const nonClaudeMdRefs = qualityRefs > 0 && refs.filesWithRefs > 1;
    checks.push({
        name: 'Connected knowledge graph',
        status: nonClaudeMdRefs && refs.filesWithRefs >= 3 ? 'pass' : nonClaudeMdRefs ? 'warn' : 'fail',
        points: nonClaudeMdRefs && refs.filesWithRefs >= 3 ? 3 : nonClaudeMdRefs ? 1 : 0,
        maxPoints: 3,
        message: nonClaudeMdRefs
            ? `${refs.filesWithRefs} files form a connected knowledge graph`
            : 'Knowledge files are isolated — they don\'t reference each other',
    });

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

    return {
        name: 'Cross-Reference Quality',
        points: totalPoints,
        maxPoints: 15,
        checks,
    };
}
