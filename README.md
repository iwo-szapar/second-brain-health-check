# Second Brain Health Check

Context engineering quality scanner for Claude Code. Scores 38 check layers across CLAUDE.md, skills, hooks, memory, and planning artifacts — adaptive reports, CE pattern mapping, time estimates.

```bash
npm install -g second-brain-health-check
claude mcp add second-brain-health -- npx second-brain-health-check
```

Then from Claude Code:
```
Run health check on current project
```

---

## What It Measures

Three dimensions, ~424 points total (all normalized to /100 for display):

| Dimension | Raw Max | Layers | What It Checks |
|-----------|---------|--------|----------------|
| **Setup Quality** | ~249 pts | 25 layers | CLAUDE.md structure, skills, hooks, memory architecture, MCP security, permissions, sandbox, model config, team readiness, rules system, context pressure |
| **Usage Activity** | ~125 pts | 7 layers | Session frequency, pattern growth, memory evolution, review loops, compound evidence, cross-references, workflow maturity |
| **AI Fluency** | ~60 pts | 6 layers | Progressive disclosure, skill orchestration, context-aware skills, reference integrity, delegation patterns, interview patterns |

Returns a normalized score per dimension, a grade, a prioritized fix list with time estimates, and a CE pattern coverage map.

**Grading:**
- Setup Quality: A (85%+) / B (70%+) / C (50%+) / D (30%+) / F (<30%)
- Usage Activity: Active (85%+) / Growing (70%+) / Starting (50%+) / Dormant (30%+) / Empty (<30%)
- AI Fluency: Expert (85%+) / Proficient (70%+) / Developing (50%+) / Beginner (30%+) / Novice (<30%)

---

## v0.8.0 — Adaptive Reports

Reports now adapt to your brain's maturity level:

| Brain State | Report Style |
|-------------|-------------|
| **Empty** (no CLAUDE.md) | 3-step getting-started guide with time estimates. Not 37 failed checks. |
| **Minimal/Basic** (score 1-40) | Growth mode: celebrates what exists, shows top 3 fixes only. |
| **Structured+** (score 41+) | Full report with all dimensions, CE patterns, and complete breakdown. |

New in v0.8.0:
- **Brain state detection** — fast pre-scan (~100ms) classifies maturity before running checks
- **CE pattern mapping** — maps 38 layers to 7 Context Engineering patterns with percentage scores
- **Time estimates** — every fix shows `~N min` so you can plan your session
- **Score-band CTAs** — dynamic footer based on overall score
- **Context pressure check** — new 10-point layer detecting CLAUDE.md bloat and context surface area
- **Three-tier fix remediation** — dashboard fixes show summary + why + step-by-step guide
- **Quick mode** — `mode: 'quick'` for detection-only scan (~100ms)

---

## Context Engineering Patterns

v0.8.0 maps your 38 check layers to 7 CE patterns:

| Pattern | What It Measures |
|---------|-----------------|
| Progressive Disclosure | CLAUDE.md references external docs, knowledge files exist |
| Knowledge Files as RAM | Knowledge base architecture, directory structure |
| Hooks as Guardrails | PreToolUse/PostToolUse hooks, rules system |
| Three-Layer Memory | Memory architecture, session logs |
| Compound Learning | Review loops, compound evidence, workflow maturity, patterns |
| Self-Correction | Brain health infra, memory evolution, cross-references |
| Context Surfaces | MCP servers, plugins, interaction config, context pressure |

---

## What Gets Checked

The 25 setup layers cover:

| Layer | Points | Key Check |
|-------|--------|-----------|
| CLAUDE.md Foundation | 23 | Quick Start section, About Me, profession-specific rules, gotchas, length (2K–6K chars), freshness (14 days) |
| Skills & Commands | 24 | 2+ skills, YAML frontmatter, profession-relevant naming, 200+ char instructions |
| Directory Structure | 15 | Organized folders, separation of concerns |
| Memory Architecture | 15 | Episodic/semantic separation, not a single blob |
| Brain Health Infra | 10 | Health monitoring setup |
| Hooks | 19 | PreToolUse/PostToolUse hooks, coverage |
| Personalization | 10 | User-specific config |
| MCP Security | 8 | Server configuration safety |
| Config Hygiene | 7 | Clean settings, no stale config |
| Plugin Coverage | 6 | MCP server coverage |
| Settings Hierarchy | 12 | Project vs user vs global settings |
| Permissions Audit | 12 | Tool permissions configured |
| Sandbox Config | 8 | Sandbox boundaries set |
| Model Config | 8 | Model selection configured |
| Environment Variables | 10 | Env vars managed |
| MCP Server Health | 10 | MCP servers responding |
| Attribution & Display | 6 | Output styling, status line |
| Agent Config Depth | 8 | Custom agents with tool restrictions |
| Gitignore Hygiene | 6 | .env and local settings excluded from git |
| Team Readiness | 8 | Agent teams enabled, team artifacts |
| Rules System | 6 | .claude/rules/ with scoped rule files |
| Interaction Config | 8 | Keybindings, output style, thinking mode |
| Spec & Planning | 10 | Plans/specs directories, structured requirements |
| Knowledge Base | 10 | .claude/docs/ or .claude/knowledge/ with domain context |
| **Context Pressure** | **10** | **CLAUDE.md size, knowledge file distribution, total context surface, progressive disclosure** |

The 7 usage layers check: session logs, pattern files, memory file dates, review loop evidence, compound learning artifacts, cross-references between memory files, and workflow diversity across skill categories.

The 6 fluency layers check: progressive disclosure in CLAUDE.md, skill-to-agent delegation, context-aware skill design, file reference integrity (do paths in CLAUDE.md actually resolve?), multi-tier orchestration with model routing, and interview/spec-first patterns.

---

## Example Report Output

### Empty Brain
```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

STATUS: No Second Brain detected.

That is totally fine. Here is how to get started:

----------------------------------------------------------------
GETTING STARTED (3 steps, ~20 minutes)
----------------------------------------------------------------

STEP 1: Create CLAUDE.md (~5 min)
  Your AI's instruction manual. Start with:
  - Who you are and what you do
  - Your top 3-5 rules ("always do X", "never do Y")
  - Key tools and frameworks you use

STEP 2: Add skills (~10 min)
  ...

================================================================
  See what a properly configured Second Brain looks like:
  https://www.iwoszapar.com/context-engineering
================================================================
```

### Configured Brain
```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

SETUP QUALITY:    84/100 (B - Good foundation)
USAGE ACTIVITY:   89/100 (Active - Brain is compounding)
AI FLUENCY:       92/100 (Expert - Advanced AI collaboration)

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

1. Add profession-specific rules to CLAUDE.md (+3 pts setup, ~10 min)
   Include 2+ domain patterns (MEDDPICC, sprint, SEO, KPI, etc.)

================================================================
  2 points from Production-grade. Missing pattern: Hooks as Guardrails.
  https://www.iwoszapar.com/context-engineering
================================================================
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `check_health` | Full 38-layer health check across 3 dimensions. Supports 14 languages, workspace type (solo/team/enterprise), use case context, and mode (full/quick). Adaptive report format based on brain maturity. |
| `get_fix_suggestions` | Focus on weakest dimension, prioritized action plan with time estimates |
| `generate_dashboard` | Self-contained HTML dashboard — dark mode, mobile-responsive, grade badges, CE patterns, three-tier fix guides |
| `generate_pdf` | PDF report via headless Chrome |

---

## Security

- Home directory boundary — cannot scan outside `$HOME`
- No network calls — zero `fetch`, `http`, `https` imports
- stdio transport only
- Path null-byte check via Zod validation
- File count limits (500 max entries per directory scan)
- Recursion depth limits (3-4 levels)
- All user content escaped in HTML output

Full security details: [SCORING.md — Security Hardening](./SCORING.md#security-hardening)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [SCORING.md](./SCORING.md) | Every check, threshold, regex, point value — the source of truth |

---

## Context Engineering vs. Prompt Engineering

Prompt engineering optimizes a single LLM call. Context engineering optimizes the persistent system surrounding those calls — the files, hooks, memory, and skills that shape every session.

This tool scores the context engineering layer, not your prompts.

---

Part of the [Context Engineering](https://www.iwoszapar.com/context-engineering) product suite. If your score reveals gaps, [Second Brain AI](https://www.iwoszapar.com/second-brain-ai) builds the full architecture.
