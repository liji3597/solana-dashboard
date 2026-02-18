"use client";

import { useState, useEffect } from "react";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PnlChart } from "@/components/dashboard/pnl-chart";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { getPortfolioHistory } from "@/lib/api/valuation";
import type { PortfolioHistoryPoint, SwapTransaction } from "@/lib/types/api";

export default function HomePage() {
  const [historyData, setHistoryData] = useState<PortfolioHistoryPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // 从 API 获取当前净值
        const response = await fetch("/api/wallet-pnl");
        const data = await response.json();

        const netWorth = data.netWorth ?? 10000; // 默认值
        const history = getPortfolioHistory(netWorth);

        setHistoryData(history);
      } catch (error) {
        console.error("Failed to generate portfolio history:", error);
        setHistoryData([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        // 通过 API 路由获取交易数据（避免在客户端暴露 API key）
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

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Solana Journal</h1>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
        >
          Connect Wallet
        </button>
      </header>
      <main className="space-y-8">
        <KpiCards />
        <PnlChart data={historyData} isLoading={isLoadingHistory} />
        <TransactionTable data={transactions} isLoading={isLoadingTransactions} />
      </main>
    </div>
  );
}
