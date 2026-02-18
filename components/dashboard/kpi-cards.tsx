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

interface VolumeFeeApiResponse {
  totalVolumeSol: number;
  totalFeesPaidSol: number;
  totalTransactions: number;
  avgFeePerTxSol: number;
}

interface DashboardData {
  totalPnL: number;
  overallROI: number;
  winRate: string;
  totalTrades: number;
  netWorth: number | null;
  totalVolumeSol: number | null;
  totalFeesPaidSol: number | null;
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

    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch PnL and Volume/Fees in parallel
        const [pnlResponse, volumeFeesResponse] = await Promise.all([
          fetch("/api/wallet-pnl"),
          fetch("/api/volume-fees"),
        ]);

        if (!pnlResponse.ok) {
          const errorBody = await pnlResponse.json().catch(() => null);
          const message = errorBody?.error || "Failed to load wallet PnL";
          throw new Error(message);
        }

        const pnlPayload = (await pnlResponse.json()) as WalletPnlApiResponse;

        // Volume/fees is optional — don't fail if it errors
        let volumePayload: VolumeFeeApiResponse | null = null;
        if (volumeFeesResponse.ok) {
          volumePayload = (await volumeFeesResponse.json()) as VolumeFeeApiResponse;
        }

        if (!isMounted) {
          return;
        }

        const normalizedWinRate = Number(pnlPayload.winRate ?? 0);

        setData({
          totalPnL: pnlPayload.totalPnL,
          overallROI: pnlPayload.overallROI,
          winRate: `${normalizedWinRate.toFixed(2)}%`,
          totalTrades: pnlPayload.totalTrades,
          netWorth: pnlPayload.netWorth,
          totalVolumeSol: volumePayload?.totalVolumeSol ?? null,
          totalFeesPaidSol: volumePayload?.totalFeesPaidSol ?? null,
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

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatSol = (value: number, decimals = 4) => `${value.toFixed(decimals)} SOL`;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        <KpiCard
          title="Total Volume"
          value={
            data && data.totalVolumeSol !== null
              ? formatSol(data.totalVolumeSol)
              : data
                ? "N/A"
                : "--"
          }
          trend="neutral"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Fees Paid"
          value={
            data && data.totalFeesPaidSol !== null
              ? formatSol(data.totalFeesPaidSol, 6)
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
