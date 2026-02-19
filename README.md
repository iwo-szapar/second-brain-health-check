# Second Brain Health Check

Context engineering quality scanner for Claude Code. Scores your workspace configuration across 37 check layers in 3 dimensions — then tells you exactly what to fix.

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

Three dimensions, ~454 points total (all normalized to /100 for display):

| Dimension | Raw Max | Layers | What It Checks |
|-----------|---------|--------|----------------|
| **Setup Quality** | ~269 pts | 24 layers | CLAUDE.md structure, skills, hooks, memory architecture, MCP security, permissions, sandbox, model config, team readiness, rules system, spec/planning artifacts, knowledge base |
| **Usage Activity** | ~125 pts | 7 layers | Session frequency, pattern growth, memory evolution, review loops, compound evidence, cross-references, workflow maturity |
| **AI Fluency** | ~60 pts | 6 layers | Progressive disclosure, skill orchestration, context-aware skills, reference integrity, delegation patterns, interview & spec patterns |

Returns a normalized score per dimension, a grade, and a prioritized fix list (top 5 fixes sorted by highest impact on the /100 score).

**Grading:**
- Setup Quality: A (85%+) / B (70%+) / C (50%+) / D (30%+) / F (<30%)
- Usage Activity: Active (85%+) / Growing (70%+) / Starting (50%+) / Dormant (30%+) / Empty (<30%)
- AI Fluency: Expert (85%+) / Proficient (70%+) / Developing (50%+) / Beginner (30%+) / Novice (<30%)

---

## What Gets Checked

The 24 setup layers cover:

| Layer | Points | Key Check |
|-------|--------|-----------|
| CLAUDE.md Foundation | 26 | Quick Start section, About Me, profession-specific rules, gotchas, length (2K–6K chars), freshness, hierarchical context files |
| Skills & Commands | 28 | 2+ skills, YAML frontmatter, profession-relevant naming, 200+ char instructions, non-coding domain coverage |
| Directory Structure | 15 | Organized folders, separation of concerns |
| Memory Architecture | 15 | Episodic/semantic separation, not a single blob |
| Brain Health Infra | 10 | Health monitoring setup |
| Hooks | 22 | PreToolUse/PostToolUse hooks, coverage, SessionStart initialization |
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
| Spec & Planning Artifacts | 10 | plans/specs/ directory, structured headings, recent activity |
| Knowledge Base Architecture | 10 | .claude/docs/.claude/knowledge/, cross-references in CLAUDE.md, domain breadth |

The 7 usage layers check: session logs, pattern files, memory file dates, review loop evidence, compound learning artifacts, cross-references between memory files, and workflow diversity across skill categories.

The 6 fluency layers check: progressive disclosure in CLAUDE.md, skill-to-agent delegation, context-aware skill design, file reference integrity (do paths in CLAUDE.md actually resolve?), multi-tier orchestration with model routing, and interview & spec patterns (AskUserQuestion usage, spec-first workflow).

---

## Example Report Output

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
  [warn] Profession-specific rules: 1 pattern (need 2+)
  [pass] Gotchas section
  ...

----------------------------------------------------------------
TOP FIXES (highest impact)
----------------------------------------------------------------

1. Add profession-specific rules to CLAUDE.md (+3 pts setup)
   Include 2+ domain patterns (MEDDPICC, sprint, SEO, KPI, etc.)

2. Add Codex compatibility layer (+2 pts setup)
   Create .codex/skills/ directory

...

================================================================
  Build a properly configured Second Brain:
  https://www.iwoszapar.com/second-brain-ai
================================================================
```

(This format is from the actual `report-formatter.js`. Scores are normalized to /100.)

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `check_health` | Full 37-layer health check across 3 dimensions. Supports 14 languages, workspace type (solo/team/enterprise), and use case context (development/content/operations/research). |
| `get_fix_suggestions` | Focus on weakest dimension, prioritized action plan |
| `generate_dashboard` | Self-contained HTML dashboard — dark mode, mobile-responsive, grade badges, layer breakdown |
| `generate_pdf` | PDF report via headless Chrome |

---

## CLI Usage

```bash
npx second-brain-health-check [path]           # Text report + open dashboard (default)
npx second-brain-health-check --no-open [path] # Text report only, skip browser
npx second-brain-health-check --pdf [path]     # PDF report via headless Chrome
npx second-brain-health-check --yes [path]     # Skip privacy consent (CI/automation)
npx second-brain-health-check --help           # Show usage
```

Path defaults to current directory.

**Privacy consent:** On first run, the CLI shows a privacy section and prompts for confirmation before reading any files. In a real terminal, this is an interactive arrow-key selector (← → to toggle, Enter to confirm). In non-interactive contexts (pipes, CI), it falls back to a plain `[Y/n]` readline prompt.

Use `--yes` to skip the prompt entirely — recommended when running from CI pipelines, MCP servers, or automation scripts.

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
