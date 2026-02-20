"use client";

import { useEffect, useState } from "react";
import {
    BarChart3,
    Layers,
    Zap,
    Clock,
    HelpCircle,
} from "lucide-react";
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

// ─── Types ───

type OrderType = "Market" | "Limit" | "DCA" | "Unknown";

interface OrderTypeStat {
    type: OrderType;
    count: number;
    percentage: string;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
}

interface PlatformStat {
    platform: string;
    count: number;
    percentage: string;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
    orderType: OrderType;
}

interface OrderAnalysisData {
    orderTypes: OrderTypeStat[];
    platforms: PlatformStat[];
    totalSwaps: number;
}

// ─── Constants ───

const ORDER_TYPE_CONFIG: Record<
    OrderType,
    { color: string; icon: React.ReactNode; label: string }
> = {
    Market: {
        color: "#10b981",
        icon: <Zap className="h-4 w-4" />,
        label: "Market Order",
    },
    Limit: {
        color: "#6366f1",
        icon: <Clock className="h-4 w-4" />,
        label: "Limit Order",
    },
    DCA: {
        color: "#f59e0b",
        icon: <Layers className="h-4 w-4" />,
        label: "DCA",
    },
    Unknown: {
        color: "#6b7280",
        icon: <HelpCircle className="h-4 w-4" />,
        label: "Other",
    },
};

function pnlColor(value: number): string {
    if (value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (value < 0) return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
}

function formatPnl(value: number): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(4)}`;
}

// ─── Sub-components ───

function CustomTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { percentage: string } }>;
}) {
    if (!active || !payload?.[0]) return null;
    const d = payload[0];
    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
            <p className="font-medium text-popover-foreground">{d.name}</p>
            <p className="text-muted-foreground">
                {d.value} trades ({d.payload.percentage}%)
            </p>
        </div>
    );
}

function SkeletonLoader() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="h-[200px] animate-pulse rounded bg-muted/50" />
                <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-[56px] animate-pulse rounded bg-muted/50" />
                    ))}
                </div>
            </div>
            <div className="h-[120px] animate-pulse rounded bg-muted/50" />
        </div>
    );
}

// ─── Main component ───

export function OrderAnalysis({ wallet }: { wallet: string }) {
    const [data, setData] = useState<OrderAnalysisData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/order-analysis?wallet=${wallet}`);

                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(body?.error || "Failed to load order analysis");
                }

                const payload = (await response.json()) as OrderAnalysisData;
                if (isMounted) setData(payload);
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unexpected error");
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => {
            isMounted = false;
        };
    }, [wallet]);

    return (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            {/* Header */}
            <div className="mb-5 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    Order Type Analysis
                </h3>
                {data && (
                    <span className="ml-auto text-xs text-muted-foreground">
                        {data.totalSwaps} swap{data.totalSwaps !== 1 ? "s" : ""} analyzed
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                    {error}
                </div>
            )}

            {isLoading ? (
                <SkeletonLoader />
            ) : data ? (
                <div className="space-y-5">
                    {/* Top row: Donut chart + Order type cards */}
                    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                        {/* Donut chart */}
                        <div className="flex flex-col items-center">
                            <div className="h-[200px] w-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.orderTypes.map((t) => ({
                                                name: t.type,
                                                value: t.count,
                                                percentage: t.percentage,
                                            }))}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {data.orderTypes.map((t) => (
                                                <Cell
                                                    key={t.type}
                                                    fill={ORDER_TYPE_CONFIG[t.type]?.color ?? "#6b7280"}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend */}
                            <div className="mt-2 flex flex-wrap justify-center gap-3">
                                {data.orderTypes.map((t) => {
                                    const cfg = ORDER_TYPE_CONFIG[t.type];
                                    return (
                                        <div key={t.type} className="flex items-center gap-1.5 text-xs">
                                            <div
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: cfg?.color ?? "#6b7280" }}
                                            />
                                            <span className="text-muted-foreground">
                                                {cfg?.label ?? t.type} ({t.percentage}%)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Order type stat cards */}
                        <div className="space-y-2">
                            {data.orderTypes.map((t) => {
                                const cfg = ORDER_TYPE_CONFIG[t.type];
                                return (
                                    <div
                                        key={t.type}
                                        className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3 transition-colors hover:bg-muted/30"
                                    >
                                        <div
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                            style={{ backgroundColor: `${cfg?.color ?? "#6b7280"}20` }}
                                        >
                                            <span style={{ color: cfg?.color ?? "#6b7280" }}>
                                                {cfg?.icon}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-card-foreground">
                                                {cfg?.label ?? t.type}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {t.count} trades · Win Rate {t.winRate}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${pnlColor(t.totalPnlSol)}`}>
                                                {formatPnl(t.totalPnlSol)} SOL
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                avg {formatPnl(t.avgPnlSol)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Platform breakdown table */}
                    {data.platforms.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                                Platform Breakdown
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                            <th className="pb-2 pr-4 font-medium">Platform</th>
                                            <th className="pb-2 pr-4 font-medium">Type</th>
                                            <th className="pb-2 pr-4 text-right font-medium">Trades</th>
                                            <th className="pb-2 pr-4 text-right font-medium">PnL (SOL)</th>
                                            <th className="pb-2 text-right font-medium">Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.platforms.map((p) => (
                                            <tr
                                                key={p.platform}
                                                className="border-b border-border/50 last:border-0"
                                            >
                                                <td className="py-2 pr-4 font-medium text-card-foreground">
                                                    {p.platform}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span
                                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                                        style={{
                                                            backgroundColor: `${ORDER_TYPE_CONFIG[p.orderType]?.color ?? "#6b7280"}15`,
                                                            color: ORDER_TYPE_CONFIG[p.orderType]?.color ?? "#6b7280",
                                                        }}
                                                    >
                                                        {p.orderType}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-right text-muted-foreground">
                                                    {p.count}
                                                    <span className="ml-1 text-[10px]">({p.percentage}%)</span>
                                                </td>
                                                <td className={`py-2 pr-4 text-right font-medium ${pnlColor(p.totalPnlSol)}`}>
                                                    {formatPnl(p.totalPnlSol)}
                                                </td>
                                                <td className="py-2 text-right text-muted-foreground">
                                                    {p.winRate}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
