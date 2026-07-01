import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Pre-composed skeleton rows for common loading patterns.
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass border-soft rounded-2xl p-5 space-y-3 animate-fade-in", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("glass border-soft rounded-xl p-4 flex items-center gap-3 animate-fade-in", className)}>
      <Skeleton className="h-11 w-11 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function SkeletonRow({ cols = 5, className }: { cols?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-3 border-b border-border/40", className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === 0 ? "w-40" : i === cols - 1 ? "w-16 ml-auto" : "flex-1")}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonStat, SkeletonRow };
