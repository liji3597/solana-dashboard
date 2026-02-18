"use client";

import { useMemo } from "react";

interface HourlyActivityPoint {
    hour: number;
    count: number;
}

interface HourlyHeatmapProps {
    data: HourlyActivityPoint[];
}

function getIntensityClass(count: number, maxCount: number): string {
    if (count === 0 || maxCount === 0) return "bg-muted/30";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "bg-emerald-500 dark:bg-emerald-600";
    if (ratio > 0.5) return "bg-emerald-400 dark:bg-emerald-500";
    if (ratio > 0.25) return "bg-emerald-300 dark:bg-emerald-700";
    return "bg-emerald-200 dark:bg-emerald-800";
}

function formatHour(hour: number): string {
    if (hour === 0) return "12a";
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return "12p";
    return `${hour - 12}p`;
}

function getSessionLabel(hour: number): string {
    if (hour >= 0 && hour < 8) return "Asia";
    if (hour >= 8 && hour < 16) return "Europe";
    return "US";
}

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
    const maxCount = useMemo(() => {
        return Math.max(...data.map((d) => d.count), 1);
    }, [data]);

    const totalTx = useMemo(() => {
        return data.reduce((sum, d) => sum + d.count, 0);
    }, [data]);

    if (totalTx === 0) {
        return (
            <div className="flex h-[140px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                No hourly activity data
            </div>
        );
    }

    return (
        <div>
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Hour-of-Day Activity (UTC)
            </h4>

            {/* Session labels */}
            <div className="mb-1 grid grid-cols-3 text-center text-[10px] font-medium text-muted-foreground">
                <span>🌏 Asia (00–08)</span>
                <span>🌍 Europe (08–16)</span>
                <span>🌎 US (16–24)</span>
            </div>

            {/* Heatmap grid — 24 cells */}
            <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {data.map((point) => (
                    <div
                        key={point.hour}
                        className={`
              group relative flex aspect-square items-center justify-center
              rounded-sm text-[10px] font-medium transition-all
              ${getIntensityClass(point.count, maxCount)}
              ${point.count > 0 ? "text-white" : "text-muted-foreground"}
            `}
                        title={`${formatHour(point.hour)} (${getSessionLabel(point.hour)}): ${point.count} tx`}
                    >
                        {point.count > 0 ? point.count : "·"}

                        {/* Tooltip on hover */}
                        <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-lg group-hover:block">
                            {formatHour(point.hour)}: {point.count} tx
                        </div>
                    </div>
                ))}
            </div>

            {/* Hour labels */}
            <div className="mt-0.5 grid text-center text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {data.map((point) => (
                    <span key={`label-${point.hour}`}>
                        {point.hour % 3 === 0 ? formatHour(point.hour) : ""}
                    </span>
                ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                <span>Less</span>
                <div className="h-3 w-3 rounded-sm bg-muted/30" />
                <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" />
                <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
                <div className="h-3 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
                <div className="h-3 w-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
                <span>More</span>
            </div>
        </div>
    );
}
