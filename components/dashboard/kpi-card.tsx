interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: "positive" | "negative" | "neutral";
  isLoading: boolean;
}

const trendColors: Record<NonNullable<KpiCardProps["trend"]>, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-slate-900",
};

export function KpiCard({ title, value, trend = "neutral", isLoading }: KpiCardProps) {
  const valueClassName = trendColors[trend];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-3 text-3xl font-semibold">
        {isLoading ? (
          <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        ) : (
          <span className={valueClassName}>{value}</span>
        )}
      </div>
    </div>
  );
}
