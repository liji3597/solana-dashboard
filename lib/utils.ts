import { PublicKey } from '@solana/web3.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MaxDrawdownResult, HeliusTransaction, SwapTransaction } from './types/api';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatApiError(error: unknown, context: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(`${context}: ${(error as { message: string }).message}`);
  }

  return new Error(`${context}: Unknown error`);
}

export function validateSolanaAddress(address: string): void {
  try {
    // PublicKey constructor throws automatically for invalid inputs
    new PublicKey(address);
  } catch (error) {
    throw formatApiError(error, 'Invalid Solana address');
  }
}

/**
 * Calculate max drawdown in a single pass (O(n)) by tracking rolling peak.
 *
 * Edge cases:
 * - Empty array: returns zeroed result.
 * - Single element: returns 0% drawdown with peak/trough equal to that value.
 * - Monotonic increase: drawdown remains 0.
 * - peak = 0: skips percentage division to avoid divide-by-zero.
 */
export function calculateMaxDrawdown(
  data: Array<{ value: number; date?: string }>
): MaxDrawdownResult {
  if (data.length === 0) {
    return {
      percentage: 0,
      peak: 0,
      trough: 0,
    };
  }

  const firstPoint = data[0];

  if (data.length === 1) {
    return {
      percentage: 0,
      peak: firstPoint.value,
      trough: firstPoint.value,
      peakDate: firstPoint.date,
      troughDate: firstPoint.date,
    };
  }

  let currentPeak = firstPoint.value;
  let currentPeakDate = firstPoint.date;

  let maxDrawdown = 0;
  let maxDrawdownPeak = firstPoint.value;
  let maxDrawdownTrough = firstPoint.value;
  let maxDrawdownPeakDate = firstPoint.date;
  let maxDrawdownTroughDate = firstPoint.date;

  for (let index = 1; index < data.length; index += 1) {
    const point = data[index];
    const { value, date } = point;

    if (value > currentPeak) {
      currentPeak = value;
      currentPeakDate = date;
      continue;
    }

    if (currentPeak === 0) {
      continue;
    }

    const drawdown = ((value - currentPeak) / currentPeak) * 100;

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPeak = currentPeak;
      maxDrawdownTrough = value;
      maxDrawdownPeakDate = currentPeakDate;
      maxDrawdownTroughDate = date;
    }
  }

  return {
    percentage: maxDrawdown,
    peak: maxDrawdownPeak,
    trough: maxDrawdownTrough,
    peakDate: maxDrawdownPeakDate,
    troughDate: maxDrawdownTroughDate,
  };
}

/**
 * Calculate day-over-day returns in a single pass (O(n)).
 *
 * Return values are decimals (e.g. 0.01 = 1%).
 *
 * Edge cases:
 * - Fewer than 2 points: returns an empty array.
 * - Non-finite values: skipped.
 * - Previous value of 0: skipped to avoid divide-by-zero.
 */
export function calculateDailyReturns(data: Array<{ value: number }>): number[] {
  if (data.length < 2) {
    return [];
  }

  const returns: number[] = [];

  for (let index = 1; index < data.length; index += 1) {
    const previousValue = data[index - 1]?.value;
    const currentValue = data[index]?.value;

    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      continue;
    }

    if (previousValue === 0) {
      continue;
    }

    returns.push((currentValue - previousValue) / previousValue);
  }

  return returns;
}

/**
 * Calculate sample standard deviation in O(n) time.
 *
 * Edge cases:
 * - Fewer than 2 finite values: returns 0.
 * - Zero variance: returns 0.
 */
export function calculateStandardDeviation(values: number[]): number {
  let count = 0;
  let sum = 0;

  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    count += 1;
    sum += value;
  }

  if (count < 2) {
    return 0;
  }

  const mean = sum / count;
  let squaredDiffSum = 0;

  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    const diff = value - mean;
    squaredDiffSum += diff * diff;
  }

  const variance = squaredDiffSum / (count - 1);

  if (variance <= 0) {
    return 0;
  }

  return Math.sqrt(variance);
}

/**
 * Calculate annualized Sharpe ratio from daily returns.
 *
 * Edge cases:
 * - Insufficient data (<2 finite returns): returns null.
 * - Zero volatility: returns null.
 * - Non-finite result: returns null.
 */
export function calculateSharpeRatio(
  dailyReturns: number[],
  annualRiskFreeRate = 0.02,
  tradingDays = 252
): number | null {
  if (tradingDays <= 0) {
    return null;
  }

  let count = 0;
  let sum = 0;

  for (const dailyReturn of dailyReturns) {
    if (!Number.isFinite(dailyReturn)) {
      continue;
    }

    count += 1;
    sum += dailyReturn;
  }

  if (count < 2) {
    return null;
  }

  const averageDailyReturn = sum / count;
  const dailyVolatility = calculateStandardDeviation(dailyReturns);

  if (dailyVolatility === 0) {
    return null;
  }

  const safeRiskFreeRate = Number.isFinite(annualRiskFreeRate) ? annualRiskFreeRate : 0;
  const dailyRiskFreeRate = safeRiskFreeRate / tradingDays;
  const sharpeRatio =
    ((averageDailyReturn - dailyRiskFreeRate) / dailyVolatility) * Math.sqrt(tradingDays);

  if (!Number.isFinite(sharpeRatio)) {
    return null;
  }

  return Number(sharpeRatio.toFixed(4));
}

/**
 * Well-known SPL token mints → symbol lookup.
 * Helius swap events only provide mints; we map the most common ones.
 */
const KNOWN_MINTS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  // add more as needed
};

/**
 * Try to derive a short symbol from a mint address.
 * Returns the known symbol or a truncated mint string.
 */
function mintToSymbol(mint: string): string {
  if (KNOWN_MINTS[mint]) return KNOWN_MINTS[mint];
  // Show first 4 + last 4 chars for unknown mints
  if (mint.length > 10) return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  return mint;
}

/**
 * Transform Helius transaction payload to the UI swap transaction shape.
 */
export function transformSwapTransaction(tx: HeliusTransaction): SwapTransaction {
  const date = new Date(tx.timestamp * 1000);
  const formattedDate = date
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', '');

  let action = '';
  let fromSymbol = '';
  let toSymbol = '';

  // ── Strategy 1: Short description pattern "SOL for USDC" ──
  const desc = tx.description || '';
  // Require at least one letter, reject pure numbers
  const shortMatch = desc.match(/([a-zA-Z]+)\s+for\s+([a-zA-Z]+)/i);
  if (shortMatch) {
    fromSymbol = shortMatch[1].toUpperCase();
    toSymbol = shortMatch[2].toUpperCase();
    // Filter out common non-symbol words that might match
    const invalid = new Set(['SWAPPED', 'UNKNOWN', 'TOKEN', 'FOR']);
    if (!invalid.has(fromSymbol) && !invalid.has(toSymbol)) {
      action = `${fromSymbol} -> ${toSymbol}`;
    }
  }

  // ── Strategy 2: Long description "X swapped 0.001 SOL for 3678777 TOKEN" ──
  if (!action) {
    // Match "swapped [amount] [Symbol] for [amount] [Symbol]"
    // Ensure symbols are not just numbers
    const longMatch = desc.match(
      /swapped\s+[\d,.]+\s+([a-zA-Z0-9]+)\s+for\s+[\d,.]+\s+([a-zA-Z0-9]+)/i,
    );
    if (longMatch) {
      const s1 = longMatch[1].toUpperCase();
      const s2 = longMatch[2].toUpperCase();
      // Heuristic: Symbols usually aren't just numbers. 
      // If pure number, ignore.
      if (!/^\d+$/.test(s1) && !/^\d+$/.test(s2)) {
        fromSymbol = s1;
        toSymbol = s2;
        action = `${fromSymbol} -> ${toSymbol}`;
      }
    }
  }

  // ── Strategy 3: Structured swap events (most reliable for PUMP_AMM etc.) ──
  if (!action && tx.events?.swap) {
    const swap = tx.events.swap;
    const inputSymbol = swap.nativeInput
      ? 'SOL'
      : swap.tokenInputs?.[0]
        ? mintToSymbol(swap.tokenInputs[0].mint)
        : '';
    const outputSymbol = swap.nativeOutput
      ? 'SOL'
      : swap.tokenOutputs?.[0]
        ? mintToSymbol(swap.tokenOutputs[0].mint)
        : '';

    if (inputSymbol && outputSymbol) {
      fromSymbol = inputSymbol;
      toSymbol = outputSymbol;

      // If both are SOL (e.g. wSOL unwrapping might look like this if mintToSymbol maps wSOL to SOL)
      // Check if one is wSOL
      if (fromSymbol === 'SOL' && toSymbol === 'SOL') {
        if (swap.tokenInputs?.[0]?.mint === 'So11111111111111111111111111111111111111112') {
          fromSymbol = 'wSOL';
        }
        if (swap.tokenOutputs?.[0]?.mint === 'So11111111111111111111111111111111111111112') {
          toSymbol = 'wSOL';
        }
      }

      action = `${fromSymbol} -> ${toSymbol}`;
    } else if (inputSymbol) {
      fromSymbol = inputSymbol;
      action = `${fromSymbol} -> ?`;
    } else if (outputSymbol) {
      toSymbol = outputSymbol;
      action = `? -> ${toSymbol}`;
    }
  }

  // ── Strategy 4: Token transfer analysis ──
  if (!action && tx.tokenTransfers?.length) {
    const mints = new Set(tx.tokenTransfers.map((t) => t.mint));
    const symbols = Array.from(mints).map(mintToSymbol);

    if (tx.nativeTransfers?.length) {
      // There were native (SOL) transfers too
      const hasSignificantSol = tx.nativeTransfers.some(
        (nt) => Math.abs(nt.amount) > 1_000_000,
      );
      if (hasSignificantSol && symbols.length > 0) {
        action = `SOL -> ${symbols[0]}`;
        fromSymbol = 'SOL';
        toSymbol = symbols[0];
      }
    }

    if (!action && symbols.length >= 2) {
      fromSymbol = symbols[0];
      toSymbol = symbols[1];
      action = `${fromSymbol} -> ${toSymbol}`;
    } else if (!action && symbols.length === 1) {
      action = `Swap ${symbols[0]}`;
      fromSymbol = symbols[0];
    }
  }

  // Fallback
  if (!action) {
    action = 'Unknown Swap';
  }

  // ── Extract token symbols ──
  const symbolSet = new Set<string>();

  if (fromSymbol) symbolSet.add(fromSymbol.toUpperCase());
  if (toSymbol) symbolSet.add(toSymbol.toUpperCase());

  // From action arrows
  const arrowMatch = action.match(/([a-zA-Z0-9]+)\s*->\s*([a-zA-Z0-9]+)/);
  if (arrowMatch) {
    const s1 = arrowMatch[1].toUpperCase();
    const s2 = arrowMatch[2].toUpperCase();
    if (!/^\d+$/.test(s1)) symbolSet.add(s1);
    if (!/^\d+$/.test(s2)) symbolSet.add(s2);
  }

  // Also extract capitalized words from description that look like symbols
  const descWords = desc.match(/\b[A-Z][A-Z0-9]{1,9}\b/g);
  if (descWords) {
    const excluded = new Set(['THE', 'FOR', 'AND', 'WITH', 'FROM', 'INTO']);
    for (const word of descWords) {
      if (!excluded.has(word)) {
        symbolSet.add(word);
      }
    }
  }

  const status: 'success' | 'failed' = tx.transactionError ? 'failed' : 'success';

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    date: formattedDate,
    platform: tx.source || 'Unknown',
    action,
    status,
    tokenSymbols: Array.from(symbolSet),
  };
}
