import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkMcpSecurity } from '../dist/setup/mcp-security.js';

let tmpDir;

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sec-test-'));
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('checkMcpSecurity', () => {
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
        await writeFile(
            join(tmpDir, '.mcp.json'),
            JSON.stringify({ mcpServers: { test: { command: 'node', args: ['server.js'] } } })
        );
        const result = await checkMcpSecurity(tmpDir);
        const secretCheck = result.checks.find(c => c.name === 'Secret detection in MCP configs');
        assert.equal(secretCheck.status, 'pass');
    });
});
