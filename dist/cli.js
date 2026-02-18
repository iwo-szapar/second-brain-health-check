#!/usr/bin/env node
/**
 * CLI entry point for Second Brain Health Check.
 * Run without Claude Code or MCP:
 *   node packages/second-brain-health-check/dist/cli.js [path]
 */
import { runHealthCheck } from './health-check.js';
import { formatReport } from './report-formatter.js';

const path = process.argv[2] || process.cwd();

try {
    const report = await runHealthCheck(path);
    console.log(formatReport(report));
} catch (error) {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
}
