# Second Brain Health Check — Scoring Reference (for Claude Code)

> Source of truth for all scoring logic. If code and this doc disagree, **the code wins** — update this doc.
>
> Last verified against code: 2026-02-24 (v0.13.1)

**Related Documentation:**
- [README.md](./README.md) — Installation and usage guide

---

## Source Code Location

Only compiled JS is distributed:

```
dist/
  index.js                     # MCP server entry point (4 tools, v0.13.0)
  cli.js                       # CLI entry point
  types.js                     # Grade functions + normalizeScore
  health-check.js              # Orchestrator + detectBrainState() + mapChecksToCEPatterns()
  report-formatter.js          # Adaptive markdown output (empty/growth/full formats)
  setup/
    claude-md.js               # Layer 1: CLAUDE.md (23 pts)
    skills.js                  # Layer 2: Skills (24 pts)
    structure.js               # Layer 3: Structure (15 pts)
    memory.js                  # Layer 4: Memory (15 pts)
    brain-health.js            # Layer 5: Brain Health Infra (10 pts)
    hooks.js                   # Layer 6: Hooks (19 pts)
    personalization.js         # Layer 7: Personalization (10 pts)
    mcp-security.js            # Layer 8: MCP Security (8 pts)
    config-hygiene.js          # Layer 9: Config Hygiene (7 pts)
    plugins.js                 # Layer 10: Plugin Coverage (6 pts)
    settings-hierarchy.js      # Layer 11: Settings Hierarchy (12 pts)
    permissions-audit.js       # Layer 12: Permissions Audit (12 pts)
    sandbox-config.js          # Layer 13: Sandbox Config (8 pts)
    model-config.js            # Layer 14: Model Config (8 pts)
    env-vars.js                # Layer 15: Environment Variables (10 pts)
    mcp-health.js              # Layer 16: MCP Server Health (10 pts)
    attribution-display.js     # Layer 17: Attribution & Display (6 pts)
    agent-quality.js           # Layer 18: Agent Config Depth (8 pts)
    gitignore-hygiene.js       # Layer 19: Gitignore Hygiene (6 pts)
    team-readiness.js          # Layer 20: Team Readiness (8 pts)
    rules-system.js            # Layer 21: Rules System (6 pts)
    interaction-config.js      # Layer 22: Interaction Configuration (8 pts)
    spec-planning.js           # Layer 23: Spec & Planning Artifacts (10 pts)
    knowledge-base.js          # Layer 24: Knowledge Base Architecture (10 pts)
    context-pressure.js        # Layer 25: Context Pressure (10 pts) — NEW in v0.8.0
    prp-files.js               # Layer 26: PRP / Implementation Blueprints (8 pts) — NEW in v0.13.0
    examples-directory.js      # Layer 27: Examples Directory (6 pts) — NEW in v0.13.0
    planning-doc.js            # Layer 28: Planning Documentation (4 pts) — NEW in v0.13.0
    task-tracking.js           # Layer 29: Task Tracking (4 pts) — NEW in v0.13.0
    validate-command.js        # Layer 30: Validate Command (6 pts) — NEW in v0.13.0
    settings-local.js          # Layer 31: Settings Local Overrides (4 pts) — NEW in v0.13.0
    feature-request-template.js # Layer 32: Feature Request Template (3 pts) — NEW in v0.13.0
  usage/
    sessions.js                # Layer 1: Sessions (25 pts)
    patterns.js                # Layer 2: Patterns (25 pts)
    memory-evolution.js        # Layer 3: Memory Evolution (20 pts)
    review-loop.js             # Layer 4: Review Loop (15 pts)
    compound-evidence.js       # Layer 5: Compound Evidence (15 pts)
    cross-references.js        # Layer 6: Cross-References (15 pts)
    workflow-maturity.js       # Layer 7: Workflow Maturity (10 pts)
  fluency/
    progressive-disclosure.js  # Layer 1: Progressive Disclosure (10 pts)
    skill-orchestration.js     # Layer 2: Skill Orchestration (10 pts)
    context-aware-skills.js    # Layer 3: Context-Aware Skills (10 pts)
    reference-integrity.js     # Layer 4: Reference Integrity (10 pts)
    delegation-patterns.js     # Layer 5: Delegation Patterns (10 pts)
    interview-patterns.js      # Layer 6: Interview & Spec Patterns (10 pts)
  dashboard/
    generate.js                # HTML dashboard generator
  tools/
    generate-pdf.js            # PDF report via headless Chrome
```

---

## Architecture

### Three Dimensions

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| Setup Quality | ~284 | Is the brain correctly configured? (static file analysis) |
| Usage Activity | ~125 | Is the brain being used? (file dates, session counts, pattern growth) |
| AI Fluency | ~60 | How effectively does the user work with AI? (delegation, context engineering, compounding) |

**Total: ~459 points** (exact total depends on dynamic maxPoints in some layers)

All dimensions are **normalized to /100** for display. The report and dashboard show `normalizedScore/100` for each dimension, calculated as `Math.round((points / maxPoints) * 100)`.

### Orchestrator (`health-check.js`)

1. Runs `detectBrainState()` for fast pre-scan (~100ms) — returns maturity level and what exists
2. If `mode: 'quick'`, returns brain state only (no full checks)
3. Runs all setup layers in parallel via `Promise.allSettled()` for fault isolation, then usage, then fluency
4. Sums points per dimension. Generates top 5 fixes sorted by normalized deficit
5. Runs `mapChecksToCEPatterns()` to map 45 layers to 7 CE patterns
6. Attaches `brainState` and `cePatterns` to report for adaptive formatting

### Security Hardening

| Protection | Location | Detail |
|------------|----------|--------|
| Home directory boundary | `health-check.js:27` | `rootPath.startsWith(homeDir + '/')` |
| Directory-only input | `health-check.js:31` | `stat(rootPath).isDirectory()` |
| Path null-byte check | `index.js:22` | Zod `.refine(p => !p.includes('\0'))` |
| No shell execution | All files except hooks.js, gitignore-hygiene.js | hooks.js uses `execFileSync('bash', ...)`, gitignore-hygiene uses `execFileSync('git', ...)` |
| No network calls | All files | Zero `fetch`, `http`, `https` imports |
| File count limits | `memory.js:33`, `structure.js:43` | `entries.slice(0, MAX_ENTRIES)` caps at 5000 |
| Depth limits | `memory.js:29`, `structure.js:35` | `depth > 3` or `depth > 4` recursion guards |

---

## State File Schema (`.health-check.json`)

Written to `<rootPath>/.health-check.json` after every successful `check_health` run. Used for delta tracking (score changes between runs).

```json
{
  "schema_version": 1,
  "runs": [
    {
      "timestamp": "2026-02-23T07:47:50.100Z",
      "version": "0.13.0",
      "overallPct": 82,
      "setup": 80,
      "usage": 79,
      "fluency": 93,
      "maturity": "configured",
      "cePatterns": [
        { "name": "Progressive Disclosure", "pct": 94 },
        { "name": "Knowledge Files as RAM", "pct": 84 }
      ],
      "checks": [
        { "dim": "setup", "name": "CLAUDE.md Quality", "pts": 25, "max": 26 }
      ]
    }
  ]
}
```

**Fields:**
- `schema_version`: Integer version of the run object schema (added in v0.13.0). Bump when schema changes.
- `runs`: Array of all historical runs (max 20, oldest trimmed)
- `version`: npm package version that produced the run (from `package.json`)
- `overallPct`: Normalized overall score 0-100
- `setup` / `usage` / `fluency`: Per-dimension normalized scores 0-100
- `maturity`: Brain maturity at time of scan (`empty` | `minimal` | `basic` | `structured` | `configured`)
- `cePatterns`: Array of CE pattern scores `{ name, pct }`
- `checks`: Array of all layer scores `{ dim, name, pts, max }`

---

## Known Engineering Debt

These are confirmed gaps identified 2026-02-23. Tasks filed for each.

### ~~1. No Layer Fault Isolation (task-2571)~~ — RESOLVED in v0.13.0

Fixed: All 3 dimension groups now use `Promise.allSettled()` with `settleToLayers()` fallback. A failing layer produces a zero-score entry with error message instead of crashing the entire dimension.

### ~~2. No State File Schema Version (task-2570)~~ — RESOLVED in v0.13.0

Fixed: `.health-check.json` now includes `schema_version: 1` at root level. Existing files without it are backfilled to 1 on next run.

### 3. Pattern Tracker Parsing is Brittle

`usage/patterns.js` parses `_pattern-tracker.md` using string matching for `LOW/MEDIUM/HIGH` and `Total Reviews`. If users customize their tracker format or rename the file, checks silently return 0 pts. No error message surfaced to user.

### 4. Template Detection by File Size is Imprecise

`setup/memory.js` detects "not a template" by checking `fileSize > 100 bytes`. A 101-byte template is indistinguishable from real content. Better signal: check for placeholder keywords like `[YOUR`, `TODO:`, `FILL IN`.

### 5. CLAUDE.md Length Check is Byte-Aware, Not Char-Aware

`setup/claude-md.js` checks `content.length` for the 2K-6K range. In JS, `.length` on a string returns UTF-16 code units, not characters. For non-ASCII content (Polish, Japanese, Arabic), multibyte sequences inflate the count. Real char count should use `[...content].length`.

---

## ~~Pending Layers (v0.11.0)~~ — IMPLEMENTED in v0.13.0

All seven new Setup Quality layers from `context-engineering-intro` research (task-2572) are now implemented as Layers 26-32. See Setup Quality section above for full documentation.

---

## Brain State Detection

### `detectBrainState()` — `health-check.js`

Fast pre-scan using `fs.stat()` calls. Returns:

```js
{
  maturity: 'empty' | 'minimal' | 'basic' | 'structured' | 'configured',
  has: { claudeMd, claudeDir, memory, skills, hooks, knowledge, agents, settings },
  isBuyer: boolean,       // GUIDE_TOKEN env var present
  isReturning: boolean    // .health-check.json exists
}
```

| Maturity | Condition |
|----------|-----------|
| empty | No CLAUDE.md |
| minimal | CLAUDE.md <500 chars, no .claude/ dir |
| basic | CLAUDE.md + .claude/ but no skills or hooks |
| structured | Has skills OR hooks OR memory |
| configured | Has skills AND hooks AND memory AND knowledge |

### Adaptive Report Formatting — `report-formatter.js`

| Brain State | Report Style |
|-------------|-------------|
| Empty | 3-step getting-started guide (~20 min). Not 37 failures. |
| Minimal/Basic (score 1-40) | Growth mode: celebrate what exists, top 3 fixes with time estimates, patterns to unlock |
| Structured+ (score 41+) | Full report with all dimensions, CE pattern section, time estimates |

### Score-Band CTAs

| Score Range | CTA |
|-------------|-----|
| 0 (empty) | → iwoszapar.com/context-engineering |
| 1-30 | → iwoszapar.com/second-brain-ai |
| 31-60 | → iwoszapar.com/context-engineering |
| 61-84 | "N points from Production-grade. Missing: [pattern]" |
| 85+ | → iwoszapar.com/teams |
| Buyer | "BASELINE CAPTURED. Run again after setup." |

### CE Pattern Mapping — `health-check.js:mapChecksToCEPatterns()`

Maps 45 layer scores to 7 Context Engineering patterns:

| Pattern | Mapped Layers |
|---------|--------------|
| Progressive Disclosure | claude-md, knowledge-base, settings-hierarchy |
| Knowledge Files as RAM | knowledge-base, structure |
| Hooks as Guardrails | hooks, rules-system |
| Three-Layer Memory | memory, sessions |
| Compound Learning | review-loop, compound-evidence, workflow-maturity, patterns |
| Self-Correction | brain-health, memory-evolution, cross-references |
| Context Surfaces | mcp, plugin, interaction, context-pressure |

Output: `{ pattern, name, score, maxScore, percentage }` per pattern. Displayed in full reports after dimension breakdown.

---

## Setup Quality — 32 Layers (~284 pts)

### Layer 1: CLAUDE.md Foundation (23 pts) — `setup/claude-md.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Quick Start with numbered rules | 5 | Has heading + 3+ numbered items | Has heading, <3 items (2) | No heading (0) | `/^#{1,3}\s.*quick\s*start/im` + `/^\d+\.\s/gm` |
| About Me with role context | 3 | Section found (3) | — | Not found (0) | `/^#{1,3}\s.*(about\s*me|who\s*(am\s*i|i\s*am)|role|context)/im` |
| Profession-specific rules | 5 | 2+ domain patterns (5) | 1 pattern (2) | 0 patterns (0) | 13 regex patterns for MEDDPICC, sprint, SEO, billable, KPI, HIPAA, litigation, TypeScript, etc. |
| Gotchas section | 3 | Heading found (3) | Has never/always rules but no heading (1) | Neither (0) | `/^#{1,3}\s.*(gotcha|pitfall|avoid|mistake|warning)/im` |
| Project structure with folder tree | 2 | Tree chars or file path table found (2) | — | Not found (0) | `[├└│─]` in code blocks, or markdown tables with `src/\|lib/\|api/` paths, or 3+ indented file paths |
| Appropriate length (2K-6K chars) | 2 | In range (2) | Outside range (1) | — | `content.length` |
| CLAUDE.md freshness | 3 | Modified within 14 days (3) | Within 30 days (2) | >30 days (1) | `stat.mtimeMs` compared to current date |

### Layer 2: Skills & Commands (24 pts) — `setup/skills.js`

Scans both `.claude/skills/` and `.codex/skills/`.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Claude Code skills (2+ required) | 6 | 2+ skills (6) | 1 skill (3) | 0 (0) | Count dirs with SKILL.md + flat .md files |
| Codex compatibility | 2 | Has .codex/skills/ (2) | — | None (0) | Directory scan |
| Valid YAML frontmatter | 4 | 80%+ have frontmatter (4) | 50%+ (2) | <50% (0) | Regex-based `---\n...\n---` frontmatter detection |
| Profession-relevant skills | 4 | 80%+ non-generic (4) | 50%+ (2) | <50% (0) | Filters against: test, hello, example, demo, sample, template |
| Clear instructions (200+ chars) | 4 | 80%+ have 200+ chars (4) | 50%+ (2) | <50% (0) | `content.trim().length >= 200` |
| Frontmatter field depth | 4 | 3+ skills with advanced fields (4) | 1+ (2) | Basic only (1) or none (0) | Checks for model, allowed-tools, context, disable-model-invocation fields |

### Layer 3: Project Structure (15 pts) — `setup/structure.js`

Validates semantic directory structure, index files, and that tree documented in CLAUDE.md matches actual dirs.

| Check | Max | Detection |
|-------|-----|-----------|
| Semantic directory structure matching profession | 5 | Domain-specific folder names |
| Index files (`_index.md` / `INDEX.md`) in key dirs | 5 | Glob scan |
| Documented tree in CLAUDE.md matches actual dirs | 5 | Parse tree block, verify dirs exist |

### Layer 4: Memory Architecture (15 pts) — `setup/memory.js`

| Check | Max | Detection |
|-------|-----|-----------|
| `memory/` directory with subdirectories | 4 | Dir exists + has children |
| `memory/patterns/` or `memory/semantic/patterns/` | 3 | Path check |
| Style/voice files populated (not empty templates) | 4 | File sizes > 100 bytes |
| Examples directory has real content | 4 | Non-template content check |

### Layer 5: Brain Health Infrastructure (10 pts) — `setup/brain-health.js`

| Check | Max | Detection |
|-------|-----|-----------|
| `brain-health/` directory with tracking files | 4 | Dir + file existence |
| Growth log, quality metrics, pattern confidence files | 3 | Specific file checks |
| Onboarding summary or getting-started guide | 3 | File existence check |

### Layer 6: Automation & Hooks (19 pts) — `setup/hooks.js`

Includes 8 checks added across versions (session init hook +3, hierarchical context +3 also attributed here).

| Check | Max | Detection |
|-------|-----|-----------|
| `.claude/settings.json` with hooks configured | 4 | File exists + JSON parse |
| 1+ PreToolUse or PostToolUse hook | 3 | Check hooks array |
| Hook scripts exist and are executable | 3 | File + permission check |
| SessionStart hook (context before session) | 3 | Checks `SessionStart` event in hooks config |
| Additional hook diversity checks | 6 | Multiple event types, command vs prompt hooks |

### Layer 7: Personalization Quality (10 pts) — `setup/personalization.js`

| Check | Max | Detection |
|-------|-----|-----------|
| CLAUDE.md mentions user's profession/role | 4 | About Me not a placeholder |
| Skills match detected profession | 3 | Cross-reference skill content with role |
| Agent selection appropriate for use case | 3 | `.claude/agents/` relevance |

### Layers 8–17: Advanced Configuration Layers

These layers were added in v0.5.0–v0.9.0. Full check-level docs are in the npm package source. Point values below are from live scoring.

| # | Layer | Max Pts | File |
|---|-------|---------|------|
| 8 | MCP Security | 8 | `setup/mcp-security.js` |
| 9 | Config Hygiene | 7 | `setup/config-hygiene.js` |
| 10 | Plugin Coverage | 6 | `setup/plugins.js` |
| 11 | Settings Hierarchy | 12 | `setup/settings-hierarchy.js` |
| 12 | Permissions Audit | 12 | `setup/permissions-audit.js` |
| 13 | Sandbox Config | 8 | `setup/sandbox-config.js` |
| 14 | Model Config | 8 | `setup/model-config.js` |
| 15 | Environment Variables | 10 | `setup/env-vars.js` |
| 16 | MCP Server Health | 10 | `setup/mcp-health.js` |
| 17 | Attribution & Display | 6 | `setup/attribution-display.js` |

> **TODO:** Expand these to full check-level docs (same format as Layers 1-7 above). The local `dist/setup/` only contains layers 1-7 — layers 8-25 are in the npm-published package. To document them, pull from npm: `npm pack second-brain-health-check && tar xf *.tgz`.

### Layer 18: Agent Configuration Depth (8 pts) — `setup/agent-quality.js`

Evaluates custom agent definitions in `.claude/agents/`.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Agent definitions | 3 | 3+ agents with 70%+ frontmatter (3) | 3+ but <70% frontmatter (2) or 1-2 agents (1) | None (0) | Counts .md files, checks for YAML frontmatter |
| Tool restriction discipline | 3 | 50%+ agents have tools field (3) | 1+ (2) | None restrict tools (1) or no agents (0) | Checks `tools:` in frontmatter |
| Model and skill integration | 2 | 2+ advanced features (2) | 1 feature (1) | None (1) or no agents (0) | Checks for `model:`, `skills:`, `memory:` in frontmatter |

### Layer 19: Gitignore Hygiene (6 pts) — `setup/gitignore-hygiene.js`

Verifies sensitive local files are excluded from version control.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Local settings protection | 3 | Protected or patterns in place (3) | No patterns (2) | Tracked in git (0) | `git ls-files` on settings.local.json, CLAUDE.local.md |
| Environment file protection | 3 | Protected or patterns in place (3) | No patterns (1) | Tracked in git (0) | `git ls-files` on .env, .env.local, .env.production, .env.secret |

### Layer 20: Team Readiness (8 pts) — `setup/team-readiness.js`

Evaluates whether the workspace is configured for agent teams.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Teams feature enabled | 3 | CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 found (3) | — | Not found (1) | Checks settings env blocks and process.env |
| Agent definitions for teamwork | 3 | 3+ agents with 2+ having tool restrictions (3) | 2+ agents (2) or 1 (1) | None (0) | Counts .md files in .claude/agents/, checks frontmatter for `tools:` |
| Active team artifacts | 2 | Teams + tasks dirs present (2) | Partial (1) | None (1) | Checks ~/.claude/teams/ and ~/.claude/tasks/ directories |

### Layer 21: Rules System (6 pts) — `setup/rules-system.js`

Evaluates the modular rules system (.claude/rules/) for path-specific policy files.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Rules files present | 3 | 3+ rule files with content (3) | 1+ (2) or empty files (1) | No rules dir (1) | Counts .md/.txt files >=50 chars in .claude/rules/ and ~/.claude/rules/ |
| Rules scope diversity | 3 | 3+ scopes or 2+ with multi-level (3) | 2 scopes or multi-level (2) | Single scope (1) | Analyzes directory depth and project vs user level |

### Layer 22: Interaction Configuration (8 pts) — `setup/interaction-config.js`

Evaluates terminal customization, keybindings, output styles, and thinking mode settings.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Keybindings customization | 3 | 3+ keybindings (3) | 1+ (2) | File exists but empty (1) or no file (1) | Reads ~/.claude/keybindings.json |
| Output style and display | 3 | 3+ features configured (3) | 1+ (2) | None (1) | Checks outputStyle, spinnerVerbs, statusLine, custom output-styles dir |
| Thinking and effort config | 2 | Both or either configured (2) | — | Defaults only (1) | Checks alwaysThinkingEnabled, effortLevel in settings |

### Layer 23: Spec & Planning Artifacts (10 pts) — `setup/spec-planning.js`

Detects the "spec-first" workflow pattern: plans/, specs/, or planning/ directories with structured requirement files. Maps to the two-session "interview → spec → execute" pattern (highest-engagement trend across all platforms).

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Spec/planning directory | 4 | 5+ .md files (4) | 2+ files (3) or 1 file (2) | No directory (0) | Checks plans/, specs/, planning/, requirements/, docs/specs/, docs/plans/ |
| Structured requirement headings | 3 | 3+ files with headings (3) | 1+ (1) | None (0) | `/^#{1,3}\s.*(goal\|objective\|overview\|requirement\|acceptance\|problem\|solution\|spec\|feature)/im` |
| Recent planning activity | 3 | Updated ≤7 days (3) | ≤30 days (2) | Older (1) | `stat().mtimeMs` on most recently modified planning file |

### Layer 24: Knowledge Base Architecture (10 pts) — `setup/knowledge-base.js`

Evaluates whether pre-engineered domain context exists in .claude/docs/ or .claude/knowledge/ — reference files written FOR Claude, not for the user. Maps to "domain-specific plugin/skill bundles" trend.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Knowledge base directory | 4 | 10+ files (4) | 5+ (3) or 2+ (2) or 1+ (1) | No directory (0) | Scans .claude/docs/, .claude/knowledge/, .claude/context/, .claude/reference/ recursively |
| CLAUDE.md references knowledge files | 3 | Explicit path reference (3) | "Read when" pattern or file table (2) | CLAUDE.md exists but no ref (1) | Checks if knowledge dir path appears in CLAUDE.md content |
| Knowledge domain breadth | 3 | 5+ dirs or 15+ files (3) | 2+ dirs or 5+ files (2) | Small (1) | Recursive count with max depth 2 |

Also adds **Check 7: Session initialization hook (3 pts)** to Layer 6 (Hooks). Detects `SessionStart` event in hooks config — the primary signal for "context engineered before the session starts, not during."

Also adds **Check 8: Hierarchical context files (3 pts)** to Layer 1 (CLAUDE.md). Detects CLAUDE.md or TODO.md files in subdirectories beyond root — per-project context layering.

Also adds **Check 7: Non-coding domain coverage (4 pts)** to Layer 2 (Skills). Detects skills covering non-dev workflows: content, marketing, research, legal, operations, design.

### Layer 25: Context Pressure (10 pts) — `setup/context-pressure.js` — NEW in v0.8.0

Measures whether the brain is causing context bloat. Traffic light zones: GREEN (<30KB), YELLOW (30-75KB), RED (75KB+).

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| CLAUDE.md not bloated | 3 | <6000 chars (3) | 6000-10000 chars (2) | >10000 chars (1) | `stat(CLAUDE.md).size` |
| Knowledge files exist | 3 | .claude/docs/ or .claude/knowledge/ has files (3) | — | No knowledge dir (0) | Directory scan |
| Context surface area | 2 | <30KB total (2) | 30-75KB (1) | >75KB (0) | Sum all .claude/ text files |
| Progressive disclosure evidence | 2 | CLAUDE.md references external docs (2) | — | No references (0) | Regex for file paths, "Read when", doc table patterns |

### Layer 26: PRP / Implementation Blueprints (8 pts) — `setup/prp-files.js` — NEW in v0.13.0

Checks for Product Requirements Plan files — structured planning artifacts that front-load context before execution.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| PRP directory | 4 | 2+ .md files (4) | 1 file (2) | No directory (0) | Scans PRPs/, .claude/PRPs/, plans/, blueprints/ |
| Structured PRP content | 4 | 2+ files with structured headings (4) | 1 file (2) | No structured content (0) | `/^#{1,3}\s.*(goal|objective|requirement|acceptance|problem|solution|spec|feature)/im` |

### Layer 27: Examples Directory (6 pts) — `setup/examples-directory.js` — NEW in v0.13.0

Checks for examples/ directory with real content for AI reference.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Examples directory | 3 | 5+ files (3) | 1-4 files (2) | No directory (0) | `readdir('examples/')` |
| Real example content | 3 | 80%+ real content (3) | Some real (1) | All templates (0) | File size >200 bytes + no placeholder markers |

### Layer 28: Planning Documentation (4 pts) — `setup/planning-doc.js` — NEW in v0.13.0

Checks for PLANNING.md or architecture documentation.

| Check | Max | Pass | Fail | Detection |
|-------|-----|------|------|-----------|
| Planning document exists | 2 | Found and >100 chars (2) | Not found (0) | Checks PLANNING.md, ARCHITECTURE.md, docs/architecture.md, docs/PLANNING.md |
| CLAUDE.md references planning | 2 | Reference found (2) | No reference (0) | Path or keyword match in CLAUDE.md |

### Layer 29: Task Tracking (4 pts) — `setup/task-tracking.js` — NEW in v0.13.0

Checks for active task tracking files or directories.

| Check | Max | Pass | Fail | Detection |
|-------|-----|------|------|-----------|
| Task tracking exists | 2 | Found (2) | Not found (0) | Checks TASK.md, TODO.md, tasks/, .claude/tasks/ |
| CLAUDE.md references tasks | 2 | Reference found (2) | No reference (0) | Task/todo keyword + path match in CLAUDE.md |

### Layer 30: Validate Command (6 pts) — `setup/validate-command.js` — NEW in v0.13.0

Checks for a validation skill/command that enforces quality before shipping.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Validate command exists | 3 | Found (3) | — | Not found (0) | Checks .claude/commands/validate.md, skills with "validate"/"check" in name |
| Validate command quality | 3 | 200+ chars + quality keywords (3) | Exists but minimal (1) | Empty or missing (0) | Content length + test/lint/build/check keyword regex |

### Layer 31: Settings Local Overrides (4 pts) — `setup/settings-local.js` — NEW in v0.13.0

Checks for user-local settings that override project defaults.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Local settings file | 2 | Found (2) | — | Not found (0) | Checks .claude/settings.local.json, CLAUDE.local.md |
| Local settings content | 2 | Has overrides (2) | Exists but empty (1) | No file (0) | JSON parse for keys, or markdown length check |

### Layer 32: Feature Request Template (3 pts) — `setup/feature-request-template.js` — NEW in v0.13.0

Checks for structured intake templates for feature requests.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Feature request template | 3 | Found with structured sections (3) | Found but minimal (1) | Not found (0) | Checks .github/FEATURE_REQUEST.md, .github/ISSUE_TEMPLATE/, INITIAL.md |

---

## Setup Quality — 32 Layers (~284 pts)

---

## Usage Activity — 7 Layers (~125 pts)

### Layer 1: Session Activity (25 pts) — `usage/sessions.js`

| Check | Max | Detection |
|-------|-----|-----------|
| Session logs exist in `memory/episodic/sessions/` | 8 | Count files |
| Session dates span > 7 days | 8 | Parse dates from filenames |
| 3+ session entries | 5 | Count check |
| Most recent session within last 14 days | 4 | Date comparison |

### Layer 2: Pattern Growth (25 pts) — `usage/patterns.js`

| Check | Max | Detection |
|-------|-----|-----------|
| Pattern tracker has tracked candidates | 8 | Parse `_pattern-tracker.md` for count > 0 |
| At least 1 promoted pattern | 8 | Promoted patterns section check |
| Pattern files have real content | 5 | File size + non-template content |
| Confidence levels progressing (LOW/MEDIUM/HIGH) | 4 | Parse confidence levels |

> **Known issue:** Checks use hardcoded string matching for `_pattern-tracker.md` format. Custom file formats return 0 pts silently. See Engineering Debt section.

### Layer 3: Memory Evolution (20 pts) — `usage/memory-evolution.js`

| Check | Max | Detection |
|-------|-----|-----------|
| Memory files modified after initial creation | 8 | Compare mod dates to oldest file |
| MEMORY.md has > 10 lines of real content | 6 | Line count + content check |
| New files added to `memory/` after initial setup | 6 | Count files created after earliest |

### Layer 4: Review Loop Active (15 pts) — `usage/review-loop.js`

| Check | Max | Detection |
|-------|-----|-----------|
| Quality metrics has logged reviews | 6 | Parse for "Total Reviews" > 0 |
| Growth log has entries | 5 | Non-template content |
| Pattern confidence tracker has movement | 4 | Confidence change history |

### Layer 5: Compound Evidence (15 pts) — `usage/compound-evidence.js`

| Check | Max | Detection |
|-------|-----|-----------|
| Skills added/modified after initial setup | 5 | Skill file dates vs oldest |
| Hooks evolved post-setup | 5 | settings.json modification date |
| Alignment log or goal tracking has entries | 5 | Non-template data |

### Layer 6: Cross-References (15 pts) — `usage/cross-references.js`

Detects whether memory, skills, and knowledge files reference each other (compound knowledge graph).

### Layer 7: Workflow Maturity (10 pts) — `usage/workflow-maturity.js`

Measures workflow sophistication: invocation tracking, command definitions, and skill diversity.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Skill invocation evidence | 4 | 20+ log entries (4) | 5+ (3) or sparse (2) | No logs (0) | Reads skill-invocations.jsonl from memory/episodic/ or .claude/ |
| Command definitions | 3 | 3+ commands (3) | 1+ (2) | None (0) | Counts .md files in .claude/commands/ |
| Workflow diversity | 3 | 3+ categories (3) | 2 (2) | 1 or few (1) | Categorizes skill names: development, content, operations, research, workflow |

---

## AI Fluency — 6 Layers (~60 pts)

### Layer 1: Progressive Disclosure (10 pts) — `fluency/progressive-disclosure.js`

Measures whether CLAUDE.md is lean and delegates detail to external files rather than bloating inline.

| Check | Max | Detection |
|-------|-----|-----------|
| CLAUDE.md references external docs | 5 | "Read when", doc table patterns, file path references |
| Knowledge files exist to be referenced | 5 | `.claude/docs/` or `.claude/knowledge/` non-empty |

### Layer 2: Skill Orchestration (10 pts) — `fluency/skill-orchestration.js`

Measures whether skills are wired together (skills calling skills, chaining workflows).

| Check | Max | Detection |
|-------|-----|-----------|
| Skills reference other skills or agents | 5 | Slash command references in skill content |
| Workflow chaining patterns | 5 | Sequential skill calls, pipeline structures |

### Layer 3: Context-Aware Skills (10 pts) — `fluency/context-aware-skills.js`

Measures whether skills adapt to context (use conditions, branch on state, read from memory).

| Check | Max | Detection |
|-------|-----|-----------|
| Skills with conditional logic | 5 | `if`, `when`, `depending on` patterns |
| Skills reading from memory or state files | 5 | Memory file references in skill content |

### Layer 4: Reference Integrity (10 pts) — `fluency/reference-integrity.js`

Verifies that file paths in CLAUDE.md and skills resolve to real files on disk.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| CLAUDE.md references resolve | 5 | All resolve (5) | ≤3 broken (3) | >3 broken (1) or no CLAUDE.md (0) | Extracts file paths from backticks, tables, directives; checks `stat()` |
| Skill references resolve | 5 | All resolve (5) | ≤3 broken (3) | >3 broken (1) or no skills (2) | Uses strict patterns (only docs/memory/brain paths) to avoid code example false positives |

### Layer 5: Delegation Patterns (10 pts) — `fluency/delegation-patterns.js`

Measures multi-tier orchestration: skills delegating to agents, agents with scoped tools, intentional model routing.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Multi-tier orchestration | 4 | 3+ delegating files, 2+ delegation types (4) | 1+ (2) | None (0) | Detects Task tool usage, agent references, slash command chaining |
| Tool scoping discipline | 3 | 50%+ agents scope tools (3) | 1+ (2) | None (1) or no agents (0) | Checks `tools:` and `allowed-tools:` in agent frontmatter |
| Model routing | 3 | 2+ different models (3) | All same model (2) | No model selection (1) | Checks `model:` in frontmatter across all skills/agents/commands |

### Layer 6: Interview & Spec Patterns (10 pts) — `fluency/interview-patterns.js`

Detects the highest-signal fluency indicator: skills that gather requirements before executing, and workflows that generate spec files before execution sessions. Maps to the "interview first, spec file, clean session" pattern (2.18M views signal).

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Interactive requirement gathering | 5 | 3+ skills with AskUserQuestion/interview (5) | 1+ (3) | None (0) | Scans .claude/skills/ and .claude/commands/ for `AskUserQuestion`, interview patterns, requirement-gathering phrases |
| Spec-first workflow pattern | 5 | 2+ spec-gen skills + planning dir (5) | 1 spec-gen skill + dir (4) or skill only (3) or dir only (2) | None (0) | Detects spec/plan generation patterns in skill content + checks plans/, specs/, planning/ existence |

---

## Grade Scales

All grade functions use **percentage** (`points / maxPoints * 100`), not raw points.

### Setup Quality

```javascript
// types.js:getSetupGrade()
>= 85 → { grade: 'A', label: 'Production-ready' }
>= 70 → { grade: 'B', label: 'Good foundation' }
>= 50 → { grade: 'C', label: 'Basic setup' }
>= 30 → { grade: 'D', label: 'Minimal' }
<  30 → { grade: 'F', label: 'Barely configured' }
```

### Usage Activity

```javascript
// types.js:getUsageGrade()
>= 85 → { grade: 'Active',   label: 'Brain is compounding' }
>= 70 → { grade: 'Growing',  label: 'Good momentum' }
>= 50 → { grade: 'Starting', label: 'Early days' }
>= 30 → { grade: 'Dormant',  label: 'Not being used regularly' }
<  30 → { grade: 'Empty',    label: 'No usage activity detected' }
```

### AI Fluency

```javascript
// types.js:getFluencyGrade()
>= 85% → { grade: 'Expert',     label: 'Advanced AI collaboration' }
>= 70% → { grade: 'Proficient', label: 'Effective AI usage' }
>= 50% → { grade: 'Developing', label: 'Learning to leverage AI' }
>= 30% → { grade: 'Beginner',   label: 'Basic AI interaction' }
<  30% → { grade: 'Novice',     label: 'Not yet leveraging AI effectively' }
```

---

## Top Fixes Algorithm (`health-check.js:generateTopFixes`)

1. Collect all checks with `status !== 'pass'` from setup, usage, and fluency layers
2. Calculate raw `deficit = maxPoints - points` for each check
3. **Normalize** the deficit to the dimension's /100 scale: `normalizedDeficit = Math.round((rawDeficit / dimensionMaxPoints) * 100)`
4. Sort descending by normalized deficit (highest impact on the /100 score first)
5. Take top 5
6. Format as: `"TITLE (+N pts category)"` where N is the normalized deficit

---

## MCP Server (`index.js`)

### Tool 1: `check_health`

Input: `{ path?, language?, workspace_type?, use_case?, mode? }` — defaults to cwd, English, no context, full mode
- `language`: One of 14 supported languages (en, es, de, fr, pl, pt, ja, ko, zh, it, nl, ru, tr, ar). Appends translation instruction to output.
- `workspace_type`: solo | team | enterprise — adds scoring context notes
- `use_case`: development | content | operations | research | mixed — adds use case context
- `mode`: `full` (default, all 45 checks) | `quick` (detection only, ~100ms — returns brain maturity and what exists)

Output: Adaptive markdown report based on brain maturity. Full report includes CE pattern section, time estimates on fixes, and score-band CTA.

### Tool 2: `get_fix_suggestions`

Input: `{ path?, focus?, language? }` — `"auto"` picks weaker dimension
Output: Action plan for weakest layer in chosen dimension

### Tool 3: `generate_dashboard`

Input: `{ path?: string, output?: string }` — defaults to `health-check-report.html` in current directory
Output: Self-contained HTML dashboard with score visualizations, grade badges, and fix suggestions

### Tool 4: `generate_pdf`

Input: `{ path?: string, output?: string }` — defaults to `health-check-report.pdf` in current directory
Output: PDF report via headless Chrome/Chromium (requires Chrome installed)

---

## Git History Integration (designed, not yet implemented)

### Configuration

File: `.health-check.json` at project root

```json
{ "git": "off" }
```

| Value | Commands used | Data accessed | Default |
|-------|-------------|---------------|---------|
| `"off"` | None | Filesystem only | Yes |
| `"stats"` | `git rev-parse --git-dir`, `git log --format="COMMIT:%aI" --numstat -- CLAUDE.md .claude/ memory/` | File names + line counts, zero content | — |
| `"full"` | Above + `git log --diff-filter=A --format="%H" -- CLAUDE.md` + `git show <hash>:CLAUDE.md` | Above + CLAUDE.md content at first commit | — |

### Security: nothing leaves localhost

All git commands run locally. The MCP server has zero network imports (`fetch`, `http`, `https`). stdio transport only.

---

## Report Format (`report-formatter.js`)

v0.8.1 uses adaptive formatting based on brain maturity. All dimensions display as **normalized/100**.

### Full Report (structured+ brains, score 41+)

```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

SETUP QUALITY:    84/100 (B - Good foundation)
USAGE ACTIVITY:   89/100 (Active - Brain is compounding)
AI FLUENCY:       92/100 (Expert - Advanced AI collaboration)

[... dimension breakdowns ...]

----------------------------------------------------------------
CONTEXT ENGINEERING PATTERNS (7 patterns)
----------------------------------------------------------------

[pass] Progressive Disclosure       |||||||||||||.. 87%
[pass] Knowledge Files as RAM       ||||||||||||||. 93%
[warn] Hooks as Guardrails          |||||.......... 33%
...

----------------------------------------------------------------
TOP FIXES (highest impact)
----------------------------------------------------------------

1. TITLE (+N pts category, ~10 min)
   Description

================================================================
  2 points from Production-grade. Missing pattern: Hooks as Guardrails.
  https://www.iwoszapar.com/context-engineering
================================================================
```

### Time Estimates

Every fix includes `~N min` based on `FIX_TIME_ESTIMATES` mapping in report-formatter.js. Categories range from 3 min (model config, attribution) to 15 min (skills, hooks, agents, knowledge, orchestration).

Progress bar: `|` for filled, `.` for empty, 20 chars wide.
Status icons: `[pass]`, `[warn]`, `[fail]`.
