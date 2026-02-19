#!/usr/bin/env node
/**
 * Second Brain Health Check — MCP Server
 *
 * QA validation tool for AI workspace configurations.
 * Checks setup quality, usage activity, and AI fluency.
 *
 * Install: claude mcp add second-brain-health -- npx second-brain-health-check
 *
 * v0.8.0: Adaptive reports, CE pattern mapping, context pressure check,
 * score-band CTAs, time estimates, mode parameter.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runHealthCheck, detectBrainState } from './health-check.js';
import { formatReport, formatFixSuggestions } from './report-formatter.js';
import { generateDashboardHtml, saveDashboard } from './dashboard/generate.js';
import { generatePdf } from './tools/generate-pdf.js';
const server = new McpServer({
    name: 'second-brain-health-check',
    version: '0.8.0',
});
const pathSchema = z
    .string()
    .max(4096)
    .refine((p) => !p.includes('\0'), 'Path must not contain null bytes')
    .optional();
const SUPPORTED_LANGUAGES = [
    'en', 'es', 'de', 'fr', 'pl', 'pt', 'ja', 'ko', 'zh', 'it', 'nl', 'ru', 'tr', 'ar',
];
const LANGUAGE_LABELS = {
    en: 'English', es: 'Espa\u00f1ol', de: 'Deutsch', fr: 'Fran\u00e7ais',
    pl: 'Polski', pt: 'Portugu\u00eas', ja: '\u65e5\u672c\u8a9e', ko: '\ud55c\uad6d\uc5b4',
    zh: '\u4e2d\u6587', it: 'Italiano', nl: 'Nederlands', ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
    tr: 'T\u00fcrk\u00e7e', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
};
const WORKSPACE_TYPES = ['solo', 'team', 'enterprise'];
const USE_CASES = ['development', 'content', 'operations', 'research', 'mixed'];
function buildLanguagePrompt(lang) {
    if (!lang || lang === 'en') return '';
    const label = LANGUAGE_LABELS[lang] || lang;
    return `\n\nIMPORTANT: Present ALL text output in ${label} (${lang}). ` +
        `Translate check names, messages, grades, and fix suggestions. ` +
        `Keep technical terms (CLAUDE.md, MCP, hooks) untranslated.`;
}
function buildContextNote(workspaceType, useCase) {
    const notes = [];
    if (workspaceType === 'solo') {
        notes.push('Scoring context: Solo workspace — team readiness checks are informational only.');
    } else if (workspaceType === 'team' || workspaceType === 'enterprise') {
        notes.push('Scoring context: Team workspace — team readiness and collaboration checks are weighted higher.');
    }
    if (useCase === 'content') {
        notes.push('Use case: Content creation — sandbox and CI/CD checks are less critical.');
    } else if (useCase === 'development') {
        notes.push('Use case: Software development — all technical checks apply.');
    } else if (useCase === 'operations') {
        notes.push('Use case: Business operations — CRM, email, and workflow checks are key.');
    } else if (useCase === 'research') {
        notes.push('Use case: Research — memory evolution and pattern tracking are key.');
    }
    return notes.length > 0 ? '\n\n' + notes.join('\n') : '';
}
// Tool 1: check_health
server.registerTool('check_health', {
    description: 'Run a full health check on your Second Brain setup. ' +
        'Validates configuration quality (CLAUDE.md, skills, hooks, memory structure), ' +
        'checks usage activity (session history, pattern growth, compound learning), ' +
        'and measures AI fluency (progressive disclosure, skill orchestration, context-awareness). ' +
        'Returns a detailed report with three scores, CE pattern coverage, and actionable fix suggestions with time estimates. ' +
        'Adapts report format based on brain maturity — beginners get a getting-started guide, not a wall of failures.',
    inputSchema: {
        path: pathSchema
            .describe('Path to the Second Brain root directory. ' +
            'Defaults to current working directory. ' +
            'Should contain CLAUDE.md at its root.'),
        language: z
            .enum(SUPPORTED_LANGUAGES)
            .optional()
            .describe('Language for the report output. Defaults to English (en). ' +
            'Available: en, es, de, fr, pl, pt, ja, ko, zh, it, nl, ru, tr, ar.'),
        workspace_type: z
            .enum(WORKSPACE_TYPES)
            .optional()
            .describe("Workspace type for scoring context. 'solo' for individual use, " +
            "'team' for small teams, 'enterprise' for large organizations. " +
            "Affects how team readiness checks are weighted."),
        use_case: z
            .enum(USE_CASES)
            .optional()
            .describe("Primary use case. 'development' for coding, 'content' for writing, " +
            "'operations' for business workflows, 'research' for analysis, 'mixed' for general use. " +
            "Provides scoring context notes."),
        mode: z
            .enum(['full', 'quick'])
            .optional()
            .describe("Scan mode. 'full' (default) runs all 38 check layers. " +
            "'quick' runs detection only (~100ms) — returns brain maturity level and what exists, " +
            "without running full checks. Use 'quick' to decide whether to run a full scan."),
    },
}, async ({ path, language, workspace_type, use_case, mode }) => {
    try {
        const report = await runHealthCheck(path, { mode: mode || 'full' });
        const formatted = formatReport(report);
        const langNote = buildLanguagePrompt(language);
        const ctxNote = buildContextNote(workspace_type, use_case);
        return {
            content: [{ type: 'text', text: formatted + ctxNote + langNote }],
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
        'for the highest-impact improvements. Each fix includes a time estimate.',
    inputSchema: {
        path: pathSchema
            .describe('Path to the Second Brain root directory. Defaults to current working directory.'),
        focus: z
            .enum(['setup', 'usage', 'fluency', 'auto'])
            .optional()
            .describe("Which area to focus on. 'setup' for configuration quality, " +
            "'usage' for activity tracking, 'fluency' for AI collaboration depth, " +
            "'auto' picks the weaker area."),
        language: z
            .enum(SUPPORTED_LANGUAGES)
            .optional()
            .describe('Language for the output. Defaults to English (en).'),
    },
}, async ({ path, focus, language }) => {
    try {
        const report = await runHealthCheck(path);
        const formatted = formatFixSuggestions(report, focus || 'auto');
        const langNote = buildLanguagePrompt(language);
        return {
            content: [{ type: 'text', text: formatted + langNote }],
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
        'grade badges, CE pattern coverage, three-tier fix suggestions with step-by-step guides, ' +
        'and actionable fix suggestions. ' +
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
    console.error('Second Brain Health Check MCP server running on stdio (v0.8.0)');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
