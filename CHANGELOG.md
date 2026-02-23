# Changelog

All notable changes to the Second Brain Health Check MCP are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.13.0] - 2026-02-23

### Added
- 7 new Setup Quality layers (+35 max points, 45 total layers, ~459 max points): PRP Files, Examples Directory, Planning Doc, Task Tracking, Validate Command, Settings Local, Feature Request Template
- `schema_version: 1` in `.health-check.json` state file for future migration safety
- `setup` command — interactive onboarding with ASCII banner, arrow-key selectors, profile questions (multi-select goals), and SBF token configuration

### Changed
- `Promise.all` → `Promise.allSettled` — failed layers return 0 points gracefully instead of crashing the scan
- Layer count updated from 38 to 45 in all tooling descriptions and README
- Max points updated from ~424 to ~459

### Fixed
- Double-execution guard in setup CLI (`import.meta.url` check)
- Arrow-key multi-select for goal priorities (was single-select)

### Docs
- README: added `setup` command to Quick Start, new CLI Commands table, removed stale v0.9.x highlights

## [0.9.3] - 2026-02-22

### Added
- Semantic color for dashboard pass/warn/fail states — forest green (#1a7a3a), dark goldenrod (#b08800), deep red (#cf222e)
- Status tally strip below score panel — check distribution with colored stacked bar
- Dashboard screenshots in README (score panel, CE patterns, setup quality)

### Changed
- Status dots, score bars, grade badges, check mini-dots, radar chart polygon, and CE pattern bars use semantic color
- All structural elements (borders, backgrounds, typography) remain pure B&W

## [0.9.2] - 2026-02-21

### Fixed
- Config line count off by 3 — `split('\n').length` counted trailing newline as extra line per file

## [0.9.1] - 2026-02-21

### Fixed
- Index file counter bailed at 500 entries — raised to 5000. Large repos missed most INDEX.md files.
- Knowledge base "topic areas" inflated — counted all nested subdirs instead of immediate children only

## [0.9.0] - 2026-02-21

### Changed
- Complete dashboard redesign: Refined Brutalism (DM Sans + Space Mono, pure B&W, 4px borders, zero radius)
- Dimension sections replaced with terminal-style compact rows — click to expand checks
- Removed editorial light theme, "What is a Second Brain?" block, "How to read this report" block

### Added
- WCAG AA contrast compliance (#999 → #767676, 4.5:1 ratio)
- Keyboard navigation on expandable rows (role="button", tabindex, aria-expanded, focus-visible)
- Responsive radar chart (width:100%;max-width:480px)
- Aria-labels on status dots for screen readers
- 44px minimum touch targets on terminal rows

## [0.8.6] - 2026-02-21

### Fixed
- Radar chart left-side label clipping (negative viewBox offset)
- npm publish OTP error with granular token (removed --provenance)
- CI test glob quoting for Linux shell

### Added
- Light theme dashboard (v0.8.5)
- npm publish GitHub Actions workflow

## [0.8.3] - 2026-02-19

### Added
- State persistence (`.health-check.json`) — tracks last 20 runs for delta comparison
- Delta display in reports — shows "+N% since last scan" on repeat runs
- Brain manifest YAML output (`mode: 'manifest'`) — machine-readable report for CI/other tools
- CE pattern radar chart in dashboard — SVG visualization of 7 pattern scores
- Buyer CTA suppression in dashboard — shows "BASELINE CAPTURED" when `GUIDE_TOKEN` is set
- CHANGELOG.md included in npm package

## [0.8.2] - 2026-02-19

### Fixed
- Version strings consistently reference v0.8.1+ across all docs and source files

## [0.8.1] - 2026-02-19

### Changed
- Updated README.md and SCORING.md documentation for v0.8.0 features
- Synced standalone GitHub repo with monorepo

## [0.8.0] - 2026-02-19

### Added
- Brain state detection (`detectBrainState()`) — fast pre-scan classifies maturity (empty/minimal/basic/structured/configured)
- Adaptive report formatting — empty brains get 3-step guide, minimal get growth mode, structured+ get full report
- CE pattern mapping — maps 38 check layers to 7 Context Engineering patterns with percentages
- Time estimates on all fix suggestions (~N min)
- Score-band CTAs — dynamic footer based on overall score percentage
- Context pressure check — new 10-point setup layer (CLAUDE.md bloat, knowledge files, context surface area)
- Three-tier fix remediation in dashboard (summary + why + step-by-step guide)
- Quick mode (`mode: 'quick'`) for detection-only scan (~100ms)

## [0.7.4] - 2026-02-19

### Fixed
- MCP stdio routing — route to index.js instead of CLI entry point

## [0.7.3] - 2026-02-19

### Fixed
- CLI privacy consent always shown — removed isTTY gate that skipped prompt in npx context

## [0.7.0] - 2026-02-19

### Added
- 6 new check layers from trends research
- Spec & Planning Artifacts layer (10 pts)
- Knowledge Base Architecture layer (10 pts)
- Interview & Spec Patterns fluency layer (10 pts)

## [0.6.0] - 2026-02-18

### Added
- Multi-language support (14 languages)
- Workspace type context (solo/team/enterprise)
- Use case context (development/content/operations/research/mixed)
- Team readiness, rules system, and interaction config layers

## [0.5.0] - 2026-02-18

### Added
- 7 new check layers total
- Team Readiness layer
- Rules System layer
- Interaction Configuration layer

## [0.4.0] - 2026-02-17

### Added
- Agent Configuration Depth layer
- Gitignore Hygiene layer
- Reference Integrity fluency layer
- Delegation Patterns fluency layer
- Dashboard storytelling and guided remediation
- 7 new setup check layers plus enhanced hooks

### Fixed
- 13 false-pass patterns eliminated
- Scan user-level MCP configs

## [0.3.1] - 2026-02-17

### Added
- PDF generation tool (`generate_pdf`)
- Normalized scoring (/100)
- 5 new checks
- CLI `--help` and `--dashboard` flags
- Brutalist dashboard design matching PDF aesthetic

### Fixed
- Dashboard uses normalized scores consistently across all dimensions
- Score-aware CTAs

## [0.3.0] - 2026-02-16

### Added
- HTML dashboard generator (`generate_dashboard`)
- Dark mode dashboard with score visualizations

## [0.2.0] - 2026-02-16

### Added
- Usage Activity dimension (7 layers)
- AI Fluency dimension (initial layers)
- Fix suggestions tool (`get_fix_suggestions`)

## [0.1.0] - 2026-02-15

### Added
- Initial release
- Setup Quality dimension with core check layers
- MCP server with `check_health` tool
- CLI with smart TTY detection
