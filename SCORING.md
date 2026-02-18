# Second Brain Health Check — Scoring Reference

> Source of truth for all scoring logic. If code and this doc disagree, **the code wins** — update this doc.
>
> Last verified against code: 2026-02-18

**Related Documentation:**
- [README.md](./README.md) — Installation and usage guide

---

## Source Code Location

Only compiled JS is distributed:

```
dist/
  index.js                     # MCP server entry point (3 tools)
  cli.js                       # CLI entry point
  types.js                     # Grade functions
  health-check.js              # Orchestrator
  report-formatter.js          # Markdown output
  setup/
    claude-md.js               # Layer 1: CLAUDE.md (20 pts)
    skills.js                  # Layer 2: Skills (20 pts)
    structure.js               # Layer 3: Structure (15 pts)
    memory.js                  # Layer 4: Memory (15 pts)
    brain-health.js            # Layer 5: Brain Health Infra (10 pts)
    hooks.js                   # Layer 6: Hooks (10 pts)
    personalization.js         # Layer 7: Personalization (10 pts)
  usage/
    sessions.js                # Layer 1: Sessions (25 pts)
    patterns.js                # Layer 2: Patterns (25 pts)
    memory-evolution.js        # Layer 3: Memory Evolution (20 pts)
    review-loop.js             # Layer 4: Review Loop (15 pts)
    compound-evidence.js       # Layer 5: Compound Evidence (15 pts)
    cross-references.js        # Layer 6: Cross-References (15 pts)
  fluency/
    progressive-disclosure.js  # Layer 1: Progressive Disclosure (10 pts)
    skill-orchestration.js     # Layer 2: Skill Orchestration (10 pts)
    context-aware-skills.js    # Layer 3: Context-Aware Skills (10 pts)
  dashboard/
    generate.js                # HTML dashboard generator
```

---

## Architecture

### Three Dimensions

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| Setup Quality | 100 | Is the brain correctly configured? (static file analysis) |
| Usage Activity | 115 | Is the brain being used? (file dates, session counts, pattern growth) |
| AI Fluency | 30 | How effectively does the user work with AI? (delegation, context engineering, compounding) |

**Total: 245 points**

### Orchestrator (`health-check.js`)

Runs all setup layers in parallel via `Promise.all()`, then all usage layers in parallel, then all fluency layers in parallel. Sums points per dimension. Generates top 5 fixes sorted by point deficit (highest potential improvement first).

### Security Hardening

| Protection | Location | Detail |
|------------|----------|--------|
| Home directory boundary | `health-check.js:27` | `rootPath.startsWith(homeDir + '/')` |
| Directory-only input | `health-check.js:31` | `stat(rootPath).isDirectory()` |
| Path null-byte check | `index.js:22` | Zod `.refine(p => !p.includes('\0'))` |
| No shell execution | All files | No `exec`, `spawn`, `fork` anywhere |
| No network calls | All files | Zero `fetch`, `http`, `https` imports |
| File count limits | `memory.js:33`, `structure.js:43` | `entries.slice(0, MAX_ENTRIES)` caps at 500 |
| Depth limits | `memory.js:29`, `structure.js:35` | `depth > 3` or `depth > 4` recursion guards |

---

## Setup Quality — 7 Layers (100 pts)

### Layer 1: CLAUDE.md Foundation (20 pts) — `setup/claude-md.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Quick Start with numbered rules | 5 | Has heading + 3+ numbered items | Has heading, <3 items (2) | No heading (0) | `/^#{1,3}\s.*quick\s*start/im` + `/^\d+\.\s/gm` |
| About Me with role context | 3 | Section found (3) | — | Not found (0) | `/^#{1,3}\s.*(about\s*me|who\s*(am\s*i|i\s*am)|role|context)/im` |
| Profession-specific rules | 5 | 2+ domain patterns (5) | 1 pattern (2) | 0 patterns (0) | 13 regex patterns for MEDDPICC, sprint, SEO, billable, KPI, HIPAA, litigation, TypeScript, etc. |
| Gotchas section | 3 | Heading found (3) | Has never/always rules but no heading (1) | Neither (0) | `/^#{1,3}\s.*(gotcha|pitfall|avoid|mistake|warning)/im` |
| Project structure with folder tree | 2 | Tree chars or file path table found (2) | — | Not found (0) | `[├└│─]` in code blocks, or markdown tables with `src/\|lib/\|api/` paths, or 3+ indented file paths |
| Appropriate length (2K-6K chars) | 2 | In range (2) | Outside range (1) | — | `content.length` |

### Layer 2: Skills & Commands (20 pts) — `setup/skills.js`

Scans both `.claude/skills/` and `.codex/skills/`. Uses `gray-matter` to parse YAML frontmatter.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Claude Code skills (2+ required) | 6 | 2+ skills (6) | 1 skill (3) | 0 (0) | Count dirs with SKILL.md + flat .md files |
| Codex compatibility | 2 | Has .codex/skills/ (2) | — | None (0) | Directory scan |
| Valid YAML frontmatter | 4 | 80%+ have frontmatter (4) | 50%+ (2) | <50% (0) | `matter(content)` — checks `Object.keys(parsed.data).length > 0` |
| Profession-relevant skills | 4 | 80%+ non-generic (4) | 50%+ (2) | <50% (0) | Filters against: test, hello, example, demo, sample, template |
| Clear instructions (200+ chars) | 4 | 80%+ have 200+ chars (4) | 50%+ (2) | <50% (0) | `parsed.content.trim().length >= 200` |

### Layer 3: Project Structure (15 pts) — `setup/structure.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Semantic directory structure | 5 | 3+ found (5) | 1+ (2) | 0 (0) | Checks 17 names: memory, experiences, brain-health, clients, content, projects, research, templates, workflows, pipeline, growth, product, decisions, patterns, docs, agent_docs, imports |
| Index files for navigation | 5 | 3+ found (5) | 1+ (2) | 0 (0) | Recursive scan (depth 3) for `_index.md` or `index.md` (case-insensitive) |
| Documented tree matches reality | 5 | 80%+ dirs exist (5) | 50%+ (3) | <50% (1) | Extracts dir names from `[├└│─]\s*([a-zA-Z_-]+)/` in CLAUDE.md, verifies on disk |

### Layer 4: Memory Architecture (15 pts) — `setup/memory.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Memory dir with subdirectories | 4 | 2+ subdirs (4) | Dir exists, <2 subdirs (2) | No dir (0) | `readdir(memory/)` |
| Patterns directory | 3 | Found (3) | — | Not found (0) | Checks: `memory/patterns/`, `memory/semantic/patterns/` |
| Style/voice files populated | 4 | 2+ populated (4) | 1 (2) | 0 (0) | Files in `memory/style-voice/`, `memory/personal/`, `memory/company/` with size > 100 bytes |
| Examples and workflow content | 4 | 3+ files (4) | 1+ (2) | 0 (0) | Counts .md files recursively in: `memory/examples/`, `memory/workflows/`, `experiences/`, `.claude/skills/`, `.claude/commands/` |

### Layer 5: Brain Health Infrastructure (10 pts) — `setup/brain-health.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Brain health directory | 4 | Found (4) | — | Not found (0) | `brain-health/` or fallback `memory/semantic/patterns/`, `memory/patterns/` |
| Tracking files present | 3 | 2+ found (3) | 1 (1) | 0 (0) | Checks: growth-log.md, quality-metrics.md, pattern-confidence.md in brain-health/ or alternative locations |
| Getting started guide | 3 | Found (3) | — | Not found (0) | Checks: ONBOARDING_SUMMARY.md, README.md, GETTING_STARTED.md, agent_docs/README.md |

### Layer 6: Automation & Hooks (10 pts) — `setup/hooks.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Settings with hooks configured | 4 | 3+ lifecycle events (4) | 2 events (3) or 1 event (2) or settings exists no hooks (1) | No settings (0) | `Object.keys(hooks).length` — counts distinct events (SessionStart, PreToolUse, PostToolUse, etc.) and total hooks |
| Tool lifecycle hooks | 3 | Has PreToolUse or PostToolUse (3) | Has other hooks (1) | None (0) | `hookEvents.some(e => e === 'PreToolUse' \|\| e === 'PostToolUse')` |
| Hook scripts valid | 3 | All executable (3) or inline hooks (3) | Some executable (1) | None executable (0) | Extracts `.sh/.py/.js/.ts` paths from hook commands, checks `access(path, X_OK)` |

### Layer 7: Personalization Quality (10 pts) — `setup/personalization.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| CLAUDE.md mentions specific role | 4 | Real About Me >50 chars, no placeholders (4) | Thin About Me (2) | Placeholders detected (0) | Checks for `{{PLACEHOLDER}}`, `[your `, `[insert `, `TODO`, `REPLACE_ME` |
| Skills match profession | 3 | 2+ non-generic (3) | 1 (1) | 0 or all generic (0) | Filters skill names against: test, example, demo, hello, sample, template, skill-1, skill-2 |
| Agent configuration | 3 | 2+ agents (3) | 1 (1) | 0 (0) | Counts `.md` files in `.claude/agents/` |

---

## Usage Activity — 6 Layers (115 pts)

### Layer 1: Session Activity (25 pts) — `usage/sessions.js`

Scans: `memory/episodic/sessions/`, `memory/episodic/`, `experiences/`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Session logs exist | 8 | 5+ files (8) | 3+ (6) | 1+ (3) or 0 (0) | Count .md files in session dirs |
| Activity spans multiple days | 8 | 14+ days (8) | 7+ (5) | 1+ (2) or 0 (0) | Parse `YYYY-MM-DD` from filenames, fall back to `stat.mtime` |
| Minimum session count | 5 | 5+ (5) | 3+ (3) | 1+ (1) or 0 (0) | Count check |
| Recent activity | 4 | Within 7 days (4) | Within 14 days (2) | Older (0) | `Date.now() - mostRecent` |

### Layer 2: Pattern Growth (25 pts) — `usage/patterns.js`

Reads `_pattern-tracker.md` from: `memory/semantic/patterns/`, `memory/patterns/`, `brain-health/`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Pattern candidates tracked | 8 | 3+ (8) | 2 (6) | 1 (3) or 0 (0) | Counts `**Count**: N` entries where N > 0 |
| Promoted patterns | 8 | 3+ (8) | 2 (6) | 1 (3) or 0 (0) | Parses promoted patterns table, falls back to counting pattern files >100 bytes |
| Pattern files with content | 5 | 3+ (5) | 1+ (2) | 0 (0) | Counts non-`_` prefixed .md files >100 bytes in pattern dirs |
| Confidence progression | 4 | Multiple levels (4) | Tracker exists (1) | No tracker (0) | Checks for HIGH+MEDIUM or MEDIUM+LOW in tracker content |

### Layer 3: Memory Evolution (20 pts) — `usage/memory-evolution.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Memory files evolving | 8 | 30%+ modified post-setup (8) | Any modified (4) | None (0) | Compares `stat.mtimeMs` to oldest file birthtime + 1 day buffer |
| Auto memory populated | 6 | 10+ lines (6) | 3+ (3) | <3 (0) | Reads MEMORY.md from: `memory/`, project root, or `~/.claude/projects/<encoded-path>/memory/` |
| Memory growth | 6 | 10+ total files (6) | 5+ (3) | 1+ (1) or 0 (0) | Recursive count of .md files in `memory/` |

### Layer 4: Review Loop (15 pts) — `usage/review-loop.js`

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Quality tracking active | 6 | Has dated reviews (6) | File exists, empty (2) | No file (0) | Reads `brain-health/quality-metrics.md` or `memory/quality-metrics.md`, checks for dates + non-empty markers |
| Growth log populated | 5 | Has entries (5) | File exists, empty (1) | No file (0) | Same dated-entry check |
| Pattern confidence tracking | 4 | Confidence moving (4) | Tracker exists (1) | No tracker (0) | Checks for MEDIUM/HIGH keywords + non-zero pattern count |

### Layer 5: Compound Evidence (15 pts) — `usage/compound-evidence.js`

Uses setup cutoff = oldest file birthtime + 2 days.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Skills evolved post-setup | 5 | 2+ modified (5) | 1 (2) | 0 (0) | `stat.mtimeMs > setupCutoff` on skill dirs |
| Hooks evolved post-setup | 5 | Settings or hook scripts modified (5) | — | Not modified (0) | `stat.mtimeMs` on settings.json + hook dir files |
| Goal or alignment tracking | 5 | Has dated entries (5) | — | No entries (0) | Reads: `memory/alignment-log.md`, `memory/goals/current.md`, `memory/personal/goals.md` |

### Layer 6: Cross-Reference Quality (15 pts) — `usage/cross-references.js`

Auto-detects "brain directories" from three sources:
1. **Always included:** `.claude/`, `.codex/`
2. **Known semantic dirs that exist on disk:** 30+ names (memory, knowledge, brain, notes, vault, journal, reference, docs, patterns, etc.)
3. **CLAUDE.md path references:** Parses `dir/subpath` patterns, verifies dir exists, excludes code dirs (src, lib, api, dist, etc.)

Reference classification:

| Level | Score | Detection | Example |
|-------|-------|-----------|---------|
| Strong | Counted | Explicit directive (Read/See/Check/Load) before path, OR path points into a detected brain dir | `See memory/patterns/api.md`, `docs/SETUP.md` |
| Medium | Counted | Markdown link `[text](path)`, or "Related:/See also:" context | `[setup guide](docs/README.md)` |
| Weak | Ignored | Bare file path mention outside brain dirs | `lib/email/templates.ts` |

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Brain directories detected | 2 | 3+ dirs (2) | <3 (1) | 0 (0) | Union of always + semantic + CLAUDE.md-parsed dirs |
| Files with cross-references | 5 | 20%+ of files have refs (5) | Any (2) | None (0) | Scans all .md files in brain dirs for paths matching `brainDir/...` |
| Strong cross-references | 5 | 5+ strong (5) | 2+ (3) | 1 (1) or 0 (0) | Counts strong + medium refs separately from weak |
| Connected knowledge graph | 3 | 3+ files linking (3) | 2 files (1) | Only 1 or 0 (0) | Multiple files must have refs (not just CLAUDE.md linking out) |

---

## AI Fluency — 3 Layers (30 pts)

### Layer 1: Progressive Disclosure (10 pts) — `fluency/progressive-disclosure.js`

Measures whether CLAUDE.md acts as a routing layer that points to external docs rather than containing everything inline.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| External doc references | 10 | 5+ unique refs (10) | 2+ (5) | 1 (2) or 0 (0) | Counts unique file paths referenced from CLAUDE.md that point to actual files on disk |

### Layer 2: Skill Orchestration (10 pts) — `fluency/skill-orchestration.js`

Measures whether skills use multiple tool types (MCP, delegation, Bash, etc.) rather than being simple text prompts.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Multi-tool skill orchestration | 10 | 80%+ skills use multiple tools (10) | 50%+ (5) | <50% (0) | Parses skill content for tool patterns: `mcp__`, `Task`, `Skill`, `Bash`, delegation keywords |

### Layer 3: Context-Aware Skills (10 pts) — `fluency/context-aware-skills.js`

Measures whether skills reference knowledge directories (memory/, docs/, patterns/) to pull context.

| Check | Max | Pass | Warn | Fail | Detection |
|-------|-----|------|------|------|-----------|
| Skills reference knowledge dirs | 10 | 50%+ skills reference dirs (10) | 25%+ (5) | <25% (0) | Counts skills containing paths to detected brain directories |

---

## Grade Scales

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
// types.js:getFluencyGrade() — uses percentage (points/maxPoints * 100)
>= 80% → { grade: 'Expert',     label: 'Advanced AI collaboration' }
>= 60% → { grade: 'Proficient', label: 'Effective AI usage' }
>= 40% → { grade: 'Developing', label: 'Learning to leverage AI' }
>= 20% → { grade: 'Beginner',   label: 'Basic AI interaction' }
<  20% → { grade: 'Novice',     label: 'Not yet leveraging AI effectively' }
```

---

## Top Fixes Algorithm (`health-check.js:generateTopFixes`)

1. Collect all checks with `status !== 'pass'` from setup, usage, and fluency layers
2. Calculate `deficit = maxPoints - points` for each
3. Sort descending by deficit (highest potential improvement first)
4. Take top 5
5. Format as: `"TITLE (+N pts category)"`

---

## MCP Server (`index.js`)

### Tool 1: `check_health`

Input: `{ path?: string }` — defaults to `process.cwd()`
Output: Full markdown report with all three dimensions + top fixes + CTA link

### Tool 2: `get_fix_suggestions`

Input: `{ path?: string, focus?: "setup" | "usage" | "fluency" | "auto" }` — `"auto"` picks weaker dimension
Output: Action plan for weakest layer in chosen dimension

### Tool 3: `generate_dashboard`

Input: `{ path?: string, output?: string }` — defaults to `health-check-report.html` in current directory
Output: Self-contained HTML dashboard with score visualizations, grade badges, and fix suggestions

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

```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

SETUP QUALITY:    82/100 (B - Good foundation)
USAGE ACTIVITY:   67/115 (Starting - early days)
AI FLUENCY:       20/30 (Proficient - Effective AI usage)

----------------------------------------------------------------
SETUP QUALITY BREAKDOWN
----------------------------------------------------------------

CLAUDE.md Foundation          ||||||||||||||||....  16/20
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
