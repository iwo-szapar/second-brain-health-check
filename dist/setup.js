#!/usr/bin/env node
/**
 * Setup CLI for Second Brain Health Check + Guide.
 *
 * Flow (OpenClaw-inspired):
 *   1. Token (free/paid gate)
 *   2. Configure MCPs
 *   3. Profile: role, experience, goal (one question at a time, Enter = default)
 *   4. Health check + dashboard
 *   5. Personalized next steps
 *
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

// ── Profile Options ──────────────────────────────────────────────────────────

const ROLES = [
    { key: 'developer',        label: 'Developer / Engineer' },
    { key: 'pm',               label: 'Product Manager' },
    { key: 'founder',          label: 'Founder / Executive' },
    { key: 'consultant',       label: 'Consultant / Advisor' },
    { key: 'content_creator',  label: 'Content Creator / Writer' },
    { key: 'sales',            label: 'Sales / Business Development' },
    { key: 'ops',              label: 'Operations / Project Manager' },
    { key: 'researcher',       label: 'Researcher / Analyst' },
];

const EXPERIENCE_LEVELS = [
    { key: 'beginner',     label: 'Beginner — just getting started with Claude Code' },
    { key: 'intermediate', label: 'Intermediate — use it regularly' },
    { key: 'power_user',   label: 'Power User — custom skills, hooks, MCPs' },
];

const GOALS = [
    { key: 'ship_faster',       label: 'Ship code faster' },
    { key: 'better_docs',       label: 'Better documentation & knowledge management' },
    { key: 'automate',          label: 'Automate repetitive workflows' },
    { key: 'organize',          label: 'Organize knowledge & reduce context switching' },
];

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

/**
 * Interactive arrow-key selector. Up/Down to move, Enter to confirm.
 * Falls back to number input if raw mode unavailable (piped stdin).
 */
async function askChoice(rl, question, options, defaultIndex = 0) {
    // Fallback for non-TTY (piped input)
    if (!process.stdin.isTTY) {
        console.log(bold(question));
        for (let i = 0; i < options.length; i++) {
            const marker = i === defaultIndex ? green('>') : ' ';
            console.log(`  ${marker} ${i + 1}. ${options[i].label}`);
        }
        const input = await ask(rl, '  > ');
        const num = parseInt(input.trim(), 10);
        if (num >= 1 && num <= options.length) return options[num - 1];
        return options[defaultIndex];
    }

    return new Promise((resolve) => {
        let selected = defaultIndex;
        const HIDE_CURSOR = '\x1b[?25l';
        const SHOW_CURSOR = '\x1b[?25h';
        const MOVE_UP = (n) => `\x1b[${n}A`;
        const CLEAR_LINE = '\x1b[2K\r';

        function render(firstTime) {
            if (!firstTime) {
                // Move cursor up to redraw options
                process.stdout.write(MOVE_UP(options.length));
            }
            for (let i = 0; i < options.length; i++) {
                process.stdout.write(CLEAR_LINE);
                if (i === selected) {
                    process.stdout.write(`  ${cyan('>')} ${bold(options[i].label)}\n`);
                } else {
                    process.stdout.write(`    ${dim(options[i].label)}\n`);
                }
            }
        }

        console.log(bold(question));
        console.log(dim('  Use arrow keys to move, Enter to select\n'));
        process.stdout.write(HIDE_CURSOR);
        render(true);

        // Switch to raw mode for keypress detection
        process.stdin.setRawMode(true);
        process.stdin.resume();

        function onData(key) {
            // Up arrow: \x1b[A
            if (key[0] === 0x1b && key[1] === 0x5b && key[2] === 0x41) {
                selected = selected > 0 ? selected - 1 : options.length - 1;
                render(false);
            }
            // Down arrow: \x1b[B
            else if (key[0] === 0x1b && key[1] === 0x5b && key[2] === 0x42) {
                selected = selected < options.length - 1 ? selected + 1 : 0;
                render(false);
            }
            // Enter
            else if (key[0] === 0x0d) {
                cleanup();
                resolve(options[selected]);
            }
            // Number keys 1-9
            else if (key[0] >= 0x31 && key[0] <= 0x39) {
                const num = key[0] - 0x30;
                if (num >= 1 && num <= options.length) {
                    selected = num - 1;
                    render(false);
                    cleanup();
                    resolve(options[selected]);
                }
            }
            // Ctrl+C
            else if (key[0] === 0x03) {
                cleanup();
                process.exit(0);
            }
        }

        function cleanup() {
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write(SHOW_CURSOR);
        }

        process.stdin.on('data', onData);
    });
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

function readClaudeSettings() {
    const projectPath = join(process.cwd(), '.claude', 'settings.json');
    if (existsSync(projectPath)) {
        try {
            return { path: projectPath, data: JSON.parse(readFileSync(projectPath, 'utf-8')) };
        } catch { /* corrupted — will recreate */ }
    }
    const userPath = join(homedir(), '.claude', 'settings.json');
    if (existsSync(userPath)) {
        try {
            return { path: userPath, data: JSON.parse(readFileSync(userPath, 'utf-8')) };
        } catch { /* corrupted */ }
    }
    return null;
}

function findExistingToken() {
    if (process.env.SBF_TOKEN) return process.env.SBF_TOKEN;
    if (process.env.GUIDE_TOKEN) return process.env.GUIDE_TOKEN;
    const settings = readClaudeSettings();
    if (settings?.data?.env?.SBF_TOKEN) return settings.data.env.SBF_TOKEN;
    return null;
}

function saveTokenToSettings(token) {
    const projectDir = join(process.cwd(), '.claude');
    const settingsPath = join(projectDir, 'settings.json');
    let data = {};
    if (existsSync(settingsPath)) {
        try { data = JSON.parse(readFileSync(settingsPath, 'utf-8')); } catch { /* start fresh */ }
    }
    if (!data.env) data.env = {};
    data.env.SBF_TOKEN = token;
    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(data, null, 2) + '\n');
    return settingsPath;
}

// ── Personalized Next Steps ──────────────────────────────────────────────────

function getNextSteps(profile, isPaid) {
    const { role, experience, goal } = profile;
    const steps = [];

    if (isPaid) {
        steps.push('Your Guide MCP is connected. In Claude Code, try:\n');

        // First suggestion: always context_pressure (universal value)
        steps.push(cyan('  "Run context_pressure to see what eats your context window"'));

        // Role-specific suggestion
        if (role === 'developer' || role === 'researcher') {
            steps.push(cyan('  "Run audit_config to find dead references and security issues"'));
        } else if (role === 'content_creator' || role === 'sales') {
            steps.push(cyan('  "Run optimize_brain to improve my knowledge organization"'));
        } else if (role === 'founder' || role === 'ops') {
            steps.push(cyan('  "Run weekly_pulse to track my productivity trends"'));
        } else {
            steps.push(cyan('  "Run weekly_pulse to see my progress over time"'));
        }

        // Experience-specific suggestion
        if (experience === 'beginner') {
            steps.push(cyan('  "Show me fix suggestions for my weakest area"'));
        } else if (experience === 'power_user') {
            steps.push(cyan('  "Run audit_config to check for unused tools and conflicts"'));
        } else {
            steps.push(cyan('  "Run optimize_brain to level up my Second Brain"'));
        }

        steps.push('');
        steps.push(dim('Free tools also available: check_health, get_fix_suggestions, generate_dashboard'));
    } else {
        steps.push('Health Check is ready. In Claude Code, try:\n');
        steps.push(cyan('  "Run check_health on this project"'));
        steps.push(cyan('  "Show me fix suggestions for my weakest area"'));

        // Goal-specific free suggestion
        if (goal === 'organize') {
            steps.push(cyan('  "Generate a health dashboard to see my brain structure"'));
        } else {
            steps.push(cyan('  "Generate a health dashboard"'));
        }

        steps.push('');
        steps.push(dim('Upgrade for context_pressure, audit_config, weekly_pulse, and guided optimization:'));
        steps.push(dim('https://www.iwoszapar.com/second-brain-ai'));
    }

    return steps;
}

// ── Main Setup Flow ─────────────────────────────────────────────────────────

export async function runSetup() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log(bold('Second Brain Health Check — Setup'));
    console.log(dim('Configures MCP servers + profiles your setup for personalized recommendations\n'));

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

    // Step 1: Token
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

    // Step 2: Configure MCPs
    console.log('\n' + bold('Configuring local MCP...'));
    let localResult = execClaude(['mcp', 'add', LOCAL_MCP_NAME, '--', 'npx', 'second-brain-health-check']);
    if (localResult !== null) {
        console.log(green('  + ') + `${LOCAL_MCP_NAME} added`);
    } else {
        execClaude(['mcp', 'remove', LOCAL_MCP_NAME]);
        const retry = execClaude(['mcp', 'add', LOCAL_MCP_NAME, '--', 'npx', 'second-brain-health-check']);
        if (retry !== null) {
            console.log(green('  + ') + `${LOCAL_MCP_NAME} added (replaced existing)`);
        } else {
            console.log(yellow('  ~ ') + `${LOCAL_MCP_NAME} may already be configured`);
        }
    }

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

    // Step 3: Profile (one question at a time, Enter = default)
    console.log('\n' + bold('--- Quick Profile ---'));
    console.log(dim('3 quick questions to personalize your experience. Press Enter to skip any.\n'));

    const roleChoice = await askChoice(rl, 'What\'s your primary role?', ROLES, 0);
    console.log(green('  -> ') + roleChoice.label + '\n');

    const expChoice = await askChoice(rl, 'How familiar are you with Claude Code?', EXPERIENCE_LEVELS, 1);
    console.log(green('  -> ') + expChoice.label + '\n');

    const goalChoice = await askChoice(rl, 'What\'s your #1 priority?', GOALS, 0);
    console.log(green('  -> ') + goalChoice.label + '\n');

    const profile = {
        role: roleChoice.key,
        experience: expChoice.key,
        goal: goalChoice.key,
        created_at: new Date().toISOString(),
    };

    // Step 4: Health check + dashboard
    console.log(bold('Running first health check...'));
    let report = null;
    try {
        const { runHealthCheck } = await import('./health-check.js');

        report = await runHealthCheck(process.cwd());

        // Attach profile to report
        report.profile = profile;

        const overallMax = report.setup.maxPoints + report.usage.maxPoints + report.fluency.maxPoints;
        const overallPts = report.setup.totalPoints + report.usage.totalPoints + report.fluency.totalPoints;
        const overall = overallMax > 0 ? Math.round((overallPts / overallMax) * 100) : 0;
        const maturity = report.brainState?.maturity || 'unknown';
        const setupScore = report.setup?.normalizedScore ?? '?';
        const usageScore = report.usage?.normalizedScore ?? '?';
        const fluencyScore = report.fluency?.normalizedScore ?? '?';

        console.log('');
        console.log(bold('  Brain Maturity: ') + cyan(maturity));
        console.log(bold('  Overall Score:  ') + `${overall}%`);
        console.log(`    Setup Quality: ${setupScore}%`);
        console.log(`    Usage Activity: ${usageScore}%`);
        console.log(`    AI Fluency: ${fluencyScore}%`);

        // Save .health-check.json (with profile)
        try {
            const jsonPath = join(process.cwd(), '.health-check.json');
            writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
            console.log(dim(`\n  Saved: ${jsonPath}`));
        } catch { /* non-critical */ }

        // Generate and open HTML dashboard
        try {
            const { saveDashboard } = await import('./dashboard/generate.js');
            const dashPath = await saveDashboard(report);
            console.log(dim('  Dashboard: ' + dashPath));

            const { execFile } = await import('node:child_process');
            execFile('open', [dashPath], (err) => {
                if (err) {
                    execFile('xdg-open', [dashPath], () => { /* no-op */ });
                }
            });
        } catch { /* non-critical */ }
    } catch (err) {
        console.log(yellow('  Could not run health check: ') + err.message);
        console.log(dim('  You can run it later: ask Claude to use check_health'));

        // Still save profile even if health check fails
        try {
            const jsonPath = join(process.cwd(), '.health-check.json');
            let existing = {};
            if (existsSync(jsonPath)) {
                try { existing = JSON.parse(readFileSync(jsonPath, 'utf-8')); } catch { /* start fresh */ }
            }
            existing.profile = profile;
            writeFileSync(jsonPath, JSON.stringify(existing, null, 2) + '\n');
        } catch { /* non-critical */ }
    }

    // Step 5: Personalized next steps
    console.log('\n' + bold('--- Next Steps ---\n'));
    const steps = getNextSteps(profile, isPaid);
    for (const step of steps) {
        console.log('  ' + step);
    }

    console.log('');
    rl.close();
}

// Run if called directly
runSetup().catch((err) => {
    console.error(red(`Setup failed: ${err.message}`));
    process.exit(1);
});
