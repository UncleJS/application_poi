import type { PoiListItem } from '@/lib/types'
import { toBoolean } from '@/lib/utils'

import { StatusBadge } from '@/components/ui/status-badge'
import { Timestamp } from '@/components/ui/timestamp'

export function PoiCard({
  poi,
  selected,
  onSelect
}: {
  poi: PoiListItem
  selected?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-teal-700 bg-teal-950/30' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{poi.name}</div>
          <div className="mt-1 text-xs text-zinc-400">{poi.category} · owner {poi.owner_username}</div>
        </div>
        <Timestamp iso={poi.updated_at} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{poi.description || 'No description provided.'}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label={toBoolean(poi.is_public) ? 'Public' : 'Private'} />
        {toBoolean(poi.owned_by_me) ? <StatusBadge label="Mine" /> : null}
        {toBoolean(poi.shared_with_me) ? <StatusBadge label="Shared" /> : null}
        {poi.archived_at ? <StatusBadge label="Archived" /> : null}
      </div>
    </button>
  )
}
