"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Fuel, TrendingUp } from "lucide-react";
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeeCompositionItem {
    name: string;
    value: number;
    percentage: number;
}

interface VolumeFeeData {
    totalVolumeSol: number;
    totalFeesPaidSol: number;
    totalTransactions: number;
    feeComposition: FeeCompositionItem[];
    avgFeePerTxSol: number;
}

const FEE_COLORS = [
    "#6366f1", // Indigo
    "#0ea5e9", // Sky
    "#22c55e", // Green
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#14b8a6", // Teal
    "#f97316", // Orange
];

const solFormatter = (value: number, decimals = 4) => {
    return `${value.toFixed(decimals)} SOL`;
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        name: string;
        value: number;
        payload: FeeCompositionItem & { fill: string };
    }>;
}

function FeeTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const item = payload[0];

    return (
        <div
            className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
            style={{ color: "var(--popover-foreground)" }}
        >
            <div className="flex items-center gap-2">
                <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.payload.fill }}
                />
                <span className="text-sm font-medium">{item.name}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
                {solFormatter(item.value, 6)} ({item.payload.percentage}%)
            </div>
        </div>
    );
}

export function FeeCompositionChart({ wallet }: { wallet: string }) {
    const [data, setData] = useState<VolumeFeeData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/volume-fees?wallet=${wallet}`);

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => null);
                    throw new Error(errorBody?.error || "Failed to load volume/fee data");
                }

                const payload = (await response.json()) as VolumeFeeData;

                if (!isMounted) return;
                setData(payload);
            } catch (err) {
                if (!isMounted) return;
                const message =
                    err instanceof Error ? err.message : "Unexpected error";
                setError(message);
                setData(null);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [wallet]);

    const chartData = useMemo(
        () =>
            (data?.feeComposition ?? []).map((item, index) => ({
                ...item,
                fill: FEE_COLORS[index % FEE_COLORS.length],
            })),
        [data]
    );

    if (isLoading) {
        return (
            <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
                <CardHeader className="px-0 pb-0">
                    <CardTitle className="text-lg text-card-foreground">
                        Volume & Fee Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Summary stats skeleton */}
                        <div className="space-y-4">
                            <div className="h-24 animate-pulse rounded-lg bg-muted" />
                            <div className="h-24 animate-pulse rounded-lg bg-muted" />
                            <div className="h-24 animate-pulse rounded-lg bg-muted" />
                        </div>
                        {/* Pie chart skeleton */}
                        <div className="h-[340px] animate-pulse rounded-lg bg-muted" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
                <CardHeader className="px-0 pb-0">
                    <CardTitle className="text-lg text-card-foreground">
                        Volume & Fee Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                        {error}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <CardHeader className="px-0 pb-0">
                <CardTitle className="text-lg text-card-foreground">
                    Volume & Fee Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Summary KPI stats */}
                    <div className="space-y-4">
                        {/* Total Volume */}
                        <div className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 p-5 transition-all hover:shadow-md dark:from-indigo-500/20 dark:to-indigo-600/10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Total Volume
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-card-foreground">
                                        {solFormatter(data?.totalVolumeSol ?? 0)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Across {data?.totalTransactions ?? 0} transactions
                                    </p>
                                </div>
                                <div className="rounded-lg bg-indigo-500/15 p-2.5 dark:bg-indigo-500/25">
                                    <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </div>
                        </div>

                        {/* Total Fees */}
                        <div className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 transition-all hover:shadow-md dark:from-amber-500/20 dark:to-amber-600/10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Total Fees Paid
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-card-foreground">
                                        {solFormatter(data?.totalFeesPaidSol ?? 0, 6)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Network transaction fees
                                    </p>
                                </div>
                                <div className="rounded-lg bg-amber-500/15 p-2.5 dark:bg-amber-500/25">
                                    <Fuel className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                            </div>
                        </div>

                        {/* Average Fee per TX */}
                        <div className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5 transition-all hover:shadow-md dark:from-emerald-500/20 dark:to-emerald-600/10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Avg Fee per Transaction
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-card-foreground">
                                        {solFormatter(data?.avgFeePerTxSol ?? 0, 6)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Average cost per trade
                                    </p>
                                </div>
                                <div className="rounded-lg bg-emerald-500/15 p-2.5 dark:bg-emerald-500/25">
                                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fee Composition Pie Chart */}
                    <div className="rounded-lg border border-border p-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Fee Composition by Platform
                        </h3>
                        <div className="mt-2 h-[300px] w-full">
                            {chartData.length === 0 ? (
                                <div className="flex h-full items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                                    No fee data available
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="45%"
                                            innerRadius={55}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            animationBegin={0}
                                            animationDuration={800}
                                        >
                                            {chartData.map((item, index) => (
                                                <Cell
                                                    key={`fee-${item.name}-${index}`}
                                                    fill={item.fill}
                                                    stroke="var(--card)"
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<FeeTooltip />} />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            formatter={(value: string) => (
                                                <span className="text-xs text-muted-foreground">
                                                    {value}
                                                </span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
