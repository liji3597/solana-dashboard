"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
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
  const { publicKey, connected } = useWallet();

  // Derive wallet address: connected wallet or default
  const walletAddress = useMemo(
    () => (connected && publicKey ? publicKey.toBase58() : WHALE_WALLET),
    [connected, publicKey],
  );

  const [historyData, setHistoryData] = useState<PortfolioHistoryPoint[]>([]);
  const [netWorth, setNetWorth] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  const [analyticsData, setAnalyticsData] = useState<JournalStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // ── Fetch portfolio data (re-runs when wallet changes) ──
  useEffect(() => {
    setIsLoadingHistory(true);

    const fetchData = async () => {
      try {
        const params = `?wallet=${walletAddress}`;
        const [pnlResponse, historyResponse] = await Promise.all([
          fetch(`/api/wallet-pnl${params}`),
          fetch(`/api/portfolio-history${params}`),
        ]);

        const pnlData = await pnlResponse.json();
        const parsedNetWorth = Number(pnlData?.netWorth);
        const safeNetWorth =
          Number.isFinite(parsedNetWorth) && parsedNetWorth > 0
            ? parsedNetWorth
            : DEFAULT_NET_WORTH;
        setNetWorth(safeNetWorth);

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
  }, [walletAddress]);

  // ── Fetch transactions ──
  useEffect(() => {
    setIsLoadingTransactions(true);

    const fetchTransactions = async () => {
      try {
        const response = await fetch(
          `/api/transactions?wallet=${walletAddress}`,
        );
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
  }, [walletAddress]);

  // ── Fetch analytics ──
  useEffect(() => {
    if (isLoadingHistory) {
      return;
    }

    let isMounted = true;

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);

      const result = await getJournalStats(walletAddress, netWorth ?? undefined);

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
  }, [isLoadingHistory, netWorth, walletAddress]);

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Solana Journal</h1>
          {connected && publicKey && (
            <p className="mt-1 text-xs text-muted-foreground">
              Analyzing: {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
            </p>
          )}
          {!connected && (
            <p className="mt-1 text-xs text-muted-foreground">
              Viewing default wallet · Connect to analyze your own
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <WalletMultiButton
            style={{
              backgroundColor: "hsl(var(--primary))",
              borderRadius: "0.5rem",
              height: "2.5rem",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </header>

      <main className="space-y-8">
        <KpiCards wallet={walletAddress} />
        <PnlChart data={historyData} isLoading={isLoadingHistory} />
        <TradingMetrics wallet={walletAddress} />
        <TimeAnalysis wallet={walletAddress} />
        <OrderAnalysis wallet={walletAddress} />
        <FeeCompositionChart wallet={walletAddress} />
        <AnalyticsView stats={analyticsData} isLoading={analyticsLoading} />
        <TransactionTable data={transactions} isLoading={isLoadingTransactions} />
      </main>
    </div>
  );
}
