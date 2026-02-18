"use client";

import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface DailyPnlPoint {
    date: string;
    pnl: number;
    txCount: number;
}

interface DailyPnlChartProps {
    data: DailyPnlPoint[];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});

function formatDateLabel(dateStr: string): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value: number; payload: DailyPnlPoint }>;
    label?: string;
}) {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0].payload;
    const pnl = point.pnl;
    const isPositive = pnl >= 0;

    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
            <p className="font-medium text-popover-foreground">
                {formatDateLabel(label ?? "")}
            </p>
            <p className={isPositive ? "text-emerald-500" : "text-rose-500"}>
                PnL: {isPositive ? "+" : ""}
                {pnl.toFixed(4)} SOL
            </p>
            <p className="text-xs text-muted-foreground">
                {point.txCount} transaction{point.txCount !== 1 ? "s" : ""}
            </p>
        </div>
    );
}

export function DailyPnlChart({ data }: DailyPnlChartProps) {
    const yDomain = useMemo(() => {
        if (data.length === 0) return [0, 1];
        const values = data.map((d) => d.pnl);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = Math.max(Math.abs(max - min) * 0.1, 0.001);
        return [min - padding, max + padding];
    }, [data]);

    if (data.length === 0) {
        return (
            <div className="flex h-[250px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                No daily PnL data available
            </div>
        );
    }

    return (
        <div>
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Daily PnL (SOL)
            </h4>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDateLabel}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                            axisLine={{ stroke: "var(--border)" }}
                            tickLine={{ stroke: "var(--border)" }}
                            minTickGap={20}
                        />
                        <YAxis
                            tickFormatter={(v: number) => `${v.toFixed(2)}`}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                            axisLine={{ stroke: "var(--border)" }}
                            tickLine={{ stroke: "var(--border)" }}
                            width={55}
                            domain={yDomain}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                            {data.map((entry) => (
                                <Cell
                                    key={entry.date}
                                    fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"}
                                    fillOpacity={0.85}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
