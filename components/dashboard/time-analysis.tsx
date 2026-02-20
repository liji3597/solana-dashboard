"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { DailyPnlChart } from "./daily-pnl-chart";
import { HourlyHeatmap } from "./hourly-heatmap";
import { SessionPerformance } from "./session-performance";

interface DailyPnlPoint {
    date: string;
    pnl: number;
    txCount: number;
}

interface HourlyActivityPoint {
    hour: number;
    count: number;
}

interface SessionStat {
    session: string;
    emoji: string;
    txCount: number;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
}

interface TimeAnalysisData {
    dailyPnl: DailyPnlPoint[];
    hourlyActivity: HourlyActivityPoint[];
    sessionStats: SessionStat[];
}

function Skeleton() {
    return (
        <div className="space-y-6">
            {/* Daily PnL skeleton */}
            <div>
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-[250px] animate-pulse rounded bg-muted/50" />
            </div>
            {/* Heatmap + Session skeleton */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                    <div className="mb-3 h-4 w-36 animate-pulse rounded bg-muted" />
                    <div className="h-[100px] animate-pulse rounded bg-muted/50" />
                </div>
                <div>
                    <div className="mb-3 h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-[140px] animate-pulse rounded bg-muted/50" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TimeAnalysis({ wallet }: { wallet: string }) {
    const [data, setData] = useState<TimeAnalysisData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/time-analysis?wallet=${wallet}`);

                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(body?.error || "Failed to load time analysis");
                }

                const payload = (await response.json()) as TimeAnalysisData;

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

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [wallet]);

    return (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            {/* Header */}
            <div className="mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    Time Dimension Analysis
                </h3>
            </div>

            {error && (
                <div className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                    {error}
                </div>
            )}

            {isLoading ? (
                <Skeleton />
            ) : data ? (
                <div className="space-y-6">
                    {/* Daily PnL bar chart — full width */}
                    <DailyPnlChart data={data.dailyPnl} />

                    {/* Heatmap + Session side by side */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <HourlyHeatmap data={data.hourlyActivity} />
                        <SessionPerformance data={data.sessionStats} />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
