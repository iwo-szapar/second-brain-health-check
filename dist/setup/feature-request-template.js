/**
 * Setup Layer: Feature Request Template
 *
 * Checks for structured intake templates for feature requests.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const TEMPLATE_PATHS = [
    '.github/FEATURE_REQUEST.md',
    '.github/ISSUE_TEMPLATE',
    'INITIAL.md',
    'templates/feature-request.md',
    '.github/ISSUE_TEMPLATE.md',
];
const STRUCTURED_RE = /#{1,3}\s.*(description|context|solution|alternative|acceptance|criteria|problem|impact)/im;

export async function checkFeatureRequestTemplate(rootPath) {
    const checks = [];
    let found = false;
    let content = '';
    let foundPath = '';

    for (const p of TEMPLATE_PATHS) {
        try {
            const fullPath = join(rootPath, p);
            const s = await stat(fullPath);
            if (s.isFile()) {
                found = true; foundPath = p;
                content = await readFile(fullPath, 'utf-8');
                break;
            }
            if (s.isDirectory()) {
                const entries = await readdir(fullPath);
                if (entries.length > 0) {
                    found = true; foundPath = p;
                    const firstMd = entries.find(e => e.endsWith('.md') || e.endsWith('.yml'));
                    if (firstMd) content = await readFile(join(fullPath, firstMd), 'utf-8');
                    break;
                }
            }
        } catch { /* not found */ }
    }

    // Single check: Template exists with structured content (3 pts)
    {
        let status, points, message;
        if (found && content.length > 50 && STRUCTURED_RE.test(content)) {
            status = 'pass'; points = 3;
            message = `Structured intake template found: ${foundPath}`;
        } else if (found) {
            status = 'warn'; points = 1;
            message = `Template found at ${foundPath} but lacks structured sections — add Description/Problem/Acceptance headings`;
        } else {
            status = 'fail'; points = 0;
            message = 'No feature request template — create .github/FEATURE_REQUEST.md or INITIAL.md for structured intake';
        }
        checks.push({ name: 'Feature request template', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Feature Request Template', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
