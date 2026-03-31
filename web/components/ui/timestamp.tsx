import { formatLocalTimestamp } from '@/lib/format'

export function Timestamp({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-zinc-500">—</span>

  return (
    <time dateTime={iso} className="font-mono text-xs text-zinc-400">
      {formatLocalTimestamp(iso)}
    </time>
  )
}
