import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function StatCardSkeleton() {
  return (
    <Card className="p-4 border border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20 skeleton-shimmer" />
          <Skeleton className="h-7 w-24 skeleton-shimmer" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl skeleton-shimmer" />
      </div>
    </Card>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={`border border-border/50 ${className || ""}`}>
      <div className="p-6 space-y-4">
        <Skeleton className="h-5 w-40 skeleton-shimmer" />
        <Skeleton className="h-[240px] w-full rounded-lg skeleton-shimmer" />
      </div>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 skeleton-shimmer" />
          <Skeleton className="h-4 w-64 skeleton-shimmer" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg skeleton-shimmer" />
          <Skeleton className="h-9 w-28 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Stat cards row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Stat cards row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ChartCardSkeleton className="lg:col-span-3" />
      </div>
    </div>
  );
}
