/**
 * Dashboard Generator — Editorial Light Theme
 *
 * Generates a self-contained HTML dashboard from health check results.
 * Warm cream/parchment aesthetic: Instrument Serif + DM Mono + Outfit.
 * Weaves narrative context between data sections for first-time readers.
 *
 * v0.8.4: Light theme, region tabs, score-neutral narratives.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VERSION } from '../version.js';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getBarColor(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 80) return '#16a34a';
    if (pct >= 60) return '#d97706';
    if (pct >= 40) return '#ea580c';
    return '#dc2626';
}

function getGradeColor(grade) {
    const g = String(grade).toLowerCase();
    if (['a', 'expert', 'active'].includes(g)) return '#16a34a';
    if (['b', 'proficient', 'growing'].includes(g)) return '#16a34a';
    if (['c', 'developing', 'starting'].includes(g)) return '#d97706';
    if (['d', 'beginner', 'dormant'].includes(g)) return '#ea580c';
    return '#dc2626';
}

function statusSquare(status) {
    const colors = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };
    const c = colors[status] || '#a8a29e';
    return `<span style="display:inline-block;width:10px;height:10px;min-width:10px;background:${c};margin-top:2px;border-radius:2px;"></span>`;
}

/** Three-tier guided remediation hints for common fix titles */
const FIX_REMEDIATION = {
    'quality tracking active': {
        hint: 'Create <code style="color:#57534e;font-family:DM Mono,monospace;">memory/quality-metrics.md</code> and log a dated entry after each work session.',
        minutes: 5,
        why: 'Tracking quality metrics over time shows the brain is improving, not just existing.',
        steps: ['Create memory/quality-metrics.md', 'Add a dated entry: "## 2026-02-19\\n- Sessions: 3\\n- Patterns learned: 1"', 'Update after each work session'],
    },
    'growth log populated': {
        hint: 'Create <code style="color:#57534e;font-family:monospace;">memory/growth-log.md</code> with dated entries tracking what your brain learned each week.',
        minutes: 5,
        why: 'A growth log creates a compound learning record — you can see what your brain learned over weeks and months.',
        steps: ['Create memory/growth-log.md', 'Add weekly entries: "## Week of Feb 17\\n- Learned: hook patterns for safety\\n- Added: 2 new skills"', 'Review monthly for patterns'],
    },
    'activity spans multiple days': {
        hint: 'Use your Second Brain across multiple days. Session diversity matters more than session count.',
        minutes: 5,
        why: 'A brain used once is an experiment. A brain used daily is a system. Multi-day activity proves compounding.',
        steps: ['Use your brain for at least one task today', 'Come back tomorrow and use it again', 'After 3+ days, this check passes automatically'],
    },
    'codex compatibility': {
        hint: 'Run <code style="color:#57534e;font-family:monospace;">mkdir -p .codex/skills</code> and symlink or copy your Claude skills there.',
        minutes: 5,
        why: 'Codex compatibility means your skills work across multiple AI coding tools, not just Claude.',
        steps: ['Run: mkdir -p .codex/skills', 'Copy or symlink your .claude/skills/ files to .codex/skills/', 'Verify with: ls .codex/skills/'],
    },
    'style/voice files populated': {
        hint: 'Add files to <code style="color:#57534e;font-family:monospace;">memory/style-voice/</code> or <code style="color:#57534e;font-family:monospace;">memory/personal/</code> describing your writing voice, communication preferences, or company context.',
        minutes: 10,
        why: 'Voice files let the AI match your communication style — emails, docs, and messages sound like you.',
        steps: ['Create memory/style-voice/ directory', 'Add a voice.md describing your writing style (tone, vocabulary, pet peeves)', 'Add examples of your best writing as reference'],
    },
    'memory files evolving': {
        hint: 'Edit existing memory files as you learn new things. A static brain is a dead brain.',
        minutes: 5,
        why: 'Memory evolution is the signal that compound learning is working. Static memory means no learning.',
        steps: ['Open any memory file that has not been updated recently', 'Add or update entries based on recent work', 'The system detects file modification dates — just saving counts'],
    },
    'auto memory populated': {
        hint: 'Use Claude Code regularly. Auto-memory fills itself as patterns emerge across sessions.',
        minutes: 5,
        why: 'Auto-memory captures patterns you would otherwise forget. It builds itself through regular use.',
        steps: ['Use Claude Code for a few tasks', 'Check ~/.claude/ for auto-generated memory files', 'Review and curate the auto-captured patterns periodically'],
    },
    'tracking files present': {
        hint: 'Create <code style="color:#57534e;font-family:monospace;">brain-health/growth-log.md</code> and <code style="color:#57534e;font-family:monospace;">brain-health/quality-metrics.md</code> to track your brain\'s evolution.',
        minutes: 5,
        why: 'Without tracking files, you cannot measure improvement. What gets measured gets managed.',
        steps: ['Run: mkdir -p brain-health', 'Create brain-health/growth-log.md with a dated first entry', 'Create brain-health/quality-metrics.md with baseline metrics'],
    },
    'config size': {
        hint: 'Audit <code style="color:#57534e;font-family:monospace;">~/.claude.json</code> and <code style="color:#57534e;font-family:monospace;">.claude/settings.local.json</code> for stale entries. Remove permissions you no longer need.',
        minutes: 5,
        why: 'Bloated config files slow down session startup and can contain stale permissions.',
        steps: ['Open ~/.claude.json and review each entry', 'Remove permissions for tools or paths you no longer use', 'Check .claude/settings.local.json for duplicates'],
    },
    'stale permission patterns': {
        hint: 'Run <code style="color:#57534e;font-family:monospace;">claude permissions reset</code> or manually prune unused patterns from settings files.',
        minutes: 5,
        why: 'Stale permissions create security surface area for no benefit.',
        steps: ['Run: claude permissions reset', 'Or manually edit .claude/settings.json to remove old Allow patterns', 'Keep only permissions you actively use'],
    },
    'hook health validation': {
        hint: 'Add <code style="color:#57534e;font-family:monospace;">|| true</code> after <code style="color:#57534e;font-family:monospace;">grep</code> and <code style="color:#57534e;font-family:monospace;">find</code> commands in hook scripts using <code style="color:#57534e;font-family:monospace;">set -e</code>.',
        minutes: 5,
        why: 'Hooks with set -e that call grep/find will crash on no-match. Adding || true prevents false failures.',
        steps: ['Find all hook scripts in .claude/hooks/', 'Search for grep or find commands', 'Add || true after each to prevent exit on no-match'],
    },
    'pattern confidence tracking': {
        hint: 'Add HIGH/MEDIUM/LOW confidence labels to your <code style="color:#57534e;font-family:monospace;">_pattern-tracker.md</code> entries.',
        minutes: 5,
        why: 'Confidence tracking separates proven patterns from hunches. It prevents acting on unverified assumptions.',
        steps: ['Open your pattern tracker file', 'Add confidence: HIGH/MEDIUM/LOW to each pattern', 'Promote patterns from LOW to HIGH as they prove themselves'],
    },
    'settings permission leaks': {
        hint: 'Remove API keys and tokens from permission allow-lists in settings files.',
        minutes: 5,
        why: 'API keys in permission lists are a security risk — they can be exposed in git history.',
        steps: ['Search settings files for patterns containing api_key, token, secret', 'Remove any that appear in Allow lists', 'Move secrets to .env files (which should be gitignored)'],
    },
    'memory dir with subdirectories': {
        hint: 'Create subdirectories in <code style="color:#57534e;font-family:monospace;">memory/</code>: semantic/, episodic/, personal/, style-voice/.',
        minutes: 10,
        why: 'A flat memory directory becomes unsearchable. Subdirectories give the AI structured retrieval paths.',
        steps: ['Run: mkdir -p memory/semantic/patterns memory/episodic/sessions memory/personal', 'Move existing files into appropriate subdirectories', 'Add index.md to each directory explaining its purpose'],
    },
    'patterns directory': {
        hint: 'Run <code style="color:#57534e;font-family:monospace;">mkdir -p memory/semantic/patterns</code> to store learned patterns.',
        minutes: 5,
        why: 'Patterns are the highest-value memory type — reusable knowledge that compounds across sessions.',
        steps: ['Run: mkdir -p memory/semantic/patterns', 'Create your first pattern file based on a recent lesson learned', 'Reference patterns from CLAUDE.md or skills'],
    },
    'index files for navigation': {
        hint: 'Add <code style="color:#57534e;font-family:monospace;">index.md</code> files to your top-level knowledge directories so the agent can navigate.',
        minutes: 5,
        why: 'Index files are progressive disclosure for AI — they tell the agent what is in each directory without loading everything.',
        steps: ['Add index.md to memory/, .claude/docs/, and any knowledge directories', 'List the contents and purpose of each file in the directory', 'Reference these indexes from CLAUDE.md'],
    },
    'brain health directory': {
        hint: 'Run <code style="color:#57534e;font-family:monospace;">mkdir brain-health</code> and add tracking files for growth metrics.',
        minutes: 5,
        why: 'A brain-health directory enables self-monitoring — the brain can track its own improvement.',
        steps: ['Run: mkdir brain-health', 'Create growth-log.md and quality-metrics.md', 'Run health check periodically and log the scores'],
    },
    'getting started guide': {
        hint: 'Create a <code style="color:#57534e;font-family:monospace;">README.md</code> or <code style="color:#57534e;font-family:monospace;">ONBOARDING_SUMMARY.md</code> at your project root.',
        minutes: 5,
        why: 'A getting started guide helps teammates (and future-you) understand the brain quickly.',
        steps: ['Create README.md at your project root', 'Explain what this brain does and who it is for', 'List the key commands and skills available'],
    },
    'agent configuration': {
        hint: 'Create <code style="color:#57534e;font-family:monospace;">.claude/agents/</code> with .md files defining specialized agent personas.',
        minutes: 15,
        why: 'Custom agents let you delegate complex tasks to specialized AI personas with focused instructions.',
        steps: ['Run: mkdir -p .claude/agents', 'Create a .md file for each agent role (e.g., reviewer.md, researcher.md)', 'Define each agent\'s purpose, tools, and constraints in the file'],
    },
    'external doc references': {
        hint: 'Add "Read X before working on Y" tables in CLAUDE.md pointing to docs/ files.',
        minutes: 10,
        why: 'External doc references implement progressive disclosure — CLAUDE.md stays lean while deep context is discoverable.',
        steps: ['Create a table in CLAUDE.md: | Area | Read This File |', 'Add rows mapping work areas to .claude/docs/ files', 'Move detailed context from CLAUDE.md into those doc files'],
    },
    'skills reference knowledge dirs': {
        hint: 'Update skill instructions to reference <code style="color:#57534e;font-family:monospace;">memory/</code>, <code style="color:#57534e;font-family:monospace;">docs/</code>, or <code style="color:#57534e;font-family:monospace;">patterns/</code> directories.',
        minutes: 10,
        why: 'Context-aware skills pull from your knowledge base instead of relying on inline instructions.',
        steps: ['Open each skill in .claude/skills/', 'Add instructions like "Read memory/semantic/patterns/ before executing"', 'Reference specific knowledge files relevant to the skill\'s domain'],
    },
};

function getRemediation(title) {
    const key = title.toLowerCase();
    for (const [pattern, data] of Object.entries(FIX_REMEDIATION)) {
        if (key.includes(pattern)) return data;
    }
    return null;
}

function renderDimension(dim, label) {
    if (!dim) return '';

    const rawPct = dim.maxPoints > 0 ? Math.round((dim.totalPoints / dim.maxPoints) * 100) : 0;
    const barColor = getBarColor(dim.totalPoints, dim.maxPoints);
    const gradeColor = getGradeColor(dim.grade);

    let layersHtml = '';
    const layers = dim.layers || [];
    for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const layerPct = layer.maxPoints > 0 ? Math.round((layer.points / layer.maxPoints) * 100) : 0;
        const layerBarColor = getBarColor(layer.points, layer.maxPoints);
        const isLast = li === layers.length - 1;

        let checksHtml = '';
        for (const check of (layer.checks || [])) {
            checksHtml += `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:3px 0;font-size:12px;color:#78716c;">
                ${statusSquare(check.status)}
                <span style="flex:1;line-height:1.5;">${escapeHtml(check.message)}</span>
                <span style="color:#a8a29e;white-space:nowrap;padding-left:12px;font-family:'DM Mono',monospace;">${check.points}/${check.maxPoints}</span>
            </div>`;
        }

        layersHtml += `
        <div style="margin-bottom:${isLast ? '0' : '20px'};padding-bottom:${isLast ? '0' : '20px'};${isLast ? '' : 'border-bottom:1px solid #e7e5e4;'}">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
                <span style="font-size:13px;color:#78716c;font-style:italic;font-family:'Instrument Serif',Georgia,serif;">${escapeHtml(layer.name)}</span>
                <span style="font-size:12px;color:#a8a29e;font-family:'DM Mono',monospace;">${layer.points}/${layer.maxPoints}</span>
            </div>
            <div style="height:3px;background:#e7e5e4;border-radius:2px;margin-bottom:10px;">
                <div style="height:100%;width:${layerPct}%;background:${layerBarColor};border-radius:2px;"></div>
            </div>
            ${checksHtml}
        </div>`;
    }

    const normalizedDisplay = dim.normalizedScore || rawPct;

    return `
    <div style="margin-top:40px;">
        <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid #e7e5e4;">
            <span style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#1c1917;flex:1;font-family:'Outfit',sans-serif;">${escapeHtml(label)}</span>
            <span style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;padding:2px 8px;border:1px solid ${gradeColor};color:${gradeColor};border-radius:4px;font-family:'DM Mono',monospace;">${escapeHtml(dim.grade)}</span>
            <span style="font-size:20px;font-weight:700;color:#1c1917;font-family:'DM Mono',monospace;">${normalizedDisplay}<span style="font-size:13px;color:#a8a29e;">/100</span></span>
        </div>
        <div style="height:4px;background:#e7e5e4;border-radius:2px;margin-bottom:24px;">
            <div style="height:100%;width:${rawPct}%;background:${barColor};border-radius:2px;"></div>
        </div>
        ${layersHtml}
    </div>`;
}

function getDimensionIntro(dim, label) {
    if (!dim) return '';

    const intros = {
        'Setup Quality': 'Foundation layer &mdash; CLAUDE.md, directory structure, memory architecture, skills, hooks, and config files. The scaffolding that gives AI context before a single prompt is typed.',
        'Usage Activity': 'Momentum layer &mdash; session frequency, pattern growth, memory evolution, and compound learning loops. Measures whether the system is actively used and improving over time.',
        'AI Fluency': 'Craft layer &mdash; skill orchestration, progressive disclosure, delegation patterns, and context-aware tooling. How effectively human and AI collaborate as a system.',
    };

    const headings = {
        'Setup Quality': 'YOUR FOUNDATION',
        'Usage Activity': 'YOUR MOMENTUM',
        'AI Fluency': 'YOUR CRAFT',
    };

    const text = intros[label] || '';
    const heading = headings[label] || '';
    if (!text) return '';

    return `
    <div style="border-left:2px solid #d6d3d1;padding:12px 20px;margin-top:40px;margin-bottom:-8px;font-size:12px;color:#78716c;line-height:1.7;background:rgba(28,25,23,0.02);border-radius:0 6px 6px 0;">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:#a8a29e;margin-bottom:6px;font-family:'DM Mono',monospace;">${heading}</div>
        ${text}
    </div>`;
}

function renderTopFixes(fixes) {
    if (!fixes || fixes.length === 0) return '';

    let rowsHtml = '';
    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const num = String(i + 1).padStart(2, '0');
        const catColors = { setup: '#57534e', usage: '#78716c', fluency: '#a8a29e' };
        const badgeColor = catColors[fix.category] || '#57534e';

        const remediation = getRemediation(fix.title);
        let remediationHtml = '';
        if (remediation) {
            const timeHtml = remediation.minutes
                ? `<span style="color:#16a34a;font-size:10px;margin-left:8px;font-family:'DM Mono',monospace;">~${remediation.minutes} min</span>`
                : '';
            const whyHtml = remediation.why
                ? `<div style="font-size:11px;color:#78716c;margin-top:4px;font-style:italic;">${escapeHtml(remediation.why)}</div>`
                : '';
            const stepsHtml = remediation.steps
                ? `<details style="margin-top:6px;"><summary style="font-size:10px;color:#57534e;font-family:monospace;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em;">Step-by-step guide</summary><ol style="font-size:11px;color:#78716c;margin:6px 0 0 16px;line-height:1.8;">${remediation.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol></details>`
                : '';
            remediationHtml = `<div style="font-size:11px;color:#57534e;margin-top:6px;padding:10px 12px;background:rgba(28,25,23,0.03);border-left:2px solid #d6d3d1;line-height:1.6;border-radius:0 4px 4px 0;">${remediation.hint}${timeHtml}${whyHtml}${stepsHtml}</div>`;
        }

        rowsHtml += `
        <div style="display:flex;align-items:flex-start;gap:20px;padding:16px 20px;border-top:1px solid #e7e5e4;">
            <span style="font-size:18px;font-weight:300;color:#d6d3d1;flex-shrink:0;width:30px;font-family:'DM Mono',monospace;">${num}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#1c1917;font-family:'Outfit',sans-serif;">${escapeHtml(fix.title)}</span>
                    <span style="font-size:10px;padding:2px 7px;border:1px solid ${badgeColor};color:${badgeColor};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;border-radius:4px;font-family:'DM Mono',monospace;">${escapeHtml(fix.impact)}</span>
                </div>
                <p style="font-size:12px;color:#78716c;margin:0;line-height:1.6;">${escapeHtml(fix.description)}</p>
                ${remediationHtml}
            </div>
        </div>`;
    }

    return `
    <div style="border:1px solid #e7e5e4;margin-top:32px;border-radius:12px;overflow:hidden;background:#faf8f5;">
        <div style="background:#1c1917;padding:13px 20px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:rgba(250,248,245,0.6);font-family:'DM Mono',monospace;">Top Fixes &mdash; Highest Impact</div>
        ${rowsHtml}
    </div>`;
}

function renderRadarChart(cePatterns) {
    const cx = 140, cy = 140, r = 110;
    const n = cePatterns.length;
    if (n < 3) return '';

    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2; // top

    function polarToXY(pct, i) {
        const angle = startAngle + i * angleStep;
        const dist = (pct / 100) * r;
        return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)];
    }

    // Grid rings at 25%, 50%, 75%, 100%
    let gridLines = '';
    for (const ring of [25, 50, 75, 100]) {
        const pts = [];
        for (let i = 0; i < n; i++) pts.push(polarToXY(ring, i).join(','));
        gridLines += `<polygon points="${pts.join(' ')}" fill="none" stroke="#e7e5e4" stroke-width="1"/>`;
    }

    // Axis lines
    let axes = '';
    for (let i = 0; i < n; i++) {
        const [x, y] = polarToXY(100, i);
        axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e7e5e4" stroke-width="1"/>`;
    }

    // Data polygon
    const dataPts = cePatterns.map((p, i) => polarToXY(Math.max(p.percentage, 2), i).join(',')).join(' ');

    // Labels
    let labels = '';
    const labelR = r + 22;
    for (let i = 0; i < n; i++) {
        const angle = startAngle + i * angleStep;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
        const shortName = cePatterns[i].name.replace('Three-Layer ', '').replace(' Protocol', '').replace(' as ', ' ');
        const color = cePatterns[i].percentage >= 70 ? '#16a34a' : cePatterns[i].percentage >= 40 ? '#d97706' : '#dc2626';
        labels += `<text x="${lx}" y="${ly}" fill="${color}" font-size="9" text-anchor="${anchor}" dominant-baseline="middle" font-family="DM Mono,monospace">${escapeHtml(shortName)}</text>`;
    }

    return `<svg viewBox="0 0 280 280" width="280" height="280" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px;">
        ${gridLines}${axes}
        <polygon points="${dataPts}" fill="rgba(28,25,23,0.06)" stroke="#57534e" stroke-width="2"/>
        ${labels}
    </svg>`;
}

function renderCEPatterns(cePatterns) {
    if (!cePatterns || cePatterns.length === 0) return '';

    const radarSvg = renderRadarChart(cePatterns);

    let patternsHtml = '';
    for (const p of cePatterns) {
        if (p.maxScore === 0) continue;
        const barColor = p.percentage >= 70 ? '#16a34a' : p.percentage >= 40 ? '#d97706' : '#dc2626';
        patternsHtml += `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #e7e5e4;">
            <span style="font-size:11px;color:#78716c;flex:1;min-width:0;">${escapeHtml(p.name)}</span>
            <div style="width:120px;height:4px;background:#e7e5e4;border-radius:2px;flex-shrink:0;">
                <div style="height:100%;width:${p.percentage}%;background:${barColor};border-radius:2px;"></div>
            </div>
            <span style="font-size:12px;color:${barColor};width:40px;text-align:right;flex-shrink:0;font-family:'DM Mono',monospace;">${p.percentage}%</span>
        </div>`;
    }

    return `
    <div style="border:1px solid #e7e5e4;margin-top:32px;border-radius:12px;overflow:hidden;background:#faf8f5;">
        <div style="background:#1c1917;padding:13px 20px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:rgba(250,248,245,0.6);font-family:'DM Mono',monospace;">Context Engineering Patterns</div>
        <div style="padding:12px 20px;">
            <div style="font-size:11px;color:#a8a29e;margin-bottom:12px;">How well your brain implements the 7 Context Engineering patterns.</div>
            ${radarSvg}
            ${patternsHtml}
        </div>
    </div>`;
}

function renderJourneyStage(overallPct) {
    const stages = [
        { min: 0,  label: 'BLANK SLATE',      desc: 'You have a repo. Not much else.' },
        { min: 30, label: 'SCAFFOLDED',        desc: 'Structure exists. Skills are configured.' },
        { min: 50, label: 'PRACTICING',        desc: 'Daily usage. Patterns starting to form.' },
        { min: 70, label: 'COMPOUNDING',       desc: 'Memory grows between sessions. AI knows your context.' },
        { min: 85, label: 'PRODUCTION-GRADE',  desc: 'Self-improving system. Hooks, reviews, compound loops.' },
    ];

    let currentIdx = 0;
    for (let i = stages.length - 1; i >= 0; i--) {
        if (overallPct >= stages[i].min) { currentIdx = i; break; }
    }

    const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
    const nextText = nextStage
        ? `The jump from <span style="color:#1c1917;font-weight:600;">${stages[currentIdx].label}</span> to <span style="color:#1c1917;font-weight:600;">${nextStage.label}</span> is usually about the areas where you scored lowest. Check your Top Fixes above.`
        : 'You are running a production-grade Second Brain. The system is self-improving. Share this report &mdash; show others what is possible.';

    let stageListHtml = '';
    for (let i = 0; i < stages.length; i++) {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const color = isCurrent ? '#16a34a' : isPast ? '#a8a29e' : '#d6d3d1';
        const marker = isCurrent ? 'x' : isPast ? '/' : ' ';
        const labelStyle = isCurrent ? 'color:#16a34a;font-weight:600;' : `color:${color};`;
        stageListHtml += `
        <div style="display:flex;gap:12px;padding:4px 0;font-size:12px;font-family:'DM Mono',monospace;">
            <span style="color:${color};">[${marker}]</span>
            <span style="${labelStyle}min-width:160px;">${stages[i].label}</span>
            <span style="color:${color};">${stages[i].desc}</span>
        </div>`;
    }

    return `
    <div style="border:1px solid #e7e5e4;padding:28px 28px 24px;margin-top:48px;border-radius:12px;background:#faf8f5;">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:#a8a29e;margin-bottom:16px;font-family:'DM Mono',monospace;">Your Second Brain Journey</div>
        ${stageListHtml}
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c;line-height:1.7;">
            You are in the <span style="color:#16a34a;font-weight:600;">${stages[currentIdx].label}</span> stage. ${nextText}
        </div>
    </div>`;
}

export function generateDashboardHtml(report) {
    const setupPts = report.setup?.totalPoints || 0;
    const setupMax = report.setup?.maxPoints || 0;
    const usagePts = report.usage?.totalPoints || 0;
    const usageMax = report.usage?.maxPoints || 0;
    const fluencyPts = report.fluency?.totalPoints || 0;
    const fluencyMax = report.fluency?.maxPoints || 0;

    const totalPoints = setupPts + usagePts + fluencyPts;
    const totalMax = setupMax + usageMax + fluencyMax;
    const overallPct = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;

    let overallGrade;
    if (overallPct >= 80) overallGrade = 'A';
    else if (overallPct >= 65) overallGrade = 'B';
    else if (overallPct >= 50) overallGrade = 'C';
    else if (overallPct >= 30) overallGrade = 'D';
    else overallGrade = 'F';

    const gradeColor = getGradeColor(overallGrade);

    const setupBarPct = setupMax > 0 ? Math.round((setupPts / setupMax) * 100) : 0;
    const usageBarPct = usageMax > 0 ? Math.round((usagePts / usageMax) * 100) : 0;
    const fluencyBarPct = fluencyMax > 0 ? Math.round((fluencyPts / fluencyMax) * 100) : 0;

    const ts = new Date(report.timestamp);
    const dateStr = ts.toISOString().slice(0, 10);
    const timeStr = ts.toISOString().slice(11, 19) + ' UTC';

    // Shorten path to ~/... style
    const home = process.env.HOME || '';
    const shortPath = home && report.path?.startsWith(home)
        ? '~' + report.path.slice(home.length)
        : (report.path || '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Second Brain Health Check &mdash; ${overallPct}% (Grade ${overallGrade})</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Outfit', sans-serif;
    background: #f5f0eb;
    color: #1c1917;
    min-height: 100vh;
    padding: 48px 44px;
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 860px; margin: 0 auto; }
  a { color: #57534e; text-decoration: none; border-bottom: 1px solid #d6d3d1; }
  a:hover { color: #1c1917; border-bottom-color: #1c1917; }
  code { font-family: 'DM Mono', monospace; font-size: 0.92em; background: rgba(28,25,23,0.06); padding: 1px 5px; border-radius: 3px; }
  details summary { list-style: none; }
  details summary::-webkit-details-marker { display: none; }
  @media (max-width: 680px) {
    body { padding: 24px 20px; }
    .score-panel { grid-template-columns: 1fr !important; }
    .score-right { border-left: none !important; border-top: 1px solid #e7e5e4 !important; }
    .big-num { font-size: 88px !important; }
  }
</style>
</head>
<body>
<div class="container">

    <!-- Nav header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;font-size:10px;color:#a8a29e;text-transform:uppercase;letter-spacing:0.12em;font-family:'DM Mono',monospace;">
        <span>Second Brain / Health Check v${VERSION}</span>
        <span style="text-align:right;">${dateStr}<br>${timeStr}</span>
    </div>

    <!-- Title -->
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:52px;font-weight:400;color:#1c1917;letter-spacing:-0.5px;line-height:1.05;margin-bottom:8px;">Health Check Report</h1>
    <span style="font-size:12px;color:#78716c;display:block;margin-bottom:4px;font-family:'DM Mono',monospace;">${escapeHtml(shortPath)}</span>
    <span style="font-size:12px;color:#a8a29e;font-style:italic;display:block;margin-bottom:28px;">Your Second Brain, examined.</span>

    <div style="border-top:1px solid #e7e5e4;margin-bottom:32px;"></div>

    <!-- What is a Second Brain? -->
    <div style="border-left:2px solid #d6d3d1;padding:16px 20px;margin-bottom:32px;font-size:12px;color:#78716c;line-height:1.7;background:rgba(28,25,23,0.02);border-radius:0 8px 8px 0;">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:#a8a29e;margin-bottom:8px;font-family:'DM Mono',monospace;">What is a Second Brain?</div>
        A Second Brain is a structured AI workspace that learns how you work.
        It is not an app. It is a repository &mdash; CLAUDE.md instructions, custom
        skills, memory systems, and automation hooks &mdash; configured for your
        specific role, tools, and workflows.<br><br>
        The more you use it, the smarter it gets. That is the whole point.
    </div>

    <!-- Score panel -->
    <div class="score-panel" style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;background:#faf8f5;">
        <!-- Left: big score -->
        <div style="padding:32px 36px;display:flex;flex-direction:column;justify-content:center;gap:20px;background:#1c1917;">
            <div>
                <span class="big-num" style="font-size:110px;font-weight:700;color:#faf8f5;line-height:1;font-family:'DM Mono',monospace;">${overallPct}</span><span style="font-size:32px;color:rgba(250,248,245,0.35);font-weight:300;font-family:'DM Mono',monospace;">%</span>
            </div>
            <div style="border:1px solid ${gradeColor};padding:10px 0;text-align:center;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${gradeColor};border-radius:6px;font-family:'DM Mono',monospace;">Grade ${overallGrade}</div>
        </div>

        <!-- Right: dimension breakdown -->
        <div class="score-right" style="padding:32px 36px;border-left:1px solid #e7e5e4;">
            <div style="font-size:11px;color:#a8a29e;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:22px;font-family:'DM Mono',monospace;">${totalPoints} / ${totalMax} points</div>

            <!-- Setup -->
            <div style="margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#78716c;margin-bottom:7px;font-family:'DM Mono',monospace;">
                    <span>Setup</span>
                    <span>${report.setup?.normalizedScore || setupBarPct}/100</span>
                </div>
                <div style="height:4px;background:#e7e5e4;border-radius:2px;">
                    <div style="height:100%;width:${setupBarPct}%;background:${getBarColor(setupPts, setupMax)};border-radius:2px;"></div>
                </div>
            </div>

            <!-- Usage -->
            <div style="margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#78716c;margin-bottom:7px;font-family:'DM Mono',monospace;">
                    <span>Usage</span>
                    <span>${report.usage?.normalizedScore || usageBarPct}/100</span>
                </div>
                <div style="height:4px;background:#e7e5e4;border-radius:2px;">
                    <div style="height:100%;width:${usageBarPct}%;background:${getBarColor(usagePts, usageMax)};border-radius:2px;"></div>
                </div>
            </div>

            <!-- Fluency -->
            <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#78716c;margin-bottom:7px;font-family:'DM Mono',monospace;">
                    <span>Fluency</span>
                    <span>${report.fluency?.normalizedScore || fluencyBarPct}/100</span>
                </div>
                <div style="height:4px;background:#e7e5e4;border-radius:2px;">
                    <div style="height:100%;width:${fluencyBarPct}%;background:${getBarColor(fluencyPts, fluencyMax)};border-radius:2px;"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- How to read this report -->
    <div style="border-left:2px solid #d6d3d1;padding:16px 20px;margin-top:32px;margin-bottom:8px;font-size:12px;color:#78716c;line-height:1.7;background:rgba(28,25,23,0.02);border-radius:0 8px 8px 0;">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:#a8a29e;margin-bottom:12px;font-family:'DM Mono',monospace;">How to read this report</div>
        This report measures three dimensions:<br><br>
        <span style="color:#1c1917;font-weight:600;">Setup</span> &mdash; Does your brain have the right architecture?
        Your CLAUDE.md file, skill library, memory system, hooks, and directory
        structure. A well-set-up brain gives AI the context it needs to help you.<br><br>
        <span style="color:#1c1917;font-weight:600;">Usage</span> &mdash; Is the brain being used, or collecting dust?
        Session logs, evolving patterns, growing memory. A brain that compounds
        is one that gets used daily and learns from every session.<br><br>
        <span style="color:#1c1917;font-weight:600;">Fluency</span> &mdash; How sophisticated is your AI collaboration?
        Not just &ldquo;do you use AI&rdquo; but &ldquo;do your skills orchestrate
        multiple tools, reference knowledge directories, and use progressive
        disclosure?&rdquo; This is the difference between prompting and engineering.
    </div>

    <!-- Top Fixes -->
    ${renderTopFixes(report.topFixes)}

    <!-- CE Patterns -->
    ${renderCEPatterns(report.cePatterns)}

    <!-- Setup -->
    ${getDimensionIntro(report.setup, 'Setup Quality')}
    ${renderDimension(report.setup, 'Setup Quality')}

    <!-- Usage -->
    ${getDimensionIntro(report.usage, 'Usage Activity')}
    ${renderDimension(report.usage, 'Usage Activity')}

    <!-- Fluency -->
    ${report.fluency ? getDimensionIntro(report.fluency, 'AI Fluency') : ''}
    ${report.fluency ? renderDimension(report.fluency, 'AI Fluency') : ''}

    <!-- Journey Stage -->
    ${renderJourneyStage(overallPct)}

    <!-- CTA -->
    ${report.brainState?.isBuyer
        ? `<div style="border:1px solid #d6d3d1;padding:44px 40px;text-align:center;margin-top:32px;margin-bottom:32px;border-radius:12px;background:#faf8f5;">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#16a34a;margin-bottom:16px;font-family:'DM Mono',monospace;">Baseline Captured</div>
        <p style="font-size:12px;color:#78716c;margin-bottom:8px;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">Score: ${overallPct}%. Run again after setup to see your progress.</p>
    </div>`
        : overallPct >= 85
        ? `<div style="background:#1c1917;padding:44px 40px;text-align:center;margin-top:32px;margin-bottom:32px;border-radius:12px;">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:rgba(250,248,245,0.6);margin-bottom:16px;font-family:'DM Mono',monospace;">You built something rare</div>
        <p style="font-size:12px;color:rgba(250,248,245,0.45);margin-bottom:24px;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">Score ${overallPct}%. Most people never get past Scaffolded. Your brain is compounding. If you want to help your team get here too, the Team Brain add-on gives everyone a personal brain with shared context.</p>
        <a href="https://www.iwoszapar.com/teams" style="display:inline-block;padding:12px 36px;background:#ffffff;color:#1c1917;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;border:none;border-radius:6px;font-family:'DM Mono',monospace;">Explore Team Brain</a>
    </div>`
        : `<div style="background:#1c1917;padding:44px 40px;text-align:center;margin-top:32px;margin-bottom:32px;border-radius:12px;">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:rgba(250,248,245,0.6);margin-bottom:16px;font-family:'DM Mono',monospace;">The fastest way to production-grade</div>
        <p style="font-size:12px;color:rgba(250,248,245,0.45);margin-bottom:24px;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">You could fix everything on this report yourself. It would take weeks of trial and error. Or you could start with a Second Brain that already scores 85+ out of the box &mdash; pre-configured with skills, hooks, memory systems, and knowledge architecture built for how you actually work.</p>
        <a href="https://www.iwoszapar.com/second-brain-ai" style="display:inline-block;padding:12px 36px;background:#ffffff;color:#1c1917;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;border:none;border-radius:6px;font-family:'DM Mono',monospace;">Get your Second Brain</a>
    </div>`
    }

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #e7e5e4;font-size:10px;color:#a8a29e;text-transform:uppercase;letter-spacing:0.1em;font-family:'DM Mono',monospace;">
        Generated by <a href="https://www.iwoszapar.com/second-brain-ai" style="color:#57534e;border-bottom:1px solid #d6d3d1;">Second Brain Health Check</a> v${VERSION} &middot; ${ts.toISOString()}
    </div>

</div>
</body>
</html>`;
}

export async function saveDashboard(report, outputPath) {
    const html = generateDashboardHtml(report);
    const filePath = resolve(outputPath || (process.cwd() + '/health-check-report.html'));
    // Security: enforce home-directory boundary on output path
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error('Cannot determine home directory: HOME environment variable is not set.');
    }
    if (!filePath.startsWith(homeDir + '/') && filePath !== homeDir) {
        throw new Error(`Output path "${filePath}" is outside the home directory.`);
    }
    await writeFile(filePath, html, 'utf-8');
    return filePath;
}
