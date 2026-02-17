"use client";

import { useEffect, useState } from "react";

import { KpiCard } from "@/components/dashboard/kpi-card";

interface WalletPnlApiResponse {
  totalPnL: number;
  overallROI: number;
  winRate: number;
  totalTrades: number;
  netWorth: number | null;
}

interface DashboardData {
  totalPnL: number;
  overallROI: number;
  winRate: string;
  totalTrades: number;
  netWorth: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function KpiCards() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchWalletPnL = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/wallet-pnl");

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message = errorBody?.error || "Failed to load wallet PnL";
          throw new Error(message);
        }

        const payload = (await response.json()) as WalletPnlApiResponse;

        if (!isMounted) {
          return;
        }

        const normalizedWinRate = Number(payload.winRate ?? 0);

        setData({
          totalPnL: payload.totalPnL,
          overallROI: payload.overallROI,
          winRate: `${normalizedWinRate.toFixed(2)}%`,
          totalTrades: payload.totalTrades,
          netWorth: payload.netWorth,
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message = err instanceof Error ? err.message : "Unexpected error";
        setError(message);
        setData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchWalletPnL();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatCurrency = (value: number) => currencyFormatter.format(value);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total PnL"
          value={data ? formatCurrency(data.totalPnL) : "--"}
          trend={data ? (data.totalPnL >= 0 ? "positive" : "negative") : "neutral"}
          isLoading={isLoading}
        />
        <KpiCard
          title="Win Rate"
          value={data?.winRate ?? "--"}
          trend="neutral"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Trades"
          value={data?.totalTrades ?? "--"}
          trend="neutral"
          isLoading={isLoading}
        />
        <KpiCard
          title="Net Worth"
          value={
            data && data.netWorth !== null
              ? formatCurrency(data.netWorth)
              : data
                ? "N/A"
                : "--"
          }
          trend="neutral"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
