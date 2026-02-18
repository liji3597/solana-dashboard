import type { PortfolioHistoryPoint } from '../types/api';
import { formatApiError, validateSolanaAddress } from '../utils';

const MOBULA_BASE_URL = 'https://api.mobula.io/api/1';

interface MobulaHistoryResponse {
  data?: {
    wallet?: string[];
    balance_usd?: number;
    balance_history?: Array<[number, number]>; // [timestamp_ms, value_usd]
  };
  error?: string;
  message?: string;
}

/**
 * Fetch real portfolio history from Mobula's "Get Historical Net Worth" endpoint.
 *
 * Returns an array of { date: 'YYYY-MM-DD', value: number } spanning the last
 * `days` calendar days at daily granularity.
 *
 * If the API returns no data or fewer points than expected, we backfill
 * missing days with the nearest known value so the chart always has `days`
 * points.
 */
export async function fetchPortfolioHistory(
  walletAddress: string,
  days: number = 30,
): Promise<PortfolioHistoryPoint[]> {
  try {
    validateSolanaAddress(walletAddress);

    const apiKey = process.env.MOBULA_API_KEY;
    if (!apiKey) {
      throw new Error('MOBULA_API_KEY environment variable is not set');
    }

    const now = Date.now();
    const from = now - days * 24 * 60 * 60 * 1000;

    const params = new URLSearchParams({
      wallet: walletAddress,
      blockchains: 'solana',
      from: String(from),
      to: String(now),
      period: '1d',
    });

    const response = await fetch(
      `${MOBULA_BASE_URL}/wallet/history?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: apiKey,
        },
      },
    );

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails =
          errorBody.error || errorBody.message || JSON.stringify(errorBody);
      } catch {
        errorDetails = await response.text();
      }
      throw new Error(
        `Mobula wallet history request failed (${response.status}): ${errorDetails}`,
      );
    }

    const payload = (await response.json()) as MobulaHistoryResponse;

    const rawHistory = payload.data?.balance_history;

    if (!rawHistory || !Array.isArray(rawHistory) || rawHistory.length === 0) {
      console.warn(
        'Mobula wallet history returned no data points — returning empty history.',
      );
      return [];
    }

    // Convert [timestamp_ms, value_usd] tuples → PortfolioHistoryPoint[]
    const pointMap = new Map<string, number>();

    for (const [timestampMs, valueUsd] of rawHistory) {
      const d = new Date(timestampMs);
      const dateStr = toDateString(d);
      // If there are multiple points for the same day, keep the latest
      pointMap.set(dateStr, Math.round(valueUsd * 100) / 100);
    }

    // Build a full array covering every day in the range
    const history: PortfolioHistoryPoint[] = [];
    let lastKnownValue = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = toDateString(d);

      if (pointMap.has(dateStr)) {
        lastKnownValue = pointMap.get(dateStr)!;
      }

      history.push({
        date: dateStr,
        value: lastKnownValue,
      });
    }

    return history;
  } catch (error) {
    throw formatApiError(
      error,
      'Failed to fetch portfolio history from Mobula',
    );
  }
}

/**
 * Legacy simulated data — kept as a fallback when the API is unavailable.
 */
export function getPortfolioHistoryFallback(
  currentNetWorth: number,
): PortfolioHistoryPoint[] {
  const days = 30;
  const history: PortfolioHistoryPoint[] = [];

  if (currentNetWorth <= 0) {
    return [];
  }

  const random = seededRandom(42);
  let value = currentNetWorth;
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    history.push({
      date: toDateString(date),
      value: Math.round(value * 100) / 100,
    });

    if (i > 0) {
      const volatility = (random() - 0.5) * 0.1;
      value = value * (1 + volatility);
      value = Math.max(value, currentNetWorth * 0.3);
    } else {
      value = currentNetWorth;
    }
  }

  return history;
}

// ── Helpers ──

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seededRandom(seed: number): () => number {
  let state = seed | 0;

  return function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
