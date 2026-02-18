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

  let action = tx.description || 'Unknown Swap';
  const swapMatch = action.match(/(\w+)\s+for\s+(\w+)/i);

  if (swapMatch) {
    action = `${swapMatch[1]} -> ${swapMatch[2]}`;
  }

  const status: 'success' | 'failed' = tx.transactionError ? 'failed' : 'success';

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    date: formattedDate,
    platform: tx.source || 'Unknown',
    action,
    status,
  };
}
