import type { ReactNode } from 'react'

import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  className
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-8 text-center', className)}>
      <Inbox className="mb-3 h-8 w-8 text-zinc-600" />
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
