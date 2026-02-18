"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PortfolioHistoryPoint } from "@/lib/types/api";
import { calculateMaxDrawdown } from "@/lib/utils";

interface PnlChartProps {
  data: PortfolioHistoryPoint[];
  isLoading: boolean;
}

const axisDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string, formatter: Intl.DateTimeFormat): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function formatYAxisValue(value: number): string {
  const inThousands = value / 1000;
  const formatted = inThousands >= 10 ? inThousands.toFixed(1) : inThousands.toFixed(2);

  return `$${formatted.replace(/\.0$/, "")}k`;
}

export function PnlChart({ data, isLoading }: PnlChartProps) {
  const gradientId = useId().replace(/:/g, "");

  const maxDrawdown = useMemo(() => calculateMaxDrawdown(data), [data]);
  const maxDrawdownLabel = `${maxDrawdown.percentage.toFixed(2)}%`;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-5 w-52 animate-pulse rounded bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-6 h-[300px] w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Portfolio Value (30 Days)</h3>
          <p className="text-sm font-semibold text-rose-600">Max Drawdown: --</p>
        </div>
        <div className="mt-6 flex h-[300px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Portfolio Value (30 Days)</h3>
        <p className="text-sm font-semibold text-rose-600">Max Drawdown: {maxDrawdownLabel}</p>
      </div>

      <div className="mt-6 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(String(value), axisDateFormatter)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value) => formatYAxisValue(Number(value))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
              width={60}
            />
            <Tooltip
              labelFormatter={(label) => formatDate(String(label), tooltipDateFormatter)}
              formatter={(value) => [currencyFormatter.format(Number(value)), "Value"]}
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--popover-foreground)",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
