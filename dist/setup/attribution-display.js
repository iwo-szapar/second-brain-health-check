/**
 * Setup Layer: Attribution, Display & Plans
 *
 * Checks attribution settings (commit/PR co-authored-by),
 * display/UX configuration, and plansDirectory setup.
 */
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function readJson(filePath) {
    try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function dirExists(dirPath) {
    try {
        await access(dirPath);
        return true;
    } catch {
        return false;
    }
}

export async function checkAttributionDisplay(rootPath) {
    const checks = [];
    const home = homedir();

    const [projectShared, projectLocal, userGlobal] = await Promise.all([
        readJson(join(rootPath, '.claude', 'settings.json')),
        readJson(join(rootPath, '.claude', 'settings.local.json')),
        readJson(join(home, '.claude.json')),
    ]);

    const allConfigs = [
        { level: 'project-shared', data: projectShared },
        { level: 'project-local', data: projectLocal },
        { level: 'user-global', data: userGlobal },
    ].filter(c => c.data !== null);

    // Check 1: Attribution Settings (2 pts)
    {
        let hasAttribution = false;
        let hasDeprecated = false;
        const details = [];

        for (const { level, data } of allConfigs) {
            if (data.attribution) {
                hasAttribution = true;
                if (data.attribution.commit !== undefined) details.push(`commit=${data.attribution.commit} (${level})`);
                if (data.attribution.pr !== undefined) details.push(`pr=${data.attribution.pr} (${level})`);
            }
            if (data.includeCoAuthoredBy !== undefined) {
                hasDeprecated = true;
                details.push(`includeCoAuthoredBy (deprecated) in ${level}`);
            }
        }

        let status, points, message;
        if (hasDeprecated) {
            status = 'warn';
            points = 1;
            message = `Using deprecated includeCoAuthoredBy — migrate to attribution.commit/attribution.pr`;
        } else if (hasAttribution) {
            status = 'pass';
            points = 2;
            message = `Attribution configured: ${details.join(', ')}`;
        } else {
            status = 'warn';
            points = 0;
            message = 'Attribution not configured — set attribution.commit and attribution.pr in .claude/settings.json';
        }
        checks.push({ name: 'Attribution settings', status, points, maxPoints: 2, message });
    }

    // Check 2: Display Configuration (2 pts)
    {
        const displaySettings = [];
        const concerns = [];

        for (const { level, data } of allConfigs) {
            if (data.statusLine !== undefined) displaySettings.push(`statusLine (${level})`);
            if (data.showGitIgnoredFiles === true) {
                concerns.push(`showGitIgnoredFiles=true (${level}) — may expose sensitive files`);
            }
            if (data.spinner) displaySettings.push(`spinner config (${level})`);
        }

        let status, points, message;
        if (concerns.length > 0) {
            status = 'warn';
            points = 1;
            message = concerns.join('; ');
        } else if (displaySettings.length > 0) {
            status = 'pass';
            points = 2;
            message = `Display customized: ${displaySettings.join(', ')}`;
        } else {
            status = 'warn';
            points = 0;
            message = 'Display not customized — consider setting statusLine, spinnerVerbs, or outputStyle in .claude/settings.json';
        }
        checks.push({ name: 'Display configuration', status, points, maxPoints: 2, message });
    }

    // Check 3: Plans Directory (2 pts)
    {
        let plansDir = null;
        let plansDirSource = null;

        for (const { level, data } of allConfigs) {
            if (data.plansDirectory) {
                plansDir = data.plansDirectory;
                plansDirSource = level;
            }
        }

        // Also check for common plans directories
        const commonPlansDirs = ['plans', '.claude/plans', 'docs/plans'];
        let existingPlansDir = null;

        for (const dir of commonPlansDirs) {
            if (await dirExists(join(rootPath, dir))) {
                existingPlansDir = dir;
                break;
            }
        }

        let status, points, message;
        if (plansDir) {
            const exists = await dirExists(join(rootPath, plansDir));
            if (exists) {
                status = 'pass';
                points = 2;
                message = `Plans directory configured: ${plansDir} (${plansDirSource}) — exists on disk`;
            } else {
                status = 'warn';
                points = 1;
                message = `Plans directory configured as "${plansDir}" but doesn't exist on disk`;
            }
        } else if (existingPlansDir) {
            status = 'warn';
            points = 1;
            message = `Found ${existingPlansDir}/ directory but plansDirectory not set in settings — consider configuring it`;
        } else {
            status = 'warn';
            points = 0;
            message = 'No plans directory configured — set plansDirectory in settings or create a plans/ directory';
        }
        checks.push({ name: 'Plans directory', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Attribution & Display',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
