import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ErrorBanner({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null

  return (
    <div className={cn('flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/80 px-4 py-3 text-sm text-red-200', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
