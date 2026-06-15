/**
 * upgrade_brain — Brain diff + personalized file generator
 *
 * Runs Phases 1-3 locally, calls Factory for Phases 4-6, presents diff.
 *
 * Phase 1: Health check (runHealthCheck)
 * Phase 2: Profile → placeholder map (reads memory/personal-profile.md)
 * Phase 3: Brain inventory (glob of .claude/ memory/ docs/ CLAUDE.md)
 * Phase 4-6: Via POST /api/upgrade/generate (Factory endpoint)
 *
 * Returns: structured diff result for presentation by /upgrade-brain skill
 *
 * v1.5 — memory-os MCP tool
 * PRD: product/context-engineering/mcp/PRD-UPGRADE-BRAIN.md
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, relative, sep } from 'path';
import { normalizePath } from '../utils/normalize-path.js';

// ─── Brain Inventory (Phase 3) ───────────────────────────────────────────────

function globBrainFiles(brainRoot) {
    const paths = [];
    const scanDirs = [
        '.claude',
        'memory',
        'docs',
    ];

    function walk(dir, baseRoot) {
        if (!existsSync(dir)) return;
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, baseRoot);
            } else if (entry.isFile()) {
                const relPath = relative(baseRoot, fullPath);
                paths.push(relPath);
            }
        }
    }

    for (const d of scanDirs) {
        walk(join(brainRoot, d), brainRoot);
    }

    // Add CLAUDE.md if it exists
    if (existsSync(join(brainRoot, 'CLAUDE.md'))) {
        paths.push('CLAUDE.md');
    }

    return paths;
}

// ─── Profile Parser (Phase 2) ────────────────────────────────────────────────

const PROFILE_FIELD_MAP = {
    'name': ['CLIENT_NAME'],
    'full name': ['CLIENT_NAME'],
    'email': ['CLIENT_EMAIL', 'PRIMARY_CALENDAR', 'SECONDARY_CALENDAR'],
    'role': ['CLIENT_ROLE'],
    'title': ['CLIENT_ROLE'],
    'company': ['COMPANY_NAME', 'CLIENT_COMPANY'],
    'organization': ['COMPANY_NAME', 'CLIENT_COMPANY'],
    'product': ['PRODUCT_NAME', 'YOUR_PRODUCT_SERVICE'],
    'service': ['YOUR_PRODUCT_SERVICE'],
    'industry': ['CLIENT_INDUSTRY'],
    'expertise': ['EXPERTISE_AREAS', 'YOUR_EXPERTISE'],
    'voice': ['VOICE_TONE', 'TONE', 'VOICE_STYLE', 'PREFERRED_STYLE'],
    'tone': ['VOICE_TONE', 'TONE'],
    'style': ['VOICE_STYLE', 'PREFERRED_STYLE'],
    'slug': ['PRODUCT_SLUG', 'SLUG'],
    'technical comfort': ['TECHNICAL_COMFORT'],
    'technical level': ['TECHNICAL_COMFORT'],
    'platforms': ['CONTENT_PLATFORMS'],
    'signature': ['YOUR_SIGNATURE'],
    'bio': ['CLIENT_BIO'],
};

function parsePersonalProfile(brainRoot) {
    const profilePaths = [
        join(brainRoot, 'memory', 'personal-profile.md'),
        join(brainRoot, 'memory', 'personal', 'profile.md'),
    ];

    let profileContent = null;
    for (const p of profilePaths) {
        if (existsSync(p)) {
            profileContent = readFileSync(p, 'utf8');
            break;
        }
    }

    const map = {};
    const today = new Date().toISOString().split('T')[0];
    map['GENERATION_DATE'] = today;
    map['DATE'] = today;

    if (!profileContent) return map;

    // Parse lines like: **Name:** Iwo Szapar
    const lines = profileContent.split('\n');
    for (const line of lines) {
        const match = line.match(/^\*{0,2}([^:*]+?)\*{0,2}:\s*(.+)/);
        if (!match) continue;

        const fieldRaw = match[1].trim().toLowerCase();
        const value = match[2].trim();

        for (const [pattern, tokens] of Object.entries(PROFILE_FIELD_MAP)) {
            if (fieldRaw.includes(pattern)) {
                for (const token of tokens) {
                    if (!map[token]) map[token] = value;
                }
            }
        }
    }

    return map;
}

// ─── MCP tool settings (Phase 3 — read MCP servers) ─────────────────────────

function readMcpSettings(brainRoot) {
    const settingsPath = join(brainRoot, '.claude', 'settings.json');
    if (!existsSync(settingsPath)) return { tools: '', list: '' };

    try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
        const servers = Object.keys(settings.mcpServers || {});
        if (servers.length === 0) return { tools: '', list: '' };

        const tools = servers.map(s => `mcp__${s}__*`).join(', ');
        const list = servers.map(s => `- ${s}`).join('\n');
        return { tools, list };
    } catch {
        return { tools: '', list: '' };
    }
}

// ─── Score projection formatter ──────────────────────────────────────────────

function formatDiffSummary(result) {
    const { to_add, to_update, current_score, score_projection } = result;
    const allFiles = [...(to_add || []), ...(to_update || [])];
    const highCount = allFiles.filter(f => f.impact === 'HIGH').length;
    const medCount = allFiles.filter(f => f.impact === 'MED').length;
    const lowCount = allFiles.filter(f => f.impact === 'LOW').length;

    let output = `\n${'='.repeat(60)}\n`;
    output += `  UPGRADE PLAN  ·  score: ${current_score}% → projected ${score_projection}% (+${score_projection - current_score}pts)\n`;
    output += `${'='.repeat(60)}\n`;

    if (to_add && to_add.length > 0) {
        output += `\n📁 FILES TO ADD  (${to_add.length} missing)\n\n`;
        output += `  #  Impact  Path\n`;
        to_add.forEach((f, i) => {
            output += `  ${i + 1}  ${f.impact.padEnd(6)}  ${f.path}\n`;
        });
    }

    if (to_update && to_update.length > 0) {
        const offset = (to_add?.length || 0) + 1;
        output += `\n📝 FILES TO UPDATE  (${to_update.length} outdated)\n\n`;
        output += `  #  Impact  Path                         Yours  Template\n`;
        to_update.forEach((f, i) => {
            output += `  ${offset + i}  ${f.impact.padEnd(6)}  ${f.path.padEnd(36)} ${(f.original_lines || '?').toString().padStart(4)}  ${f.template_lines}\n`;
        });
    }

    if (allFiles.length === 0) {
        output += '\n✅ No gaps found — brain is up to date for your tier.\n';
    } else {
        output += `\nImpact breakdown: HIGH=${highCount} MED=${medCount} LOW=${lowCount}\n`;
        output += `\nApply with /upgrade-brain skill in Claude Code (or pass result to apply phase).\n`;
    }

    return output;
}

// ─── Main: runUpgradeBrain ────────────────────────────────────────────────────

export async function runUpgradeBrain(options = {}) {
    const {
        path: brainPath,
        factory_url,
        api_key,
        high_only = false,
        category,
        dry_run = false,
    } = options;

    // Resolve brain root
    const brainRoot = normalizePath(brainPath || process.cwd(), { checkBoundary: true });

    // Phase 1: Health check (import dynamically to avoid circular deps)
    let scores = { overallPct: 0 };
    let topFixes = [];
    let cePatterns = [];
    let maturity = 'basic';

    try {
        const { runHealthCheck } = await import('../health-check.js');
        const report = await runHealthCheck(brainRoot, { mode: 'full' });

        const sp = report.setup?.normalizedScore ?? 0;
        const up = report.usage?.normalizedScore ?? 0;
        const fp = report.fluency?.normalizedScore ?? 0;
        const total = Math.round((sp + up + fp) / 3);

        scores = { overallPct: total, setup: sp, usage: up, fluency: fp };
        topFixes = (report.topFixes || []).slice(0, 5);
        cePatterns = report.cePatterns || [];
        maturity = report.setup?.maturity || 'basic';
    } catch (err) {
        // If health check fails, proceed with empty scores
        console.error(`Health check warning: ${err.message}`);
    }

    // Phase 2: Profile → placeholder map
    const profile = parsePersonalProfile(brainRoot);
    const mcpTokens = readMcpSettings(brainRoot);
    profile['MCP_TOOLS'] = mcpTokens.tools;
    profile['MCP_SERVERS_LIST'] = mcpTokens.list;

    // Kanban from topFixes
    profile['KANBAN_COLUMNS'] = 'Todo | In Progress | Done';
    profile['KANBAN_TASK_001'] = topFixes[0]?.title || 'Set up CLAUDE.md';
    profile['KANBAN_TASK_002'] = topFixes[1]?.title || 'Build first agent';
    profile['KANBAN_TASK_003'] = topFixes[2]?.title || 'Create memory system';

    // Phase 3: Brain inventory (normalize backslashes for Windows compatibility)
    const existing_paths = globBrainFiles(brainRoot).map(p => p.replace(/\\/g, '/'));

    // Phase 4-6: Call Factory endpoint
    const endpoint = factory_url || 'https://second-brain-factory.com/api/upgrade/generate';

    // Token resolution: explicit > SBK_TOKEN > SBF_TOKEN > legacy UPGRADE_BRAIN_API_KEY > settings file
    let token = api_key || process.env.SBK_TOKEN || process.env.SBF_TOKEN || process.env.UPGRADE_BRAIN_API_KEY;
    if (!token) {
        // Try reading sbk_ key from settings.local.json (common config location)
        try {
            const settingsPath = join(brainRoot, '.claude', 'settings.local.json');
            if (existsSync(settingsPath)) {
                const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                token = settings.env?.SBK_TOKEN || settings.env?.SBF_TOKEN || settings.env?.UPGRADE_BRAIN_API_KEY || settings.upgrade_brain_api_key;
            }
        } catch { /* ignore parse errors */ }
    }

    if (!token) {
        throw new Error(
            'No API key found. Your sbk_ key is needed for upgrade_brain.\n' +
            'Option 1: Pass api_key parameter directly with your sbk_ key\n' +
            'Option 2: Set SBK_TOKEN env var in your MCP server config\n' +
            'Option 3: Add to .claude/settings.local.json: { "env": { "SBK_TOKEN": "sbk_..." } }\n' +
            'Get your key from: https://www.iwoszapar.com/memory-os (MemoryOS subscriber benefit).'
        );
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            scores,
            topFixes,
            cePatterns,
            maturity,
            profile,
            existing_paths,
            high_only,
            category,
            dry_run,
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(JSON.stringify({
            tool: 'upgrade_brain',
            error: `http_${response.status}`,
            endpoint,
            prefix: token?.substring(0, 12) || 'none',
            detail: errData.error,
        }));
        throw new Error(`Factory endpoint failed (${response.status}): ${errData.error || 'Unknown'}`);
    }

    const result = await response.json();

    // Format summary output
    const summary = formatDiffSummary(result);

    if (dry_run) {
        return {
            ...result,
            _summary: summary,
            _dry_run: true,
            _note: 'DRY RUN — no files written. Use /upgrade-brain skill to apply.',
        };
    }

    return {
        ...result,
        _summary: summary,
        _brain_root: brainRoot,
        _profile: profile,
    };
}
