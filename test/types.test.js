import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSetupGrade, getUsageGrade, getFluencyGrade, normalizeScore } from '../dist/types.js';

describe('getSetupGrade', () => {
    it('returns A for 85%+', () => {
        const { grade } = getSetupGrade(85, 100);
        assert.equal(grade, 'A');
    });

    it('returns B for 70-84%', () => {
        const { grade } = getSetupGrade(70, 100);
        assert.equal(grade, 'B');
    });

    it('returns C for 50-69%', () => {
        const { grade } = getSetupGrade(50, 100);
        assert.equal(grade, 'C');
    });

    it('returns D for 30-49%', () => {
        const { grade } = getSetupGrade(30, 100);
        assert.equal(grade, 'D');
    });

    it('returns F for <30%', () => {
        const { grade } = getSetupGrade(10, 100);
        assert.equal(grade, 'F');
    });

    it('returns F when maxPoints is 0', () => {
        const { grade } = getSetupGrade(0, 0);
        assert.equal(grade, 'F');
    });
});

describe('getUsageGrade', () => {
    it('returns Active for 85%+', () => {
        const { grade } = getUsageGrade(90, 100);
        assert.equal(grade, 'Active');
    });

    it('returns Empty for <30%', () => {
        const { grade } = getUsageGrade(5, 100);
        assert.equal(grade, 'Empty');
    });

    it('handles 0 points / 0 max', () => {
        const { grade } = getUsageGrade(0, 0);
        assert.equal(grade, 'Empty');
    });
});

describe('getFluencyGrade', () => {
    it('returns Expert for 85%+', () => {
        const { grade } = getFluencyGrade(90, 100);
        assert.equal(grade, 'Expert');
    });

    it('returns Novice for <30%', () => {
        const { grade } = getFluencyGrade(10, 100);
        assert.equal(grade, 'Novice');
    });
});

describe('normalizeScore', () => {
    it('returns 0 when maxPoints is 0', () => {
        assert.equal(normalizeScore(10, 0), 0);
    });

    it('returns 0 when maxPoints is negative', () => {
        assert.equal(normalizeScore(10, -5), 0);
    });

    it('returns rounded percentage', () => {
        assert.equal(normalizeScore(1, 3), 33);
    });

    it('returns 100 for perfect score', () => {
        assert.equal(normalizeScore(50, 50), 100);
    });

    it('returns 0 for zero points', () => {
        assert.equal(normalizeScore(0, 100), 0);
    });
});
