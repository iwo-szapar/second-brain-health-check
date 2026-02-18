#!/usr/bin/env node
/**
 * CLI entry point for Second Brain Health Check.
 *
 * Usage:
 *   npx second-brain-health-check [path]              Text report
 *   npx second-brain-health-check --dashboard [path]   HTML dashboard
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
  npx second-brain-health-check [path]              Text report (default)
  npx second-brain-health-check --dashboard [path]   HTML dashboard
  npx second-brain-health-check --pdf [path]         PDF report (needs Chrome)

Options:
  --dashboard   Generate HTML dashboard and open in browser
  --pdf         Generate PDF report via headless Chrome
  --help, -h    Show this help

Path defaults to current directory. Must contain a CLAUDE.md file.

MCP Server:
  claude mcp add second-brain-health -- npx second-brain-health-check`);
    process.exit(0);
}

const flags = ['--pdf', '--dashboard'];
const pdfFlag = args.includes('--pdf');
const dashboardFlag = args.includes('--dashboard');
const pathArgs = args.filter((a) => !flags.includes(a));
const path = pathArgs[0] || process.cwd();

try {
    if (pdfFlag) {
        const pdfPath = await generatePdf(path);
        console.log(`PDF report saved to: ${pdfPath}`);
    } else if (dashboardFlag) {
        const report = await runHealthCheck(path);
        const filePath = await saveDashboard(report);
        console.log(`Dashboard saved to: ${filePath}`);
        // Try to open in browser using execFile (safe, no shell injection)
        const { execFile } = await import('node:child_process');
        execFile('open', [filePath], (err) => {
            if (err) {
                execFile('xdg-open', [filePath], () => { /* no-op on failure */ });
            }
        });
    } else {
        const report = await runHealthCheck(path);
        console.log(formatReport(report));
    }
} catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
}
