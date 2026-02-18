import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`kpi-skeleton-${index}`} className="gap-3">
          <CardHeader className="space-y-2 pb-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-14" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card className="gap-4 rounded-lg">
      <CardHeader className="flex flex-col gap-2 pb-0 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}

function AnalyticsSkeleton() {
  return (
    <Card className="gap-4 rounded-lg">
      <CardHeader className="pb-0">
        <Skeleton className="h-6 w-60" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg lg:col-span-3" />
        </div>
      </CardContent>
    </Card>
  )
}

function TransactionTableSkeleton() {
  return (
    <Card className="gap-4 rounded-lg">
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`tx-row-${index}`} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <KpiCardsSkeleton />
      <ChartSkeleton />
      <AnalyticsSkeleton />
      <TransactionTableSkeleton />
    </div>
  )
}
