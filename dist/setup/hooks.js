/**
 * Setup Layer: Hooks Configuration
 *
 * Evaluates whether .claude/settings.json contains hooks for lifecycle
 * automation, checks for tool lifecycle hooks, verifies that referenced
 * hook scripts exist on disk, and validates hook health (syntax, fragile
 * patterns, no-op safety).
 */
import { readFile, access } from 'node:fs/promises';
import { join, isAbsolute, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

function extractScriptPaths(command) {
    const paths = [];
    const matches = command.match(/[\w./$~-]+\.(?:sh|py|js|ts)\b/g) || [];
    for (const m of matches) {
        paths.push(m);
    }
    return paths;
}

/**
 * Collect all hook entries from settings, properly traversing
 * both flat ({ command: "..." }) and nested ({ hooks: [{ command: "..." }] })
 * hook structures.
 *
 * Returns array of { event, matcher, command, scriptPaths, resolvedPaths }
 */
function collectAllHooks(hooks, rootPath) {
    const collected = [];
    for (const event of Object.keys(hooks)) {
        const eventEntries = hooks[event];
        if (!Array.isArray(eventEntries)) continue;

        for (const entry of eventEntries) {
            // Nested structure: { matcher, hooks: [{ type, command }] }
            if (Array.isArray(entry.hooks)) {
                for (const h of entry.hooks) {
                    const command = h.command || h.cmd || '';
                    if (typeof command !== 'string') continue;
                    const scriptPaths = extractScriptPaths(command);
                    collected.push({
                        event,
                        matcher: entry.matcher || null,
                        type: h.type || 'command',
                        command,
                        scriptPaths,
                        resolvedPaths: scriptPaths.map(p => resolvePath(p, rootPath)),
                    });
                }
            }
            // Flat structure: { command: "..." }
            const directCommand = entry.command || entry.cmd || '';
            if (typeof directCommand === 'string' && directCommand) {
                const scriptPaths = extractScriptPaths(directCommand);
                collected.push({
                    event,
                    matcher: entry.matcher || null,
                    type: entry.type || 'command',
                    command: directCommand,
                    scriptPaths,
                    resolvedPaths: scriptPaths.map(p => resolvePath(p, rootPath)),
                });
            }
        }
    }
    return collected;
}

function resolvePath(scriptPath, rootPath) {
    let resolved = scriptPath;
    resolved = resolved.replace(/\$CLAUDE_PROJECT_DIR/g, rootPath);
    resolved = resolved.replace(/\$\{CLAUDE_PROJECT_DIR\}/g, rootPath);
    if (!isAbsolute(resolved)) {
        resolved = join(rootPath, resolved);
    }
    return resolved;
}

/**
 * Check bash syntax using `bash -n` (parse-only, no execution).
 * Returns null if valid, error message if invalid.
 */
function checkBashSyntax(filePath) {
    try {
        execFileSync('bash', ['-n', filePath], {
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return null; // valid
    } catch (err) {
        const stderr = err.stderr ? err.stderr.toString().trim() : 'Unknown syntax error';
        return stderr;
    }
}

/**
 * Detect fragile patterns in shell scripts that can cause silent failures.
 * Returns array of warning strings.
 */
function detectFragilePatterns(content, scriptName) {
    const warnings = [];

    const hasSetE = /set\s+-[a-z]*e/.test(content);
    const hasPipefail = /set\s+-[a-z]*o\s+pipefail/.test(content) || /set\s+-euo\s+pipefail/.test(content);
    const hasSetU = /set\s+-[a-z]*u/.test(content);

    // Check: set -e/pipefail with unguarded find/grep -l/pipe chains
    if (hasSetE || hasPipefail) {
        // find on potentially non-existent dirs (find without || true or if-guard)
        const findLines = content.match(/^[^#]*\bfind\s+/gm) || [];
        for (const line of findLines) {
            if (!line.includes('|| true') && !line.includes('|| :') && !line.includes('2>/dev/null')) {
                warnings.push(`${scriptName}: \`find\` used with strict mode (set -e/pipefail) without error guard — will abort if directory missing`);
                break;
            }
        }

        // grep without || true
        const grepLines = content.match(/^[^#]*\bgrep\b/gm) || [];
        for (const line of grepLines) {
            if (!line.includes('|| true') && !line.includes('|| :') && !line.includes('|| exit')) {
                warnings.push(`${scriptName}: \`grep\` used with strict mode without error guard — exit code 1 on no match will abort script`);
                break;
            }
        }
    }

    // Check: set -u without default values for common optional vars
    if (hasSetU) {
        // Look for $1, $2 etc without ${1:-default} pattern
        const positionalRaw = content.match(/\$[1-9]/g) || [];
        const positionalSafe = content.match(/\$\{[1-9]:-/g) || [];
        if (positionalRaw.length > 0 && positionalSafe.length === 0) {
            warnings.push(`${scriptName}: \`set -u\` used with unguarded positional params ($1, $2) — will fail if args not provided`);
        }

        // Check for unguarded hook-specific env vars
        const hookVars = ['CLAUDE_PROJECT_DIR', 'TOOL_NAME', 'TOOL_INPUT'];
        const usedUnguarded = hookVars.filter(v => {
            const used = content.includes(`$${v}`) || content.includes(`\${${v}}`);
            const guarded = content.includes(`\${${v}:-`);
            return used && !guarded;
        });
        if (usedUnguarded.length > 0) {
            warnings.push(`${scriptName}: \`set -u\` with hook env vars lacking defaults (${usedUnguarded.join(', ')}) — script may fail when vars aren't set`);
        }
    }

    return warnings;
}

/**
 * Test no-op safety: send non-matching stdin to the hook and verify exit 0.
 * Returns null if safe, warning string if not.
 */
function testNoOpSafety(resolvedPath, event) {
    // Build a test payload that should NOT match any real hook condition
    let testPayload;
    if (event === 'PostToolUse') {
        testPayload = JSON.stringify({
            tool_name: 'Bash',
            tool_input: { command: 'echo health_check_noop_test' },
        });
    } else if (event === 'PreToolUse') {
        testPayload = JSON.stringify({
            tool_name: 'Read',
            tool_input: { file_path: '/tmp/health_check_noop_test' },
        });
    } else {
        // SessionStart, Stop, etc — send empty object
        testPayload = JSON.stringify({});
    }

    try {
        execFileSync('bash', ['-c', `echo ${JSON.stringify(testPayload)} | bash ${JSON.stringify(resolvedPath)}`], {
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: '/tmp',
        });
        return null; // exit 0 = safe
    } catch (err) {
        const code = err.status || 'unknown';
        const scriptFile = basename(resolvedPath);
        // Exit code 2 is used by Claude hooks to block tool execution — that's intentional
        // but on a no-op input it suggests the hook is too aggressive
        if (code === 2) {
            return `${scriptFile}: blocks non-matching input (exit 2) — hook may be too aggressive, should exit 0 for non-matching tools`;
        }
        return `${scriptFile}: exits with code ${code} on non-matching input — should exit 0 to pass through`;
    }
}

export async function checkHooks(rootPath) {
    const checks = [];
    const settingsPath = join(rootPath, '.claude', 'settings.json');

    let settings = null;
    try {
        const raw = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
    } catch {
        // No settings or invalid JSON
    }

    if (!settings) {
        return {
            name: 'Hooks Configuration',
            points: 0,
            maxPoints: 13,
            checks: [{
                name: 'Settings with hooks configured',
                status: 'fail',
                points: 0,
                maxPoints: 4,
                message: 'No .claude/settings.json found or invalid JSON',
            }, {
                name: 'Tool lifecycle hooks',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No settings file to evaluate',
            }, {
                name: 'Hook scripts valid',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No settings file to evaluate',
            }, {
                name: 'Hook health validation',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No settings file to evaluate',
            }],
        };
    }

    const hooksConfig = settings.hooks || {};
    const hookEvents = Object.keys(hooksConfig);

    // Collect all hooks with proper nesting traversal
    const allHookEntries = collectAllHooks(hooksConfig, rootPath);

    // Check 1: Settings with hooks configured (4 pts)
    {
        const totalHooks = allHookEntries.length;

        let status, points;
        if (hookEvents.length >= 3) {
            status = 'pass';
            points = 4;
        } else if (hookEvents.length === 2) {
            status = 'warn';
            points = 3;
        } else if (hookEvents.length === 1) {
            status = 'warn';
            points = 2;
        } else {
            status = 'warn';
            points = 1;
        }

        checks.push({
            name: 'Settings with hooks configured',
            status,
            points,
            maxPoints: 4,
            message: hookEvents.length > 0
                ? `${totalHooks} hook(s) across ${hookEvents.length} lifecycle event(s): ${hookEvents.join(', ')}`
                : 'Settings file exists but no hooks configured',
        });
    }

    // Check 2: Tool lifecycle hooks (3 pts)
    {
        const hasPreToolUse = hookEvents.includes('PreToolUse');
        const hasPostToolUse = hookEvents.includes('PostToolUse');
        const hasToolHooks = hasPreToolUse || hasPostToolUse;

        let status, points;
        if (hasToolHooks) {
            status = 'pass';
            points = 3;
        } else if (hookEvents.length > 0) {
            status = 'warn';
            points = 1;
        } else {
            status = 'fail';
            points = 0;
        }

        checks.push({
            name: 'Tool lifecycle hooks',
            status,
            points,
            maxPoints: 3,
            message: hasToolHooks
                ? `Tool lifecycle hooks found: ${[hasPreToolUse && 'PreToolUse', hasPostToolUse && 'PostToolUse'].filter(Boolean).join(', ')}`
                : hookEvents.length > 0
                    ? 'Hooks exist but none for PreToolUse/PostToolUse — add tool guards for safety'
                    : 'No hooks configured',
        });
    }

    // Check 3: Hook scripts exist on disk (3 pts)
    {
        const allScriptPaths = [];
        let hasInlineOnly = true;

        for (const entry of allHookEntries) {
            if (entry.scriptPaths.length > 0) {
                hasInlineOnly = false;
                allScriptPaths.push(...entry.resolvedPaths);
            }
        }

        // Deduplicate
        const uniquePaths = [...new Set(allScriptPaths)];

        if (uniquePaths.length === 0 && hookEvents.length > 0) {
            checks.push({
                name: 'Hook scripts valid',
                status: hasInlineOnly ? 'pass' : 'fail',
                points: hasInlineOnly ? 3 : 0,
                maxPoints: 3,
                message: hasInlineOnly
                    ? 'Hooks use inline commands (no external script files)'
                    : 'No hook scripts found',
            });
        } else if (uniquePaths.length > 0) {
            let existCount = 0;
            const missingScripts = [];
            for (const resolved of uniquePaths) {
                try {
                    await access(resolved);
                    existCount++;
                } catch {
                    missingScripts.push(basename(resolved));
                }
            }

            let status, points;
            if (existCount === uniquePaths.length) {
                status = 'pass';
                points = 3;
            } else if (existCount > 0) {
                status = 'warn';
                points = 1;
            } else {
                status = 'fail';
                points = 0;
            }

            const msg = `${existCount}/${uniquePaths.length} referenced hook script(s) exist on disk`;
            checks.push({
                name: 'Hook scripts valid',
                status,
                points,
                maxPoints: 3,
                message: missingScripts.length > 0
                    ? `${msg} — missing: ${missingScripts.join(', ')}`
                    : msg,
            });
        } else {
            checks.push({
                name: 'Hook scripts valid',
                status: 'fail',
                points: 0,
                maxPoints: 3,
                message: 'No hooks to evaluate',
            });
        }
    }

    // Check 4: Hook health validation (3 pts)
    // Sub-checks: syntax, fragile patterns, no-op safety
    {
        // Gather all unique resolved paths for scripts that exist
        const scriptEntries = []; // { resolvedPath, event, scriptName }
        const seenPaths = new Set();

        for (const entry of allHookEntries) {
            for (let i = 0; i < entry.resolvedPaths.length; i++) {
                const resolved = entry.resolvedPaths[i];
                if (seenPaths.has(resolved)) continue;
                seenPaths.add(resolved);

                // Only validate scripts that exist on disk
                try {
                    await access(resolved);
                    scriptEntries.push({
                        resolvedPath: resolved,
                        event: entry.event,
                        scriptName: basename(resolved),
                    });
                } catch {
                    // skip missing scripts — already reported in Check 3
                }
            }
        }

        if (scriptEntries.length === 0) {
            // No external scripts to validate (inline-only or no hooks)
            checks.push({
                name: 'Hook health validation',
                status: hookEvents.length > 0 ? 'pass' : 'fail',
                points: hookEvents.length > 0 ? 3 : 0,
                maxPoints: 3,
                message: hookEvents.length > 0
                    ? 'No external hook scripts to validate (inline commands only)'
                    : 'No hooks to validate',
            });
        } else {
            const syntaxErrors = [];
            const fragileWarnings = [];
            const noopWarnings = [];

            for (const { resolvedPath, event, scriptName } of scriptEntries) {
                // Sub-check A: Bash syntax
                if (resolvedPath.endsWith('.sh')) {
                    const syntaxErr = checkBashSyntax(resolvedPath);
                    if (syntaxErr) {
                        syntaxErrors.push(`${scriptName}: ${syntaxErr}`);
                    }
                }

                // Sub-check B: Fragile pattern detection
                try {
                    const content = await readFile(resolvedPath, 'utf-8');
                    const fragile = detectFragilePatterns(content, scriptName);
                    fragileWarnings.push(...fragile);
                } catch {
                    // can't read file — skip
                }

                // Sub-check C: No-op safety (only for Pre/PostToolUse hooks)
                if (event === 'PreToolUse' || event === 'PostToolUse') {
                    const noopResult = testNoOpSafety(resolvedPath, event);
                    if (noopResult) {
                        noopWarnings.push(noopResult);
                    }
                }
            }

            const totalIssues = syntaxErrors.length + fragileWarnings.length + noopWarnings.length;
            const hasSyntaxErrors = syntaxErrors.length > 0;

            let status, points;
            if (totalIssues === 0) {
                status = 'pass';
                points = 3;
            } else if (hasSyntaxErrors) {
                // Syntax errors are serious
                status = 'fail';
                points = 0;
            } else if (fragileWarnings.length > 0 || noopWarnings.length > 0) {
                // Warnings only — partial credit
                status = 'warn';
                points = 1;
            } else {
                status = 'warn';
                points = 1;
            }

            // Build detailed message
            const parts = [];
            parts.push(`Validated ${scriptEntries.length} hook script(s)`);

            if (syntaxErrors.length > 0) {
                parts.push(`SYNTAX ERRORS (${syntaxErrors.length}): ${syntaxErrors.join('; ')}`);
            }
            if (fragileWarnings.length > 0) {
                parts.push(`Fragile patterns (${fragileWarnings.length}): ${fragileWarnings.join('; ')}`);
            }
            if (noopWarnings.length > 0) {
                parts.push(`No-op safety (${noopWarnings.length}): ${noopWarnings.join('; ')}`);
            }
            if (totalIssues === 0) {
                parts.push('All scripts pass syntax, fragile pattern, and no-op safety checks');
            }

            checks.push({
                name: 'Hook health validation',
                status,
                points,
                maxPoints: 3,
                message: parts.join(' — '),
            });
        }
    }

    // Check 5: Hook Type Distribution (3 pts)
    {
        const types = { command: 0, prompt: 0, agent: 0, unknown: 0 };

        for (const entry of allHookEntries) {
            // Determine hook type from the entry
            // In the hooks config, entries can have a "type" field
            // Default to "command" if not specified
            const hookType = entry.type || 'command';
            if (hookType === 'command' || hookType === 'cmd') types.command++;
            else if (hookType === 'prompt') types.prompt++;
            else if (hookType === 'agent') types.agent++;
            else types.command++; // default
        }

        const totalHooks = allHookEntries.length;
        const typeList = [];
        if (types.command > 0) typeList.push(`${types.command} command`);
        if (types.prompt > 0) typeList.push(`${types.prompt} prompt`);
        if (types.agent > 0) typeList.push(`${types.agent} agent`);

        let status, points, message;
        if (totalHooks === 0) {
            status = 'fail';
            points = 0;
            message = 'No hooks to evaluate';
        } else if (types.prompt > 0 || types.agent > 0) {
            status = 'pass';
            points = 3;
            message = `Advanced hook types in use: ${typeList.join(', ')}`;
        } else if (types.command >= 3) {
            status = 'pass';
            points = 2;
            message = `${types.command} command hook(s) — consider adding prompt/agent hooks for smarter decisions`;
        } else {
            status = 'warn';
            points = 1;
            message = `Only ${types.command} command hook(s) — hook system underutilized`;
        }
        checks.push({ name: 'Hook type distribution', status, points, maxPoints: 3, message });
    }

    // Check 6: Matcher Quality (3 pts)
    {
        let matcherCount = 0;
        let unmatchedCount = 0;
        const broadMatchers = [];

        for (const entry of allHookEntries) {
            if (entry.matcher) {
                matcherCount++;
                // Check if matcher is overly broad (matches everything)
                if (entry.matcher === '*' || entry.matcher === '.*') {
                    broadMatchers.push(entry.event);
                }
            } else {
                // PreToolUse/PostToolUse without matcher runs on EVERY tool call
                if (entry.event === 'PreToolUse' || entry.event === 'PostToolUse') {
                    unmatchedCount++;
                }
            }
        }

        const toolHookCount = allHookEntries.filter(e =>
            e.event === 'PreToolUse' || e.event === 'PostToolUse'
        ).length;

        let status, points, message;
        if (toolHookCount === 0) {
            status = 'pass';
            points = 3;
            message = 'No tool lifecycle hooks — matchers not applicable';
        } else if (unmatchedCount > 2) {
            status = 'warn';
            points = 1;
            message = `${unmatchedCount} tool hook(s) without matchers — run on every tool call, may impact performance`;
        } else if (broadMatchers.length > 0) {
            status = 'warn';
            points = 1;
            message = `${broadMatchers.length} hook(s) with wildcard matcher — consider scoping to specific tools`;
        } else if (matcherCount > 0) {
            status = 'pass';
            points = 3;
            message = `${matcherCount} hook(s) use matchers for targeted execution`;
        } else {
            status = 'pass';
            points = 2;
            message = 'Tool hooks configured without matchers — acceptable for simple setups';
        }
        checks.push({ name: 'Matcher quality', status, points, maxPoints: 3, message });
    }

    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const totalMaxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
        name: 'Hooks Configuration',
        points: totalPoints,
        maxPoints: totalMaxPoints,
        checks,
    };
}
