"use client";

import { useEffect, useState } from "react";
import {
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Clock,
    Scale,
    TrendingDown,
    TrendingUp,
    Trophy,
} from "lucide-react";

interface TradingMetricsData {
    largestGainUsd: number | null;
    largestGainSymbol: string | null;
    largestLossUsd: number | null;
    largestLossSymbol: string | null;
    averageWinUsd: number | null;
    averageLossUsd: number | null;
    profitFactor: number | null;
    avgTradeDurationMinutes: number | null;
    buyCount: number;
    sellCount: number;
    longShortRatio: string | null;
    totalPositions: number;
    winningPositions: number;
    losingPositions: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});

function formatDuration(minutes: number): string {
    if (minutes < 1) return `${(minutes * 60).toFixed(0)}s`;
    if (minutes < 60) return `${minutes.toFixed(1)}m`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
}

interface MetricItemProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    sublabel?: string;
    valueClassName?: string;
}

function MetricItem({
    icon,
    label,
    value,
    sublabel,
    valueClassName = "text-card-foreground",
}: MetricItemProps) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className={`mt-0.5 text-lg font-semibold leading-tight ${valueClassName}`}>
                    {value}
                </p>
                {sublabel && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
                )}
            </div>
        </div>
    );
}

function SkeletonItem() {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            </div>
        </div>
    );
}

export function TradingMetrics() {
    const [data, setData] = useState<TradingMetricsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchMetrics = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/trading-metrics");

                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(body?.error || "Failed to load trading metrics");
                }

                const payload = (await response.json()) as TradingMetricsData;

                if (isMounted) {
                    setData(payload);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unexpected error");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchMetrics();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    Trading Performance Metrics
                </h3>
            </div>

            {error && (
                <div className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {isLoading ? (
                    <>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <SkeletonItem key={`skeleton-${i}`} />
                        ))}
                    </>
                ) : data ? (
                    <>
                        {/* Largest Gain */}
                        <MetricItem
                            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
                            label="Largest Gain"
                            value={
                                data.largestGainUsd !== null
                                    ? currencyFormatter.format(data.largestGainUsd)
                                    : "N/A"
                            }
                            sublabel={data.largestGainSymbol ?? undefined}
                            valueClassName="text-emerald-600 dark:text-emerald-400"
                        />

                        {/* Largest Loss */}
                        <MetricItem
                            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
                            label="Largest Loss"
                            value={
                                data.largestLossUsd !== null
                                    ? currencyFormatter.format(data.largestLossUsd)
                                    : "N/A"
                            }
                            sublabel={data.largestLossSymbol ?? undefined}
                            valueClassName="text-rose-600 dark:text-rose-400"
                        />

                        {/* Average Win */}
                        <MetricItem
                            icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
                            label="Average Win"
                            value={
                                data.averageWinUsd !== null
                                    ? currencyFormatter.format(data.averageWinUsd)
                                    : "N/A"
                            }
                            sublabel={
                                data.winningPositions > 0
                                    ? `${data.winningPositions} winning positions`
                                    : undefined
                            }
                            valueClassName="text-emerald-600 dark:text-emerald-400"
                        />

                        {/* Average Loss */}
                        <MetricItem
                            icon={<ArrowDownRight className="h-4 w-4 text-rose-500" />}
                            label="Average Loss"
                            value={
                                data.averageLossUsd !== null
                                    ? currencyFormatter.format(data.averageLossUsd)
                                    : "N/A"
                            }
                            sublabel={
                                data.losingPositions > 0
                                    ? `${data.losingPositions} losing positions`
                                    : undefined
                            }
                            valueClassName="text-rose-600 dark:text-rose-400"
                        />

                        {/* Average Trade Duration */}
                        <MetricItem
                            icon={<Clock className="h-4 w-4 text-blue-500" />}
                            label="Avg Trade Interval"
                            value={
                                data.avgTradeDurationMinutes !== null
                                    ? formatDuration(data.avgTradeDurationMinutes)
                                    : "N/A"
                            }
                            sublabel="Between consecutive swaps"
                        />

                        {/* Long/Short Ratio */}
                        <MetricItem
                            icon={<Scale className="h-4 w-4 text-indigo-500" />}
                            label="Buy/Sell Ratio"
                            value={data.longShortRatio ?? "N/A"}
                            sublabel={`${data.buyCount} buys / ${data.sellCount} sells`}
                        />

                        {/* Profit Factor */}
                        <MetricItem
                            icon={<Trophy className="h-4 w-4 text-amber-500" />}
                            label="Profit Factor"
                            value={
                                data.profitFactor !== null
                                    ? data.profitFactor.toFixed(2)
                                    : "N/A"
                            }
                            sublabel="Gross gains / gross losses"
                            valueClassName={
                                data.profitFactor !== null && data.profitFactor >= 1
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : data.profitFactor !== null
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-card-foreground"
                            }
                        />

                        {/* Win/Loss Breakdown */}
                        <MetricItem
                            icon={<BarChart3 className="h-4 w-4 text-violet-500" />}
                            label="W/L Breakdown"
                            value={`${data.winningPositions}W / ${data.losingPositions}L`}
                            sublabel={`of ${data.totalPositions} total positions`}
                        />
                    </>
                ) : null}
            </div>
        </div>
    );
}
