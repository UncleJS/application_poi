import { Badge } from '@/components/ui/badge'

export function StatusBadge({ label }: { label: 'Public' | 'Private' | 'Shared' | 'Mine' | 'Archived' }) {
  const styles = {
    Public: 'border-emerald-800 bg-emerald-950 text-emerald-200',
    Private: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    Shared: 'border-blue-800 bg-blue-950 text-blue-200',
    Mine: 'border-teal-800 bg-teal-950 text-teal-200',
    Archived: 'border-zinc-700 bg-zinc-800 text-zinc-400 italic'
  } as const

  return <Badge className={styles[label]}>{label}</Badge>
}
