import { NextResponse } from 'next/server';

import { getRecentTransactions } from '@/lib/api/helius';
import { resolveSymbols } from '@/lib/api/jupiter-tokens';
import { WHALE_WALLET } from '@/lib/constants/wallets';
import type { HeliusTransaction, SwapTransaction } from '@/lib/types/api';

const LAMPORTS_PER_SOL = 1_000_000_000;
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// ─── SOL price cache ───

let cachedSolPrice: number | null = null;
let solPriceFetchedAt = 0;
const PRICE_CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch current SOL price in USD from CoinGecko.
 * Caches the result for 1 minute.
 */
async function getSolPriceUsd(): Promise<number> {
  const now = Date.now();
  if (cachedSolPrice && now - solPriceFetchedAt < PRICE_CACHE_TTL_MS) {
    return cachedSolPrice;
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 } },
    );

    if (res.ok) {
      const data = await res.json();
      const price = data?.solana?.usd;
      if (typeof price === 'number' && price > 0) {
        cachedSolPrice = price;
        solPriceFetchedAt = now;
        console.log(`[sol-price] Current SOL price: $${price}`);
        return price;
      }
    }
  } catch (err) {
    console.warn('[sol-price] CoinGecko fetch failed:', err);
  }

  // Fallback if CoinGecko is unavailable
  return cachedSolPrice ?? 170;
}

// ─── Helpers ───

function toDateStr(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Collect every mint address that appears in a transaction's swap events
 * or token transfers, so we can batch-resolve them via Jupiter + Helius.
 */
function collectMints(tx: HeliusTransaction): string[] {
  const mints = new Set<string>();

  const swap = tx.events?.swap;
  if (swap) {
    if (swap.tokenInputs) {
      for (const t of swap.tokenInputs) mints.add(t.mint);
    }
    if (swap.tokenOutputs) {
      for (const t of swap.tokenOutputs) mints.add(t.mint);
    }
    if (swap.nativeInput) mints.add(WSOL_MINT);
    if (swap.nativeOutput) mints.add(WSOL_MINT);
  }

  if (tx.tokenTransfers) {
    for (const t of tx.tokenTransfers) mints.add(t.mint);
  }

  return Array.from(mints);
}

/**
 * Find non-wSOL tokens from tokenTransfers.
 * Used to identify the actual memecoin in PUMP_AMM transactions
 * where swap events only show SOL/wSOL on both sides.
 */
function findNonSolTokens(
  tx: HeliusTransaction,
  symbolMap: Map<string, string>,
): string[] {
  if (!tx.tokenTransfers?.length) return [];

  const nonSolMints = new Set<string>();
  for (const transfer of tx.tokenTransfers) {
    if (transfer.mint !== WSOL_MINT) {
      nonSolMints.add(transfer.mint);
    }
  }

  return Array.from(nonSolMints).map((m) => symbolMap.get(m) ?? m);
}

/**
 * Determine swap direction from tokenTransfers for PUMP_AMM.
 * If wallet receives a non-SOL token → it's a buy (SOL -> Token)
 * If wallet sends a non-SOL token → it's a sell (Token -> SOL)
 */
function detectPumpDirection(
  tx: HeliusTransaction,
  wallet: string,
  symbolMap: Map<string, string>,
): { fromSymbol: string; toSymbol: string } | null {
  if (!tx.tokenTransfers?.length) return null;

  const walletLower = wallet.toLowerCase();

  for (const transfer of tx.tokenTransfers) {
    if (transfer.mint === WSOL_MINT) continue;

    const tokenSymbol = symbolMap.get(transfer.mint) ?? transfer.mint;

    // Wallet receives the token → bought it (SOL -> Token)
    if (transfer.toUserAccount?.toLowerCase() === walletLower) {
      return { fromSymbol: 'SOL', toSymbol: tokenSymbol };
    }
    // Wallet sends the token → sold it (Token -> SOL)
    if (transfer.fromUserAccount?.toLowerCase() === walletLower) {
      return { fromSymbol: tokenSymbol, toSymbol: 'SOL' };
    }
  }

  return null;
}

/**
 * Build a human-readable "action" string (e.g. "SOL -> Punch") using
 * the Jupiter+Helius symbol map.
 *
 * Strategy priority:
 *   1. Structured swap events (most reliable, clean mint data)
 *      → If both sides are SOL, use tokenTransfers to find the real token
 *   2. Description parsing (fallback)
 *   3. Token transfer heuristic
 */
function buildAction(
  tx: HeliusTransaction,
  symbolMap: Map<string, string>,
  wallet: string,
): { action: string; fromSymbol: string; toSymbol: string } {
  let fromSymbol = '';
  let toSymbol = '';

  // ── Strategy 1 (PRIMARY): Structured swap events + symbol resolution ──
  if (tx.events?.swap) {
    const swap = tx.events.swap;

    if (swap.nativeInput) {
      fromSymbol = 'SOL';
    } else if (swap.tokenInputs?.[0]) {
      const mint = swap.tokenInputs[0].mint;
      fromSymbol = mint === WSOL_MINT ? 'SOL' : (symbolMap.get(mint) ?? mint);
    }

    if (swap.nativeOutput) {
      toSymbol = 'SOL';
    } else if (swap.tokenOutputs?.[0]) {
      const mint = swap.tokenOutputs[0].mint;
      toSymbol = mint === WSOL_MINT ? 'SOL' : (symbolMap.get(mint) ?? mint);
    }

    // ── FIX for PUMP_AMM: Both sides show SOL/wSOL ──
    // Pump.fun AMM routes through wSOL, so swap events show SOL→SOL.
    // The actual memecoin is in tokenTransfers.
    if (
      (fromSymbol === 'SOL' || fromSymbol === 'wSOL') &&
      (toSymbol === 'SOL' || toSymbol === 'wSOL')
    ) {
      const pumpResult = detectPumpDirection(tx, wallet, symbolMap);
      if (pumpResult) {
        fromSymbol = pumpResult.fromSymbol;
        toSymbol = pumpResult.toSymbol;
      } else {
        // Fallback: find any non-SOL token in transfers
        const nonSolTokens = findNonSolTokens(tx, symbolMap);
        if (nonSolTokens.length > 0) {
          // Guess direction from nativeInput/nativeOutput
          if (swap.nativeInput) {
            fromSymbol = 'SOL';
            toSymbol = nonSolTokens[0];
          } else {
            fromSymbol = nonSolTokens[0];
            toSymbol = 'SOL';
          }
        }
      }
    }
  }

  // ── Strategy 2 (FALLBACK): Description parsing ──
  if (!fromSymbol && !toSymbol) {
    const desc = tx.description || '';

    const longMatch = desc.match(
      /swapped\s+[\d,.]+\s+([a-zA-Z][a-zA-Z0-9]*)\s+for\s+[\d,.]+\s+([a-zA-Z][a-zA-Z0-9]*)/i,
    );
    if (longMatch) {
      const s1 = longMatch[1];
      const s2 = longMatch[2];
      if (s1.length <= 12) fromSymbol = s1.toUpperCase();
      if (s2.length <= 12) toSymbol = s2.toUpperCase();
      if (!fromSymbol && s1.length > 12)
        fromSymbol = symbolMap.get(s1) ?? s1.slice(0, 8);
      if (!toSymbol && s2.length > 12)
        toSymbol = symbolMap.get(s2) ?? s2.slice(0, 8);
    }

    if (!fromSymbol) {
      const shortMatch = desc.match(/([a-zA-Z]+)\s+for\s+([a-zA-Z]+)/i);
      if (shortMatch) {
        const invalid = new Set(['SWAPPED', 'UNKNOWN', 'TOKEN', 'FOR']);
        const a = shortMatch[1].toUpperCase();
        const b = shortMatch[2].toUpperCase();
        if (
          !invalid.has(a) &&
          !invalid.has(b) &&
          a.length <= 12 &&
          b.length <= 12
        ) {
          fromSymbol = a;
          toSymbol = b;
        }
      }
    }
  }

  // ── Strategy 3: Token transfers ──
  if (!fromSymbol && !toSymbol && tx.tokenTransfers?.length) {
    const uniqueMints = [...new Set(tx.tokenTransfers.map((t) => t.mint))];
    const symbols = uniqueMints
      .filter((m) => m !== WSOL_MINT)
      .map((m) => symbolMap.get(m) ?? m);

    if (
      tx.nativeTransfers?.some((nt) => Math.abs(nt.amount) > 1_000_000)
    ) {
      fromSymbol = 'SOL';
      toSymbol = symbols[0] ?? '?';
    } else if (symbols.length >= 2) {
      fromSymbol = symbols[0];
      toSymbol = symbols[1];
    } else if (symbols.length === 1) {
      fromSymbol = 'SOL';
      toSymbol = symbols[0];
    }
  }

  const action =
    fromSymbol && toSymbol
      ? `${fromSymbol} -> ${toSymbol}`
      : fromSymbol
        ? `${fromSymbol} -> ?`
        : 'Unknown Swap';

  return { action, fromSymbol, toSymbol };
}

/**
 * Estimate the SOL value of the swap by looking at native amounts.
 */
function estimateValueSol(tx: HeliusTransaction): number {
  // From swap events
  const swap = tx.events?.swap;
  if (swap) {
    const nativeIn = swap.nativeInput
      ? (Number(swap.nativeInput.amount) || 0) / LAMPORTS_PER_SOL
      : 0;
    const nativeOut = swap.nativeOutput
      ? (Number(swap.nativeOutput.amount) || 0) / LAMPORTS_PER_SOL
      : 0;

    if (nativeIn > 0 || nativeOut > 0) {
      return Math.max(nativeIn, nativeOut);
    }

    // If no native amounts, check for wSOL in tokenInputs/Outputs
    const wsolIn = swap.tokenInputs?.find((t) => t.mint === WSOL_MINT);
    const wsolOut = swap.tokenOutputs?.find((t) => t.mint === WSOL_MINT);
    const solFromTokens = Math.max(
      wsolIn ? (Number(wsolIn.amount) || 0) / LAMPORTS_PER_SOL : 0,
      wsolOut ? (Number(wsolOut.amount) || 0) / LAMPORTS_PER_SOL : 0,
    );
    if (solFromTokens > 0) return solFromTokens;
  }

  // From native transfers (filter out dust fees)
  let maxAmount = 0;
  if (tx.nativeTransfers) {
    for (const nt of tx.nativeTransfers) {
      if (Math.abs(nt.amount) < 1_000_000) continue; // skip dust
      const sol = Math.abs(nt.amount) / LAMPORTS_PER_SOL;
      maxAmount = Math.max(maxAmount, sol);
    }
  }

  return maxAmount;
}

// ─── Route handler ───

export async function GET() {
  try {
    // Fetch transactions + SOL price concurrently
    const [transactions, solPriceUsd] = await Promise.all([
      getRecentTransactions(WHALE_WALLET, 20, 'SWAP'),
      getSolPriceUsd(),
    ]);

    // 1. Collect all mints from all transactions
    const allMints = new Set<string>();
    for (const tx of transactions) {
      for (const m of collectMints(tx)) allMints.add(m);
    }

    // 2. Batch-resolve via Jupiter + Helius DAS
    const symbolMap = await resolveSymbols(Array.from(allMints));

    // 3. Transform each transaction
    const transformed: SwapTransaction[] = transactions.map((tx) => {
      const { action, fromSymbol, toSymbol } = buildAction(
        tx,
        symbolMap,
        WHALE_WALLET,
      );

      // Collect token symbols
      const symbolSet = new Set<string>();
      if (fromSymbol) symbolSet.add(fromSymbol.toUpperCase());
      if (toSymbol) symbolSet.add(toSymbol.toUpperCase());

      const valueSol = estimateValueSol(tx);
      const valueUsd = valueSol > 0 ? valueSol * solPriceUsd : undefined;

      return {
        signature: tx.signature,
        timestamp: tx.timestamp,
        date: toDateStr(tx.timestamp),
        platform: tx.source || 'Unknown',
        action,
        status: (tx.transactionError ? 'failed' : 'success') as
          | 'success'
          | 'failed',
        tokenSymbols: Array.from(symbolSet),
        valueSol: valueSol > 0 ? Number(valueSol.toFixed(6)) : undefined,
        valueUsd: valueUsd ? Number(valueUsd.toFixed(2)) : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformed,
      total: transformed.length,
      solPriceUsd: Number(solPriceUsd.toFixed(2)),
    });
  } catch (error) {
    console.error('API route error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
