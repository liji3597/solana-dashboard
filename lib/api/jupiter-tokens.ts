/**
 * Token metadata resolution — multi-tier strategy:
 *
 * 1. Jupiter strict token list (cached in memory for 10 min)
 * 2. Helius DAS API `getAssetBatch` for any mints Jupiter doesn't know
 *
 * Combined, this resolves virtually every SPL token on Solana.
 */

export interface JupiterToken {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

// ─── Jupiter strict list cache ───

let jupiterCache: Map<string, JupiterToken> | null = null;
let jupiterCacheTs = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function loadJupiterList(): Promise<Map<string, JupiterToken>> {
    const now = Date.now();
    if (jupiterCache && now - jupiterCacheTs < CACHE_TTL_MS) return jupiterCache;

    try {
        const res = await fetch('https://token.jup.ag/strict', {
            next: { revalidate: 600 },
        });

        if (!res.ok) throw new Error(`Jupiter fetch failed: ${res.status}`);

        const tokens: JupiterToken[] = await res.json();
        const map = new Map<string, JupiterToken>();
        for (const t of tokens) map.set(t.address, t);

        // Always include wSOL
        map.set('So11111111111111111111111111111111111111112', {
            address: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Wrapped SOL',
            decimals: 9,
        });

        jupiterCache = map;
        jupiterCacheTs = now;
        console.log(`[token-resolver] Loaded ${map.size} Jupiter tokens`);
        return map;
    } catch (err) {
        console.error('[token-resolver] Jupiter list error:', err);
        return jupiterCache ?? new Map();
    }
}

// ─── Helius DAS fallback cache ───
// We cache individual DAS results so we don't re-fetch the same mint repeatedly.
const dasCache = new Map<string, string>(); // mint → symbol

/**
 * Resolve unknown mints via Helius DAS `getAssetBatch`.
 * This works for virtually every SPL token, including pump.fun memecoins.
 */
async function resolveViaHeliusDas(
    unknownMints: string[],
): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    // Check local DAS cache first
    const toFetch: string[] = [];
    for (const mint of unknownMints) {
        const cached = dasCache.get(mint);
        if (cached) {
            result.set(mint, cached);
        } else {
            toFetch.push(mint);
        }
    }

    if (toFetch.length === 0) return result;

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
        console.warn('[token-resolver] No HELIUS_API_KEY, skipping DAS resolution');
        return result;
    }

    try {
        const res = await fetch(
            `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'token-resolve',
                    method: 'getAssetBatch',
                    params: { ids: toFetch },
                }),
            },
        );

        if (!res.ok) {
            console.warn(`[token-resolver] Helius DAS returned ${res.status}`);
            return result;
        }

        const body = await res.json();

        if (body.result && Array.isArray(body.result)) {
            for (const asset of body.result) {
                if (!asset?.id) continue;

                const mint: string = asset.id;
                let symbol = '';

                // Try content.metadata.symbol first
                if (asset.content?.metadata?.symbol) {
                    symbol = asset.content.metadata.symbol;
                }
                // Fallback: content.metadata.name
                else if (asset.content?.metadata?.name) {
                    symbol = asset.content.metadata.name;
                }
                // Fallback: token_info.symbol
                else if (asset.token_info?.symbol) {
                    symbol = asset.token_info.symbol;
                }

                if (symbol) {
                    // Clean up: some pump.fun tokens have very long names
                    if (symbol.length > 12) symbol = symbol.slice(0, 12);
                    result.set(mint, symbol);
                    dasCache.set(mint, symbol);
                }
            }
        }

        console.log(
            `[token-resolver] Helius DAS resolved ${result.size - (unknownMints.length - toFetch.length)}/${toFetch.length} unknown mints`,
        );
    } catch (err) {
        console.error('[token-resolver] Helius DAS error:', err);
    }

    return result;
}

// ─── Public API ───

/**
 * Resolve multiple mint addresses at once.
 * Uses Jupiter (fast, cached) → Helius DAS (fallback for unknowns).
 * Returns a Map<mint, symbol>.
 */
export async function resolveSymbols(
    mints: string[],
): Promise<Map<string, string>> {
    const jupList = await loadJupiterList();
    const result = new Map<string, string>();
    const unknowns: string[] = [];

    for (const mint of mints) {
        const jup = jupList.get(mint);
        if (jup) {
            result.set(mint, jup.symbol);
        } else {
            unknowns.push(mint);
        }
    }

    // Tier 2: Helius DAS for anything Jupiter doesn't know
    if (unknowns.length > 0) {
        const dasResults = await resolveViaHeliusDas(unknowns);
        for (const [mint, symbol] of dasResults) {
            result.set(mint, symbol);
        }

        // Anything still unresolved gets a truncated address
        for (const mint of unknowns) {
            if (!result.has(mint)) {
                const truncated =
                    mint.length > 10
                        ? `${mint.slice(0, 4)}…${mint.slice(-4)}`
                        : mint;
                result.set(mint, truncated);
            }
        }
    }

    return result;
}

/**
 * Resolve a single mint address.
 */
export async function resolveSymbol(mint: string): Promise<string> {
    const map = await resolveSymbols([mint]);
    return map.get(mint) ?? mint;
}

/**
 * Get the full Jupiter token info (includes logo, name, etc.)
 */
export async function getTokenInfo(
    mint: string,
): Promise<JupiterToken | null> {
    const cache = await loadJupiterList();
    return cache.get(mint) ?? null;
}
