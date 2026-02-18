/**
 * Health Check Orchestrator
 *
 * Runs all setup, usage, and fluency checks, produces a full report.
 */
import { resolve } from 'node:path';
import { stat, realpath } from 'node:fs/promises';
import { getSetupGrade, getUsageGrade, getFluencyGrade } from './types.js';
// Setup layers
import { checkClaudeMd } from './setup/claude-md.js';
import { checkSkills } from './setup/skills.js';
import { checkStructure } from './setup/structure.js';
import { checkMemory } from './setup/memory.js';
import { checkBrainHealth } from './setup/brain-health.js';
import { checkHooks } from './setup/hooks.js';
import { checkPersonalization } from './setup/personalization.js';
// Usage layers
import { checkSessions } from './usage/sessions.js';
import { checkPatterns } from './usage/patterns.js';
import { checkMemoryEvolution } from './usage/memory-evolution.js';
import { checkReviewLoop } from './usage/review-loop.js';
import { checkCompoundEvidence } from './usage/compound-evidence.js';
import { checkCrossReferences } from './usage/cross-references.js';
// Fluency layers
import { checkProgressiveDisclosure } from './fluency/progressive-disclosure.js';
import { checkSkillOrchestration } from './fluency/skill-orchestration.js';
import { checkContextAwareSkills } from './fluency/context-aware-skills.js';
export async function runHealthCheck(path) {
    const rootPath = await realpath(resolve(path || process.cwd()));
    // Boundary check: only allow paths within user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error('Cannot determine home directory: HOME environment variable is not set.');
    }
    if (!rootPath.startsWith(homeDir + '/') && rootPath !== homeDir) {
        throw new Error(`Path "${rootPath}" is outside the home directory.`);
    }
    // Ensure path is a directory
    const s = await stat(rootPath);
    if (!s.isDirectory()) {
        throw new Error(`Path "${rootPath}" is not a directory.`);
    }
    // Run all checks in parallel (setup, usage, fluency)
    const [setupLayers, usageLayers, fluencyLayers] = await Promise.all([
        Promise.all([
            checkClaudeMd(rootPath),
            checkSkills(rootPath),
            checkStructure(rootPath),
            checkMemory(rootPath),
            checkBrainHealth(rootPath),
            checkHooks(rootPath),
            checkPersonalization(rootPath),
        ]),
        Promise.all([
            checkSessions(rootPath),
            checkPatterns(rootPath),
            checkMemoryEvolution(rootPath),
            checkReviewLoop(rootPath),
            checkCompoundEvidence(rootPath),
            checkCrossReferences(rootPath),
        ]),
        Promise.all([
            checkProgressiveDisclosure(rootPath),
            checkSkillOrchestration(rootPath),
            checkContextAwareSkills(rootPath),
        ]),
    ]);
    const setupTotal = setupLayers.reduce((sum, l) => sum + l.points, 0);
    const setupMax = setupLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const usageTotal = usageLayers.reduce((sum, l) => sum + l.points, 0);
    const usageMax = usageLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const fluencyTotal = fluencyLayers.reduce((sum, l) => sum + l.points, 0);
    const fluencyMax = fluencyLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const setupGrade = getSetupGrade(setupTotal);
    const usageGrade = getUsageGrade(usageTotal);
    const fluencyGrade = getFluencyGrade(fluencyTotal, fluencyMax);
    const setup = {
        totalPoints: setupTotal,
        maxPoints: setupMax,
        grade: setupGrade.grade,
        gradeLabel: setupGrade.label,
        layers: setupLayers,
    };
    const usage = {
        totalPoints: usageTotal,
        maxPoints: usageMax,
        grade: usageGrade.grade,
        gradeLabel: usageGrade.label,
        layers: usageLayers,
    };
    const fluency = {
        totalPoints: fluencyTotal,
        maxPoints: fluencyMax,
        grade: fluencyGrade.grade,
        gradeLabel: fluencyGrade.label,
        layers: fluencyLayers,
    };
    const topFixes = generateTopFixes(setupLayers, usageLayers, fluencyLayers);
    return {
        path: rootPath,
        timestamp: new Date().toISOString(),
        setup,
        usage,
        fluency,
        topFixes,
    };
}
function generateTopFixes(setupLayers, usageLayers, fluencyLayers) {
    const allChecks = [];
    const addChecks = (layers, category) => {
        for (const layer of layers) {
            for (const check of layer.checks) {
                if (check.status !== 'pass') {
                    allChecks.push({
                        check,
                        layer: layer.name,
                        category,
                        deficit: check.maxPoints - check.points,
                    });
                }
            }
        }
    };
    addChecks(setupLayers, 'setup');
    addChecks(usageLayers, 'usage');
    addChecks(fluencyLayers, 'fluency');
    // Sort by deficit (highest potential improvement first)
    allChecks.sort((a, b) => b.deficit - a.deficit);
    // Take top 5
    return allChecks.slice(0, 5).map(item => ({
        title: item.check.name.toUpperCase(),
        impact: `+${item.deficit} pts ${item.category}`,
        description: item.check.message,
        category: item.category,
    }));
}
//# sourceMappingURL=health-check.js.map
