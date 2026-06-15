/**
 * Reference Integrity — false-positive regression tests (task-3552)
 *
 * The scanner must NOT flag template placeholders or bare prose folder names
 * as broken references, but MUST still catch genuinely dangling file paths.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReferenceIntegrity } from '../dist/fluency/reference-integrity.js';

async function makeBrain(files) {
    const root = await mkdtemp(join(tmpdir(), 'sbhc-refint-'));
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        await mkdir(join(full, '..'), { recursive: true });
        await writeFile(full, content, 'utf-8');
    }
    return root;
}

function claudeCheck(result) {
    return result.checks.find(c => c.name === 'CLAUDE.md references resolve');
}
function skillCheck(result) {
    return result.checks.find(c => c.name === 'Skill references resolve');
}

test('template placeholders in CLAUDE.md are not flagged as broken', async () => {
    const root = await makeBrain({
        'CLAUDE.md': [
            '# CLAUDE.md',
            '- Canonical folder per month: `personal/biznes/YYYY/MM/` holds',
            '  `faktury-sprzedaz/`, `faktury-kosztowe/`, `bank-statements/`,',
            '  `outreach/`, and `zips/`.',
            '- Session branch: `session/task-XXXX-description`',
            '- Episodic note: `memory/episodic/domain/YYYY-MM-DD-slug.md`',
            '- Real doc: `docs/REAL.md`',
        ].join('\n'),
        'docs/REAL.md': '# real',
    });
    try {
        const result = await checkReferenceIntegrity(root);
        const c = claudeCheck(result);
        assert.equal(c.status, 'pass', `expected pass, got: ${c.message}`);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('genuinely broken CLAUDE.md reference is still caught', async () => {
    const root = await makeBrain({
        'CLAUDE.md': '# CLAUDE.md\nProfile: `memory/personal-profile.md`\n',
    });
    try {
        const result = await checkReferenceIntegrity(root);
        const c = claudeCheck(result);
        assert.notEqual(c.status, 'pass', 'a real dangling ref must not pass');
        assert.match(c.message, /personal-profile\.md/);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('placeholder example paths in skills are not flagged', async () => {
    const root = await makeBrain({
        'CLAUDE.md': '# CLAUDE.md\n',
        '.claude/skills/demo/SKILL.md': [
            '# Demo',
            'Write to `memory/episodic/sessions/YYYY-MM-DD-task-XXXX.md`.',
            'See `memory/procedural/domain/workflow-name.md` example.',
            'Read `docs/REAL.md`.',
        ].join('\n'),
        'docs/REAL.md': '# real',
        'memory/procedural/domain/workflow-name.md': '# wf',
    });
    try {
        const result = await checkReferenceIntegrity(root);
        const c = skillCheck(result);
        assert.equal(c.status, 'pass', `expected pass, got: ${c.message}`);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('genuinely broken skill reference is still caught', async () => {
    const root = await makeBrain({
        'CLAUDE.md': '# CLAUDE.md\n',
        '.claude/skills/demo/SKILL.md':
            '# Demo\nPull strategy: `memory/linkedin-content-strategy.md`\n',
    });
    try {
        const result = await checkReferenceIntegrity(root);
        const c = skillCheck(result);
        assert.notEqual(c.status, 'pass', 'a real dangling skill ref must not pass');
        assert.match(c.message, /linkedin-content-strategy\.md/);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
