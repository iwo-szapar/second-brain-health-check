/**
 * MemoryOS SQL stats — fetched once, shared across check layers.
 *
 * Queries memory_knowledge, memory_decisions, and knowledge_links
 * via PostgREST. Computes all metrics the health check layers need.
 * Returns null if Supabase is not configured (opt-in).
 */
import { getSupabaseClient } from './supabase-client.js';

let _stats = undefined;

/**
 * Detect the owner_id to use for queries.
 * Priority: MEMORYOS_OWNER_ID env var > first row in memory_knowledge > null.
 */
async function detectOwnerId(client) {
    // Explicit env var
    if (process.env.MEMORYOS_OWNER_ID) return process.env.MEMORYOS_OWNER_ID;

    // Auto-detect from first row
    const rows = await client.from('memory_knowledge', {
        select: 'owner_id',
        limit: 1,
    });
    if (rows && rows.length > 0 && rows[0].owner_id) return rows[0].owner_id;

    return null;
}

/**
 * Fetch MemoryOS stats from Supabase. Cached after first call.
 * Returns stats object or null if Supabase not configured / query fails.
 */
export async function getMemoryOSStats(rootPath) {
    if (_stats !== undefined) return _stats;

    const client = await getSupabaseClient(rootPath);
    if (!client) {
        _stats = null;
        return null;
    }

    try {
        const ownerId = await detectOwnerId(client);
        if (!ownerId) {
            _stats = null;
            return null;
        }

        const ownerFilter = { owner_id: `eq.${ownerId}` };

        // Fetch knowledge items (select only what we need)
        // Limit to 2000 to avoid massive payloads
        const knowledge = await client.from('memory_knowledge', {
            select: 'id,type,confidence,source,created_at,updated_at',
            filters: ownerFilter,
            limit: 2000,
            order: 'created_at.desc',
        });

        if (!knowledge) {
            _stats = null;
            return null;
        }

        // Check embedding coverage separately (embedding column is large, don't fetch it)
        const [totalCount, embeddingCount] = await Promise.all([
            client.count('memory_knowledge', ownerFilter),
            client.count('memory_knowledge', { ...ownerFilter, embedding: 'not.is.null' }),
        ]);

        // Fetch decisions
        const decisions = await client.from('memory_decisions', {
            select: 'id,title,outcome_rating,options_considered,created_at',
            filters: ownerFilter,
            limit: 500,
        });

        // Count links
        const linkCount = await client.count('knowledge_links', ownerFilter);

        // Compute stats
        const now = Date.now();
        const day30 = now - 30 * 24 * 60 * 60 * 1000;
        const day7 = now - 7 * 24 * 60 * 60 * 1000;
        const day90 = now - 90 * 24 * 60 * 60 * 1000;

        // Type distribution
        const typeMap = {};
        let addedLast30d = 0;
        let addedLast7d = 0;
        let freshIn90d = 0;
        const confidenceValues = new Set();
        const sourceMap = {};
        let observerCount = 0;
        let observerLast7d = 0;
        let oldestItem = null;
        let newestItem = null;

        for (const item of knowledge) {
            const type = item.type || 'unknown';
            typeMap[type] = (typeMap[type] || 0) + 1;

            const created = new Date(item.created_at).getTime();
            const updated = item.updated_at ? new Date(item.updated_at).getTime() : created;

            if (created > day30) addedLast30d++;
            if (created > day7) addedLast7d++;
            if (updated > day90 || created > day90) freshIn90d++;

            if (item.confidence != null) confidenceValues.add(item.confidence);

            const source = item.source || 'unknown';
            sourceMap[source] = (sourceMap[source] || 0) + 1;
            if (source === 'auto-observer') {
                observerCount++;
                if (created > day7) observerLast7d++;
            }

            if (!oldestItem || created < new Date(oldestItem).getTime()) oldestItem = item.created_at;
            if (!newestItem || created > new Date(newestItem).getTime()) newestItem = item.created_at;
        }

        const total = totalCount ?? knowledge.length;
        const brainAgeDays = oldestItem
            ? Math.floor((now - new Date(oldestItem).getTime()) / (24 * 60 * 60 * 1000))
            : 0;

        _stats = {
            // Volume
            total,
            typeDistribution: typeMap,
            distinctTypes: Object.keys(typeMap).length,

            // Patterns
            patternCount: typeMap['pattern'] || 0,
            insightCount: typeMap['insight'] || 0,
            lessonCount: typeMap['lesson'] || 0,
            factCount: typeMap['fact'] || 0,

            // Confidence
            confidenceSpread: confidenceValues.size,
            confidenceValues: [...confidenceValues].sort(),

            // Growth
            addedLast30d,
            addedLast7d,
            freshIn90d,
            freshnessRatio: total > 0 ? freshIn90d / total : 0,
            brainAgeDays,

            // Embeddings
            embeddingCount: embeddingCount ?? 0,
            embeddingCoverage: total > 0 ? (embeddingCount ?? 0) / total : 0,

            // Links
            linkCount: linkCount ?? 0,
            linksPerItem: total > 0 ? (linkCount ?? 0) / total : 0,

            // Observer
            observerCount,
            observerLast7d,

            // Sources
            sourceDistribution: sourceMap,
            distinctSources: Object.keys(sourceMap).length,

            // Decisions
            decisionCount: decisions?.length ?? 0,
            decisionsWithOutcome: decisions?.filter(d => d.outcome_rating != null).length ?? 0,
            decisionsWithOptions: decisions?.filter(d =>
                d.options_considered && Array.isArray(d.options_considered) && d.options_considered.length >= 2
            ).length ?? 0,
            decisionsLast30d: decisions?.filter(d => new Date(d.created_at).getTime() > day30).length ?? 0,

            // Timestamps
            oldestItem,
            newestItem,
        };

        return _stats;
    } catch {
        _stats = null;
        return null;
    }
}

export function resetMemoryOSStats() {
    _stats = undefined;
}
