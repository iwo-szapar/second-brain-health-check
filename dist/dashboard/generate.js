/**
 * Dashboard Generator — Brutalist Design
 *
 * Generates a self-contained HTML dashboard from health check results.
 * Matches the PDF report aesthetic: monospace, dark, angular, no-nonsense.
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

function renderTopFixes(fixes) {
    if (!fixes || fixes.length === 0) return '';

    let rowsHtml = '';
    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const num = String(i + 1).padStart(2, '0');
        const catColors = { setup: '#4455ee', usage: '#5544ee', fluency: '#6644cc' };
        const badgeColor = catColors[fix.category] || '#4455ee';

        rowsHtml += `
        <div style="display:flex;align-items:flex-start;gap:20px;padding:16px 20px;border-top:1px solid #1a1a1a;">
            <span style="font-size:20px;font-weight:700;color:#2a2a2a;flex-shrink:0;width:30px;">${num}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#e0e0e0;">${escapeHtml(fix.title)}</span>
                    <span style="font-size:10px;padding:2px 7px;border:1px solid ${badgeColor};color:${badgeColor};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">${escapeHtml(fix.impact)}</span>
                </div>
                <p style="font-size:12px;color:#666;margin:0;">${escapeHtml(fix.description)}</p>
            </div>
        </div>`;
    }

    return `
    <div style="border:1px solid #2a2a2a;margin-top:32px;">
        <div style="background:#0d0d40;padding:13px 20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#c0c0c0;">TOP FIXES &mdash; HIGHEST IMPACT</div>
        ${rowsHtml}
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
<title>Second Brain Health Check &mdash; Diagnostic Report</title>
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
  @media (max-width: 680px) {
    body { padding: 24px 20px; }
    .score-panel { grid-template-columns: 1fr !important; }
    .score-right { border-left: none !important; border-top: 1px solid #2a2a2a !important; }
    .big-num { font-size: 88px !important; }
  }
</style>
</head>
<body>
<div class="container">

    <!-- Nav header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.1em;">
        <span>SECOND BRAIN // HEALTH CHECK</span>
        <span style="text-align:right;">${dateStr}<br>${timeStr}</span>
    </div>

    <!-- Title -->
    <h1 style="font-size:56px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:-0.01em;line-height:1;margin-bottom:8px;">DIAGNOSTIC REPORT</h1>
    <span style="font-size:13px;color:#22c55e;display:block;margin-bottom:24px;">${escapeHtml(shortPath)}</span>

    <div style="border-top:1px solid #2a2a2a;margin-bottom:32px;"></div>

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

    <!-- Top Fixes -->
    ${renderTopFixes(report.topFixes)}

    <!-- Setup -->
    ${renderDimension(report.setup, 'Setup Quality')}

    <!-- Usage -->
    ${renderDimension(report.usage, 'Usage Activity')}

    <!-- Fluency -->
    ${report.fluency ? renderDimension(report.fluency, 'AI Fluency') : ''}

    <!-- CTA -->
    ${overallPct >= 85
        ? `<div style="border:1px solid #2a2a2a;padding:44px 40px;text-align:center;margin-top:48px;margin-bottom:32px;">
        <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fff;margin-bottom:12px;">YOUR BRAIN IS IN THE TOP TIER</div>
        <p style="font-size:12px;color:#555;margin-bottom:24px;line-height:1.7;">Score ${overallPct}%. You're running a production-grade Second Brain.<br>Share the health check with your team.</p>
        <a href="https://www.iwoszapar.com/second-brain-ai" style="display:inline-block;padding:12px 36px;background:#2233cc;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;">SEE WHAT&rsquo;S NEXT</a>
    </div>`
        : `<div style="border:1px solid #2a2a2a;padding:44px 40px;text-align:center;margin-top:48px;margin-bottom:32px;">
        <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fff;margin-bottom:12px;">WANT A SECOND BRAIN THAT SCORES 85+?</div>
        <p style="font-size:12px;color:#555;margin-bottom:24px;line-height:1.7;">Pre-configured AI workspace with skills, hooks, memory systems,<br>and knowledge architecture built in.</p>
        <a href="https://www.iwoszapar.com/second-brain-ai" style="display:inline-block;padding:12px 36px;background:#2233cc;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none;">GET YOUR SECOND BRAIN</a>
    </div>`
    }

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #1a1a1a;font-size:10px;color:#444;text-transform:uppercase;letter-spacing:0.1em;">
        GENERATED BY <a href="https://www.iwoszapar.com/second-brain-ai" style="color:#22c55e;">SECOND BRAIN HEALTH CHECK</a> &middot; ${ts.toISOString()}
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
