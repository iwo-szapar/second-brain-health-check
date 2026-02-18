#!/usr/bin/env node
/**
 * Second Brain Health Check — MCP Server
 *
 * QA validation tool for AI workspace configurations.
 * Checks setup quality, usage activity, and AI fluency.
 *
 * Install: claude mcp add second-brain-health -- npx second-brain-health-check
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runHealthCheck } from './health-check.js';
import { formatReport, formatFixSuggestions } from './report-formatter.js';
import { generateDashboardHtml, saveDashboard } from './dashboard/generate.js';
import { generatePdf } from './tools/generate-pdf.js';
const server = new McpServer({
    name: 'second-brain-health-check',
    version: '0.2.0',
});
const pathSchema = z
    .string()
    .max(4096)
    .refine((p) => !p.includes('\0'), 'Path must not contain null bytes')
    .optional();
// Tool 1: check_health
server.registerTool('check_health', {
    description: 'Run a full health check on your Second Brain setup. ' +
        'Validates configuration quality (CLAUDE.md, skills, hooks, memory structure), ' +
        'checks usage activity (session history, pattern growth, compound learning), ' +
        'and measures AI fluency (progressive disclosure, skill orchestration, context-awareness). ' +
        'Returns a detailed report with three scores and actionable fix suggestions.',
    inputSchema: {
        path: pathSchema
            .describe('Path to the Second Brain root directory. ' +
            'Defaults to current working directory. ' +
            'Should contain CLAUDE.md at its root.'),
    },
}, async ({ path }) => {
    try {
        const report = await runHealthCheck(path);
        const formatted = formatReport(report);
        return {
            content: [{ type: 'text', text: formatted }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `Health check failed: ${message}` }],
            isError: true,
        };
    }
});
// Tool 2: get_fix_suggestions
server.registerTool('get_fix_suggestions', {
    description: 'Get specific fix suggestions for the lowest-performing area of your Second Brain setup. ' +
        'Runs a health check and then generates a prioritized action plan ' +
        'for the highest-impact improvements.',
    inputSchema: {
        path: pathSchema
            .describe('Path to the Second Brain root directory. Defaults to current working directory.'),
        focus: z
            .enum(['setup', 'usage', 'fluency', 'auto'])
            .optional()
            .describe("Which area to focus on. 'setup' for configuration quality, " +
            "'usage' for activity tracking, 'fluency' for AI collaboration depth, " +
            "'auto' picks the weaker area."),
    },
}, async ({ path, focus }) => {
    try {
        const report = await runHealthCheck(path);
        const formatted = formatFixSuggestions(report, focus || 'auto');
        return {
            content: [{ type: 'text', text: formatted }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `Fix suggestions failed: ${message}` }],
            isError: true,
        };
    }
});
// Tool 3: generate_dashboard
server.registerTool('generate_dashboard', {
    description: 'Generate a beautiful HTML dashboard from health check results. ' +
        'Creates a self-contained HTML file with dark mode, score visualizations, ' +
        'grade badges, and actionable fix suggestions. ' +
        'Perfect for sharing results or taking screenshots.',
    inputSchema: {
        path: pathSchema
            .describe('Path to the Second Brain root directory. Defaults to current working directory.'),
        output: z
            .string()
            .max(4096)
            .optional()
            .describe('Output path for the HTML file. Defaults to health-check-report.html in the current directory.'),
    },
}, async ({ path, output }) => {
    try {
        const report = await runHealthCheck(path);
        const filePath = await saveDashboard(report, output);
        const formatted = formatReport(report);
        return {
            content: [{
                type: 'text',
                text: `Dashboard saved to: ${filePath}\n\n${formatted}`,
            }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `Dashboard generation failed: ${message}` }],
            isError: true,
        };
    }
});
// Tool 4: generate_pdf
server.registerTool('generate_pdf', {
    description: 'Generate PDF report from health check dashboard. ' +
        'Runs a full health check, renders the HTML dashboard, and converts it to PDF ' +
        'using headless Chrome/Chromium. Requires Chrome or Chromium installed.',
    inputSchema: {
        project_path: z
            .string()
            .max(4096)
            .refine((p) => !p.includes('\0'), 'Path must not contain null bytes')
            .describe('Absolute path to project directory.'),
    },
}, async ({ project_path }) => {
    try {
        const pdfPath = await generatePdf(project_path);
        return {
            content: [{
                type: 'text',
                text: `PDF report saved to: ${pdfPath}`,
            }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `PDF generation failed: ${message}` }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Second Brain Health Check MCP server running on stdio (v0.2.0)');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
