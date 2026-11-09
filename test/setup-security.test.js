import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findExistingToken } from '../dist/setup.js';

const token = 'sbk_' + 'fixture'.repeat(6);

it('finds user-scoped credentials without stopping at unrelated settings', () => {
    const home = mkdtempSync(join(tmpdir(), 'setup-user-'));
    try {
        mkdirSync(join(home, '.claude'));
        writeFileSync(join(home, '.claude.json'), '{}');
        writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { SBF_TOKEN: token } }));
        assert.equal(findExistingToken({}, home), token);
        writeFileSync(join(home, '.claude.json'), JSON.stringify({ mcpServers: {
            'second-brain-health-check': { env: { SBK_TOKEN: token + 'user' } },
        } }));
        assert.equal(findExistingToken({}, home), token + 'user');
        assert.equal(findExistingToken({ SBK_TOKEN: token + 'env' }, home), token + 'env');
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

for (const scenario of ['valid', 'rejected', 'rejected-403', 'offline', 'cli-failure', 'pasted']) {
    it(`setup keeps credentials outside the checkout (${scenario})`, () => {
        const root = mkdtempSync(join(tmpdir(), 'setup-flow-'));
        const moduleUrl = new URL('../dist/setup.js', import.meta.url).href;
        const shared = JSON.stringify({ permissions: { allow: [] } });
        mkdirSync(join(root, '.claude'));
        mkdirSync(join(root, '.vscode'));
        writeFileSync(join(root, '.claude', 'settings.json'), shared);
        const script = `
            import { mock } from 'node:test';
            import { syncBuiltinESMExports } from 'node:module';
            import * as childProcess from 'node:child_process';
            import * as readline from 'node:readline';
            import * as os from 'node:os';
            import { existsSync } from 'node:fs';
            const calls = [];
            const scenario = ${JSON.stringify(scenario)};
            const token = ${JSON.stringify(token)};
            delete process.env.SBK_TOKEN;
            delete process.env.SBF_TOKEN;
            delete process.env.GUIDE_TOKEN;
            if (scenario !== 'pasted') process.env.SBK_TOKEN = token;
            Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
            mock.method(childProcess.default, 'execFileSync', (command, args) => {
                if (command !== 'claude') throw new Error('No fixture Git metadata');
                calls.push(args);
                if (scenario === 'cli-failure' && args[0] !== '--version') throw new Error(token);
                return '';
            });
            mock.method(childProcess.default, 'execFile', (...args) => args.at(-1)?.(null));
            mock.method(os.default, 'homedir', () => ${JSON.stringify(root)});
            mock.method(readline.default, 'createInterface', ({ output }) => {
                Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
                let question = 0;
                return {
                    question(prompt, callback) {
                        const answer = question++ === 0 ? (scenario === 'pasted' ? token : 'y') : '';
                        output.write(answer);
                        callback(answer);
                    },
                    close() {},
                };
            });
            syncBuiltinESMExports();
            global.fetch = async () => {
                if (scenario === 'offline') throw new Error('offline');
                const rejected = scenario.startsWith('rejected');
                return new Response(JSON.stringify({ valid: !rejected, type: 'customer', mcp_url: '/api/mcp/customer' }), { status: rejected ? (scenario === 'rejected-403' ? 403 : 401) : 200 });
            };
            const { runSetup } = await import(${JSON.stringify(moduleUrl)});
            await runSetup();
            console.log('RESULT:' + JSON.stringify({
                localCalls: calls.filter(args => args[0] === 'mcp' && args[1] === 'add').map(args => ({
                    userScope: args.includes('user'),
                    hasCredential: args.some(arg => arg.includes(token)),
                    customerEndpoint: args.includes('https://second-brain-factory.com/api/mcp/customer'),
                })),
                wroteProjectMcp: existsSync('.mcp.json'),
                wroteLocalSettings: existsSync('.claude/settings.local.json'),
            }));
        `;
        try {
            const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
                cwd: root, encoding: 'utf8', timeout: 20000,
            });
            assert.equal(child.status, 0, 'Setup harness must complete');
            const output = child.stdout;
            assert.equal(output.includes(token), false, 'Setup must not print the full credential');
            assert.equal(child.stderr.includes(token), false, 'Setup must not print the credential on stderr');
            assert.equal(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'), shared);
            const result = JSON.parse(output.split('RESULT:')[1].trim());
            assert.equal(result.wroteProjectMcp, false);
            assert.equal(result.wroteLocalSettings, false);
            assert.ok(result.localCalls.length > 0);
            assert.ok(result.localCalls.every(call => call.userScope));
            if (scenario.startsWith('rejected')) {
                assert.ok(result.localCalls.every(call => !call.hasCredential));
                assert.ok(output.includes('free tier'));
            } else {
                assert.ok(result.localCalls.some(call => call.hasCredential));
                assert.ok(result.localCalls.some(call => call.customerEndpoint));
            }
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}
