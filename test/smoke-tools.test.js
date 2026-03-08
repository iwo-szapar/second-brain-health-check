/**
 * Smoke tests for all 9 MCP tools.
 * Each test validates the tool runs without crashing on a real brain.
 * Uses this repo (iwoszapar.com) as the test brain.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Resolve repo root (two levels up from test/)
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const BRAIN_PATH = resolve(PACKAGE_ROOT, '..', '..');

// Tool imports
import { runHealthCheck } from '../dist/health-check.js';
import { formatReport, formatFixSuggestions } from '../dist/report-formatter.js';
import { saveDashboard } from '../dist/dashboard/generate.js';
import { runWeeklyPulse } from '../dist/guide/weekly-pulse.js';
import { runContextPressure } from '../dist/guide/context-pressure-tool.js';
import { runAuditConfig } from '../dist/guide/audit-config.js';
import { runImportContext } from '../dist/tools/import-context.js';

/**
 * Extract text from MCP tool response format.
 * Tools return either:
 * - A string directly
 * - { content: [{ type: 'text', text: '...' }] } (MCP tool response)
 * - { content: '...' } (simple wrapper)
 */
function extractText(result) {
    if (typeof result === 'string') return result;
    if (result && Array.isArray(result.content)) {
        return result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
    }
    if (result && typeof result.content === 'string') return result.content;
    return JSON.stringify(result);
}

// Use a temp dir inside home (saveDashboard enforces home dir boundary)
let tmpDir;

before(async () => {
    tmpDir = await mkdtemp(join(homedir(), '.smoke-test-'));
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

// ─── Tool 1: check_health ───────────────────────────────────────────

describe('Tool 1: check_health (smoke)', () => {
    it('runs full health check on real brain and returns report', async () => {
        const report = await runHealthCheck(BRAIN_PATH);
        assert.ok(report, 'report should be returned');
        assert.ok(report.setup, 'report should have setup dimension');
        assert.ok(report.usage, 'report should have usage dimension');
        assert.ok(report.fluency, 'report should have fluency dimension');
        assert.ok(typeof report.setup.normalizedScore === 'number', 'setup should have normalizedScore');
        assert.ok(report.cePatterns, 'report should have cePatterns');
        assert.ok(Array.isArray(report.topFixes), 'report should have topFixes array');
    });
});

// ─── Tool 2: get_fix_suggestions ────────────────────────────────────

describe('Tool 2: get_fix_suggestions (smoke)', () => {
    it('returns fix suggestions with auto focus', async () => {
        const report = await runHealthCheck(BRAIN_PATH);
        const suggestions = formatFixSuggestions(report, 'auto');
        assert.ok(typeof suggestions === 'string', 'suggestions should be a string');
        assert.ok(suggestions.length > 0, 'suggestions should not be empty');
    });
});

// ─── Tool 3: generate_dashboard ─────────────────────────────────────

describe('Tool 3: generate_dashboard (smoke)', () => {
    it('generates HTML dashboard file', async () => {
        const report = await runHealthCheck(BRAIN_PATH);
        const outputPath = join(tmpDir, 'test-dashboard.html');
        await saveDashboard(report, outputPath);
        const html = await readFile(outputPath, 'utf8');
        assert.ok(html.includes('<html'), 'output should be HTML');
        assert.ok(html.includes('Health'), 'output should contain health-related content');
        assert.ok(html.length > 1000, 'dashboard should be substantial');
    });
});

// ─── Tool 4: generate_pdf ───────────────────────────────────────────

describe('Tool 4: generate_pdf (smoke)', () => {
    it('module loads and exports generatePdf function', async () => {
        const mod = await import('../dist/tools/generate-pdf.js');
        assert.ok(typeof mod.generatePdf === 'function', 'generatePdf should be a function');
    });
});

// ─── Tool 5: weekly_pulse ───────────────────────────────────────────

describe('Tool 5: weekly_pulse (smoke)', () => {
    it('runs weekly pulse on real brain without crashing', async () => {
        const result = await runWeeklyPulse('7d', BRAIN_PATH);
        assert.ok(result, 'weekly_pulse should return a result');
        const text = extractText(result);
        assert.ok(text.length > 0, 'should produce output text');
    });
});

// ─── Tool 6: context_pressure ───────────────────────────────────────

describe('Tool 6: context_pressure (smoke)', () => {
    it('analyzes context pressure on real brain', async () => {
        const result = await runContextPressure(BRAIN_PATH);
        assert.ok(result, 'context_pressure should return a result');
        const text = extractText(result);
        assert.ok(text.length > 100, 'should contain meaningful analysis');
    });
});

// ─── Tool 7: audit_config ──────────────────────────────────────────

describe('Tool 7: audit_config (smoke)', () => {
    it('runs all audit categories on real brain', async () => {
        const categories = ['references', 'conflicts', 'security', 'unused', 'performance'];
        const result = await runAuditConfig(BRAIN_PATH, categories);
        assert.ok(result, 'audit_config should return a result');
        const text = extractText(result);
        assert.ok(text.length > 50, 'should contain audit findings');
    });

    it('runs single category without crashing', async () => {
        const result = await runAuditConfig(BRAIN_PATH, ['security']);
        const text = extractText(result);
        assert.ok(text.length > 0, 'security audit should produce output');
    });
});

// ─── Tool 8: import_context ─────────────────────────────────────────

describe('Tool 8: import_context (smoke)', () => {
    let fixtureFile;

    before(async () => {
        const conversations = [
            {
                title: 'Test Conversation 1',
                create_time: Date.now() / 1000,
                update_time: Date.now() / 1000,
                mapping: {
                    'root': { id: 'root', parent: null, children: ['msg1'] },
                    'msg1': {
                        id: 'msg1',
                        parent: 'root',
                        children: ['msg2'],
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['How do I write a function in JavaScript?'] },
                            create_time: Date.now() / 1000,
                        },
                    },
                    'msg2': {
                        id: 'msg2',
                        parent: 'msg1',
                        children: [],
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: ['Here is how you write a function...'] },
                            create_time: Date.now() / 1000,
                        },
                    },
                },
            },
            {
                title: 'Research on AI trends',
                create_time: Date.now() / 1000,
                update_time: Date.now() / 1000,
                mapping: {
                    'root': { id: 'root', parent: null, children: ['m1'] },
                    'm1': {
                        id: 'm1',
                        parent: 'root',
                        children: ['m2'],
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['What are the latest AI research papers?'] },
                            create_time: Date.now() / 1000,
                        },
                    },
                    'm2': {
                        id: 'm2',
                        parent: 'm1',
                        children: [],
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: ['Here are some recent papers...'] },
                            create_time: Date.now() / 1000,
                        },
                    },
                },
            },
        ];
        fixtureFile = join(tmpDir, 'conversations.json');
        await writeFile(fixtureFile, JSON.stringify(conversations));
    });

    it('scans ChatGPT export in scan mode', async () => {
        const result = await runImportContext({
            source: { type: 'chatgpt_export', path: fixtureFile },
            mode: 'scan',
            options: { max_conversations: 10, min_messages: 1 },
            language: 'en',
            projectRoot: tmpDir,
        });
        const text = extractText(result);
        assert.ok(text.length > 50, 'scan should contain summary data');
    });

    it('imports ChatGPT export in import mode', async () => {
        const outputDir = join(tmpDir, 'imported');
        await mkdir(outputDir, { recursive: true });
        const result = await runImportContext({
            source: { type: 'chatgpt_export', path: fixtureFile },
            mode: 'import',
            options: {
                max_conversations: 10,
                min_messages: 1,
                output_dir: outputDir,
                merge_existing: false,
            },
            language: 'en',
            projectRoot: tmpDir,
        });
        const text = extractText(result);
        assert.ok(text.length > 0, 'import should produce output');
        await access(outputDir);
    });
});

// ─── Tool 9: upgrade_brain ──────────────────────────────────────────

describe('Tool 9: upgrade_brain (smoke)', () => {
    it('module loads and exports runUpgradeBrain function', async () => {
        const mod = await import('../dist/tools/upgrade-brain.js');
        assert.ok(typeof mod.runUpgradeBrain === 'function', 'runUpgradeBrain should be a function');
    });

    it('runs with API key if available', async () => {
        const apiKey = process.env.UPGRADE_BRAIN_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!apiKey) {
            // Skip — no API key available (expected in CI)
            return;
        }
        const mod = await import('../dist/tools/upgrade-brain.js');
        const result = await mod.runUpgradeBrain({
            path: BRAIN_PATH,
            dry_run: true,
            high_only: false,
        });
        assert.ok(result, 'upgrade_brain should return a result');
    });
});
