/**
 * Setup Layer: Model Configuration
 *
 * Checks model aliases, effort levels, custom model env vars,
 * and whether the user has intentional model configuration.
 */
import { readFile } from 'node:fs/promises';
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

const KNOWN_MODELS = [
    'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5',
    'claude-opus-4-0-20250514', 'claude-sonnet-4-5-20250514',
    'claude-sonnet-4-0-20250514', 'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet', 'claude-3-5-haiku',
];

const VALID_EFFORT_LEVELS = ['high', 'medium', 'low'];

const MODEL_ALIAS_KEYS = ['default', 'sonnet', 'opus', 'haiku'];

export async function checkModelConfig(rootPath) {
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

    // Check 1: Model Configuration Exists (3 pts)
    {
        const modelSettings = [];
        for (const { level, data } of allConfigs) {
            if (data.model) modelSettings.push({ level, model: data.model });
            if (data.modelAliases) modelSettings.push({ level, aliases: data.modelAliases });
        }

        // Check env vars
        const envModel = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL;

        let status, points, message;
        if (modelSettings.length > 0) {
            status = 'pass';
            points = 3;
            const details = modelSettings.map(m => {
                if (m.model) return `model="${m.model}" (${m.level})`;
                if (m.aliases) return `aliases in ${m.level}`;
                return m.level;
            }).join(', ');
            message = `Model configuration found: ${details}`;
        } else if (envModel) {
            status = 'pass';
            points = 3;
            message = `Model set via environment variable: ${envModel}`;
        } else {
            status = 'pass';
            points = 2;
            message = 'Using default model — no explicit model configuration (fine for most users)';
        }
        checks.push({ name: 'Model configuration', status, points, maxPoints: 3, message });
    }

    // Check 2: Model Alias Validity (3 pts)
    {
        const invalidAliases = [];
        let hasAliases = false;

        for (const { level, data } of allConfigs) {
            if (!data.modelAliases || typeof data.modelAliases !== 'object') continue;
            hasAliases = true;

            for (const [alias, modelId] of Object.entries(data.modelAliases)) {
                if (!MODEL_ALIAS_KEYS.includes(alias) && !alias.endsWith('LargeContext')) {
                    invalidAliases.push({ alias, level, reason: 'unknown alias key' });
                }
                if (typeof modelId === 'string' && modelId.length > 0) {
                    const isKnown = KNOWN_MODELS.some(m => modelId.includes(m) || m.includes(modelId));
                    if (!isKnown && !modelId.startsWith('claude-')) {
                        invalidAliases.push({ alias, level, reason: `unknown model "${modelId}"` });
                    }
                }
            }
        }

        let status, points, message;
        if (!hasAliases) {
            status = 'pass';
            points = 3;
            message = 'No model aliases configured — using defaults';
        } else if (invalidAliases.length === 0) {
            status = 'pass';
            points = 3;
            message = 'All model aliases reference valid models';
        } else {
            status = 'warn';
            points = 1;
            const examples = invalidAliases.slice(0, 3).map(a => `${a.alias}: ${a.reason} (${a.level})`).join('; ');
            message = `${invalidAliases.length} questionable alias(es): ${examples}`;
        }
        checks.push({ name: 'Model alias validity', status, points, maxPoints: 3, message });
    }

    // Check 3: Effort Level Configuration (2 pts)
    {
        let effortLevel = null;
        let effortSource = null;

        for (const { level, data } of allConfigs) {
            if (data.effortLevel) {
                effortLevel = data.effortLevel;
                effortSource = level;
            }
        }

        // Also check env
        if (!effortLevel && process.env.CLAUDE_CODE_EFFORT) {
            effortLevel = process.env.CLAUDE_CODE_EFFORT;
            effortSource = 'env';
        }

        let status, points, message;
        if (!effortLevel) {
            status = 'pass';
            points = 2;
            message = 'No effort level set — using default (high)';
        } else if (VALID_EFFORT_LEVELS.includes(effortLevel.toLowerCase())) {
            status = 'pass';
            points = 2;
            message = `Effort level: ${effortLevel} (${effortSource})`;
        } else {
            status = 'fail';
            points = 0;
            message = `Invalid effort level "${effortLevel}" (${effortSource}) — valid: ${VALID_EFFORT_LEVELS.join(', ')}`;
        }
        checks.push({ name: 'Effort level', status, points, maxPoints: 2, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Model Configuration',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
