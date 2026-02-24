/**
 * Setup Layer: PRP / Implementation Blueprints
 *
 * Checks for Product Requirements Plan files — structured planning
 * artifacts that front-load context before execution.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PRP_DIRS = ['PRPs', '.claude/PRPs', 'plans', 'blueprints'];
const STRUCTURED_HEADING_RE = /^#{1,3}\s.*(goal|objective|requirement|acceptance|problem|solution|spec|feature|overview|scope|approach)/im;

async function findPrpDir(rootPath) {
    for (const dir of PRP_DIRS) {
        try {
            const p = join(rootPath, dir);
            const s = await stat(p);
            if (s.isDirectory()) return p;
        } catch { /* not found */ }
    }
    return null;
}

async function getMdFiles(dirPath) {
    try {
        const entries = await readdir(dirPath);
        return entries.filter(e => e.endsWith('.md'));
    } catch {
        return [];
    }
}

export async function checkPrpFiles(rootPath) {
    const checks = [];
    const prpDir = await findPrpDir(rootPath);
    const mdFiles = prpDir ? await getMdFiles(prpDir) : [];

    // Check 1: PRPs directory with files (4 pts)
    {
        let status, points, message;
        if (mdFiles.length >= 2) {
            status = 'pass'; points = 4;
            message = `${mdFiles.length} PRP/blueprint files found in ${prpDir.replace(rootPath + '/', '')}`;
        } else if (mdFiles.length === 1) {
            status = 'warn'; points = 2;
            message = '1 PRP file found — add more to build a planning library';
        } else {
            status = 'fail'; points = 0;
            message = 'No PRP/blueprint directory found — create PRPs/ or plans/ with structured requirement files';
        }
        checks.push({ name: 'PRP directory', status, points, maxPoints: 4, message });
    }

    // Check 2: Structured content in PRP files (4 pts)
    {
        let status, points, message;
        if (mdFiles.length === 0) {
            status = 'fail'; points = 0;
            message = 'No PRP files to evaluate';
        } else {
            let structuredCount = 0;
            for (const file of mdFiles.slice(0, 20)) {
                try {
                    const content = await readFile(join(prpDir, file), 'utf-8');
                    if (STRUCTURED_HEADING_RE.test(content)) structuredCount++;
                } catch { /* skip */ }
            }
            if (structuredCount >= 2) {
                status = 'pass'; points = 4;
                message = `${structuredCount}/${mdFiles.length} PRP files have structured requirement headings`;
            } else if (structuredCount >= 1) {
                status = 'warn'; points = 2;
                message = `${structuredCount} file with structured headings — add Goal/Requirements/Acceptance sections to more files`;
            } else {
                status = 'fail'; points = 0;
                message = 'PRP files lack structured headings (Goal, Requirements, Acceptance Criteria)';
            }
        }
        checks.push({ name: 'Structured PRP content', status, points, maxPoints: 4, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    return { name: 'PRP / Implementation Blueprints', points: totalPoints, maxPoints: totalMaxPoints, checks };
}
