"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JournalStats } from "@/lib/types/api";

interface AnalyticsViewProps {
  stats: JournalStats | null;
  isLoading: boolean;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

const RATING_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];
const PIE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
];

function getSharpeStatus(sharpeRatio: number | null | undefined): {
  label: string;
  colorClass: string;
  description: string;
} {
  if (typeof sharpeRatio !== "number" || !Number.isFinite(sharpeRatio)) {
    return {
      label: "Insufficient Data",
      colorClass: "text-muted-foreground",
      description: "Need more stable return data to compute risk-adjusted performance.",
    };
  }

  if (sharpeRatio >= 2) {
    return {
      label: "Excellent",
      colorClass: "text-emerald-600",
      description: "Strong risk-adjusted returns relative to observed volatility.",
    };
  }

  if (sharpeRatio >= 1) {
    return {
      label: "Good",
      colorClass: "text-amber-600",
      description: "Solid risk-adjusted return profile with room for improvement.",
    };
  }

  return {
    label: "Poor",
    colorClass: "text-rose-600",
    description: "Returns are weak for the amount of risk taken.",
  };
}

export function AnalyticsView({ stats, isLoading }: AnalyticsViewProps) {
  const ratingData = useMemo(
    () =>
      RATINGS.map((rating, index) => ({
        rating: `${rating} Star`,
        count: stats?.ratingDistribution?.[rating] ?? 0,
        color: RATING_COLORS[index],
      })),
    [stats]
  );

  const tagData = useMemo(
    () =>
      Object.entries(stats?.tagFrequency ?? {})
        .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
        .slice(0, 8)
        .map(([name, value]) => ({ name, value })),
    [stats]
  );

  const tagEfficiencyData = useMemo(
    () =>
      (stats?.tagWinRates ?? [])
        .slice(0, 8)
        .map((item) => ({
          tag: item.tag,
          winRate: Math.max(0, Math.min(100, Number(item.winRate) || 0)),
          totalTrades: item.totalTrades,
          winningTrades: item.winningTrades,
        })),
    [stats]
  );

  const sharpeStatus = getSharpeStatus(stats?.sharpeRatio);
  const sharpeValue =
    typeof stats?.sharpeRatio === "number" && Number.isFinite(stats.sharpeRatio)
      ? stats.sharpeRatio.toFixed(2)
      : "--";

  if (isLoading) {
    return (
      <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <CardHeader className="px-0 pb-0">
          <CardTitle className="text-lg text-card-foreground">Trading Behavior Analysis</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="h-[300px] animate-pulse rounded bg-muted" />
            <div className="h-[300px] animate-pulse rounded bg-muted" />
            <div className="h-[300px] animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalEntries === 0) {
    return (
      <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <CardHeader className="px-0 pb-0">
          <CardTitle className="text-lg text-card-foreground">Trading Behavior Analysis</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <div className="flex flex-col items-center gap-3 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Start journaling to see insights</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <CardHeader className="px-0 pb-0">
        <CardTitle className="text-lg text-card-foreground">Trading Behavior Analysis</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Risk Analysis</h3>
            <div className="mt-4 rounded-md bg-muted p-4">
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-semibold text-card-foreground">{sharpeValue}</p>
                <p className={`text-sm font-semibold ${sharpeStatus.colorClass}`}>{sharpeStatus.label}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Sharpe Ratio (annualized)</p>
              <p className="mt-2 text-xs text-muted-foreground">{sharpeStatus.description}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Emotional Rating Distribution</h3>
            <div className="mt-4 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="rating"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip
                    formatter={(value) => [value, "Entries"]}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {ratingData.map((item, index) => (
                      <Cell key={`${item.rating}-${index}`} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Common Tags & Patterns</h3>
            <div className="mt-4 h-[300px] w-full">
              {tagData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                  No tags added yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tagData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {tagData.map((item, index) => (
                        <Cell key={`${item.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [value, "Count"]}
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 lg:col-span-3">
            <h3 className="text-sm font-medium text-muted-foreground">Tag Efficiency (Win Rate)</h3>
            <div className="mt-4 h-[300px] w-full">
              {tagEfficiencyData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                  No tag win-rate data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tagEfficiencyData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="tag"
                      width={120}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip
                      labelFormatter={(label) => `Tag: ${label}`}
                      formatter={(value) => [
                        `${Number(value).toFixed(2)}%`,
                        "Win Rate",
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="winRate" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
