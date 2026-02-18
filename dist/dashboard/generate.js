/**
 * Dashboard Generator
 *
 * Generates a self-contained HTML dashboard from health check results.
 * Single file, no external dependencies, dark mode, mobile-responsive.
 */
import { writeFile, realpath as fsRealpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getScoreColor(points, maxPoints) {
    const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    if (pct >= 80) return '#22c55e';  // green
    if (pct >= 60) return '#eab308';  // yellow
    if (pct >= 40) return '#f97316';  // orange
    return '#ef4444';                  // red
}

function getGradeBadgeColor(grade) {
    const gradeMap = {
        'A': '#22c55e', 'Active': '#22c55e', 'Expert': '#22c55e',
        'B': '#84cc16', 'Growing': '#84cc16', 'Proficient': '#84cc16',
        'C': '#eab308', 'Starting': '#eab308', 'Developing': '#eab308',
        'D': '#f97316', 'Dormant': '#f97316', 'Beginner': '#f97316',
        'F': '#ef4444', 'Empty': '#ef4444', 'Novice': '#ef4444',
    };
    return gradeMap[grade] || '#6b7280';
}

function statusDot(status) {
    const colors = { pass: '#22c55e', warn: '#eab308', fail: '#ef4444' };
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[status] || '#6b7280'};margin-right:6px;"></span>`;
}

function renderDimension(dim, label) {
    const color = getScoreColor(dim.totalPoints, dim.maxPoints);
    const pct = dim.maxPoints > 0 ? Math.round((dim.totalPoints / dim.maxPoints) * 100) : 0;
    const badgeColor = getGradeBadgeColor(dim.grade);

    let layersHtml = '';
    for (const layer of dim.layers) {
        const layerPct = layer.maxPoints > 0 ? Math.round((layer.points / layer.maxPoints) * 100) : 0;
        const layerColor = getScoreColor(layer.points, layer.maxPoints);

        let checksHtml = '';
        for (const check of layer.checks) {
            checksHtml += `
                <div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;font-size:13px;color:#94a3b8;">
                    ${statusDot(check.status)}
                    <span style="flex:1">${escapeHtml(check.message)}</span>
                    <span style="color:#64748b;white-space:nowrap;">${check.points}/${check.maxPoints}</span>
                </div>`;
        }

        layersHtml += `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:14px;font-weight:500;color:#e2e8f0;">${escapeHtml(layer.name)}</span>
                    <span style="font-size:13px;color:#94a3b8;">${layer.points}/${layer.maxPoints}</span>
                </div>
                <div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${layerPct}%;background:${layerColor};border-radius:3px;transition:width 0.5s;"></div>
                </div>
                <div style="margin-top:8px;padding-left:4px;">
                    ${checksHtml}
                </div>
            </div>`;
    }

    return `
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div>
                    <h2 style="font-size:18px;font-weight:600;color:#f8fafc;margin:0 0 4px 0;">${escapeHtml(label)}</h2>
                    <p style="font-size:14px;color:#94a3b8;margin:0;">${escapeHtml(dim.gradeLabel)}</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:32px;font-weight:700;color:${color};">${dim.normalizedScore || pct}<span style="font-size:16px;color:#64748b;">/100</span></div>
                    <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600;color:#0f172a;background:${badgeColor};">${escapeHtml(dim.grade)}</span>
                </div>
            </div>
            <div style="height:8px;background:#1e293b;border-radius:4px;overflow:hidden;margin-bottom:24px;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.5s;"></div>
            </div>
            ${layersHtml}
        </div>`;
}

function renderTopFixes(fixes) {
    if (!fixes || fixes.length === 0) return '';

    let fixesHtml = '';
    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const catColors = { setup: '#6366f1', usage: '#8b5cf6', fluency: '#a855f7' };
        const catColor = catColors[fix.category] || '#6b7280';

        fixesHtml += `
            <div style="display:flex;gap:12px;padding:12px 0;${i < fixes.length - 1 ? 'border-bottom:1px solid #1e293b;' : ''}">
                <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#e2e8f0;">${i + 1}</div>
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:14px;font-weight:500;color:#e2e8f0;">${escapeHtml(fix.title)}</span>
                        <span style="font-size:11px;padding:1px 6px;border-radius:4px;background:${catColor}20;color:${catColor};border:1px solid ${catColor}40;">${escapeHtml(fix.impact)}</span>
                    </div>
                    <p style="font-size:13px;color:#94a3b8;margin:0;">${escapeHtml(fix.description)}</p>
                </div>
            </div>`;
    }

    return `
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:20px;">
            <h2 style="font-size:18px;font-weight:600;color:#f8fafc;margin:0 0 16px 0;">Top Fixes</h2>
            ${fixesHtml}
        </div>`;
}

export function generateDashboardHtml(report) {
    const totalPoints = (report.setup?.totalPoints || 0) + (report.usage?.totalPoints || 0) + (report.fluency?.totalPoints || 0);
    const totalMax = (report.setup?.maxPoints || 0) + (report.usage?.maxPoints || 0) + (report.fluency?.maxPoints || 0);
    const overallPct = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;
    const overallColor = getScoreColor(totalPoints, totalMax);

    let overallGrade;
    if (overallPct >= 80) overallGrade = 'A';
    else if (overallPct >= 65) overallGrade = 'B';
    else if (overallPct >= 50) overallGrade = 'C';
    else if (overallPct >= 30) overallGrade = 'D';
    else overallGrade = 'F';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Second Brain Health Check</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #e2e8f0; min-height: 100vh; padding: 24px; }
  .container { max-width: 720px; margin: 0 auto; }
  a { color: #818cf8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  @media (max-width: 640px) {
    body { padding: 12px; }
    .score-grid { grid-template-columns: 1fr !important; }
  }
</style>
</head>
<body>
<div class="container">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:24px;font-weight:700;color:#f8fafc;margin-bottom:4px;">Second Brain Health Check</h1>
        <p style="font-size:14px;color:#64748b;">${escapeHtml(report.path)} &middot; ${new Date(report.timestamp).toLocaleDateString()}</p>
    </div>

    <!-- Overall Score -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid #312e81;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
        <div style="font-size:64px;font-weight:800;color:${overallColor};line-height:1;">${overallPct}<span style="font-size:24px;color:#64748b;">%</span></div>
        <div style="margin-top:8px;">
            <span style="display:inline-block;padding:4px 16px;border-radius:9999px;font-size:14px;font-weight:600;color:#0f172a;background:${overallColor};">Grade ${overallGrade}</span>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin-top:12px;">${totalPoints} / ${totalMax} points across all dimensions</p>

        <!-- Mini bars -->
        <div class="score-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px;text-align:left;">
            <div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Setup</div>
                <div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${report.setup?.maxPoints ? Math.round((report.setup.totalPoints / report.setup.maxPoints) * 100) : 0}%;background:${getScoreColor(report.setup?.totalPoints || 0, report.setup?.maxPoints || 1)};border-radius:2px;"></div>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${report.setup?.normalizedScore || 0}/100</div>
            </div>
            <div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Usage</div>
                <div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${report.usage?.maxPoints ? Math.round((report.usage.totalPoints / report.usage.maxPoints) * 100) : 0}%;background:${getScoreColor(report.usage?.totalPoints || 0, report.usage?.maxPoints || 1)};border-radius:2px;"></div>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${report.usage?.normalizedScore || 0}/100</div>
            </div>
            <div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Fluency</div>
                <div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${report.fluency?.maxPoints ? Math.round((report.fluency.totalPoints / report.fluency.maxPoints) * 100) : 0}%;background:${getScoreColor(report.fluency?.totalPoints || 0, report.fluency?.maxPoints || 1)};border-radius:2px;"></div>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${report.fluency?.normalizedScore || 0}/100</div>
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
    <div style="background:linear-gradient(135deg,#312e81,#4c1d95);border:1px solid #4338ca;border-radius:12px;padding:24px;text-align:center;margin-top:8px;">
        <h3 style="font-size:16px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Want a Second Brain that scores 85+?</h3>
        <p style="font-size:14px;color:#c4b5fd;margin-bottom:16px;">Get a pre-configured AI workspace with skills, hooks, memory systems, and knowledge architecture built in.</p>
        <a href="https://www.iwoszapar.com/second-brain-ai" style="display:inline-block;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Get Your Second Brain</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #1e293b;">
        <p style="font-size:12px;color:#475569;">Generated by <a href="https://www.iwoszapar.com/second-brain-ai">Second Brain Health Check</a> &middot; ${new Date(report.timestamp).toISOString()}</p>
    </div>

</div>
</body>
</html>`;
}

export async function saveDashboard(report, outputPath) {
    const html = generateDashboardHtml(report);
    const filePath = resolve(outputPath || join(process.cwd(), 'health-check-report.html'));
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
