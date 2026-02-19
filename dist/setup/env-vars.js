/**
 * Setup Layer: Environment Variables
 *
 * Checks for API key conflicts, backend selection vars,
 * performance tuning, git-tracked .env files, and common
 * environment variable misconfigurations.
 */
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function readText(filePath) {
    try {
        return await readFile(filePath, 'utf-8');
    } catch {
        return null;
    }
}

// Env files that should never be git-tracked
const SENSITIVE_ENV_FILES = ['.env', '.env.local', '.env.production', '.env.secret'];

export async function checkEnvVars(rootPath) {
    const checks = [];

    // Check 1: Git-tracked .env files (4 pts)
    {
        const trackedEnvFiles = [];

        for (const envFile of SENSITIVE_ENV_FILES) {
            const fullPath = join(rootPath, envFile);
            if (!(await fileExists(fullPath))) continue;

            try {
                execFileSync('git', ['ls-files', '--error-unmatch', envFile], {
                    cwd: rootPath,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                trackedEnvFiles.push(envFile);
            } catch {
                // not tracked — good
            }
        }

        let status, points, message;
        if (trackedEnvFiles.length > 0) {
            status = 'fail';
            points = 0;
            message = `${trackedEnvFiles.length} env file(s) tracked in git: ${trackedEnvFiles.join(', ')} — add to .gitignore and rotate secrets`;
        } else {
            // Check if .env files exist and are properly gitignored
            const gitignore = await readText(join(rootPath, '.gitignore'));
            const hasEnvIgnore = gitignore && (
                gitignore.includes('.env') ||
                gitignore.includes('.env*') ||
                gitignore.includes('.env.local')
            );

            const envFilesExist = [];
            for (const envFile of SENSITIVE_ENV_FILES) {
                if (await fileExists(join(rootPath, envFile))) {
                    envFilesExist.push(envFile);
                }
            }

            if (envFilesExist.length === 0) {
                status = 'pass';
                points = 4;
                message = 'No .env files present — secrets managed elsewhere';
            } else if (hasEnvIgnore) {
                status = 'pass';
                points = 4;
                message = `${envFilesExist.length} env file(s) present and .gitignore includes .env patterns`;
            } else {
                status = 'warn';
                points = 2;
                message = `${envFilesExist.length} env file(s) present but .gitignore may not cover them — verify .env is gitignored`;
            }
        }
        checks.push({ name: 'Git-tracked env files', status, points, maxPoints: 4, message });
    }

    // Check 2: API Key Conflicts (3 pts)
    {
        const apiKeyVars = [
            'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_CODE_API_KEY',
        ];
        const setKeys = apiKeyVars.filter(v => process.env[v]);
        const conflicts = [];

        // Check if multiple API key vars are set with different values
        if (setKeys.length > 1) {
            const values = setKeys.map(k => process.env[k]);
            const uniqueValues = new Set(values);
            if (uniqueValues.size > 1) {
                conflicts.push(`Multiple API key vars set with different values: ${setKeys.join(', ')}`);
            }
        }

        // Check for conflicting backend selection
        const backendVars = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'];
        const activeBackends = backendVars.filter(v => process.env[v] === '1' || process.env[v] === 'true');
        if (activeBackends.length > 1) {
            conflicts.push(`Multiple backends active: ${activeBackends.join(', ')} — only one should be set`);
        }

        let status, points, message;
        if (conflicts.length > 0) {
            status = 'fail';
            points = 0;
            message = conflicts.join('; ');
        } else if (setKeys.length > 0) {
            status = 'pass';
            points = 3;
            message = `API key configured via ${setKeys[0]}`;
        } else {
            status = 'pass';
            points = 3;
            message = 'API keys configured through login or other mechanism';
        }
        checks.push({ name: 'API key conflicts', status, points, maxPoints: 3, message });
    }

    // Check 3: Performance Tuning Awareness (3 pts)
    {
        const perfVars = {
            'MAX_TOOL_OUTPUT_SIZE': { desc: 'max tool output bytes' },
            'CLAUDE_CODE_MAX_TURNS': { desc: 'max agentic turns' },
            'CLAUDE_CODE_MAX_TOKENS': { desc: 'max output tokens' },
        };

        const configured = [];
        const warnings = [];

        for (const [varName, info] of Object.entries(perfVars)) {
            const val = process.env[varName];
            if (val) {
                configured.push(`${varName}=${val}`);
                const num = parseInt(val, 10);
                if (varName === 'CLAUDE_CODE_MAX_TURNS' && num < 5) {
                    warnings.push(`${varName}=${val} — very low, may prevent complex tasks`);
                }
            }
        }

        let status, points, message;
        if (warnings.length > 0) {
            status = 'warn';
            points = 1;
            message = `Performance tuning issues: ${warnings.join('; ')}`;
        } else if (configured.length > 0) {
            status = 'pass';
            points = 3;
            message = `Performance vars configured: ${configured.join(', ')}`;
        } else {
            status = 'pass';
            points = 3;
            message = 'Using default performance settings';
        }
        checks.push({ name: 'Performance tuning', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Environment Variables',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
