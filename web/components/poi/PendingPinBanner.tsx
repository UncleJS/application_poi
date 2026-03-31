import { MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PendingPinBanner({
  pendingPin,
  onClear
}: {
  pendingPin: { lat: string; lng: string } | null
  onClear: () => void
}) {
  if (!pendingPin) return null

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-700 bg-amber-950/70 px-4 py-3 text-sm text-amber-200">
      <div className="flex gap-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">Pending pin selected</div>
          <div className="text-amber-300/90">Lat {pendingPin.lat}, Lng {pendingPin.lng}. Save a POI to lock it in.</div>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="border-amber-700 bg-amber-950 text-amber-100 hover:bg-amber-900" onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}
