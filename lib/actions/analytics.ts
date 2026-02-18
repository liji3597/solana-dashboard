'use server';

import { getPortfolioHistory } from '@/lib/api/valuation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateDailyReturns, calculateSharpeRatio } from '@/lib/utils';
import type { JournalStats } from '@/lib/types/api';
import type { JournalEntry } from '@/lib/types/database.types';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function formatError(error: unknown, context: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return `${context}: ${(error as { message: string }).message}`;
  }

  return `${context}: Unknown error`;
}

function createEmptyStats(): JournalStats {
  return {
    ratingDistribution: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    tagFrequency: {},
    totalEntries: 0,
    sharpeRatio: null,
    tagWinRates: [],
  };
}

function calculatePortfolioSharpeRatio(netWorth?: number): number | null {
  const safeNetWorth = Number(netWorth);

  if (!Number.isFinite(safeNetWorth) || safeNetWorth <= 0) {
    return null;
  }

  const history = getPortfolioHistory(safeNetWorth);
  const dailyReturns = calculateDailyReturns(history);
  return calculateSharpeRatio(dailyReturns);
}

export async function getJournalStats(
  walletAddress: string,
  netWorth?: number,
): Promise<ActionResult<JournalStats>> {
  try {
    const stats = createEmptyStats();
    stats.sharpeRatio = calculatePortfolioSharpeRatio(netWorth);

    if (!walletAddress.trim()) {
      return {
        success: true,
        data: stats,
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('rating,tags')
      .eq('user_wallet', walletAddress);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Pick<JournalEntry, 'rating' | 'tags'>[];
    const tagWinRateMap = new Map<string, { totalTrades: number; winningTrades: number }>();

    rows.forEach((entry) => {
      const rating = Number(entry.rating);
      const isWinningTrade = rating >= 4 && rating <= 5;

      if (rating >= 1 && rating <= 5) {
        stats.ratingDistribution[rating] =
          (stats.ratingDistribution[rating] ?? 0) + 1;
      }

      if (Array.isArray(entry.tags)) {
        entry.tags.forEach((tag) => {
          const normalized = typeof tag === 'string' ? tag.trim() : '';
          if (!normalized) {
            return;
          }

          stats.tagFrequency[normalized] =
            (stats.tagFrequency[normalized] ?? 0) + 1;

          const current =
            tagWinRateMap.get(normalized) ?? { totalTrades: 0, winningTrades: 0 };
          current.totalTrades += 1;

          if (isWinningTrade) {
            current.winningTrades += 1;
          }

          tagWinRateMap.set(normalized, current);
        });
      }
    });

    stats.totalEntries = rows.length;
    stats.tagWinRates = Array.from(tagWinRateMap.entries())
      .map(([tag, value]) => ({
        tag,
        totalTrades: value.totalTrades,
        winningTrades: value.winningTrades,
        winRate:
          value.totalTrades === 0
            ? 0
            : Number(((value.winningTrades / value.totalTrades) * 100).toFixed(2)),
      }))
      .sort(
        (left, right) =>
          right.winRate - left.winRate ||
          right.totalTrades - left.totalTrades ||
          left.tag.localeCompare(right.tag),
      );

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, 'Unable to fetch journal stats'),
    };
  }
}
