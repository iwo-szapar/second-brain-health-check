/**
 * Dashboard Generator — Brutalist Design + Story
 *
 * Generates a self-contained HTML dashboard from health check results.
 * Matches the PDF report aesthetic: monospace, dark, angular, no-nonsense.
 * Weaves narrative context between data sections for first-time readers.
 *
 * v0.8.1: Three-tier fix remediation (summary + why + steps),
 * time estimates, CE pattern section.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getBarColor(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 80) return '#22c55e';
    if (pct >= 60) return '#eab308';
    if (pct >= 40) return '#f97316';
    return '#ef4444';
}

function getGradeColor(grade) {
    const g = String(grade).toLowerCase();
    if (['a', 'expert', 'active'].includes(g)) return '#22c55e';
    if (['b', 'proficient', 'growing'].includes(g)) return '#84cc16';
    if (['c', 'developing', 'starting'].includes(g)) return '#eab308';
    if (['d', 'beginner', 'dormant'].includes(g)) return '#f97316';
    return '#ef4444';
}

function statusSquare(status) {
    const colors = { pass: '#22c55e', warn: '#f59e0b', fail: '#ef4444' };
    const c = colors[status] || '#555';
    return `<span style="display:inline-block;width:10px;height:10px;min-width:10px;background:${c};margin-top:2px;"></span>`;
}

/** Three-tier guided remediation hints for common fix titles */
const FIX_REMEDIATION = {
    'quality tracking active': {
        hint: 'Create <code style="color:#4455ee;">memory/quality-metrics.md</code> and log a dated entry after each work session.',
        minutes: 5,
        why: 'Tracking quality metrics over time shows the brain is improving, not just existing.',
        steps: ['Create memory/quality-metrics.md', 'Add a dated entry: "## 2026-02-19\\n- Sessions: 3\\n- Patterns learned: 1"', 'Update after each work session'],
    },
    'growth log populated': {
        hint: 'Create <code style="color:#4455ee;">memory/growth-log.md</code> with dated entries tracking what your brain learned each week.',
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
        hint: 'Run <code style="color:#4455ee;">mkdir -p .codex/skills</code> and symlink or copy your Claude skills there.',
        minutes: 5,
        why: 'Codex compatibility means your skills work across multiple AI coding tools, not just Claude.',
        steps: ['Run: mkdir -p .codex/skills', 'Copy or symlink your .claude/skills/ files to .codex/skills/', 'Verify with: ls .codex/skills/'],
    },
    'style/voice files populated': {
        hint: 'Add files to <code style="color:#4455ee;">memory/style-voice/</code> or <code style="color:#4455ee;">memory/personal/</code> describing your writing voice, communication preferences, or company context.',
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
        hint: 'Create <code style="color:#4455ee;">brain-health/growth-log.md</code> and <code style="color:#4455ee;">brain-health/quality-metrics.md</code> to track your brain\'s evolution.',
        minutes: 5,
        why: 'Without tracking files, you cannot measure improvement. What gets measured gets managed.',
        steps: ['Run: mkdir -p brain-health', 'Create brain-health/growth-log.md with a dated first entry', 'Create brain-health/quality-metrics.md with baseline metrics'],
    },
    'config size': {
        hint: 'Audit <code style="color:#4455ee;">~/.claude.json</code> and <code style="color:#4455ee;">.claude/settings.local.json</code> for stale entries. Remove permissions you no longer need.',
        minutes: 5,
        why: 'Bloated config files slow down session startup and can contain stale permissions.',
        steps: ['Open ~/.claude.json and review each entry', 'Remove permissions for tools or paths you no longer use', 'Check .claude/settings.local.json for duplicates'],
    },
    'stale permission patterns': {
        hint: 'Run <code style="color:#4455ee;">claude permissions reset</code> or manually prune unused patterns from settings files.',
        minutes: 5,
        why: 'Stale permissions create security surface area for no benefit.',
        steps: ['Run: claude permissions reset', 'Or manually edit .claude/settings.json to remove old Allow patterns', 'Keep only permissions you actively use'],
    },
    'hook health validation': {
        hint: 'Add <code style="color:#4455ee;">|| true</code> after <code style="color:#4455ee;">grep</code> and <code style="color:#4455ee;">find</code> commands in hook scripts using <code style="color:#4455ee;">set -e</code>.',
        minutes: 5,
        why: 'Hooks with set -e that call grep/find will crash on no-match. Adding || true prevents false failures.',
        steps: ['Find all hook scripts in .claude/hooks/', 'Search for grep or find commands', 'Add || true after each to prevent exit on no-match'],
    },
    'pattern confidence tracking': {
        hint: 'Add HIGH/MEDIUM/LOW confidence labels to your <code style="color:#4455ee;">_pattern-tracker.md</code> entries.',
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
        hint: 'Create subdirectories in <code style="color:#4455ee;">memory/</code>: semantic/, episodic/, personal/, style-voice/.',
        minutes: 10,
        why: 'A flat memory directory becomes unsearchable. Subdirectories give the AI structured retrieval paths.',
        steps: ['Run: mkdir -p memory/semantic/patterns memory/episodic/sessions memory/personal', 'Move existing files into appropriate subdirectories', 'Add index.md to each directory explaining its purpose'],
    },
    'patterns directory': {
        hint: 'Run <code style="color:#4455ee;">mkdir -p memory/semantic/patterns</code> to store learned patterns.',
        minutes: 5,
        why: 'Patterns are the highest-value memory type — reusable knowledge that compounds across sessions.',
        steps: ['Run: mkdir -p memory/semantic/patterns', 'Create your first pattern file based on a recent lesson learned', 'Reference patterns from CLAUDE.md or skills'],
    },
    'index files for navigation': {
        hint: 'Add <code style="color:#4455ee;">index.md</code> files to your top-level knowledge directories so the agent can navigate.',
        minutes: 5,
        why: 'Index files are progressive disclosure for AI — they tell the agent what is in each directory without loading everything.',
        steps: ['Add index.md to memory/, .claude/docs/, and any knowledge directories', 'List the contents and purpose of each file in the directory', 'Reference these indexes from CLAUDE.md'],
    },
    'brain health directory': {
        hint: 'Run <code style="color:#4455ee;">mkdir brain-health</code> and add tracking files for growth metrics.',
        minutes: 5,
        why: 'A brain-health directory enables self-monitoring — the brain can track its own improvement.',
        steps: ['Run: mkdir brain-health', 'Create growth-log.md and quality-metrics.md', 'Run health check periodically and log the scores'],
    },
    'getting started guide': {
        hint: 'Create a <code style="color:#4455ee;">README.md</code> or <code style="color:#4455ee;">ONBOARDING_SUMMARY.md</code> at your project root.',
        minutes: 5,
        why: 'A getting started guide helps teammates (and future-you) understand the brain quickly.',
        steps: ['Create README.md at your project root', 'Explain what this brain does and who it is for', 'List the key commands and skills available'],
    },
    'agent configuration': {
        hint: 'Create <code style="color:#4455ee;">.claude/agents/</code> with .md files defining specialized agent personas.',
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
        hint: 'Update skill instructions to reference <code style="color:#4455ee;">memory/</code>, <code style="color:#4455ee;">docs/</code>, or <code style="color:#4455ee;">patterns/</code> directories.',
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
            <div style="display:flex;align-items:flex-start;gap:10px;padding:3px 0;font-size:12px;color:#777;">
                ${statusSquare(check.status)}
                <span style="flex:1;line-height:1.5;">${escapeHtml(check.message)}</span>
                <span style="color:#444;white-space:nowrap;padding-left:12px;">${check.points}/${check.maxPoints}</span>
            </div>`;
        }

        layersHtml += `
        <div style="margin-bottom:${isLast ? '0' : '20px'};padding-bottom:${isLast ? '0' : '20px'};${isLast ? '' : 'border-bottom:1px solid #1a1a1a;'}">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
                <span style="font-size:13px;color:#aaa;font-style:italic;">${escapeHtml(layer.name)}</span>
                <span style="font-size:12px;color:#555;">${layer.points}/${layer.maxPoints}</span>
            </div>
            <div style="height:3px;background:#1a1a1a;margin-bottom:10px;">
                <div style="height:100%;width:${layerPct}%;background:${layerBarColor};"></div>
            </div>
            ${checksHtml}
        </div>`;
    }

    const normalizedDisplay = dim.normalizedScore || rawPct;

    return `
    <div style="margin-top:40px;">
        <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#e0e0e0;flex:1;">${escapeHtml(label)}</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;padding:2px 8px;border:1px solid ${gradeColor};color:${gradeColor};">${escapeHtml(dim.grade)}</span>
            <span style="font-size:20px;font-weight:700;color:#fff;">${normalizedDisplay}<span style="font-size:13px;color:#444;">/100</span></span>
        </div>
        <div style="height:4px;background:#1a1a1a;margin-bottom:24px;">
            <div style="height:100%;width:${rawPct}%;background:${barColor};"></div>
        </div>
        ${layersHtml}
    </div>`;
}

function getDimensionIntro(dim, label) {
    if (!dim) return '';
    const pct = dim.maxPoints > 0 ? Math.round((dim.totalPoints / dim.maxPoints) * 100) : 0;

    const intros = {
        'Setup Quality': pct >= 70
            ? 'Your setup is strong. The architecture is in place &mdash; CLAUDE.md is routing, skills are configured, memory has structure. Focus on the yellow and red items below.'
            : 'Setup is where most Second Brains stall. Without the right architecture, AI has no context to work with &mdash; like hiring a brilliant assistant and giving them no onboarding.',
        'Usage Activity': pct >= 70
            ? 'Your brain is alive. Sessions are happening, patterns are forming, memory is growing. This is where compound learning kicks in &mdash; every session makes the next one better.'
            : 'A Second Brain only works if you use it. The goal is not perfection &mdash; it is consistency. Even 10 minutes a day builds compound knowledge over weeks.',
        'AI Fluency': pct >= 70
            ? 'You are not just using AI &mdash; you are engineering context. Your skills orchestrate tools, reference knowledge, and use progressive disclosure.'
            : 'Fluency measures how you collaborate with AI, not just whether you use it. The leap from &ldquo;I use Claude&rdquo; to &ldquo;my skills orchestrate tools and pull from a knowledge graph&rdquo; is what this tracks.',
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
    <div style="border-left:2px solid #2233cc;padding:12px 20px;margin-top:40px;margin-bottom:-8px;font-size:12px;color:#888;line-height:1.7;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555;margin-bottom:6px;">${heading}</div>
        ${text}
    </div>`;
}

function renderTopFixes(fixes) {
    if (!fixes || fixes.length === 0) return '';

    let rowsHtml = '';
    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const num = String(i + 1).padStart(2, '0');
        const catColors = { setup: '#4455ee', usage: '#5544ee', fluency: '#6644cc' };
        const badgeColor = catColors[fix.category] || '#4455ee';

        const remediation = getRemediation(fix.title);
        let remediationHtml = '';
        if (remediation) {
            const timeHtml = remediation.minutes
                ? `<span style="color:#22c55e;font-size:10px;margin-left:8px;">~${remediation.minutes} min</span>`
                : '';
            const whyHtml = remediation.why
                ? `<div style="font-size:11px;color:#888;margin-top:4px;font-style:italic;">${escapeHtml(remediation.why)}</div>`
                : '';
            const stepsHtml = remediation.steps
                ? `<details style="margin-top:6px;"><summary style="font-size:10px;color:#4455ee;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em;">Step-by-step guide</summary><ol style="font-size:11px;color:#777;margin:6px 0 0 16px;line-height:1.8;">${remediation.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol></details>`
                : '';
            remediationHtml = `<div style="font-size:11px;color:#4455ee;margin-top:6px;padding:8px 10px;background:#0d0d1a;border-left:2px solid #2233cc;line-height:1.6;">${remediation.hint}${timeHtml}${whyHtml}${stepsHtml}</div>`;
        }

        rowsHtml += `
        <div style="display:flex;align-items:flex-start;gap:20px;padding:16px 20px;border-top:1px solid #1a1a1a;">
            <span style="font-size:20px;font-weight:700;color:#2a2a2a;flex-shrink:0;width:30px;">${num}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#e0e0e0;">${escapeHtml(fix.title)}</span>
                    <span style="font-size:10px;padding:2px 7px;border:1px solid ${badgeColor};color:${badgeColor};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">${escapeHtml(fix.impact)}</span>
                </div>
                <p style="font-size:12px;color:#666;margin:0;">${escapeHtml(fix.description)}</p>
                ${remediationHtml}
            </div>
        </div>`;
    }

    return `
    <div style="border:1px solid #2a2a2a;margin-top:32px;">
        <div style="background:#0d0d40;padding:13px 20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#c0c0c0;">TOP FIXES &mdash; HIGHEST IMPACT</div>
        ${rowsHtml}
    </div>`;
}

function renderCEPatterns(cePatterns) {
    if (!cePatterns || cePatterns.length === 0) return '';

    let patternsHtml = '';
    for (const p of cePatterns) {
        if (p.maxScore === 0) continue;
        const barColor = p.percentage >= 70 ? '#22c55e' : p.percentage >= 40 ? '#eab308' : '#ef4444';
        patternsHtml += `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #1a1a1a;">
            <span style="font-size:11px;color:#aaa;flex:1;min-width:0;">${escapeHtml(p.name)}</span>
            <div style="width:120px;height:4px;background:#1a1a1a;flex-shrink:0;">
                <div style="height:100%;width:${p.percentage}%;background:${barColor};"></div>
            </div>
            <span style="font-size:12px;color:${barColor};width:40px;text-align:right;flex-shrink:0;">${p.percentage}%</span>
        </div>`;
    }

    return `
    <div style="border:1px solid #2a2a2a;margin-top:32px;">
        <div style="background:#0d0d40;padding:13px 20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#c0c0c0;">CONTEXT ENGINEERING PATTERNS</div>
        <div style="padding:12px 20px;">
            <div style="font-size:11px;color:#666;margin-bottom:12px;">How well your brain implements the 7 Context Engineering patterns.</div>
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
        ? `The jump from <span style="color:#ccc;">${stages[currentIdx].label}</span> to <span style="color:#ccc;">${nextStage.label}</span> is usually about the areas where you scored lowest. Check your Top Fixes above.`
        : 'You are running a production-grade Second Brain. The system is self-improving. Share this report &mdash; show others what is possible.';

    let stageListHtml = '';
    for (let i = 0; i < stages.length; i++) {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const color = isCurrent ? '#22c55e' : isPast ? '#555' : '#333';
        const marker = isCurrent ? 'x' : isPast ? '/' : ' ';
        const labelStyle = isCurrent ? 'color:#22c55e;font-weight:700;' : `color:${color};`;
        stageListHtml += `
        <div style="display:flex;gap:12px;padding:4px 0;font-size:12px;">
            <span style="color:${color};">[${marker}]</span>
            <span style="${labelStyle}min-width:160px;">${stages[i].label}</span>
            <span style="color:${color};">${stages[i].desc}</span>
        </div>`;
    }

    return `
    <div style="border:1px solid #2a2a2a;padding:28px 28px 24px;margin-top:48px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#c0c0c0;margin-bottom:16px;">YOUR SECOND BRAIN JOURNEY</div>
        ${stageListHtml}
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1a1a;font-size:12px;color:#888;line-height:1.7;">
            You are in the <span style="color:#22c55e;font-weight:700;">${stages[currentIdx].label}</span> stage. ${nextText}
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
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
    background: #0a0a0a;
    color: #d0d0d0;
    min-height: 100vh;
    padding: 48px 44px;
    font-size: 13px;
    line-height: 1.5;
  }
  .container { max-width: 840px; margin: 0 auto; }
  a { color: #22c55e; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { font-family: inherit; }
  details summary { list-style: none; }
  details summary::-webkit-details-marker { display: none; }
  @media (max-width: 680px) {
    body { padding: 24px 20px; }
    .score-panel { grid-template-columns: 1fr !important; }
    .score-right { border-left: none !important; border-top: 1px solid #2a2a2a !important; }
    .big-num { font-size: 88px !important; }
    .journey-row { flex-wrap: wrap; }
  }
</style>
</head>
<body>
<div class="container">

    <!-- Nav header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.1em;">
        <span>SECOND BRAIN // HEALTH CHECK v0.8.1</span>
        <span style="text-align:right;">${dateStr}<br>${timeStr}</span>
    </div>

    <!-- Title -->
    <h1 style="font-size:56px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:-0.01em;line-height:1;margin-bottom:8px;">DIAGNOSTIC REPORT</h1>
    <span style="font-size:13px;color:#22c55e;display:block;margin-bottom:4px;">${escapeHtml(shortPath)}</span>
    <span style="font-size:12px;color:#555;font-style:italic;display:block;margin-bottom:24px;">Your Second Brain, examined.</span>

    <div style="border-top:1px solid #2a2a2a;margin-bottom:32px;"></div>

    <!-- What is a Second Brain? -->
    <div style="border-left:2px solid #2233cc;padding:16px 20px;margin-bottom:32px;font-size:12px;color:#888;line-height:1.7;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555;margin-bottom:8px;">WHAT IS A SECOND BRAIN?</div>
        A Second Brain is a structured AI workspace that learns how you work.
        It is not an app. It is a repository &mdash; CLAUDE.md instructions, custom
        skills, memory systems, and automation hooks &mdash; configured for your
        specific role, tools, and workflows.<br><br>
        The more you use it, the smarter it gets. That is the whole point.
    </div>

    <!-- Score panel -->
    <div class="score-panel" style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #2a2a2a;">
        <!-- Left: big score -->
        <div style="padding:32px 36px;display:flex;flex-direction:column;justify-content:center;gap:20px;">
            <div>
                <span class="big-num" style="font-size:110px;font-weight:700;color:#fff;line-height:1;">${overallPct}</span><span style="font-size:32px;color:#555;font-weight:700;">%</span>
            </div>
            <div style="border:2px solid ${gradeColor};padding:10px 0;text-align:center;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:${gradeColor};">GRADE ${overallGrade}</div>
        </div>

        <!-- Right: dimension breakdown -->
        <div class="score-right" style="padding:32px 36px;border-left:1px solid #2a2a2a;">
            <div style="font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:22px;">${totalPoints} / ${totalMax} POINTS</div>

            <!-- Setup -->
            <div style="margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:7px;">
                    <span>SETUP</span>
                    <span>${report.setup?.normalizedScore || setupBarPct}/100</span>
                </div>
                <div style="height:4px;background:#1a1a1a;">
                    <div style="height:100%;width:${setupBarPct}%;background:${getBarColor(setupPts, setupMax)};"></div>
                </div>
            </div>

            <!-- Usage -->
            <div style="margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:7px;">
                    <span>USAGE</span>
                    <span>${report.usage?.normalizedScore || usageBarPct}/100</span>
                </div>
                <div style="height:4px;background:#1a1a1a;">
                    <div style="height:100%;width:${usageBarPct}%;background:${getBarColor(usagePts, usageMax)};"></div>
                </div>
            </div>

            <!-- Fluency -->
            <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:7px;">
                    <span>FLUENCY</span>
                    <span>${report.fluency?.normalizedScore || fluencyBarPct}/100</span>
                </div>
                <div style="height:4px;background:#1a1a1a;">
                    <div style="height:100%;width:${fluencyBarPct}%;background:${getBarColor(fluencyPts, fluencyMax)};"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- How to read this report -->
    <div style="border-left:2px solid #2233cc;padding:16px 20px;margin-top:32px;margin-bottom:8px;font-size:12px;color:#888;line-height:1.7;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555;margin-bottom:12px;">HOW TO READ THIS REPORT</div>
        This report measures three things:<br><br>
        <span style="color:#ccc;font-weight:700;">SETUP</span> &mdash; Does your brain have the right architecture?
        Your CLAUDE.md file, skill library, memory system, hooks, and directory
        structure. A well-set-up brain gives AI the context it needs to help you.<br><br>
        <span style="color:#ccc;font-weight:700;">USAGE</span> &mdash; Is the brain being used, or collecting dust?
        Session logs, evolving patterns, growing memory. A brain that compounds
        is one that gets used daily and learns from every session.<br><br>
        <span style="color:#ccc;font-weight:700;">FLUENCY</span> &mdash; How sophisticated is your AI collaboration?
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
    ${overallPct >= 85
        ? `<div style="border:1px solid #2a2a2a;padding:44px 40px;text-align:center;margin-top:32px;margin-bottom:32px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fff;margin-bottom:16px;">YOU BUILT SOMETHING RARE</div>
        <p style="font-size:12px;color:#888;margin-bottom:24px;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">Score ${overallPct}%. Most people never get past Scaffolded. Your brain is compounding. If you want to help your team get here too, the Team Brain add-on gives everyone a personal brain with shared context.</p>
        <a href="https://www.iwoszapar.com/teams" style="display:inline-block;padding:12px 36px;background:#2233cc;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;">EXPLORE TEAM BRAIN</a>
    </div>`
        : `<div style="border:1px solid #2a2a2a;padding:44px 40px;text-align:center;margin-top:32px;margin-bottom:32px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fff;margin-bottom:16px;">THE FASTEST WAY TO PRODUCTION-GRADE</div>
        <p style="font-size:12px;color:#888;margin-bottom:24px;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">You could fix everything on this report yourself. It would take weeks of trial and error. Or you could start with a Second Brain that already scores 85+ out of the box &mdash; pre-configured with skills, hooks, memory systems, and knowledge architecture built for how you actually work.</p>
        <a href="https://www.iwoszapar.com/second-brain-ai" style="display:inline-block;padding:12px 36px;background:#2233cc;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;">GET YOUR SECOND BRAIN</a>
    </div>`
    }

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #1a1a1a;font-size:10px;color:#444;text-transform:uppercase;letter-spacing:0.1em;">
        GENERATED BY <a href="https://www.iwoszapar.com/second-brain-ai" style="color:#22c55e;">SECOND BRAIN HEALTH CHECK</a> v0.8.1 &middot; ${ts.toISOString()}
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
