/**
 * Health Check Orchestrator
 *
 * Runs all setup, usage, and fluency checks, produces a full report.
 */
import { resolve } from 'node:path';
import { stat, realpath } from 'node:fs/promises';
import { getSetupGrade, getUsageGrade, getFluencyGrade, normalizeScore } from './types.js';
// Setup layers
import { checkClaudeMd } from './setup/claude-md.js';
import { checkSkills } from './setup/skills.js';
import { checkStructure } from './setup/structure.js';
import { checkMemory } from './setup/memory.js';
import { checkBrainHealth } from './setup/brain-health.js';
import { checkHooks } from './setup/hooks.js';
import { checkPersonalization } from './setup/personalization.js';
import { checkMcpSecurity } from './setup/mcp-security.js';
import { checkConfigHygiene } from './setup/config-hygiene.js';
import { checkPlugins } from './setup/plugins.js';
import { checkSettingsHierarchy } from './setup/settings-hierarchy.js';
import { checkPermissionsAudit } from './setup/permissions-audit.js';
import { checkSandboxConfig } from './setup/sandbox-config.js';
import { checkModelConfig } from './setup/model-config.js';
import { checkEnvVars } from './setup/env-vars.js';
import { checkMcpHealth } from './setup/mcp-health.js';
import { checkAttributionDisplay } from './setup/attribution-display.js';
import { checkAgentQuality } from './setup/agent-quality.js';
import { checkGitignoreHygiene } from './setup/gitignore-hygiene.js';
import { checkTeamReadiness } from './setup/team-readiness.js';
import { checkRulesSystem } from './setup/rules-system.js';
import { checkInteractionConfig } from './setup/interaction-config.js';
// Usage layers
import { checkSessions } from './usage/sessions.js';
import { checkPatterns } from './usage/patterns.js';
import { checkMemoryEvolution } from './usage/memory-evolution.js';
import { checkReviewLoop } from './usage/review-loop.js';
import { checkCompoundEvidence } from './usage/compound-evidence.js';
import { checkCrossReferences } from './usage/cross-references.js';
import { checkWorkflowMaturity } from './usage/workflow-maturity.js';
// Fluency layers
import { checkProgressiveDisclosure } from './fluency/progressive-disclosure.js';
import { checkSkillOrchestration } from './fluency/skill-orchestration.js';
import { checkContextAwareSkills } from './fluency/context-aware-skills.js';
import { checkReferenceIntegrity } from './fluency/reference-integrity.js';
import { checkDelegationPatterns } from './fluency/delegation-patterns.js';
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
            checkMcpSecurity(rootPath),
            checkConfigHygiene(rootPath),
            checkPlugins(rootPath),
            checkSettingsHierarchy(rootPath),
            checkPermissionsAudit(rootPath),
            checkSandboxConfig(rootPath),
            checkModelConfig(rootPath),
            checkEnvVars(rootPath),
            checkMcpHealth(rootPath),
            checkAttributionDisplay(rootPath),
            checkAgentQuality(rootPath),
            checkGitignoreHygiene(rootPath),
            checkTeamReadiness(rootPath),
            checkRulesSystem(rootPath),
            checkInteractionConfig(rootPath),
        ]),
        Promise.all([
            checkSessions(rootPath),
            checkPatterns(rootPath),
            checkMemoryEvolution(rootPath),
            checkReviewLoop(rootPath),
            checkCompoundEvidence(rootPath),
            checkCrossReferences(rootPath),
            checkWorkflowMaturity(rootPath),
        ]),
        Promise.all([
            checkProgressiveDisclosure(rootPath),
            checkSkillOrchestration(rootPath),
            checkContextAwareSkills(rootPath),
            checkReferenceIntegrity(rootPath),
            checkDelegationPatterns(rootPath),
        ]),
    ]);
    const setupTotal = setupLayers.reduce((sum, l) => sum + l.points, 0);
    const setupMax = setupLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const usageTotal = usageLayers.reduce((sum, l) => sum + l.points, 0);
    const usageMax = usageLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const fluencyTotal = fluencyLayers.reduce((sum, l) => sum + l.points, 0);
    const fluencyMax = fluencyLayers.reduce((sum, l) => sum + l.maxPoints, 0);
    const setupGrade = getSetupGrade(setupTotal, setupMax);
    const usageGrade = getUsageGrade(usageTotal, usageMax);
    const fluencyGrade = getFluencyGrade(fluencyTotal, fluencyMax);
    const setup = {
        totalPoints: setupTotal,
        maxPoints: setupMax,
        normalizedScore: normalizeScore(setupTotal, setupMax),
        grade: setupGrade.grade,
        gradeLabel: setupGrade.label,
        layers: setupLayers,
    };
    const usage = {
        totalPoints: usageTotal,
        maxPoints: usageMax,
        normalizedScore: normalizeScore(usageTotal, usageMax),
        grade: usageGrade.grade,
        gradeLabel: usageGrade.label,
        layers: usageLayers,
    };
    const fluency = {
        totalPoints: fluencyTotal,
        maxPoints: fluencyMax,
        normalizedScore: normalizeScore(fluencyTotal, fluencyMax),
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
    const dimMaxes = {
        setup: setupLayers.reduce((s, l) => s + l.maxPoints, 0),
        usage: usageLayers.reduce((s, l) => s + l.maxPoints, 0),
        fluency: fluencyLayers.reduce((s, l) => s + l.maxPoints, 0),
    };
    const addChecks = (layers, category) => {
        for (const layer of layers) {
            for (const check of layer.checks) {
                if (check.status !== 'pass') {
                    const rawDeficit = check.maxPoints - check.points;
                    const dimMax = dimMaxes[category] || 1;
                    const normalizedDeficit = Math.round((rawDeficit / dimMax) * 100);
                    allChecks.push({
                        check,
                        layer: layer.name,
                        category,
                        deficit: rawDeficit,
                        normalizedDeficit,
                    });
                }
            }
        }
    };
    addChecks(setupLayers, 'setup');
    addChecks(usageLayers, 'usage');
    addChecks(fluencyLayers, 'fluency');
    // Sort by normalized deficit (highest potential improvement first)
    allChecks.sort((a, b) => b.normalizedDeficit - a.normalizedDeficit);
    // Take top 5
    return allChecks.slice(0, 5).map(item => ({
        title: item.check.name.toUpperCase(),
        impact: `+${item.normalizedDeficit}% ${item.category}`,
        description: item.check.message,
        category: item.category,
    }));
}
//# sourceMappingURL=health-check.js.map
