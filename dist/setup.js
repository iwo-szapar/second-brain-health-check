#!/usr/bin/env node
/**
 * Setup CLI for Second Brain Health Check + Guide.
 *
 * Configures local MCP (always) and remote Guide MCP (if token provided).
 * Run via: npx second-brain-health-check setup
 */

import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const REMOTE_MCP_URL = 'https://factory.secondbrain.dev/api/mcp';
const LOCAL_MCP_NAME = 'second-brain-health';
const REMOTE_MCP_NAME = 'second-brain-guide';

// ── Helpers ──────────────────────────────────────────────────────────────────

function dim(s) { return `\x1b[2m${s}\x1b[0m`; }
function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function cyan(s) { return `\x1b[36m${s}\x1b[0m`; }

function ask(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function claudeCliAvailable() {
    try {
        execFileSync('claude', ['--version'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function execClaude(args) {
    try {
        return execFileSync('claude', args, { stdio: 'pipe', encoding: 'utf-8' }).trim();
    } catch {
        return null;
    }
}

/**
 * Read the project-level Claude settings file (.claude/settings.json).
 * Returns { path, data } or null.
 */
function readClaudeSettings() {
    // Project-level settings (current directory)
    const projectPath = join(process.cwd(), '.claude', 'settings.json');
    if (existsSync(projectPath)) {
        try {
            return { path: projectPath, data: JSON.parse(readFileSync(projectPath, 'utf-8')) };
        } catch { /* corrupted — will recreate */ }
    }

    // User-level settings
    const userPath = join(homedir(), '.claude', 'settings.json');
    if (existsSync(userPath)) {
        try {
            return { path: userPath, data: JSON.parse(readFileSync(userPath, 'utf-8')) };
        } catch { /* corrupted */ }
    }

    return null;
}

/**
 * Find existing SBF_TOKEN from env or Claude settings.
 */
function findExistingToken() {
    if (process.env.SBF_TOKEN) return process.env.SBF_TOKEN;
    if (process.env.GUIDE_TOKEN) return process.env.GUIDE_TOKEN;

    const settings = readClaudeSettings();
    if (settings?.data?.env?.SBF_TOKEN) return settings.data.env.SBF_TOKEN;

    return null;
}

/**
 * Add SBF_TOKEN to the project-level .claude/settings.json env block.
 */
function saveTokenToSettings(token) {
    const projectDir = join(process.cwd(), '.claude');
    const settingsPath = join(projectDir, 'settings.json');

    let data = {};
    if (existsSync(settingsPath)) {
        try {
            data = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        } catch { /* start fresh */ }
    }

    if (!data.env) data.env = {};
    data.env.SBF_TOKEN = token;

    if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(data, null, 2) + '\n');
    return settingsPath;
}

// ── Main Setup Flow ─────────────────────────────────────────────────────────

export async function runSetup() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log(bold('Second Brain Health Check — Setup'));
    console.log(dim('Configures MCP servers for Claude Code\n'));

    // Step 0: Check claude CLI
    if (!claudeCliAvailable()) {
        console.log(red('Error: Claude Code CLI not found.'));
        console.log('Install it first: https://docs.anthropic.com/en/docs/claude-code/overview');
        console.log('');
        console.log(dim('Manual setup (without CLI):'));
        console.log(dim('  Add to .claude/settings.json mcpServers block:'));
        console.log(dim('  "second-brain-health": { "command": "npx", "args": ["second-brain-health-check"] }'));
        rl.close();
        process.exit(1);
    }

    // Step 1: Check for existing token
    const existingToken = findExistingToken();
    let token = existingToken;

    if (existingToken) {
        console.log(green('Found existing token: ') + dim(existingToken.slice(0, 8) + '...'));
        const answer = await ask(rl, 'Use this token? (Y/n) ');
        if (answer.toLowerCase() === 'n') {
            token = null;
        }
    }

    if (!token) {
        console.log('Enter your token from the purchase email.');
        console.log(dim('Press Enter to skip (free tier — health check tools only).\n'));
        const input = await ask(rl, 'Token: ');
        token = input.trim() || null;

        if (token && !token.startsWith('sbf_')) {
            console.log(yellow('\nWarning: Token should start with "sbf_". Proceeding anyway.\n'));
        }
    }

    const isPaid = !!token;

    // Step 2: Configure local MCP
    console.log('\n' + bold('Configuring local MCP...'));
    let localResult = execClaude(['mcp', 'add', LOCAL_MCP_NAME, '--', 'npx', 'second-brain-health-check']);
    if (localResult !== null) {
        console.log(green('  + ') + `${LOCAL_MCP_NAME} added`);
    } else {
        // Try removing first in case it exists, then re-add
        execClaude(['mcp', 'remove', LOCAL_MCP_NAME]);
        const retry = execClaude(['mcp', 'add', LOCAL_MCP_NAME, '--', 'npx', 'second-brain-health-check']);
        if (retry !== null) {
            console.log(green('  + ') + `${LOCAL_MCP_NAME} added (replaced existing)`);
        } else {
            console.log(yellow('  ~ ') + `${LOCAL_MCP_NAME} may already be configured`);
        }
    }

    // Step 3: Save token and configure remote MCP (paid only)
    if (isPaid) {
        console.log(bold('\nSaving token...'));
        try {
            const settingsPath = saveTokenToSettings(token);
            console.log(green('  + ') + `SBF_TOKEN saved to ${dim(settingsPath)}`);
        } catch (err) {
            console.log(yellow('  ~ ') + `Could not save token automatically: ${err.message}`);
            console.log(dim('    Add manually: SBF_TOKEN=' + token + ' in your environment'));
        }

        console.log(bold('\nConfiguring remote Guide MCP...'));
        const header = `Authorization: Bearer ${token}`;
        execClaude(['mcp', 'remove', REMOTE_MCP_NAME]);
        const remoteResult = execClaude([
            'mcp', 'add', REMOTE_MCP_NAME,
            '--transport', 'http',
            '--url', REMOTE_MCP_URL,
            '--header', header
        ]);
        if (remoteResult !== null) {
            console.log(green('  + ') + `${REMOTE_MCP_NAME} added`);
        } else {
            console.log(yellow('  ~ ') + `Could not add remote MCP automatically.`);
            console.log(dim('    Run manually:'));
            console.log(dim(`    claude mcp add ${REMOTE_MCP_NAME} --transport http --url ${REMOTE_MCP_URL} --header "${header}"`));
        }
    }

    // Step 4: Run first health check
    console.log('\n' + bold('Running first health check...'));
    try {
        const { runHealthCheck } = await import('./health-check.js');
        const { formatReport } = await import('./report-formatter.js');

        const report = await runHealthCheck(process.cwd());

        // Calculate overall from dimension scores
        const overallMax = report.setup.maxPoints + report.usage.maxPoints + report.fluency.maxPoints;
        const overallPts = report.setup.totalPoints + report.usage.totalPoints + report.fluency.totalPoints;
        const overall = overallMax > 0 ? Math.round((overallPts / overallMax) * 100) : 0;
        const maturity = report.brainState?.maturity || 'unknown';
        const setup = report.setup?.normalizedScore ?? '?';
        const usage = report.usage?.normalizedScore ?? '?';
        const fluency = report.fluency?.normalizedScore ?? '?';

        console.log('');
        console.log(bold('  Brain Maturity: ') + cyan(maturity));
        console.log(bold('  Overall Score:  ') + `${overall}%`);
        console.log(`    Setup Quality: ${setup}%`);
        console.log(`    Usage Activity: ${usage}%`);
        console.log(`    AI Fluency: ${fluency}%`);

        // Save .health-check.json
        try {
            const jsonPath = join(process.cwd(), '.health-check.json');
            writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
            console.log(dim(`\n  Saved: ${jsonPath}`));
        } catch { /* non-critical */ }
    } catch (err) {
        console.log(yellow('  Could not run health check: ') + err.message);
        console.log(dim('  You can run it later: ask Claude to use check_health'));
    }

    // Step 5: Next steps
    console.log('\n' + bold('--- Next Steps ---\n'));

    if (isPaid) {
        console.log('  Your Guide MCP is connected. In Claude Code, try:');
        console.log(cyan('    "Run optimize_brain to level up my Second Brain"'));
        console.log(cyan('    "Run weekly_pulse to see my progress"'));
        console.log(cyan('    "Onboard me — set up my Second Brain from scratch"'));
        console.log('');
        console.log(dim('  Free tools also available: check_health, get_fix_suggestions, generate_dashboard'));
    } else {
        console.log('  Health Check is ready. In Claude Code, try:');
        console.log(cyan('    "Run check_health on this project"'));
        console.log(cyan('    "Show me fix suggestions for my weakest area"'));
        console.log(cyan('    "Generate a health dashboard"'));
        console.log('');
        console.log(dim('  Upgrade for optimize_brain, weekly_pulse, and guided onboarding:'));
        console.log(dim('  https://www.iwoszapar.com/second-brain-ai'));
    }

    console.log('');
    rl.close();
}

// Run if called directly
runSetup().catch((err) => {
    console.error(red(`Setup failed: ${err.message}`));
    process.exit(1);
});
