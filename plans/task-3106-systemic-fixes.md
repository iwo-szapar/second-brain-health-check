# task-3106: Systemic fixes — doctor, normalizePath, setup wizard, error logging

## Problem
Timo's 20-hour debug chain exposed four systemic gaps: no diagnostic tool for quick triage, ad-hoc path normalization scattered across 15 files, setup wizard scope/migration issues, and silent error swallowing in network calls.

## Approach

### 1. `doctor` diagnostic tool (`dist/tools/doctor.js` + register in `dist/index.js`)
New MCP tool that collects environment diagnostics into a pasteable block:
- Package version (from VERSION)
- OS, platform, arch, Node version
- Package name (`@iwo-szapar/second-brain-health-check`)
- Env vars: SBK_TOKEN, SBF_TOKEN, UPGRADE_BRAIN_API_KEY — show "set (sbk_xxxx...)" or "not set", never full value
- Key paths: check existence of `~/.claude/`, `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`
- Factory connectivity: HEAD request to `https://second-brain-factory.com/api/mcp/validate` with timeout
- MCP endpoint configured: read from `.claude/settings.json` mcpServers entries
- Output as fenced code block for easy copy-paste

### 2. `normalizePath()` utility (`dist/utils/normalize-path.js`)
Single exported function:
```js
export function normalizePath(inputPath, { homeDir, checkBoundary = true } = {})
```
- Replace `\` with `/`
- Uppercase drive letter: `c:/` → `C:/`
- Collapse `.claude/.claude/` → `.claude/`
- If `checkBoundary`, verify path starts with homeDir (case-insensitive on Windows)
- Return resolved absolute path

Import and use in `upgrade-brain.js` (replace `assertPathWithinHome`) and `health-check.js` (replace inline path resolution).

### 3. Setup wizard improvements (`dist/setup.js`)
Three changes:
- (a) Add `--scope user` to `mcp add` commands (lines 566, 571, 600) so MCP entries live in user config, not project
- (b) Detect `@iwo-szapar/memoryos` in `claude mcp list` output and auto-remove if found (expand existing line 563 migration)
- (c) After MCP setup, check if `.vscode/` exists → if so, write `.mcp.json` with the same server config for VSCode extension compatibility

### 4. Token validation error logging
- `upgrade-brain.js`: The fetch response handler already has `response.status` — add `console.error` with structured JSON: `{ tool: 'upgrade_brain', error: 'http_401', endpoint, prefix: token?.substring(0,12) }`
- `phone-home.js`: Replace generic `'network_error'` with `response?.status` when available, add `console.error` for non-2xx responses

## Files Affected
- `dist/tools/doctor.js` — **new file** (diagnostic tool implementation)
- `dist/utils/normalize-path.js` — **new file** (path utility)
- `dist/index.js` — register doctor tool, import normalizePath
- `dist/tools/upgrade-brain.js` — use normalizePath, add error logging
- `dist/health-check.js` — use normalizePath for root path resolution
- `dist/setup.js` — `--scope user`, old package detection, `.mcp.json`
- `dist/guide/phone-home.js` — structured error logging
- `package.json` — bump to 0.18.0 (feature release)

## Acceptance Criteria
- [ ] `doctor` tool registered and outputs all diagnostic fields
- [ ] `normalizePath` handles Windows paths, drive letter case, .claude doubling
- [ ] Setup wizard adds `--scope user` to all `mcp add` calls
- [ ] Setup wizard detects and removes old `@iwo-szapar/memoryos` package
- [ ] Setup wizard creates `.mcp.json` when VSCode detected
- [ ] `upgrade_brain` fetch errors include HTTP status and token prefix in console.error
- [ ] `phone-home` fetch errors include HTTP status in console.error
- [ ] All existing tests pass (`npm test`)

## Edge Cases
- `doctor` offline: Factory ping times out → show "unreachable (timeout)"
- No `.claude/` directory at all → doctor reports "not found" for each path
- Windows path with forward slashes already → normalizePath is idempotent
- No VSCode installed → skip `.mcp.json` silently

## Risks
- None significant — all changes are additive or improving existing error paths
