"use client";

import { useEffect, useState } from "react";
import { AiCoach } from "@/components/dashboard/ai-coach";
import { AnalyticsView } from "@/components/dashboard/analytics-view";
import { FeeCompositionChart } from "@/components/dashboard/fee-composition-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ModeToggle } from "@/components/mode-toggle";
import { PnlChart } from "@/components/dashboard/pnl-chart";
import { TradingMetrics } from "@/components/dashboard/trading-metrics";
import { TimeAnalysis } from "@/components/dashboard/time-analysis";
import { OrderAnalysis } from "@/components/dashboard/order-analysis";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { getJournalStats } from "@/lib/actions/analytics";
import { WHALE_WALLET } from "@/lib/constants/wallets";
import type {
  JournalStats,
  PortfolioHistoryPoint,
  SwapTransaction,
} from "@/lib/types/api";

const DEFAULT_NET_WORTH = 10000;

export default function HomePage() {
  const [historyData, setHistoryData] = useState<PortfolioHistoryPoint[]>([]);
  const [netWorth, setNetWorth] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  const [analyticsData, setAnalyticsData] = useState<JournalStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch wallet PnL and portfolio history in parallel
        const [pnlResponse, historyResponse] = await Promise.all([
          fetch("/api/wallet-pnl"),
          fetch("/api/portfolio-history"),
        ]);

        // Parse wallet PnL for netWorth
        const pnlData = await pnlResponse.json();
        const parsedNetWorth = Number(pnlData?.netWorth);
        const safeNetWorth =
          Number.isFinite(parsedNetWorth) && parsedNetWorth > 0
            ? parsedNetWorth
            : DEFAULT_NET_WORTH;
        setNetWorth(safeNetWorth);

        // Parse portfolio history (real Mobula data or simulated fallback)
        if (historyResponse.ok) {
          const historyResult = await historyResponse.json();
          const points = historyResult?.data ?? [];
          const source = historyResult?.source ?? "unknown";
          console.log(
            `Portfolio history loaded: ${points.length} points (source: ${source})`,
          );
          setHistoryData(points);
        } else {
          console.warn("Portfolio history API failed, showing empty chart");
          setHistoryData([]);
        }
      } catch (error) {
        console.error("Failed to fetch portfolio data:", error);
        setNetWorth(null);
        setHistoryData([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch("/api/transactions");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to fetch transactions");
        }

        setTransactions(result.data ?? []);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        setTransactions([]);
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    if (isLoadingHistory) {
      return;
    }

    let isMounted = true;

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);

      const result = await getJournalStats(WHALE_WALLET, netWorth ?? undefined);

      if (!isMounted) {
        return;
      }

      if (result.success && result.data) {
        setAnalyticsData(result.data);
      } else {
        setAnalyticsData(null);
      }

      setAnalyticsLoading(false);
    };

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [isLoadingHistory, netWorth]);

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Solana Journal</h1>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
          >
            Connect Wallet
          </button>
        </div>
      </header>

      <main className="space-y-8">
        <KpiCards />
        <PnlChart data={historyData} isLoading={isLoadingHistory} />
        <TradingMetrics />
        <TimeAnalysis />
        <OrderAnalysis />
        <FeeCompositionChart />
        <AnalyticsView stats={analyticsData} isLoading={analyticsLoading} />
        <TransactionTable data={transactions} isLoading={isLoadingTransactions} />
      </main>

      <AiCoach />
    </div>
  );
}
