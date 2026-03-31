import type { PoiListItem } from '@/lib/types'

import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { SkeletonRows } from '@/components/ui/skeleton-rows'
import { PoiCard } from '@/components/poi/PoiCard'

export function PoiList({
  items,
  loading,
  error,
  selectedPoiId,
  onSelect
}: {
  items: PoiListItem[]
  loading: boolean
  error?: string | null
  selectedPoiId?: string | null
  onSelect: (poi: PoiListItem) => void
}) {
  if (loading) return <SkeletonRows rows={6} />
  if (error) return <ErrorBanner message={error} />
  if (items.length === 0) {
    return <EmptyState title="No POIs found" description="Try broadening your filters or create a new POI from a map pin." />
  }

  return (
    <div className="app-scrollbar grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
      {items.map((poi) => (
        <PoiCard key={poi.id} poi={poi} selected={poi.id === selectedPoiId} onSelect={() => onSelect(poi)} />
      ))}
    </div>
  )
}
