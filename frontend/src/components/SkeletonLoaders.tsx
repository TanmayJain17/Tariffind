export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`glass-card-static p-6 space-y-4 ${className}`}>
      <div className="skeleton-pulse h-4 w-1/3" />
      <div className="skeleton-pulse h-8 w-2/3" />
      <div className="skeleton-pulse h-4 w-full" />
      <div className="skeleton-pulse h-4 w-4/5" />
      <div className="skeleton-pulse h-32 w-full" />
    </div>
  );
}

export function SkeletonResults() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto px-4 pt-24 pb-12">
      <div className="lg:col-span-3 space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="lg:col-span-2 space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
