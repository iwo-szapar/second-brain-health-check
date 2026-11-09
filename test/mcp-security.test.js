import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { checkMcpSecurity } from '../dist/setup/mcp-security.js';

let tmpDir;

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sec-test-'));
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('checkMcpSecurity', () => {
    for (const path of ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json', '.mcp/extra.json', '.claude.json']) {
        for (const prefix of ['sbf_', 'sbk_']) {
            it(`detects tracked ${prefix} credentials in ${path} despite ignore rules`, async () => {
                const root = await mkdtemp(join(tmpdir(), 'tracked-config-'));
                const token = prefix + 'fixture'.repeat(6);
                try {
                    await mkdir(join(root, '.claude'));
                    await mkdir(join(root, '.mcp'));
                    await writeFile(join(root, path), JSON.stringify({ env: { SBF_TOKEN: token } }));
                    await writeFile(join(root, '.gitignore'), '*\n');
                    execFileSync('git', ['init', '-q'], { cwd: root });
                    execFileSync('git', ['add', '-f', '--', path], { cwd: root });
                    const result = await checkMcpSecurity(root);
                    assert.equal(result.checks.find(c => c.name === 'Secret detection in MCP configs').status, 'fail');
                    assert.equal(result.checks.find(c => c.name === 'Git-tracked MCP secrets').status, 'fail');
                    assert.equal(JSON.stringify(result).includes(token), false);
                } finally {
                    await rm(root, { recursive: true, force: true });
                }
            });
        }
    }

    it('detects credentials in a tracked malformed project .claude.json', async () => {
        const root = await mkdtemp(join(tmpdir(), 'malformed-claude-'));
        const token = 'sbf_' + 'fixture'.repeat(6);
        try {
            await writeFile(join(root, '.claude.json'), '{"token":"' + token);
            execFileSync('git', ['init', '-q'], { cwd: root });
            execFileSync('git', ['add', '.claude.json'], { cwd: root });
            const result = await checkMcpSecurity(root);
            assert.equal(result.checks.find(c => c.name === 'Secret detection in MCP configs').status, 'fail');
            assert.equal(result.checks.find(c => c.name === 'Git-tracked MCP secrets').status, 'fail');
            assert.equal(JSON.stringify(result).includes(token), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('scans malformed settings and shared permission rules without echoing secrets', async () => {
        const root = await mkdtemp(join(tmpdir(), 'malformed-config-'));
        const token = 'sbf_' + 'fixture'.repeat(6);
        try {
            await mkdir(join(root, '.claude'));
            const path = join(root, '.claude', 'settings.json');
            await writeFile(path, '{"token":"' + token);
            let result = await checkMcpSecurity(root);
            assert.equal(result.checks.find(c => c.name === 'Secret detection in MCP configs').status, 'fail');
            assert.equal(result.checks.find(c => c.name === 'Git-tracked MCP secrets').status, 'warn');
            await writeFile(path, JSON.stringify({ permissions: { allow: ['Bash(curl -H "Authorization: Bearer ' + token + '")'] } }));
            result = await checkMcpSecurity(root);
            assert.equal(result.checks.find(c => c.name === 'Settings permission leaks').status, 'warn');
            assert.equal(JSON.stringify(result).includes(token), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('distinguishes ignored personal credentials from tracked credentials', async () => {
        const root = await mkdtemp(join(tmpdir(), 'ignored-config-'));
        try {
            await mkdir(join(root, '.claude'));
            await writeFile(join(root, '.claude', 'settings.local.json'), JSON.stringify({ env: { SBK_TOKEN: 'sbk_' + 'fixture'.repeat(6) } }));
            await writeFile(join(root, '.gitignore'), '.claude/settings.local.json\n');
            execFileSync('git', ['init', '-q'], { cwd: root });
            const result = await checkMcpSecurity(root);
            assert.equal(result.checks.find(c => c.name === 'Git-tracked MCP secrets').status, 'pass');
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('returns passing scores when no MCP config exists', async () => {
        const result = await checkMcpSecurity(tmpDir);
        assert.ok(result.points > 0);
        assert.equal(result.maxPoints, 8);
    });

    it('detects sk- API key pattern in .mcp.json', async () => {
        await writeFile(
            join(tmpDir, '.mcp.json'),
            JSON.stringify({ mcpServers: { test: { apiKey: 'sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456' } } })
        );
        const result = await checkMcpSecurity(tmpDir);
        const secretCheck = result.checks.find(c => c.name === 'Secret detection in MCP configs');
        assert.equal(secretCheck.status, 'fail');
    });

    it('detects JWT patterns', async () => {
        await writeFile(
            join(tmpDir, '.mcp.json'),
            JSON.stringify({ token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U' })
        );
        const result = await checkMcpSecurity(tmpDir);
        const secretCheck = result.checks.find(c => c.name === 'Secret detection in MCP configs');
        assert.equal(secretCheck.status, 'fail');
    });

    it('detects Bearer token patterns', async () => {
        await writeFile(
            join(tmpDir, '.mcp.json'),
            JSON.stringify({ auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijklmnop' })
        );
        const result = await checkMcpSecurity(tmpDir);
        const secretCheck = result.checks.find(c => c.name === 'Secret detection in MCP configs');
        assert.equal(secretCheck.status, 'fail');
    });

    it('passes when config has no secrets', async () => {
        // Use a fresh isolated dir so ~/.claude.json (user-level) is the only
        // file in scope — and write a clean project-level .mcp.json there.
        const cleanDir = await mkdtemp(join(tmpdir(), 'sec-clean-'));
        try {
            await writeFile(
                join(cleanDir, '.mcp.json'),
                JSON.stringify({ mcpServers: { test: { command: 'node', args: ['server.js'] } } })
            );
            const result = await checkMcpSecurity(cleanDir);
            const secretCheck = result.checks.find(c => c.name === 'Secret detection in MCP configs');
            // The check passes only when the project-level file has no secrets.
            // We can't control ~/.claude.json in the test environment, so we
            // assert that the project file itself doesn't push the status to fail
            // by verifying the overall result contains a passing project check OR
            // fall back to checking the message doesn't reference the clean file.
            assert.ok(
                secretCheck.status === 'pass' ||
                !secretCheck.message?.includes('.mcp.json'),
                `Expected no secrets in project .mcp.json, got: ${secretCheck.message}`
            );
        } finally {
            await rm(cleanDir, { recursive: true, force: true });
        }
    });
});
