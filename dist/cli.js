#!/usr/bin/env node
/**
 * CLI entry point for Second Brain Health Check.
 *
 * Usage:
 *   npx second-brain-health-check [path]              Text report + dashboard (default)
 *   npx second-brain-health-check --no-open [path]    Text report only, no browser
 *   npx second-brain-health-check --pdf [path]         PDF report (needs Chrome)
 *   npx second-brain-health-check --help               Show usage
 */
import { runHealthCheck } from './health-check.js';
import { formatReport } from './report-formatter.js';
import { saveDashboard } from './dashboard/generate.js';
import { generatePdf } from './tools/generate-pdf.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`Second Brain Health Check

Usage:
  npx second-brain-health-check [path]              Text report + open dashboard (default)
  npx second-brain-health-check --no-open [path]    Text report only, skip browser
  npx second-brain-health-check --pdf [path]         PDF report via headless Chrome

Options:
  --no-open     Skip opening the HTML dashboard in browser
  --pdf         Generate PDF report via headless Chrome
  --help, -h    Show this help

Path defaults to current directory. Must contain a CLAUDE.md file.

MCP Server:
  claude mcp add second-brain-health -- npx second-brain-health-check`);
    process.exit(0);
}

const flags = ['--pdf', '--no-open', '--dashboard'];
const pdfFlag = args.includes('--pdf');
const noOpenFlag = args.includes('--no-open');
const pathArgs = args.filter((a) => !flags.includes(a));
const path = pathArgs[0] || process.cwd();

// Privacy notice — printed once before analysis begins
process.stderr.write(
    '\nRuns locally. Zero network calls. Zero telemetry.\n' +
    'Reads: CLAUDE.md, .claude/ config files, memory/ structure — not your code, emails, or documents.\n\n'
);

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
