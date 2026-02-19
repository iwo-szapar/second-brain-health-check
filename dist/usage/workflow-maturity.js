/**
 * Usage Layer: Workflow Maturity
 *
 * Measures the sophistication of automated workflows by looking at
 * skill invocation logs, command definitions, and evidence of
 * repeated skill usage over time.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function fileExists(filePath) {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

async function countMdFiles(dirPath) {
    try {
        const entries = await readdir(dirPath, { recursive: true });
        return entries.filter(e => e.endsWith('.md')).length;
    } catch {
        return 0;
    }
}

export async function checkWorkflowMaturity(rootPath) {
    const checks = [];

    // Check 1: Skill invocation evidence (4 pts)
    // Look for invocation logs, usage data, or workflow traces
    {
        const invocationPaths = [
            join(rootPath, 'memory', 'episodic', 'skill-invocations.jsonl'),
            join(rootPath, '.claude', 'skill-invocations.jsonl'),
            join(rootPath, 'memory', 'skill-usage.md'),
        ];

        let logFound = null;
        let lineCount = 0;

        for (const p of invocationPaths) {
            try {
                const content = await readFile(p, 'utf-8');
                logFound = p;
                lineCount = content.split('\n').filter(l => l.trim()).length;
                break;
            } catch {
                continue;
            }
        }

        let status, points, message;
        if (logFound && lineCount >= 20) {
            status = 'pass'; points = 4;
            message = `Skill invocation log found with ${lineCount} entries — workflows are being tracked`;
        } else if (logFound && lineCount >= 5) {
            status = 'warn'; points = 3;
            message = `Skill invocation log exists with ${lineCount} entries — still building usage history`;
        } else if (logFound) {
            status = 'warn'; points = 2;
            message = `Skill invocation log exists but sparse (${lineCount} entries)`;
        } else {
            status = 'fail'; points = 0;
            message = 'No skill invocation logs found — consider tracking skill usage for workflow optimization';
        }
        checks.push({ name: 'Skill invocation evidence', status, points, maxPoints: 4, message });
    }

    // Check 2: Command definitions (3 pts)
    // Commands orchestrate workflows — their existence shows maturity
    {
        const commandsDir = join(rootPath, '.claude', 'commands');
        const commandCount = await countMdFiles(commandsDir);

        let status, points, message;
        if (commandCount >= 3) {
            status = 'pass'; points = 3;
            message = `${commandCount} command definitions — structured workflow entry points`;
        } else if (commandCount >= 1) {
            status = 'warn'; points = 2;
            message = `${commandCount} command(s) defined — commands create repeatable workflow entry points`;
        } else {
            // Check if skills are being used as de facto commands
            const skillCount = await countMdFiles(join(rootPath, '.claude', 'skills'));
            if (skillCount >= 5) {
                status = 'warn'; points = 1;
                message = `No commands but ${skillCount} skills — consider adding commands to orchestrate skill chains`;
            } else {
                status = 'fail'; points = 0;
                message = 'No commands in .claude/commands/ — commands define repeatable workflows';
            }
        }
        checks.push({ name: 'Command definitions', status, points, maxPoints: 3, message });
    }

    // Check 3: Workflow diversity (3 pts)
    // How many different categories of workflows exist (code, content, ops, research, etc.)
    {
        const skillsDir = join(rootPath, '.claude', 'skills');
        let skillNames = [];
        try {
            const entries = await readdir(skillsDir);
            skillNames = entries.filter(e => !e.startsWith('.'));
        } catch {
            // no skills
        }

        // Categorize by naming patterns
        const categories = new Set();
        const categoryPatterns = {
            development: /code|dev|build|test|lint|deploy|review|debug|fix|refactor|migrate/i,
            content: /content|write|blog|newsletter|post|draft|essay|article|publish/i,
            operations: /crm|prospect|lead|sales|outreach|email|pipeline|campaign/i,
            research: /research|analyze|explore|search|investigate|evaluate|audit/i,
            workflow: /workflow|orchestrat|automat|schedule|sync|track|monitor/i,
        };

        for (const name of skillNames) {
            for (const [category, pattern] of Object.entries(categoryPatterns)) {
                if (pattern.test(name)) {
                    categories.add(category);
                }
            }
        }

        let status, points, message;
        if (categories.size >= 3) {
            status = 'pass'; points = 3;
            message = `Skills span ${categories.size} workflow categories: ${[...categories].join(', ')}`;
        } else if (categories.size >= 2) {
            status = 'warn'; points = 2;
            message = `Skills cover ${categories.size} categories (${[...categories].join(', ')}) — expand to more workflow types`;
        } else if (skillNames.length >= 3) {
            status = 'warn'; points = 1;
            message = `${skillNames.length} skills but concentrated in ${categories.size || 'uncategorized'} area(s)`;
        } else {
            status = 'fail'; points = 0;
            message = 'Too few skills to assess workflow diversity';
        }
        checks.push({ name: 'Workflow diversity', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Workflow Maturity',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
