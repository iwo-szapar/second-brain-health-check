/**
 * Setup Layer: Examples Directory
 *
 * Checks for examples/ directory with real content for AI reference.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PLACEHOLDER_RE = /\[YOUR|\bTODO:|FILL\s*IN|REPLACE\s*WITH|INSERT\s*HERE|<your[_-]/i;

export async function checkExamplesDirectory(rootPath) {
    const checks = [];
    const examplesDir = join(rootPath, 'examples');
    let files = [];

    try {
        const entries = await readdir(examplesDir);
        for (const entry of entries.slice(0, 50)) {
            try {
                const s = await stat(join(examplesDir, entry));
                if (s.isFile()) files.push(entry);
            } catch { /* skip */ }
        }
    } catch { /* no directory */ }

    // Check 1: Examples directory exists with files (3 pts)
    {
        let status, points, message;
        if (files.length >= 5) {
            status = 'pass'; points = 3;
            message = `${files.length} example files found — good reference library for AI`;
        } else if (files.length >= 1) {
            status = 'warn'; points = 2;
            message = `${files.length} example file(s) — add more reference examples for AI context`;
        } else {
            status = 'fail'; points = 0;
            message = 'No examples/ directory — create one with reference files the AI can learn from';
        }
        checks.push({ name: 'Examples directory', status, points, maxPoints: 3, message });
    }

    // Check 2: Files have real content (3 pts)
    {
        let status, points, message;
        if (files.length === 0) {
            status = 'fail'; points = 0;
            message = 'No example files to evaluate';
        } else {
            let realCount = 0;
            const sampleFiles = files.slice(0, 20);
            for (const file of sampleFiles) {
                try {
                    const content = await readFile(join(examplesDir, file), 'utf-8');
                    if (content.length >= 200 && !PLACEHOLDER_RE.test(content)) realCount++;
                } catch { /* skip */ }
            }
            const pct = realCount / sampleFiles.length;
            if (pct >= 0.8) {
                status = 'pass'; points = 3;
                message = `${realCount}/${sampleFiles.length} example files have real content`;
            } else if (realCount >= 1) {
                status = 'warn'; points = 1;
                message = `${realCount}/${sampleFiles.length} files have real content — replace templates with actual examples`;
            } else {
                status = 'fail'; points = 0;
                message = 'Example files appear to be templates/placeholders — add real content';
            }
        }
        checks.push({ name: 'Real example content', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'Examples Directory', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
