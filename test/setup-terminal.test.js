import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const terminalHarness = String.raw`
import json, os, pty, select, shutil, subprocess, sys, tempfile, time

mode = sys.argv[1]
existing = 'sbk_' + 'existingfixture' * 4
entered = 'sbk_' + 'replacementfixture' * 4
root = tempfile.mkdtemp(prefix='setup-terminal-')
master, slave = pty.openpty()
env = dict(os.environ)
for name in ['SBK_TOKEN', 'SBF_TOKEN', 'GUIDE_TOKEN']:
    env.pop(name, None)
if mode == 'replacement':
    env['SBK_TOKEN'] = existing
script = '''
import { mock } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import childProcess from 'node:child_process';
import os from 'node:os';
mock.method(childProcess, 'execFileSync', () => '');
mock.method(os, 'homedir', () => process.cwd());
syncBuiltinESMExports();
global.fetch = async () => {
    console.log('FIXTURE_VALIDATION_REACHED');
    process.exit(0);
};
const { runSetup } = await import(process.env.HC_SETUP_MODULE);
await runSetup();
'''
child = subprocess.Popen([env['HC_NODE_BINARY'], '--input-type=module', '-e', script],
    stdin=slave, stdout=slave, stderr=slave, env=env, cwd=root)
os.close(slave)
transcript = b''
stage = 0 if mode == 'replacement' else 1
timed_out = False
try:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            if not chunk:
                break
            transcript += chunk
            if stage == 0 and b'Use this token?' in transcript:
                os.write(master, b'n')
                time.sleep(0.05)
                os.write(master, b'\r')
                stage = 1
            if stage == 1 and b'Token (hidden)' in transcript:
                time.sleep(0.05)
                os.write(master, entered.encode())
                time.sleep(0.05)
                os.write(master, b'\r')
                stage = 2
        elif child.poll() is not None:
            break
    else:
        timed_out = True
finally:
    if child.poll() is None:
        child.kill()
    child.wait()
    os.close(master)
    shutil.rmtree(root)

# Never include the transcript or fixture credentials in test output.
print(json.dumps({
    'prompt_reached': stage == 2,
    'validation_reached': b'FIXTURE_VALIDATION_REACHED' in transcript,
    'entered_token_echoed': entered.encode() in transcript,
    'existing_token_echoed': existing.encode() in transcript,
    'exit_code': child.returncode,
    'timed_out': timed_out,
}))
`;

for (const mode of ['initial', 'replacement']) {
    it(`hides ${mode} token entry in a real terminal`, {
        // Python's PTY harness exercises POSIX terminal echo; Windows runs the setup flow tests.
        skip: process.platform === 'win32' ? 'POSIX PTY required; setup flow coverage runs on Windows' : false,
    }, () => {
        const output = execFileSync('python3', ['-c', terminalHarness, mode], {
            encoding: 'utf8',
            timeout: 15000,
            env: {
                ...process.env,
                HC_NODE_BINARY: process.execPath,
                HC_SETUP_MODULE: new URL('../dist/setup.js', import.meta.url).href,
            },
        });
        const result = JSON.parse(output);
        assert.equal(result.timed_out, false);
        assert.equal(result.prompt_reached, true);
        assert.equal(result.validation_reached, true);
        assert.equal(result.exit_code, 0);
        assert.equal(result.entered_token_echoed, false, 'Typed credential must not appear in terminal output');
        assert.equal(result.existing_token_echoed, false, 'Existing credential must not appear in terminal output');
    });
}
