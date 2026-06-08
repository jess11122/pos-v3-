export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-zinc-700 rounded-xl ${className}`} />
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}
