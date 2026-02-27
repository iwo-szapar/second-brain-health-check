/**
 * Report Formatter
 *
 * Converts health check results into a readable markdown report.
 * v0.8.1: Adaptive formatting based on brain maturity level,
 * score-band CTAs, time estimates on fixes, CE pattern section.
 * v0.13.5: i18n translation maps, formatQuickReport, lang param threading.
 */

/**
 * i18n translation maps for report structural elements.
 * Technical terms (CLAUDE.md, MCP, hooks, skills) stay untranslated.
 */
const TRANSLATIONS = {
    es: {
        'SECOND BRAIN HEALTH CHECK': 'CHEQUEO DE SALUD DEL SEGUNDO CEREBRO',
        'SECOND BRAIN QUICK SCAN': 'ESCANEO R\u00c1PIDO DEL SEGUNDO CEREBRO',
        'OVERALL': 'GENERAL',
        'SETUP QUALITY': 'CALIDAD DE CONFIGURACI\u00d3N',
        'USAGE ACTIVITY': 'ACTIVIDAD DE USO',
        'AI FLUENCY': 'FLUIDEZ IA',
        'SETUP QUALITY BREAKDOWN': 'DESGLOSE DE CALIDAD DE CONFIGURACI\u00d3N',
        'USAGE ACTIVITY BREAKDOWN': 'DESGLOSE DE ACTIVIDAD DE USO',
        'AI FLUENCY BREAKDOWN': 'DESGLOSE DE FLUIDEZ IA',
        'TOP FIXES (highest impact)': 'PRINCIPALES CORRECCIONES (mayor impacto)',
        'CONTEXT ENGINEERING PATTERNS (7 patterns)': 'PATRONES DE INGENIER\u00cdA DE CONTEXTO (7 patrones)',
        'X-RAY RESULT: No brain detected.': 'RESULTADO: No se detect\u00f3 ning\u00fan cerebro.',
        'INSTALL YOUR BRAIN (3 steps)': 'INSTALA TU CEREBRO (3 pasos)',
        'WHAT YOU HAVE (good start!)': 'LO QUE TIENES (\u00a1buen comienzo!)',
        'YOUR NEXT 20-MINUTE SESSION (top 3 fixes)': 'TU PR\u00d3XIMA SESI\u00d3N DE 20 MIN (3 correcciones)',
        'PATTERNS TO UNLOCK': 'PATRONES POR DESBLOQUEAR',
        'Maturity': 'Madurez',
        'Components detected': 'Componentes detectados',
        'Recommendation': 'Recomendaci\u00f3n',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    de: {
        'SECOND BRAIN HEALTH CHECK': 'SECOND BRAIN GESUNDHEITSCHECK',
        'SECOND BRAIN QUICK SCAN': 'SECOND BRAIN SCHNELLSCAN',
        'OVERALL': 'GESAMT',
        'SETUP QUALITY': 'EINRICHTUNGSQUALIT\u00c4T',
        'USAGE ACTIVITY': 'NUTZUNGSAKTIVIT\u00c4T',
        'AI FLUENCY': 'KI-KOMPETENZ',
        'SETUP QUALITY BREAKDOWN': 'DETAILS EINRICHTUNGSQUALIT\u00c4T',
        'USAGE ACTIVITY BREAKDOWN': 'DETAILS NUTZUNGSAKTIVIT\u00c4T',
        'AI FLUENCY BREAKDOWN': 'DETAILS KI-KOMPETENZ',
        'TOP FIXES (highest impact)': 'TOP-KORREKTUREN (h\u00f6chste Wirkung)',
        'CONTEXT ENGINEERING PATTERNS (7 patterns)': 'CONTEXT ENGINEERING MUSTER (7 Muster)',
        'X-RAY RESULT: No brain detected.': 'ERGEBNIS: Kein Brain erkannt.',
        'INSTALL YOUR BRAIN (3 steps)': 'BRAIN INSTALLIEREN (3 Schritte)',
        'WHAT YOU HAVE (good start!)': 'WAS DU HAST (guter Anfang!)',
        'YOUR NEXT 20-MINUTE SESSION (top 3 fixes)': 'DEINE N\u00c4CHSTE 20-MIN SITZUNG (Top 3 Korrekturen)',
        'PATTERNS TO UNLOCK': 'MUSTER ZUM FREISCHALTEN',
        'Maturity': 'Reife',
        'Components detected': 'Erkannte Komponenten',
        'Recommendation': 'Empfehlung',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    fr: {
        'SECOND BRAIN HEALTH CHECK': 'BILAN DE SANT\u00c9 DU SECOND CERVEAU',
        'SECOND BRAIN QUICK SCAN': 'SCAN RAPIDE DU SECOND CERVEAU',
        'OVERALL': 'G\u00c9N\u00c9RAL',
        'SETUP QUALITY': 'QUALIT\u00c9 DE CONFIGURATION',
        'USAGE ACTIVITY': 'ACTIVIT\u00c9 D\'UTILISATION',
        'AI FLUENCY': 'MA\u00ceTRISE IA',
        'SETUP QUALITY BREAKDOWN': 'D\u00c9TAILS QUALIT\u00c9 DE CONFIGURATION',
        'USAGE ACTIVITY BREAKDOWN': 'D\u00c9TAILS ACTIVIT\u00c9 D\'UTILISATION',
        'AI FLUENCY BREAKDOWN': 'D\u00c9TAILS MA\u00ceTRISE IA',
        'TOP FIXES (highest impact)': 'CORRECTIONS PRIORITAIRES (plus fort impact)',
        'CONTEXT ENGINEERING PATTERNS (7 patterns)': 'PATRONS D\'ING\u00c9NIERIE DE CONTEXTE (7 patrons)',
        'X-RAY RESULT: No brain detected.': 'R\u00c9SULTAT : Aucun cerveau d\u00e9tect\u00e9.',
        'INSTALL YOUR BRAIN (3 steps)': 'INSTALLER VOTRE CERVEAU (3 \u00e9tapes)',
        'WHAT YOU HAVE (good start!)': 'CE QUE VOUS AVEZ (bon d\u00e9but !)',
        'YOUR NEXT 20-MINUTE SESSION (top 3 fixes)': 'VOTRE PROCHAINE SESSION DE 20 MIN (3 corrections)',
        'PATTERNS TO UNLOCK': 'PATRONS \u00c0 D\u00c9BLOQUER',
        'Maturity': 'Maturit\u00e9',
        'Components detected': 'Composants d\u00e9tect\u00e9s',
        'Recommendation': 'Recommandation',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    pl: {
        'SECOND BRAIN HEALTH CHECK': 'BADANIE ZDROWIA DRUGIEGO M\u00d3ZGU',
        'SECOND BRAIN QUICK SCAN': 'SZYBKI SKAN DRUGIEGO M\u00d3ZGU',
        'OVERALL': 'OG\u00d3LNIE',
        'SETUP QUALITY': 'JAKO\u015a\u0106 KONFIGURACJI',
        'USAGE ACTIVITY': 'AKTYWNO\u015a\u0106 U\u017bYTKOWANIA',
        'AI FLUENCY': 'BIEG\u0141O\u015a\u0106 AI',
        'SETUP QUALITY BREAKDOWN': 'SZCZEG\u00d3\u0141Y JAKO\u015aCI KONFIGURACJI',
        'USAGE ACTIVITY BREAKDOWN': 'SZCZEG\u00d3\u0141Y AKTYWNO\u015aCI',
        'AI FLUENCY BREAKDOWN': 'SZCZEG\u00d3\u0141Y BIEG\u0141O\u015aCI AI',
        'TOP FIXES (highest impact)': 'NAJWA\u017bNIEJSZE POPRAWKI (najwy\u017cszy wp\u0142yw)',
        'CONTEXT ENGINEERING PATTERNS (7 patterns)': 'WZORCE IN\u017bYNIERII KONTEKSTU (7 wzorc\u00f3w)',
        'X-RAY RESULT: No brain detected.': 'WYNIK: Nie wykryto m\u00f3zgu.',
        'INSTALL YOUR BRAIN (3 steps)': 'ZAINSTALUJ SW\u00d3J M\u00d3ZG (3 kroki)',
        'WHAT YOU HAVE (good start!)': 'CO JU\u017b MASZ (dobry pocz\u0105tek!)',
        'YOUR NEXT 20-MINUTE SESSION (top 3 fixes)': 'TWOJA NAST\u0118PNA 20-MINUTOWA SESJA (3 poprawki)',
        'PATTERNS TO UNLOCK': 'WZORCE DO ODBLOKOWANIA',
        'Maturity': 'Dojrza\u0142o\u015b\u0107',
        'Components detected': 'Wykryte komponenty',
        'Recommendation': 'Rekomendacja',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    pt: {
        'SECOND BRAIN HEALTH CHECK': 'VERIFICA\u00c7\u00c3O DE SA\u00daDE DO SEGUNDO C\u00c9REBRO',
        'SECOND BRAIN QUICK SCAN': 'SCAN R\u00c1PIDO DO SEGUNDO C\u00c9REBRO',
        'OVERALL': 'GERAL',
        'SETUP QUALITY': 'QUALIDADE DA CONFIGURA\u00c7\u00c3O',
        'USAGE ACTIVITY': 'ATIVIDADE DE USO',
        'AI FLUENCY': 'FLU\u00caNCIA IA',
        'SETUP QUALITY BREAKDOWN': 'DETALHES QUALIDADE DA CONFIGURA\u00c7\u00c3O',
        'USAGE ACTIVITY BREAKDOWN': 'DETALHES ATIVIDADE DE USO',
        'AI FLUENCY BREAKDOWN': 'DETALHES FLU\u00caNCIA IA',
        'TOP FIXES (highest impact)': 'CORRE\u00c7\u00d5ES PRIORIT\u00c1RIAS (maior impacto)',
        'CONTEXT ENGINEERING PATTERNS (7 patterns)': 'PADR\u00d5ES DE ENGENHARIA DE CONTEXTO (7 padr\u00f5es)',
        'X-RAY RESULT: No brain detected.': 'RESULTADO: Nenhum c\u00e9rebro detectado.',
        'INSTALL YOUR BRAIN (3 steps)': 'INSTALE SEU C\u00c9REBRO (3 passos)',
        'WHAT YOU HAVE (good start!)': 'O QUE VOC\u00ca TEM (bom come\u00e7o!)',
        'YOUR NEXT 20-MINUTE SESSION (top 3 fixes)': 'SUA PR\u00d3XIMA SESS\u00c3O DE 20 MIN (3 corre\u00e7\u00f5es)',
        'PATTERNS TO UNLOCK': 'PADR\u00d5ES PARA DESBLOQUEAR',
        'Maturity': 'Maturidade',
        'Components detected': 'Componentes detectados',
        'Recommendation': 'Recomenda\u00e7\u00e3o',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    ja: {
        'SECOND BRAIN HEALTH CHECK': '\u30bb\u30ab\u30f3\u30c9\u30d6\u30ec\u30a4\u30f3 \u5065\u5eb7\u8a3a\u65ad',
        'SECOND BRAIN QUICK SCAN': '\u30bb\u30ab\u30f3\u30c9\u30d6\u30ec\u30a4\u30f3 \u30af\u30a4\u30c3\u30af\u30b9\u30ad\u30e3\u30f3',
        'OVERALL': '\u7dcf\u5408',
        'SETUP QUALITY': '\u30bb\u30c3\u30c8\u30a2\u30c3\u30d7\u54c1\u8cea',
        'USAGE ACTIVITY': '\u4f7f\u7528\u72b6\u6cc1',
        'AI FLUENCY': 'AI\u6d41\u66a2\u6027',
        'TOP FIXES (highest impact)': '\u512a\u5148\u4fee\u6b63 (\u6700\u5927\u306e\u5f71\u97ff)',
        'Maturity': '\u6210\u719f\u5ea6',
        'Components detected': '\u691c\u51fa\u3055\u308c\u305f\u30b3\u30f3\u30dd\u30fc\u30cd\u30f3\u30c8',
        'Recommendation': '\u63a8\u5968',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    ko: {
        'SECOND BRAIN HEALTH CHECK': '\uc138\ucee8\ub4dc \ube0c\ub808\uc778 \uac74\uac15 \uc9c4\ub2e8',
        'SECOND BRAIN QUICK SCAN': '\uc138\ucee8\ub4dc \ube0c\ub808\uc778 \ube60\ub978 \uc2a4\ucba8',
        'OVERALL': '\uc885\ud569',
        'SETUP QUALITY': '\uc124\uc815 \ud488\uc9c8',
        'USAGE ACTIVITY': '\uc0ac\uc6a9 \ud65c\ub3d9',
        'AI FLUENCY': 'AI \uc720\ucc3d\uc131',
        'TOP FIXES (highest impact)': '\uc6b0\uc120 \uc218\uc815 (\ucd5c\ub300 \ud6a8\uacfc)',
        'Maturity': '\uc131\uc219\ub3c4',
        'Components detected': '\uac10\uc9c0\ub41c \uad6c\uc131 \uc694\uc18c',
        'Recommendation': '\ucd94\ucc9c',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
    zh: {
        'SECOND BRAIN HEALTH CHECK': '\u7b2c\u4e8c\u5927\u8111\u5065\u5eb7\u68c0\u67e5',
        'SECOND BRAIN QUICK SCAN': '\u7b2c\u4e8c\u5927\u8111\u5feb\u901f\u626b\u63cf',
        'OVERALL': '\u603b\u4f53',
        'SETUP QUALITY': '\u914d\u7f6e\u8d28\u91cf',
        'USAGE ACTIVITY': '\u4f7f\u7528\u6d3b\u52a8',
        'AI FLUENCY': 'AI\u6d41\u7545\u5ea6',
        'TOP FIXES (highest impact)': '\u4f18\u5148\u4fee\u590d (\u6700\u5927\u5f71\u54cd)',
        'Maturity': '\u6210\u719f\u5ea6',
        'Components detected': '\u68c0\u6d4b\u5230\u7684\u7ec4\u4ef6',
        'Recommendation': '\u5efa\u8bae',
        '[pass]': '[\u2713]', '[warn]': '[!]', '[fail]': '[\u2717]', '[miss]': '[-]',
    },
};

/**
 * Translate a string using the i18n map. Falls through to original if no translation exists.
 */
function t(text, lang) {
    if (!lang || lang === 'en' || !TRANSLATIONS[lang]) return text;
    return TRANSLATIONS[lang][text] || text;
}

/** Time estimates for common fix categories (minutes) */
const FIX_TIME_ESTIMATES = {
    'claude.md': 10,
    'skills': 15,
    'hooks': 15,
    'memory': 10,
    'directory': 5,
    'brain health': 5,
    'personalization': 10,
    'mcp': 5,
    'config': 5,
    'settings': 5,
    'permissions': 5,
    'sandbox': 5,
    'model': 3,
    'env': 5,
    'attribution': 3,
    'agent': 15,
    'gitignore': 3,
    'team': 10,
    'rules': 10,
    'interaction': 5,
    'spec': 10,
    'knowledge': 15,
    'context pressure': 10,
    'sessions': 5,
    'patterns': 10,
    'memory evolution': 5,
    'review loop': 15,
    'compound': 10,
    'cross-references': 10,
    'workflow': 10,
    'progressive': 10,
    'orchestration': 15,
    'context-aware': 10,
    'reference': 5,
    'delegation': 15,
    'interview': 10,
    'quality tracking': 5,
    'growth log': 5,
    'activity': 5,
    'codex': 5,
    'style': 10,
    'tracking': 5,
    'stale': 5,
    'hook health': 5,
    'pattern confidence': 5,
    'index files': 5,
    'getting started': 5,
    'external doc': 10,
};

function estimateMinutes(fixTitle) {
    const lower = fixTitle.toLowerCase();
    for (const [key, mins] of Object.entries(FIX_TIME_ESTIMATES)) {
        if (lower.includes(key)) return mins;
    }
    return 10; // default
}

function progressBar(points, maxPoints, width = 20) {
    const filled = Math.round((points / maxPoints) * width);
    const empty = width - filled;
    return '|'.repeat(filled) + '.'.repeat(empty);
}
function statusIcon(status) {
    switch (status) {
        case 'pass': return '[pass]';
        case 'warn': return '[warn]';
        case 'fail': return '[fail]';
        default: return '[----]';
    }
}
function formatLayer(layer) {
    const bar = progressBar(layer.points, layer.maxPoints);
    const lines = [];
    lines.push(`${layer.name.padEnd(30)} ${bar}  ${layer.points}/${layer.maxPoints}`);
    for (const check of layer.checks) {
        lines.push(`  ${statusIcon(check.status)} ${check.message}`);
    }
    return lines.join('\n');
}

/**
 * Build score-band CTA based on overall percentage and buyer status.
 */
function buildCTA(report) {
    const isBuyer = report.brainState?.isBuyer || false;
    const overallPct = getOverallPct(report);

    if (isBuyer) {
        return [
            '================================================================',
            '  BASELINE CAPTURED',
            `  Your brain scores ${overallPct}%.`,
            '  Run again after setup to see your progress.',
            '================================================================',
        ];
    }

    if (overallPct === 0 || report.brainState?.maturity === 'empty') {
        return [
            '================================================================',
            '  See what a properly configured Second Brain looks like:',
            '  https://www.iwoszapar.com/context-engineering',
            '================================================================',
        ];
    }

    if (overallPct <= 30) {
        return [
            '================================================================',
            '  20 min of manual work gets you started.',
            '  Or get a pre-built brain:',
            '  https://www.iwoszapar.com/second-brain-ai',
            '================================================================',
        ];
    }

    if (overallPct <= 60) {
        return [
            '================================================================',
            '  You built the foundation.',
            '  The Context Engineering Guide automates the rest:',
            '  https://www.iwoszapar.com/context-engineering',
            '================================================================',
        ];
    }

    if (overallPct < 85) {
        const gap = 85 - overallPct;
        // Find weakest CE pattern
        const weakestPattern = report.cePatterns
            ?.filter(p => p.maxScore > 0)
            ?.sort((a, b) => a.percentage - b.percentage)?.[0];
        const patternHint = weakestPattern
            ? ` Missing pattern: ${weakestPattern.name}.`
            : '';
        return [
            '================================================================',
            `  ${gap} points from Production-grade.${patternHint}`,
            '  https://www.iwoszapar.com/context-engineering',
            '================================================================',
        ];
    }

    // 85+
    return [
        '================================================================',
        '  You built something rare. Ready for Team Brain?',
        '  https://www.iwoszapar.com/teams',
        '================================================================',
    ];
}

function formatDelta(report) {
    const prev = report.brainState?.previousScore;
    if (prev === null || prev === undefined) return '';
    const current = getOverallPct(report);
    const diff = current - prev;
    if (diff === 0) return '  (no change since last scan)';
    const sign = diff > 0 ? '+' : '';
    return `  (${sign}${diff}% since last scan)`;
}

function getOverallPct(report) {
    const totalPts = (report.setup?.totalPoints || 0) +
        (report.usage?.totalPoints || 0) +
        (report.fluency?.totalPoints || 0);
    const totalMax = (report.setup?.maxPoints || 0) +
        (report.usage?.maxPoints || 0) +
        (report.fluency?.maxPoints || 0);
    return totalMax > 0 ? Math.round((totalPts / totalMax) * 100) : 0;
}

/**
 * Format report for an EMPTY brain (no CLAUDE.md).
 * Direct X-ray: show exactly what's missing, then the 3 install steps.
 */
function formatEmptyReport(report, lang) {
    const lines = [];
    lines.push('================================================================');
    lines.push(`  ${t('SECOND BRAIN HEALTH CHECK', lang)}`);
    lines.push('================================================================');
    lines.push('');
    lines.push(`  ${t('X-RAY RESULT: No brain detected.', lang)}`);
    lines.push('');
    lines.push('  [miss] CLAUDE.md          \u2014 AI has no instructions');
    lines.push('  [miss] .claude/            \u2014 no skills, hooks, or settings');
    lines.push('  [miss] memory/             \u2014 nothing is remembered');
    lines.push('  [miss] .claude/skills/     \u2014 no reusable commands');
    lines.push('');
    lines.push('  Claude is running blind in this directory.');
    lines.push('  Every session starts from zero. Fix that in 20 minutes:');
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push(t('INSTALL YOUR BRAIN (3 steps)', lang));
    lines.push('----------------------------------------------------------------');
    lines.push('');
    lines.push('1. Create CLAUDE.md (~5 min)');
    lines.push('   Who you are, your top rules, your tools and stack.');
    lines.push('   This is the one file Claude reads in every session.');
    lines.push('');
    lines.push('2. Add skills (~10 min)');
    lines.push('   mkdir -p .claude/skills');
    lines.push('   Each .md file becomes a /command you can invoke.');
    lines.push('');
    lines.push('3. Set up memory (~5 min)');
    lines.push('   mkdir -p memory/episodic memory/semantic');
    lines.push('   Episodic = session logs. Semantic = patterns and voice.');
    lines.push('');
    lines.push('Run the health check again after setup.');
    lines.push('You will jump from 0% to ~25-35% immediately.');
    lines.push('');
    lines.push(...buildCTA(report));
    return lines.join('\n');
}

/**
 * Format report for MINIMAL/BASIC brain (score 1-40).
 * Growth mode: celebrate what exists, show top 3 fixes only.
 */
function formatGrowthReport(report, lang) {
    const lines = [];
    const overallPct = getOverallPct(report);
    const has = report.brainState?.has || {};

    lines.push('================================================================');
    lines.push(`  ${t('SECOND BRAIN HEALTH CHECK', lang)}`);
    lines.push('================================================================');
    lines.push('');
    lines.push(`${t('SETUP QUALITY', lang)}:    ${report.setup.normalizedScore}/100 (${report.setup.grade} - ${report.setup.gradeLabel})`);
    lines.push(`${t('USAGE ACTIVITY', lang)}:   ${report.usage.normalizedScore}/100 (${report.usage.grade} - ${report.usage.gradeLabel})`);
    if (report.fluency) {
        lines.push(`${t('AI FLUENCY', lang)}:       ${report.fluency.normalizedScore}/100 (${report.fluency.grade} - ${report.fluency.gradeLabel})`);
    }
    lines.push('');

    // Celebrate what exists
    lines.push('----------------------------------------------------------------');
    lines.push(t('WHAT YOU HAVE (good start!)', lang));
    lines.push('----------------------------------------------------------------');
    lines.push('');
    if (has.claudeMd) lines.push('  [pass] CLAUDE.md exists');
    if (has.claudeDir) lines.push('  [pass] .claude/ directory configured');
    if (has.skills) lines.push('  [pass] Skills directory found');
    if (has.hooks) lines.push('  [pass] Hooks configured');
    if (has.memory) lines.push('  [pass] Memory directory found');
    if (has.knowledge) lines.push('  [pass] Knowledge base started');
    if (has.agents) lines.push('  [pass] Custom agents configured');
    lines.push('');

    // Top 3 fixes with time estimates
    const fixes = report.topFixes.slice(0, 3);
    if (fixes.length > 0) {
        lines.push('----------------------------------------------------------------');
        lines.push(t('YOUR NEXT 20-MINUTE SESSION (top 3 fixes)', lang));
        lines.push('----------------------------------------------------------------');
        lines.push('');
        let totalMinutes = 0;
        fixes.forEach((fix, i) => {
            const mins = estimateMinutes(fix.title);
            totalMinutes += mins;
            lines.push(`${i + 1}. ${fix.title} (${fix.impact}, ~${mins} min)`);
            lines.push(`   ${fix.description}`);
            lines.push('');
        });
        lines.push(`Total estimated time: ~${totalMinutes} min`);
        lines.push('');
    }

    // CE pattern hint (just top 3 weakest)
    if (report.cePatterns && report.cePatterns.length > 0) {
        const weakPatterns = report.cePatterns
            .filter(p => p.maxScore > 0)
            .sort((a, b) => a.percentage - b.percentage)
            .slice(0, 3);
        if (weakPatterns.length > 0) {
            lines.push('----------------------------------------------------------------');
            lines.push(t('PATTERNS TO UNLOCK', lang));
            lines.push('----------------------------------------------------------------');
            lines.push('');
            for (const p of weakPatterns) {
                const bar = progressBar(p.percentage, 100, 10);
                lines.push(`  ${p.name.padEnd(25)} ${bar} ${p.percentage}%`);
            }
            lines.push('');
        }
    }

    lines.push(...buildCTA(report));
    return lines.join('\n');
}

/**
 * Format CE patterns section for full reports.
 */
function formatCEPatterns(cePatterns, lang) {
    if (!cePatterns || cePatterns.length === 0) return [];
    const lines = [];
    lines.push('----------------------------------------------------------------');
    lines.push(t('CONTEXT ENGINEERING PATTERNS (7 patterns)', lang));
    lines.push('----------------------------------------------------------------');
    lines.push('');
    for (const p of cePatterns) {
        if (p.maxScore === 0) continue;
        const bar = progressBar(p.percentage, 100, 15);
        const status = p.percentage >= 70 ? '[pass]' : p.percentage >= 40 ? '[warn]' : '[fail]';
        lines.push(`${status} ${p.name.padEnd(28)} ${bar} ${p.percentage}%`);
    }
    lines.push('');
    return lines;
}

/**
 * Format report for QUICK mode (detection only, no full scan).
 * Shows brain maturity level and what exists.
 */
export function formatQuickReport(report, lang) {
    const lines = [];
    const bs = report.brainState || {};
    const has = bs.has || {};
    const maturity = bs.maturity || 'unknown';
    const pass = t('[pass]', lang);
    const miss = t('[miss]', lang);

    lines.push('================================================================');
    lines.push(`  ${t('SECOND BRAIN QUICK SCAN', lang)}`);
    lines.push('================================================================');
    lines.push('');
    lines.push(`  ${t('Maturity', lang)}: ${maturity.toUpperCase()}`);
    lines.push('');

    // Show what exists
    lines.push(`  ${t('Components detected', lang)}:`);
    lines.push(`    ${has.claudeMd ? pass : miss} CLAUDE.md${has.claudeMd && bs.claudeMdSize ? ` (${bs.claudeMdSize} bytes)` : ''}`);
    lines.push(`    ${has.claudeDir ? pass : miss} .claude/ directory`);
    lines.push(`    ${has.skills ? pass : miss} Skills`);
    lines.push(`    ${has.hooks ? pass : miss} Hooks`);
    lines.push(`    ${has.memory ? pass : miss} Memory`);
    lines.push(`    ${has.knowledge ? pass : miss} Knowledge base`);
    lines.push(`    ${has.agents ? pass : miss} Custom agents`);
    lines.push(`    ${has.settings ? pass : miss} Settings`);
    lines.push('');

    if (bs.isReturning && bs.previousScore !== null && bs.previousScore !== undefined) {
        lines.push(`  Last full scan score: ${bs.previousScore}%`);
        lines.push('');
    }

    // Recommendation
    if (maturity === 'empty') {
        lines.push(`  ${t('Recommendation', lang)}: No brain detected. Run full scan for a getting-started guide.`);
    } else if (maturity === 'minimal' || maturity === 'basic') {
        lines.push(`  ${t('Recommendation', lang)}: Foundation in place. Run full scan to get your score and top fixes.`);
    } else {
        lines.push(`  ${t('Recommendation', lang)}: Run full scan to see detailed scores and CE pattern coverage.`);
    }
    lines.push('');

    return lines.join('\n');
}

/**
 * Full report -- for structured+ brains (score 41+).
 */
export function formatReport(report, lang) {
    // Adaptive formatting based on brain state
    const maturity = report.brainState?.maturity;
    const overallPct = getOverallPct(report);

    // Empty brain: getting started guide
    if (maturity === 'empty' || (overallPct === 0 && !report.brainState?.has?.claudeMd)) {
        return formatEmptyReport(report, lang);
    }

    // Growth mode for low scores
    if (overallPct <= 40 && (maturity === 'minimal' || maturity === 'basic')) {
        return formatGrowthReport(report, lang);
    }

    // Full report for structured+
    const lines = [];
    const delta = formatDelta(report);
    lines.push('================================================================');
    lines.push(`  ${t('SECOND BRAIN HEALTH CHECK', lang)}`);
    lines.push('================================================================');
    lines.push('');
    lines.push(`${t('OVERALL', lang)}:          ${getOverallPct(report)}%${delta}`);
    lines.push('');
    lines.push(`${t('SETUP QUALITY', lang)}:    ${report.setup.normalizedScore}/100 (${report.setup.grade} - ${report.setup.gradeLabel})`);
    lines.push(`${t('USAGE ACTIVITY', lang)}:   ${report.usage.normalizedScore}/100 (${report.usage.grade} - ${report.usage.gradeLabel})`);
    if (report.fluency) {
        lines.push(`${t('AI FLUENCY', lang)}:       ${report.fluency.normalizedScore}/100 (${report.fluency.grade} - ${report.fluency.gradeLabel})`);
    }
    lines.push('');
    // Setup breakdown
    lines.push('----------------------------------------------------------------');
    lines.push(t('SETUP QUALITY BREAKDOWN', lang));
    lines.push('----------------------------------------------------------------');
    lines.push('');
    for (const layer of report.setup.layers) {
        lines.push(formatLayer(layer));
        lines.push('');
    }
    // Usage breakdown
    lines.push('----------------------------------------------------------------');
    lines.push(t('USAGE ACTIVITY BREAKDOWN', lang));
    lines.push('----------------------------------------------------------------');
    lines.push('');
    for (const layer of report.usage.layers) {
        lines.push(formatLayer(layer));
        lines.push('');
    }
    // Fluency breakdown
    if (report.fluency) {
        lines.push('----------------------------------------------------------------');
        lines.push(t('AI FLUENCY BREAKDOWN', lang));
        lines.push('----------------------------------------------------------------');
        lines.push('');
        for (const layer of report.fluency.layers) {
            lines.push(formatLayer(layer));
            lines.push('');
        }
    }
    // CE Patterns section
    lines.push(...formatCEPatterns(report.cePatterns, lang));
    // Top fixes with time estimates
    if (report.topFixes.length > 0) {
        lines.push('----------------------------------------------------------------');
        lines.push(t('TOP FIXES (highest impact)', lang));
        lines.push('----------------------------------------------------------------');
        lines.push('');
        report.topFixes.forEach((fix, i) => {
            const mins = estimateMinutes(fix.title);
            lines.push(`${i + 1}. ${fix.title} (${fix.impact}, ~${mins} min)`);
            lines.push(`   ${fix.description}`);
            lines.push('');
        });
    }
    // Score-band CTA
    lines.push(...buildCTA(report));
    return lines.join('\n');
}
export function formatFixSuggestions(report, focus) {
    const lines = [];
    // Determine focus
    let targetCategory;
    if (focus === 'auto') {
        const scores = [
            { cat: 'setup', score: report.setup.totalPoints / report.setup.maxPoints },
            { cat: 'usage', score: report.usage.totalPoints / report.usage.maxPoints },
        ];
        if (report.fluency) {
            scores.push({ cat: 'fluency', score: report.fluency.totalPoints / report.fluency.maxPoints });
        }
        scores.sort((a, b) => a.score - b.score);
        targetCategory = scores[0].cat;
    }
    else {
        targetCategory = focus;
    }
    const targetReport = targetCategory === 'setup' ? report.setup
        : targetCategory === 'fluency' && report.fluency ? report.fluency
        : report.usage;
    const reportName = targetCategory === 'setup' ? 'SETUP QUALITY'
        : targetCategory === 'fluency' ? 'AI FLUENCY'
        : 'USAGE ACTIVITY';
    lines.push('================================================================');
    lines.push(`  FIX PLAN: ${reportName}`);
    lines.push(`  Current: ${targetReport.normalizedScore}/100 (${targetReport.grade})`);
    lines.push('================================================================');
    lines.push('');
    // Find the weakest layer
    const sortedLayers = [...targetReport.layers].sort((a, b) => (a.points / a.maxPoints) - (b.points / b.maxPoints));
    const weakest = sortedLayers[0];
    if (!weakest) {
        lines.push('No issues found \u2014 your setup looks good!');
        return lines.join('\n');
    }
    lines.push(`WEAKEST AREA: ${weakest.name} (${weakest.points}/${weakest.maxPoints})`);
    lines.push('');
    // List all failing/warning checks in this layer
    const failingChecks = weakest.checks.filter(c => c.status !== 'pass');
    lines.push('ISSUES TO FIX:');
    lines.push('');
    failingChecks.forEach((check, i) => {
        const pointsToGain = check.maxPoints - check.points;
        const mins = estimateMinutes(check.name);
        lines.push(`${i + 1}. ${check.name} (+${pointsToGain} pts, ~${mins} min)`);
        lines.push(`   Status: ${check.status}`);
        lines.push(`   ${check.message}`);
        lines.push('');
    });
    // Also show other weak layers
    if (sortedLayers.length > 1) {
        lines.push('OTHER AREAS TO IMPROVE:');
        lines.push('');
        for (const layer of sortedLayers.slice(1, 3)) {
            const ratio = layer.points / layer.maxPoints;
            if (ratio < 0.8) {
                lines.push(`- ${layer.name}: ${layer.points}/${layer.maxPoints}`);
            }
        }
    }
    lines.push('');
    lines.push('================================================================');
    return lines.join('\n');
}
