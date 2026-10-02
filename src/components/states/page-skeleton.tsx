import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중…</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
