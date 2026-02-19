/**
 * Fluency Layer: Interview & Spec Patterns
 *
 * Detects the "two-session spec → execution split" pattern:
 * skills that use AskUserQuestionTool to gather requirements before acting,
 * and workflows that generate spec/plan files before execution sessions.
 *
 * This is the highest-signal indicator of advanced AI fluency — the user
 * understands that context must be engineered BEFORE execution begins.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ASK_USER_PATTERNS = [
    /AskUserQuestion/,
    /interview.*user|user.*interview/i,
    /gather.*requirements?|requirements?.*gather/i,
    /ask.*(?:before|first|clarify)|(?:clarify|confirm).*before/i,
    /what.*(?:do you need|should.*do|would.*like).*\?/i,
];

const SPEC_GENERATION_PATTERNS = [
    /write.*(?:spec|plan|requirement)|(?:spec|plan|requirement).*(?:write|generat|creat)/i,
    /save.*to.*(?:spec|plan|plans[\\/]|specs[\\/])/i,
    /(?:generat|creat|output).*(?:spec|plan|brief|requirement)/i,
    /spec[_-]?first|plan[_-]?first|interview.*first/i,
    /then\s+(?:write|create|save).*(?:spec|plan|file)/i,
];

async function collectMdFiles(dirPath) {
    const files = [];
    try {
        const entries = await readdir(dirPath, { recursive: true });
        for (const entry of entries) {
            if (!entry.endsWith('.md')) continue;
            try {
                const fullPath = join(dirPath, entry);
                const s = await stat(fullPath);
                if (!s.isFile()) continue;
                const content = await readFile(fullPath, 'utf-8');
                files.push({ name: entry, content });
            } catch { continue; }
        }
    } catch { /* dir doesn't exist */ }
    return files;
}

export async function checkInterviewPatterns(rootPath) {
    const checks = [];

    const skills = await collectMdFiles(join(rootPath, '.claude', 'skills'));
    const commands = await collectMdFiles(join(rootPath, '.claude', 'commands'));
    const allFiles = [...skills, ...commands];

    // Check 1: Interactive requirement gathering (5 pts)
    // Skills that ask before acting prevent context-blind execution
    {
        let filesWithAsk = 0;
        for (const file of allFiles) {
            const hasAsk = ASK_USER_PATTERNS.some(p => p.test(file.content));
            if (hasAsk) filesWithAsk++;
        }

        let status, points, message;
        if (filesWithAsk >= 3) {
            status = 'pass'; points = 5;
            message = `${filesWithAsk} skills/commands gather requirements interactively — context-first execution pattern`;
        } else if (filesWithAsk >= 1) {
            status = 'warn'; points = 3;
            message = `${filesWithAsk} skill(s) use AskUserQuestion or interview patterns — extend to more workflows`;
        } else if (allFiles.length > 0) {
            status = 'fail'; points = 0;
            message = 'No skills gather requirements before executing — skills run blind without user context';
        } else {
            status = 'fail'; points = 0;
            message = 'No skills or commands to evaluate';
        }
        checks.push({ name: 'Interactive requirement gathering', status, points, maxPoints: 5, message });
    }

    // Check 2: Spec-first workflow pattern (5 pts)
    // Skills that write spec files + a planning directory = two-session pattern
    {
        let filesWithSpecGen = 0;
        for (const file of allFiles) {
            const hasSpecGen = SPEC_GENERATION_PATTERNS.some(p => p.test(file.content));
            if (hasSpecGen) filesWithSpecGen++;
        }

        // Check if a planning directory exists as evidence of spec-first workflow
        let hasPlanningDir = false;
        for (const dirName of ['plans', 'specs', 'planning']) {
            try {
                const s = await stat(join(rootPath, dirName));
                if (s.isDirectory()) { hasPlanningDir = true; break; }
            } catch { continue; }
        }

        let status, points, message;
        if (filesWithSpecGen >= 2 && hasPlanningDir) {
            status = 'pass'; points = 5;
            message = `${filesWithSpecGen} skill(s) generate specs + planning directory exists — strong spec-first workflow`;
        } else if (filesWithSpecGen >= 1 && hasPlanningDir) {
            status = 'pass'; points = 4;
            message = `Spec-generating skill + planning directory — spec-first pattern in place`;
        } else if (filesWithSpecGen >= 1) {
            status = 'warn'; points = 3;
            message = `${filesWithSpecGen} skill(s) reference spec generation — add a plans/ directory to store output`;
        } else if (hasPlanningDir) {
            status = 'warn'; points = 2;
            message = 'Planning directory exists but no skills generate specs — add skills that write spec files before execution';
        } else {
            status = 'fail'; points = 0;
            message = 'No spec-first pattern detected — consider separating requirements-gathering sessions from execution sessions';
        }
        checks.push({ name: 'Spec-first workflow pattern', status, points, maxPoints: 5, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Interview & Spec Patterns',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
