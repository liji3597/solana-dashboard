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
 * 将 Helius 原始交易数据转换为 UI 展示格式
 */
export function transformSwapTransaction(tx: HeliusTransaction): SwapTransaction {
  // 格式化日期
  const date = new Date(tx.timestamp * 1000);
  const formattedDate = date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');

  // 提取交易对信息（从 description 或 tokenTransfers）
  let action = tx.description || 'Unknown Swap';

  // 简化描述（例如："Swapped 1 SOL for 50 USDC" -> "SOL -> USDC"）
  const swapMatch = action.match(/(\w+)\s+for\s+(\w+)/i);
  if (swapMatch) {
    action = `${swapMatch[1]} -> ${swapMatch[2]}`;
  }

  // 确定状态
  const status = tx.transactionError ? 'failed' : 'success';

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    date: formattedDate,
    platform: tx.source || 'Unknown',
    action,
    status,
  };
}
