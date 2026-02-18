import type { PortfolioHistoryPoint } from '../types/api';

function seededRandom(seed: number): () => number {
  let state = seed | 0;

  return function random(): number {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate simulated portfolio history data.
 *
 * Backtracks 30 days from current net worth with daily random volatility in -5% to +5%.
 */
export function getPortfolioHistory(
  currentNetWorth: number
): PortfolioHistoryPoint[] {
  const days = 30;
  const history: PortfolioHistoryPoint[] = [];

  // Boundary handling
  if (currentNetWorth <= 0) {
    return [];
  }

  const random = seededRandom(42);

  // Generate from 30 days ago
  let value = currentNetWorth;
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    history.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });

    // Generate random volatility for previous day (-5% to +5%)
    if (i > 0) {
      const volatility = (random() - 0.5) * 0.1;
      value = value * (1 + volatility);

      // Prevent negative values: keep at least 30% of current net worth
      value = Math.max(value, currentNetWorth * 0.3);
    } else {
      // Force last day back to current net worth
      value = currentNetWorth;
    }
  }

  return history;
}
