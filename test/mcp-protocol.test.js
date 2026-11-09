import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

it('serves schemas, rejects invalid input, and runs a free tool over MCP stdio', { timeout: 20000 }, async () => {
    const root = await mkdtemp(join(homedir(), '.mcp-protocol-'));
    const client = new Client({ name: 'health-check-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
        cwd: root,
        env: { ...process.env, SBK_TOKEN: '', SBF_TOKEN: '', GUIDE_TOKEN: '' },
        stderr: 'pipe',
    });
    try {
        await writeFile(join(root, 'CLAUDE.md'), '# Test workspace\n');
        await client.connect(transport);
        const { tools } = await client.listTools();
        const health = tools.find(tool => tool.name === 'check_health');
        assert.ok(health);
        assert.ok(health.inputSchema.properties.mode.enum.includes('quick'));
        const invalid = await client.callTool({ name: 'check_health', arguments: { mode: 'unsupported' } });
        assert.equal(invalid.isError, true);
        const result = await client.callTool({ name: 'get_fix_suggestions', arguments: { path: root } });
        assert.notEqual(result.isError, true);
        assert.ok(result.content.some(item => item.type === 'text' && item.text.includes('[MemoryOS v')));
    } finally {
        await client.close();
        await rm(root, { recursive: true, force: true });
    }
});
