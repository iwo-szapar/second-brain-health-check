# Second Brain Health Check — Scoring Reference

> Source of truth for all scoring logic. If code and this doc disagree, **the code wins** — update this doc.
>
> Last verified against code: 2026-02-19

**Related Documentation:**
- [README.md](./README.md) — Installation and usage guide

---

## Source Code Location

Only compiled JS is distributed:

```
dist/
  index.js                     # MCP server entry point (4 tools)
  cli.js                       # CLI entry point
  types.js                     # Grade functions + normalizeScore
  health-check.js              # Orchestrator
  report-formatter.js          # Markdown output
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
| Setup Quality | ~239 | Is the brain correctly configured? (static file analysis) |
| Usage Activity | ~125 | Is the brain being used? (file dates, session counts, pattern growth) |
| AI Fluency | ~50 | How effectively does the user work with AI? (delegation, context engineering, compounding) |

**Total: ~414 points** (exact total depends on dynamic maxPoints in some layers)

All dimensions are **normalized to /100** for display. The report and dashboard show `normalizedScore/100` for each dimension, calculated as `Math.round((points / maxPoints) * 100)`.

### Orchestrator (`health-check.js`)

Runs all setup layers in parallel via `Promise.all()`, then all usage layers in parallel, then all fluency layers in parallel. Sums points per dimension. Generates top 5 fixes sorted by normalized deficit (highest potential improvement first).

### Security Hardening

| Protection | Location | Detail |
|------------|----------|--------|
| Home directory boundary | `health-check.js:27` | `rootPath.startsWith(homeDir + '/')` |
| Directory-only input | `health-check.js:31` | `stat(rootPath).isDirectory()` |
| Path null-byte check | `index.js:22` | Zod `.refine(p => !p.includes('\0'))` |
| No shell execution | All files except hooks.js, gitignore-hygiene.js | hooks.js uses `execFileSync('bash', ...)`, gitignore-hygiene uses `execFileSync('git', ...)` |
| No network calls | All files | Zero `fetch`, `http`, `https` imports |
| File count limits | `memory.js:33`, `structure.js:43` | `entries.slice(0, MAX_ENTRIES)` caps at 500 |
| Depth limits | `memory.js:29`, `structure.js:35` | `depth > 3` or `depth > 4` recursion guards |

---

## Setup Quality — 22 Layers (~239 pts)

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

### Layer 3–17: (unchanged from v0.4.0)

See previous layers documentation — these remain unchanged.

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

---

## Usage Activity — 7 Layers (~125 pts)

### Layers 1–6: (unchanged from v0.4.0)

### Layer 7: Workflow Maturity (10 pts) — `usage/workflow-maturity.js`

Measures workflow sophistication: invocation tracking, command definitions, and skill diversity.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Skill invocation evidence | 4 | 20+ log entries (4) | 5+ (3) or sparse (2) | No logs (0) | Reads skill-invocations.jsonl from memory/episodic/ or .claude/ |
| Command definitions | 3 | 3+ commands (3) | 1+ (2) | None (0) | Counts .md files in .claude/commands/ |
| Workflow diversity | 3 | 3+ categories (3) | 2 (2) | 1 or few (1) | Categorizes skill names: development, content, operations, research, workflow |

---

## AI Fluency — 5 Layers (~50 pts)

### Layers 1–3: (unchanged from v0.4.0)

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

Input: `{ path?, language?, workspace_type?, use_case? }` — defaults to cwd, English, no context
- `language`: One of 14 supported languages (en, es, de, fr, pl, pt, ja, ko, zh, it, nl, ru, tr, ar). Appends translation instruction to output.
- `workspace_type`: solo | team | enterprise — adds scoring context notes
- `use_case`: development | content | operations | research | mixed — adds use case context

Output: Full markdown report with all three dimensions + top fixes + CTA link + context notes + language instruction

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

All dimensions display as **normalized/100** regardless of raw max points:

```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

SETUP QUALITY:    84/100 (B - Good foundation)
USAGE ACTIVITY:   89/100 (Active - Brain is compounding)
AI FLUENCY:       92/100 (Expert - Advanced AI collaboration)

----------------------------------------------------------------
SETUP QUALITY BREAKDOWN
----------------------------------------------------------------

CLAUDE.md Foundation          ||||||||||||||||....  22/23
  [pass] Quick Start with 5 rules
  [pass] About Me with role context
  ...

[... all layers ...]

----------------------------------------------------------------
TOP FIXES (highest impact)
----------------------------------------------------------------

1. TITLE (+N pts category)
   Description

================================================================
  Build a properly configured Second Brain:
  https://www.iwoszapar.com/second-brain-ai
================================================================
```

Progress bar: `|` for filled, `.` for empty, 20 chars wide.
Status icons: `[pass]`, `[warn]`, `[fail]`.
