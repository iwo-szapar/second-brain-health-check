# Second Brain Health Check

**Context engineering quality scanner for Claude Code** — scores your CLAUDE.md, skills, hooks, and memory architecture against 7 CE patterns. Get your Brain Health Score in 60 seconds.

```bash
npm install -g second-brain-health-check
claude mcp add second-brain-health -- npx second-brain-health-check
```

Then from Claude Code:
```
Run health check on current project
```

---

## The Problem

Most Claude Code setups are broken in ways that aren't obvious:

- CLAUDE.md is 800 lines but Claude only reads the first 200
- Hooks exist but aren't deterministic — they fire sometimes
- Memory has no layers — everything is dumped in one file
- Sessions start from scratch because compound learning isn't happening
- AI fluency patterns are missing — no progressive disclosure, no skill orchestration

You feel like you're doing it right. You're not scoring it.

---

## What It Measures

Three dimensions, 245 points total:

| Dimension | Points | What It Checks |
|-----------|--------|----------------|
| **Setup Quality** | 100 | CLAUDE.md structure, skills, hooks, memory architecture |
| **Usage Activity** | 115 | Sessions, patterns, memory growth, compound evidence |
| **AI Fluency** | 30 | Progressive disclosure, skill orchestration, context-awareness |

Returns a score, grade (A–F), and prioritized fix list with exact point impact per fix.

---

## The 7 Context Engineering Patterns

This tool measures whether your setup implements these patterns:

| Pattern | What It Means | Measured By |
|---------|--------------|-------------|
| **Progressive Disclosure** | CLAUDE.md reveals context in layers, not all at once | Setup Quality |
| **Knowledge Files as RAM** | Structured memory files, not one blob | Setup Quality |
| **Hooks as Guardrails** | Deterministic shell commands, not suggestions | Setup Quality |
| **Three-Layer Memory** | Episodic / semantic / goals separation | Setup Quality |
| **Compound Learning Loop** | Each session teaches the next | Usage Activity |
| **Self-Correction Protocol** | Mistakes get logged, not just fixed | Usage Activity |
| **Context Surfaces** | Multiple `.md` files, not just CLAUDE.md | AI Fluency |

A score below 60% on any dimension means that pattern cluster is broken.

---

## What a Failing Brain Looks Like

```
Setup Quality:    41/100  ⚠️  Needs Work
Usage Activity:   28/115  ✗   Not Compounding
AI Fluency:        8/30   ✗   Basic

CLAUDE.md: 847 lines — too long, Claude truncates after ~200
Hooks: 0 active — no guardrails, no auto-tracking
Memory: 1 file (MEMORY.md) — no episodic/semantic split
Skills: 3 found — below threshold for compound workflows
Sessions: 0 logged — no compound learning evidence

Top fixes (by point impact):
  +18 pts  Add Quick Start section to CLAUDE.md (first 20 lines)
  +15 pts  Create episodic memory directory
  +12 pts  Add at least 1 PreToolUse hook
  +10 pts  Log sessions with /begin and /end
  + 8 pts  Split CLAUDE.md — move details to linked topic files
```

If this looks familiar, the tool will tell you exactly what to fix.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `check_health` | Full 3-dimension health check, text report |
| `get_fix_suggestions` | Weakest dimension focus, prioritized action plan |
| `generate_dashboard` | HTML dashboard — dark mode, mobile-responsive |

The dashboard (`health-check-report.html`) is shareable — grade badges, layer breakdown, top fixes with commands.

---

## Context Engineering vs. Prompt Engineering

Prompt engineering optimizes a single call. Context engineering optimizes the system the call happens inside.

| | Prompt Engineering | Context Engineering |
|--|---|---|
| **Unit** | Single prompt | Full session context |
| **Scope** | One response | Persistent across sessions |
| **Tool** | Better instructions | CLAUDE.md + hooks + memory architecture |
| **What breaks** | Bad phrasing | Bad system structure |
| **What this tool scores** | ✗ | ✓ |

You can write perfect prompts inside a broken context system and still get inconsistent results. This tool finds the structural issues.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [SCORING.md](./SCORING.md) | Every check, threshold, regex, point value |

---

## Security

- Enforces home-directory boundary — cannot scan outside `$HOME`
- No network calls, pure filesystem operations
- Resolves symlinks before path validation
- Escapes all user content in HTML output

---

## Build Your System

This tool scores what you've built. If your score reveals gaps, [Second Brain AI](https://www.iwoszapar.com/second-brain-ai) builds the full architecture with you — CLAUDE.md, hooks, skills, memory, and the CE patterns this tool measures.

---

Part of the [Context Engineering](https://www.iwoszapar.com/context-engineering) product suite at [iwoszapar.com](https://www.iwoszapar.com).
