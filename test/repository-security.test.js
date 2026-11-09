import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

it('keeps Factory credentials out of repository files', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const paths = execFileSync('git', ['ls-files', '-z', '--', '.'], {
        cwd: root,
        encoding: 'utf8',
    }).split('\0').filter(Boolean);
    const findings = [];

    for (const path of paths) {
        let content;
        try {
            content = readFileSync(join(root, path), 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') continue; // Locally deleted tracked file.
            throw error;
        }
        if (/\bsb[fk]_[A-Za-z0-9_-]{30,}/.test(content)) {
            findings.push(path);
        }
    }

    // Report filenames only; never copy a credential into CI logs.
    assert.deepEqual(findings, [], `Factory credential found in: ${findings.join(', ')}`);
});
