import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateManifestYaml } from '../dist/brain-manifest.js';
import { VERSION } from '../dist/version.js';

function makeMockReport() {
    return {
        timestamp: '2025-01-01T00:00:00.000Z',
        brainState: { maturity: 'configured' },
        setup: { totalPoints: 80, maxPoints: 100, normalizedScore: 80, layers: [
            { name: 'CLAUDE.md Quality', points: 8, maxPoints: 10, checks: [
                { name: 'Has CLAUDE.md', status: 'pass', points: 5, maxPoints: 5, message: 'Found' },
            ]},
        ]},
        usage: { totalPoints: 40, maxPoints: 50, normalizedScore: 80, layers: [] },
        fluency: { totalPoints: 35, maxPoints: 50, normalizedScore: 70, layers: [] },
        cePatterns: [{ name: 'Progressive Disclosure', percentage: 75 }],
        topFixes: [{ title: 'Add hooks', impact: 'high', description: 'Set up hooks' }],
    };
}

describe('generateManifestYaml', () => {
    it('produces valid YAML-like output with version from package.json', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes(`version: "${VERSION}"`));
    });

    it('includes scores section', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('scores:'));
        assert.ok(yaml.includes('setup: 80'));
        assert.ok(yaml.includes('usage: 80'));
        assert.ok(yaml.includes('fluency: 70'));
    });

    it('includes layers section with snake_case keys', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('layers:'));
        assert.ok(yaml.includes('claude_md_quality:'));
    });

    it('includes CE patterns section with id keys', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('ce_patterns:'));
        assert.ok(yaml.includes('progressive_disclosure: 75'));
    });

    it('includes scanned_at timestamp', () => {
        const yaml = generateManifestYaml(makeMockReport());
        assert.ok(yaml.includes('scanned_at: "2025-01-01T00:00:00.000Z"'));
    });
});
