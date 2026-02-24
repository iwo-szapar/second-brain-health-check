import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatReport } from '../dist/report-formatter.js';

function makeEmptyReport() {
    return {
        path: '/tmp/test',
        timestamp: new Date().toISOString(),
        brainState: { maturity: 'empty', has: { claudeMd: false }, isBuyer: false, isReturning: false, previousScore: null },
        setup: { totalPoints: 0, maxPoints: 100, normalizedScore: 0, grade: 'F', gradeLabel: 'Barely configured', layers: [] },
        usage: { totalPoints: 0, maxPoints: 50, normalizedScore: 0, grade: 'Empty', gradeLabel: 'No usage', layers: [] },
        fluency: { totalPoints: 0, maxPoints: 50, normalizedScore: 0, grade: 'Novice', gradeLabel: 'Not yet leveraging AI', layers: [] },
        topFixes: [],
        cePatterns: [],
    };
}

function makeGrowthReport() {
    return {
        path: '/tmp/test',
        timestamp: new Date().toISOString(),
        brainState: { maturity: 'minimal', has: { claudeMd: true }, isBuyer: false, isReturning: false, previousScore: null },
        setup: { totalPoints: 15, maxPoints: 100, normalizedScore: 15, grade: 'F', gradeLabel: 'Barely configured', layers: [] },
        usage: { totalPoints: 5, maxPoints: 50, normalizedScore: 10, grade: 'Empty', gradeLabel: 'No usage', layers: [] },
        fluency: { totalPoints: 0, maxPoints: 50, normalizedScore: 0, grade: 'Novice', gradeLabel: 'Not yet leveraging AI', layers: [] },
        topFixes: [{ title: 'Add skills directory', impact: 'high', description: 'Create .claude/skills/' }],
        cePatterns: [],
    };
}

function makeFullReport() {
    const layer = { name: 'Test Layer', points: 8, maxPoints: 10, checks: [{ status: 'pass', message: 'OK', points: 8, maxPoints: 10 }] };
    return {
        path: '/tmp/test',
        timestamp: new Date().toISOString(),
        brainState: { maturity: 'configured', has: { claudeMd: true, skills: true, hooks: true, memory: true }, isBuyer: false, isReturning: false, previousScore: null },
        setup: { totalPoints: 80, maxPoints: 100, normalizedScore: 80, grade: 'B', gradeLabel: 'Good foundation', layers: [layer] },
        usage: { totalPoints: 40, maxPoints: 50, normalizedScore: 80, grade: 'Growing', gradeLabel: 'Good momentum', layers: [layer] },
        fluency: { totalPoints: 40, maxPoints: 50, normalizedScore: 80, grade: 'Proficient', gradeLabel: 'Effective AI usage', layers: [layer] },
        topFixes: [{ title: 'Improve hooks', impact: 'medium', description: 'Add pre-commit hook' }],
        cePatterns: [{ id: 'test', name: 'Test Pattern', percentage: 75, maxScore: 10, score: 7 }],
    };
}

describe('formatReport', () => {
    it('returns getting-started guide for empty brain', () => {
        const output = formatReport(makeEmptyReport());
        assert.ok(output.includes('No brain detected'));
        assert.ok(output.includes('INSTALL YOUR BRAIN'));
    });

    it('returns growth report for low-score minimal brain', () => {
        const output = formatReport(makeGrowthReport());
        assert.ok(output.includes('WHAT YOU HAVE'));
        assert.ok(output.includes('NEXT 20-MINUTE SESSION'));
    });

    it('returns full report for configured brain', () => {
        const output = formatReport(makeFullReport());
        assert.ok(output.includes('OVERALL:'));
        assert.ok(output.includes('SETUP QUALITY BREAKDOWN'));
        assert.ok(output.includes('USAGE ACTIVITY BREAKDOWN'));
        assert.ok(output.includes('AI FLUENCY BREAKDOWN'));
    });

    it('includes CE patterns in full report', () => {
        const output = formatReport(makeFullReport());
        assert.ok(output.includes('CONTEXT ENGINEERING PATTERNS'));
    });

    it('includes top fixes in full report', () => {
        const output = formatReport(makeFullReport());
        assert.ok(output.includes('TOP FIXES'));
    });
});
