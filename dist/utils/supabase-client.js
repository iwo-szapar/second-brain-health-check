/**
 * Opt-in Supabase client for MemoryOS SQL health checks.
 *
 * OPT-IN ONLY: Activates when SUPABASE_URL + SUPABASE_SERVICE_KEY are
 * found in environment variables or .env.local. Without these, the health
 * check remains fully local with zero network calls.
 *
 * When active, queries go ONLY to the user's own Supabase instance.
 * No data is sent to MemoryOS servers or any third party.
 *
 * Uses PostgREST table queries (no raw SQL needed).
 * Zero dependencies — uses native fetch (Node 18+).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let _client = undefined; // undefined = not initialized, null = not available

function parseEnvFile(content) {
    const vars = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        vars[key] = val;
    }
    return vars;
}

/**
 * Initialize the Supabase client from .env.local.
 * Returns client object or null if not configured.
 */
export async function getSupabaseClient(rootPath) {
    if (_client !== undefined) return _client;

    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        try {
            const envContent = await readFile(join(rootPath, '.env.local'), 'utf-8');
            const vars = parseEnvFile(envContent);
            url = url || vars.SUPABASE_URL;
            key = key || vars.SUPABASE_SERVICE_KEY;
        } catch {
            // No .env.local
        }
    }

    if (!url || !key) {
        _client = null;
        return null;
    }

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
    };

    _client = {
        /**
         * Fetch rows from a table with PostgREST query params.
         * @param {string} table - Table name
         * @param {Object} opts - { select, filters, limit, order }
         *   filters: { column: 'eq.value', column2: 'gte.2024-01-01' }
         * @returns {Array|null} rows or null on error
         */
        async from(table, opts = {}) {
            try {
                const params = new URLSearchParams();
                if (opts.select) params.set('select', opts.select);
                if (opts.limit) params.set('limit', String(opts.limit));
                if (opts.order) params.set('order', opts.order);
                if (opts.filters) {
                    for (const [col, val] of Object.entries(opts.filters)) {
                        params.set(col, val);
                    }
                }
                const res = await fetch(`${url}/rest/v1/${table}?${params}`, { headers });
                if (!res.ok) return null;
                return await res.json();
            } catch {
                return null;
            }
        },

        /**
         * Count rows in a table matching filters.
         * Uses HEAD + Prefer: count=exact for efficiency.
         */
        async count(table, filters = {}) {
            try {
                const params = new URLSearchParams({ select: '*' });
                for (const [col, val] of Object.entries(filters)) {
                    params.set(col, val);
                }
                const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
                    method: 'HEAD',
                    headers: { ...headers, 'Prefer': 'count=exact' },
                });
                if (!res.ok) return null;
                const range = res.headers.get('content-range');
                if (range) {
                    // Format: "0-9/100" or "*/0"
                    const total = range.split('/')[1];
                    return parseInt(total, 10);
                }
                return null;
            } catch {
                return null;
            }
        },

        url,
    };

    return _client;
}

export function resetSupabaseClient() {
    _client = undefined;
}
