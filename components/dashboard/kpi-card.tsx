interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: "positive" | "negative" | "neutral";
  isLoading: boolean;
}

const trendColors: Record<NonNullable<KpiCardProps["trend"]>, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-card-foreground",
};

export function KpiCard({ title, value, trend = "neutral", isLoading }: KpiCardProps) {
  const valueClassName = trendColors[trend];

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-3 text-3xl font-semibold">
        {isLoading ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <span className={valueClassName}>{value}</span>
        )}
      </div>
    </div>
  );
}
