import { cn } from '@/lib/utils'

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="h-4 w-1/3 rounded bg-zinc-800" />
          <div className="mt-3 h-3 w-2/3 rounded bg-zinc-900" />
          <div className="mt-2 h-3 w-1/2 rounded bg-zinc-900" />
        </div>
      ))}
    </div>
  )
}
