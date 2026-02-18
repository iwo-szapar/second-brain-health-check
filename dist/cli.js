#!/usr/bin/env node
/**
 * CLI entry point for Second Brain Health Check.
 * Run without Claude Code or MCP:
 *   node packages/second-brain-health-check/dist/cli.js [path]
 *   node packages/second-brain-health-check/dist/cli.js --pdf [path]
 */
import { runHealthCheck } from './health-check.js';
import { formatReport } from './report-formatter.js';
import { generatePdf } from './tools/generate-pdf.js';

const args = process.argv.slice(2);
const pdfFlag = args.includes('--pdf');
const pathArgs = args.filter((a) => a !== '--pdf');
const path = pathArgs[0] || process.cwd();

try {
    if (pdfFlag) {
        const pdfPath = await generatePdf(path);
        console.log(`PDF report saved to: ${pdfPath}`);
    } else {
        const report = await runHealthCheck(path);
        console.log(formatReport(report));
    }
} catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
}
