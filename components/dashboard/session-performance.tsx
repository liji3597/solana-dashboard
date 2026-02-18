"use client";

import { Activity, Clock, Target, TrendingUp } from "lucide-react";

interface SessionStat {
    session: string;
    emoji: string;
    txCount: number;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
}

interface SessionPerformanceProps {
    data: SessionStat[];
}

function pnlColor(value: number): string {
    if (value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (value < 0) return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
}

function formatPnl(value: number): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(4)} SOL`;
}

export function SessionPerformance({ data }: SessionPerformanceProps) {
    if (data.length === 0) {
        return (
            <div className="flex h-[120px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                No session data available
            </div>
        );
    }

    return (
        <div>
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Session Performance
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {data.map((session) => (
                    <div
                        key={session.session}
                        className="rounded-lg border border-border bg-card/50 p-4 shadow-sm transition-colors hover:bg-muted/30"
                    >
                        {/* Header */}
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-xl">{session.emoji}</span>
                            <span className="text-sm font-semibold text-card-foreground">
                                {session.session}
                            </span>
                        </div>

                        {/* Metrics grid */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Activity className="h-3 w-3" />
                                    Trades
                                </span>
                                <span className="text-sm font-medium text-card-foreground">
                                    {session.txCount}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <TrendingUp className="h-3 w-3" />
                                    Total PnL
                                </span>
                                <span className={`text-sm font-medium ${pnlColor(session.totalPnlSol)}`}>
                                    {formatPnl(session.totalPnlSol)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Avg PnL
                                </span>
                                <span className={`text-sm font-medium ${pnlColor(session.avgPnlSol)}`}>
                                    {formatPnl(session.avgPnlSol)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Target className="h-3 w-3" />
                                    Win Rate
                                </span>
                                <span className="text-sm font-medium text-card-foreground">
                                    {session.winRate}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
