import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateManifestYaml } from '../dist/brain-manifest.js';
import { VERSION } from '../dist/version.js';

function makeMockReport() {
    return {
        timestamp: '2025-01-01T00:00:00.000Z',
        brainState: { maturity: 'configured', has: { claudeMd: true, skills: true, memory: true } },
        setup: { totalPoints: 80, maxPoints: 100, normalizedScore: 80, layers: [
            { name: 'CLAUDE.md Quality', points: 8, maxPoints: 10, checks: [
                { name: 'Has CLAUDE.md', status: 'pass', points: 5, maxPoints: 5, message: '287 lines, 14 sections' },
                { name: 'Line count', status: 'warn', points: 3, maxPoints: 5, message: 'CLAUDE.md is short (50 lines)' },
            ]},
            { name: 'Skills', points: 5, maxPoints: 10, checks: [
                { name: 'Skill count', status: 'warn', points: 5, maxPoints: 10, message: '3 skills found' },
            ]},
        ]},
        usage: { totalPoints: 40, maxPoints: 50, normalizedScore: 80, layers: [] },
        fluency: { totalPoints: 35, maxPoints: 50, normalizedScore: 70, layers: [] },
        cePatterns: [{ name: 'Progressive Disclosure', percentage: 75 }],
        topFixes: [{ title: 'Add hooks', impact: 'high', description: 'Set up hooks' }],
    };
}

describe('generateManifestYaml', () => {
    it('includes version in header comment', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes(`v${VERSION}`));
    });

    it('includes score and grade in header', () => {
        const yaml = generateManifestYaml(makeMockReport());
        // 80+40+35 = 155 out of 100+50+50 = 200 → 78%
        assert.ok(yaml.includes('Score: 78/100'));
        assert.ok(yaml.includes('Grade: B'));
    });

    it('includes inventory section with counts', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('inventory:'));
        assert.ok(yaml.includes('claude_md:'));
        assert.ok(yaml.includes('skills:'));
    });

    it('includes lowest-scoring checks as findings', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('findings:'));
        assert.ok(yaml.includes('check:'));
        assert.ok(yaml.includes('score:'));
        assert.ok(yaml.includes('finding:'));
    });

    it('includes guide tools section', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('guide:'));
        assert.ok(yaml.includes('weekly_pulse:'));
        assert.ok(yaml.includes('context_pressure:'));
        assert.ok(yaml.includes('audit_config:'));
    });

    it('includes timestamp in header', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('2025-01-01T00:00:00.000Z'));
    });
});
