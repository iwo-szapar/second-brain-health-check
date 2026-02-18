/**
 * Fluency Layer: Progressive Disclosure
 *
 * Measures how many external doc references CLAUDE.md contains.
 * High count = user keeps CLAUDE.md lean and delegates detail to specialized files.
 * This is a core context engineering skill.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkProgressiveDisclosure(rootPath) {
    const checks = [];
    let claudeMdContent = '';

    try {
        claudeMdContent = await readFile(join(rootPath, 'CLAUDE.md'), 'utf-8');
    } catch {
        return {
            name: 'Progressive Disclosure',
            points: 0,
            maxPoints: 10,
            checks: [{
                name: 'CLAUDE.md external references',
                status: 'fail',
                points: 0,
                maxPoints: 10,
                message: 'No CLAUDE.md found — cannot measure progressive disclosure',
            }],
        };
    }

    const lines = claudeMdContent.split('\n');
    const referencedPaths = new Set();

    for (const line of lines) {
        // Pattern 1: Explicit directives — "Read docs/X.md", "See .claude/docs/Y.md"
        const directiveMatches = line.match(
            /(?:Read|See|Refer to|Check|Load|Consult|Reference)\s+[`"']?([.\w][\w./-]+\.(?:md|txt|json|yaml|yml))/gi
        );
        if (directiveMatches) {
            for (const m of directiveMatches) {
                const path = m.replace(/^(?:Read|See|Refer to|Check|Load|Consult|Reference)\s+[`"']?/i, '');
                referencedPaths.add(path.replace(/[`"']/g, ''));
            }
        }

        // Pattern 2: Markdown table cells containing file paths
        // e.g., | Architecture | `.claude/docs/architecture.md` |
        if (line.includes('|') && /[.\w][\w./-]+\.md/.test(line)) {
            const tablePaths = line.match(/[`"']?([.\w][\w./-]+\.md)[`"']?/g);
            if (tablePaths) {
                for (const tp of tablePaths) {
                    const clean = tp.replace(/[`"']/g, '');
                    // Skip if it looks like a URL or the CLAUDE.md itself
                    if (!clean.startsWith('http') && clean !== 'CLAUDE.md') {
                        referencedPaths.add(clean);
                    }
                }
            }
        }

        // Pattern 3: Path references to known brain dirs
        const brainDirPaths = line.match(
            /(?:\.claude|docs|memory|patterns|experiences|research|workflows|templates|product|decisions|brain-health|agent_docs)\/[\w./-]+/g
        );
        if (brainDirPaths) {
            for (const p of brainDirPaths) {
                // Filter out common false positives
                if (!p.startsWith('docs/API') && !p.includes('node_modules')) {
                    referencedPaths.add(p);
                }
            }
        }
    }

    const refCount = referencedPaths.size;
    let points, status;

    if (refCount >= 10) {
        points = 10;
        status = 'pass';
    } else if (refCount >= 5) {
        points = 7;
        status = 'pass';
    } else if (refCount >= 2) {
        points = 4;
        status = 'warn';
    } else {
        points = 0;
        status = 'fail';
    }

    checks.push({
        name: 'CLAUDE.md external references',
        status,
        points,
        maxPoints: 10,
        message: refCount >= 10
            ? `${refCount} unique external doc references — CLAUDE.md is a well-organized routing layer`
            : refCount >= 5
                ? `${refCount} external references — good delegation to external docs`
                : refCount >= 2
                    ? `${refCount} external references — CLAUDE.md may be doing too much inline`
                    : 'No external doc references — consider extracting sections to docs/',
    });

    return {
        name: 'Progressive Disclosure',
        points: checks.reduce((s, c) => s + c.points, 0),
        maxPoints: 10,
        checks,
    };
}
