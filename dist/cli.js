#!/usr/bin/env node
/**
 * CLI entry point for Second Brain Health Check.
 *
 * Usage:
 *   npx second-brain-health-check [path]              Text report + dashboard (default)
 *   npx second-brain-health-check --no-open [path]    Text report only, no browser
 *   npx second-brain-health-check --pdf [path]         PDF report (needs Chrome)
 *   npx second-brain-health-check --yes [path]         Skip consent prompt (CI/automation)
 *   npx second-brain-health-check --help               Show usage
 */
import { runHealthCheck } from './health-check.js';
import { formatReport } from './report-formatter.js';
import { saveDashboard } from './dashboard/generate.js';
import { generatePdf } from './tools/generate-pdf.js';
import { createInterface } from 'node:readline';

// ── ANSI color helpers (no-op if stdout is not a TTY) ───────────────────────
const isTTY = Boolean(process.stdout.isTTY);
function ansi(code) { return isTTY ? `\x1b[${code}m` : ''; }
const c = {
    r:     ansi(0),
    bold:  ansi(1),
    dim:   ansi(2),
    cyan:  ansi(36),
    amber: ansi(33),
    gray:  ansi(90),
    white: ansi(97),
    green: ansi(32),
    red:   ansi(31),
};
const out = (s = '') => process.stdout.write(s + '\n');

// ── Privacy section ──────────────────────────────────────────────────────────
function printPrivacySection() {
    const cols = (isTTY && process.stdout.columns) ? Math.min(process.stdout.columns, 76) : 72;
    const fillWidth = cols - 6;
    const dash = (n) => c.gray + '─'.repeat(Math.max(n, 1)) + c.r;

    out();
    out(`  ${c.amber}◇ ${c.r}${c.bold}${c.white}Privacy${c.r} ${dash(fillWidth - 5)}`);
    out();
    out(`    This tool runs entirely on your machine.`);
    out(`    Zero network calls. Zero telemetry. Nothing leaves your machine.`);
    out();
    out(`    ${c.dim}Reads:${c.r}`);
    out(`    ${c.gray}─${c.r}  CLAUDE.md, .claude/ skills, hooks, agents, memory/ structure`);
    out(`    ${c.gray}─${c.r}  Hook scripts are analyzed for patterns, not executed`);
    out();
    out(`    ${c.dim}Does not read:${c.r}`);
    out(`    ${c.gray}─${c.r}  Code files, emails, documents, or secrets`);
    out(`    ${c.gray}─${c.r}  Anything outside the path you provide`);
    out();
    out(`    ${c.gray}Source: github.com/iwo-szapar/second-brain-health-check${c.r}`);
    out();
}

// ── Interactive Yes/No prompt ────────────────────────────────────────────────
// Tries raw-mode arrow-key selection first; falls back to readline if not a TTY.
async function confirmContinue() {
    // Test if raw mode is available (real interactive terminal)
    let canRawMode = false;
    try {
        process.stdin.setRawMode(true);
        process.stdin.setRawMode(false);
        canRawMode = true;
    } catch {
        canRawMode = false;
    }

    if (canRawMode) {
        return rawModePrompt();
    } else {
        return readlinePrompt();
    }
}

function rawModePrompt() {
    return new Promise((resolve) => {
        let selected = 0; // 0 = Yes, 1 = No

        const renderOptions = () => {
            const yes = selected === 0
                ? `${c.green}● Yes${c.r}`
                : `${c.dim}○ Yes${c.r}`;
            const no = selected === 1
                ? `${c.red}● No${c.r}`
                : `${c.dim}○ No${c.r}`;
            process.stdout.write(`\x1b[2K\r  ${yes}  ${c.gray}/${c.r}  ${no}`);
        };

        const cleanup = (answer) => {
            try { process.stdin.setRawMode(false); } catch {}
            process.stdin.pause();
            process.stdin.removeAllListeners('data');
            if (isTTY) process.stdout.write('\x1b[?25h'); // restore cursor
            process.stdout.write('\n\n');
            resolve(answer);
        };

        process.stdout.write(
            `  ${c.amber}◆${c.r} ${c.cyan}Runs locally, reads config files only. Continue?${c.r}\n`
        );
        renderOptions();
        if (isTTY) process.stdout.write('\x1b[?25l'); // hide cursor during selection

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (key) => {
            if (key === '\x03') { cleanup(false); process.exit(0); }                  // Ctrl+C
            if (key === '\x1b[D' || key === '\x1b[C') {                              // arrows
                selected = selected === 0 ? 1 : 0;
                renderOptions();
                return;
            }
            if (key === '\r' || key === '\n') { cleanup(selected === 0); return; }   // Enter
            if (key.toLowerCase() === 'y') { cleanup(true); return; }
            if (key.toLowerCase() === 'n' || key === '\x1b') { cleanup(false); return; }
        });
    });
}

function readlinePrompt() {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(
            `  ${c.amber}◆${c.r} ${c.cyan}Runs locally, reads config files only. Continue?${c.r} ${c.dim}[Y/n]${c.r} `,
            (answer) => {
                rl.close();
                process.stdout.write('\n');
                resolve(answer.trim().toLowerCase() !== 'n');
            }
        );
    });
}

// ── Argument parsing ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`Second Brain Health Check

Usage:
  npx second-brain-health-check [path]              Text report + open dashboard (default)
  npx second-brain-health-check --no-open [path]    Text report only, skip browser
  npx second-brain-health-check --pdf [path]         PDF report via headless Chrome
  npx second-brain-health-check --yes [path]         Skip consent prompt (CI/automation)

Options:
  --no-open     Skip opening the HTML dashboard in browser
  --pdf         Generate PDF report via headless Chrome
  --yes         Skip privacy consent prompt (for CI or MCP server use)
  --help, -h    Show this help

Path defaults to current directory.

MCP Server:
  claude mcp add second-brain-health -- npx second-brain-health-check`);
    process.exit(0);
}

const flags = ['--pdf', '--no-open', '--dashboard', '--yes'];
const pdfFlag = args.includes('--pdf');
const noOpenFlag = args.includes('--no-open');
const yesFlag = args.includes('--yes');
const pathArgs = args.filter((a) => !flags.includes(a));
const path = pathArgs[0] || process.cwd();

// ── Privacy consent ───────────────────────────────────────────────────────────
// Always shown unless --yes is passed (for CI / MCP server / automation use).
if (!yesFlag) {
    printPrivacySection();
    const confirmed = await confirmContinue();
    if (!confirmed) {
        out(`  ${c.dim}Exited. No files were read.${c.r}`);
        out();
        process.exit(0);
    }
    out();
}

// ── Run health check ──────────────────────────────────────────────────────────
try {
    if (pdfFlag) {
        const pdfPath = await generatePdf(path);
        console.log(`PDF report saved to: ${pdfPath}`);
    } else {
        const report = await runHealthCheck(path);
        console.log(formatReport(report));

        // Always generate dashboard and open in browser unless --no-open
        const filePath = await saveDashboard(report);
        console.log(`\nDashboard: ${filePath}`);

        if (!noOpenFlag) {
            const { execFile } = await import('node:child_process');
            execFile('open', [filePath], (err) => {
                if (err) {
                    execFile('xdg-open', [filePath], () => { /* no-op on failure */ });
                }
            });
        }
    }
} catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
}
