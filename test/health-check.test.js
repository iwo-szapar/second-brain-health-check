import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectBrainState, mapChecksToCEPatterns } from '../dist/health-check.js';

let tmpDir;

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'hc-test-'));
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('detectBrainState', () => {
    it('returns "empty" when no CLAUDE.md exists', async () => {
        const state = await detectBrainState(tmpDir);
        assert.equal(state.maturity, 'empty');
        assert.equal(state.has.claudeMd, false);
    });

    it('returns "minimal" for tiny CLAUDE.md without .claude dir', async () => {
        await writeFile(join(tmpDir, 'CLAUDE.md'), 'Hello');
        const state = await detectBrainState(tmpDir);
        assert.equal(state.maturity, 'minimal');
        assert.equal(state.has.claudeMd, true);
        assert.ok(state.claudeMdSize < 500);
    });

    it('returns "basic" for large CLAUDE.md without skills/hooks/memory', async () => {
        await writeFile(join(tmpDir, 'CLAUDE.md'), 'x'.repeat(600));
        const state = await detectBrainState(tmpDir);
        assert.equal(state.maturity, 'basic');
    });

    it('returns "structured" when some (but not all) advanced dirs exist', async () => {
        await writeFile(join(tmpDir, 'CLAUDE.md'), 'x'.repeat(600));
        await mkdir(join(tmpDir, '.claude', 'skills'), { recursive: true });
        const state = await detectBrainState(tmpDir);
        assert.equal(state.maturity, 'structured');
        assert.equal(state.has.skills, true);
    });
});

describe('mapChecksToCEPatterns', () => {
    it('returns 7 CE patterns', () => {
        const mockReport = {
            setup: { layers: [{ name: 'CLAUDE.md Quality', points: 5, maxPoints: 10, checks: [] }] },
            usage: { layers: [{ name: 'Sessions', points: 3, maxPoints: 5, checks: [] }] },
            fluency: { layers: [] },
        };
        const patterns = mapChecksToCEPatterns(mockReport);
        assert.equal(patterns.length, 7);
    });

    it('calculates percentage correctly for matched layers', () => {
        const mockReport = {
            setup: { layers: [
                { name: 'CLAUDE.md Quality', points: 8, maxPoints: 10, checks: [] },
                { name: 'Knowledge Base Architecture', points: 5, maxPoints: 10, checks: [] },
                { name: 'Settings Hierarchy', points: 2, maxPoints: 5, checks: [] },
            ]},
            usage: { layers: [] },
            fluency: { layers: [] },
        };
        const patterns = mapChecksToCEPatterns(mockReport);
        const pd = patterns.find(p => p.id === 'progressive_disclosure');
        assert.ok(pd);
        assert.equal(pd.percentage, Math.round(((8 + 5 + 2) / (10 + 10 + 5)) * 100));
    });

    it('returns 0% when no layers match a pattern', () => {
        const mockReport = {
            setup: { layers: [] },
            usage: { layers: [] },
            fluency: { layers: [] },
        };
        const patterns = mapChecksToCEPatterns(mockReport);
        for (const p of patterns) {
            assert.equal(p.percentage, 0);
            assert.equal(p.matchedLayers, 0);
        }
    });
});
