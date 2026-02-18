# Second Brain Health Check

Score your AI workspace setup. Works with Claude Code, Codex, or any CLAUDE.md-based workflow.

```
SETUP QUALITY:    92/100 (A - Production-ready)
USAGE ACTIVITY:   101/115 (Active - Brain is compounding)
AI FLUENCY:       30/30 (Expert - Advanced AI collaboration)
```

## What It Checks

**Setup Quality** (100 pts) — CLAUDE.md structure, skills, hooks, memory architecture, directory organization, brain health infrastructure, personalization depth

**Usage Activity** (115 pts) — Session frequency, pattern recognition, memory evolution, review loops, compound evidence, cross-reference quality

**AI Fluency** (30 pts) — Progressive disclosure, skill orchestration, context-aware skills

Total: 245 points across 15+ individual checks with pass/warn/fail status.

## Quick Start

### CLI (no Claude Code needed)

```bash
npx second-brain-health-check /path/to/your/project
```

### MCP Server (inside Claude Code)

```bash
claude mcp add second-brain-health -- npx second-brain-health-check
```

Then ask Claude:

```
Run a health check on my project
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `check_health` | Full 3-dimension health check with text report |
| `get_fix_suggestions` | Prioritized action plan for weakest area |
| `generate_dashboard` | HTML dashboard with scores and grade badges |

## What You Need

A project directory with a `CLAUDE.md` file. The more context engineering you have (skills, hooks, memory, patterns), the higher your score.

No API key required. The health check runs entirely on your local filesystem — zero network calls, zero data collection.

## Scoring

Every check has defined thresholds. Full technical reference in [SCORING.md](./SCORING.md).

| Grade | Setup Score | Meaning |
|-------|-------------|---------|
| A | 85-100 | Production-ready |
| B | 70-84 | Good foundation |
| C | 50-69 | Basic setup |
| D | 30-49 | Minimal |
| F | 0-29 | Barely configured |

## Example Output

```
================================================================
  SECOND BRAIN HEALTH CHECK
================================================================

SETUP QUALITY:    72/100 (B - Solid foundation)
USAGE ACTIVITY:   45/115 (Growing - Building habits)
AI FLUENCY:       20/30 (Intermediate - Good foundations)

----------------------------------------------------------------
SETUP QUALITY BREAKDOWN
----------------------------------------------------------------

CLAUDE.md Quality              |||||||||||||||.....  15/20
  [pass] Quick Start section found
  [pass] Role/context section found
  [warn] 1 domain pattern(s) found — aim for 3+
  [fail] No gotchas/pitfalls section
  [pass] Project structure documentation found

...

----------------------------------------------------------------
TOP FIXES (highest impact)
----------------------------------------------------------------

1. MEMORY FILES EVOLVING (+8 pts usage)
   12 memory files but none modified after setup — brain is static

2. AUTO MEMORY POPULATED (+6 pts usage)
   MEMORY.md has only 2 line(s) — barely populated

3. INDEX FILES FOR NAVIGATION (+5 pts setup)
   No index files found — add index.md files to help the agent navigate
================================================================
```

## Build Your Own Second Brain

This tool checks the quality of an AI Second Brain — a structured knowledge system that makes Claude Code (or any AI assistant) dramatically more effective.

Get a fully configured Second Brain setup at [iwoszapar.com/second-brain-ai](https://www.iwoszapar.com/second-brain-ai).

## Security

- Runs only on your local filesystem
- Enforces home-directory boundary (cannot scan outside `$HOME`)
- Resolves symlinks before path validation
- No network calls, no telemetry, no data collection
- Escapes all user content in HTML dashboard output

## License

MIT
