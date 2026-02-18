# Second Brain Health Check

Find out if your Claude Code workspace is actually compounding — or just collecting files.

```
SETUP QUALITY:    92/100  (A - Production-ready)
USAGE ACTIVITY:  101/115  (Active - Brain is compounding)
AI FLUENCY:       30/30   (Expert - Advanced AI collaboration)
```

245 points. 15+ individual checks. Brutalist HTML dashboard included.

---

## Install as MCP Server (recommended)

The primary use case is inside Claude Code, so the health check runs in context and Claude can act on the results immediately.

```bash
claude mcp add second-brain-health -- npx second-brain-health-check
```

Then ask Claude:

```
Run a health check on my project
```

Claude runs the check, reads the output, and can start fixing the gaps in the same session.

### MCP Tools

| Tool | Description |
|------|-------------|
| `check_health` | Full 3-dimension health check with text report |
| `get_fix_suggestions` | Prioritized action plan for your weakest area |
| `generate_dashboard` | Self-contained HTML dashboard with scores and grade badges |
| `generate_pdf` | PDF report via headless Chrome (requires Chrome/Chromium) |

---

## CLI (no Claude Code needed)

```bash
npx second-brain-health-check /path/to/your/project
npx second-brain-health-check --pdf /path/to/your/project
```

Outputs a text report to stdout. Add `--pdf` to generate a PDF report alongside it.

---

## What It Checks

**Setup Quality** (100 pts) — Is your brain correctly configured?

CLAUDE.md structure and length, skills with valid frontmatter, hooks and lifecycle events, memory architecture, directory organization, brain health infrastructure, personalization depth.

**Usage Activity** (115 pts) — Is your brain actually being used?

Session frequency and recency, pattern recognition and promotion, memory evolution over time, review loops, compound evidence that the system is improving, cross-reference quality across knowledge files.

**AI Fluency** (30 pts) — How effectively are you working with AI?

Progressive disclosure (CLAUDE.md as routing layer, not a wall of text), skill orchestration with multiple tool types, context-aware skills that pull from knowledge directories.

---

## What You Need

A project directory with a `CLAUDE.md` file. The more context engineering you have — skills, hooks, memory, patterns — the higher your score.

No API key. No account. Runs entirely on your local filesystem with zero network calls.

---

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

CLAUDE.md Foundation           ||||||||||||||||....  16/20
  [pass] Quick Start with numbered rules
  [pass] About Me with role context
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

The HTML dashboard renders the same data with score visualizations and grade badges in a brutalist monospace design — same aesthetic as the PDF report.

---

## Scoring

Full technical reference in [SCORING.md](./SCORING.md).

| Grade | Setup Score | Meaning |
|-------|-------------|---------|
| A | 85–100 | Production-ready |
| B | 70–84 | Good foundation |
| C | 50–69 | Basic setup |
| D | 30–49 | Minimal |
| F | 0–29 | Barely configured |

Usage Activity and AI Fluency use their own grade scales — detailed in SCORING.md.

---

## From a Diagnostic to a Working System

This health check tells you what's missing. The [AI Second Brain](https://www.iwoszapar.com/second-brain-ai) gives you the system itself — pre-configured repository, skills, hooks, memory structure, and a remote Guide MCP with personalized recommendations.

Three packages: DIY ($237), Kickstart ($597), Done-With-You ($1,797).

If your score is low and you want to skip the trial-and-error, that's what the paid product is for.

---

## Security

- Runs only on your local filesystem
- Enforces home-directory boundary (cannot scan outside `$HOME`)
- Resolves symlinks before path validation
- No network calls, no telemetry, no data collection
- Escapes all user content in HTML output

## License

MIT
