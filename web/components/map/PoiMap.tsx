'use client'

import { useEffect } from 'react'
import type { LeafletMouseEvent } from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents
} from 'react-leaflet'

import type { PoiListItem } from '@/lib/types'
import { toBoolean } from '@/lib/utils'

const DEFAULT_CENTER: [number, number] = [-25.8927, 28.1292]

function ClickHandler({
  enabled,
  onPickPin
}: {
  enabled: boolean
  onPickPin?: (coords: { lat: string; lng: string }) => void
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (!enabled || !onPickPin) return

      onPickPin({
        lat: event.latlng.lat.toFixed(6),
        lng: event.latlng.lng.toFixed(6)
      })
    }
  })

  return null
}

function ViewportController({
  items,
  selectedPoi,
  pendingPin
}: {
  items: PoiListItem[]
  selectedPoi?: PoiListItem | null
  pendingPin?: { lat: string; lng: string } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedPoi) {
      const lat = Number(selectedPoi.lat)
      const lng = Number(selectedPoi.lng)

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
      }

      return
    }

    if (pendingPin) {
      map.setView([Number(pendingPin.lat), Number(pendingPin.lng)], Math.max(map.getZoom(), 14), {
        animate: true
      })
      return
    }

    if (items.length === 0) return

    const bounds = items
      .map((item) => [Number(item.lat), Number(item.lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))

    if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: true })
      return
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [32, 32] })
    }
  }, [items, map, pendingPin, selectedPoi])

  return null
}

export function PoiMap({
  items,
  selectedPoiId,
  pendingPin,
  onPickPin,
  onSelect,
  interactive = true
}: {
  items: PoiListItem[]
  selectedPoiId?: string | null
  pendingPin?: { lat: string; lng: string } | null
  onPickPin?: (coords: { lat: string; lng: string }) => void
  onSelect: (poi: PoiListItem) => void
  interactive?: boolean
}) {
  const selectedPoi = items.find((item) => item.id === selectedPoiId) ?? null

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={13} className="h-[55vh] min-h-[420px] w-full rounded-2xl lg:h-[calc(100vh-15rem)]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler enabled={interactive} onPickPin={onPickPin} />
      <ViewportController items={items} selectedPoi={selectedPoi} pendingPin={pendingPin} />

      {items.map((poi) => {
        const lat = Number(poi.lat)
        const lng = Number(poi.lng)
        const archived = Boolean(poi.archived_at)
        const ownedByMe = toBoolean(poi.owned_by_me)
        const sharedWithMe = toBoolean(poi.shared_with_me)
        const isPublic = toBoolean(poi.is_public)
        const isSelected = poi.id === selectedPoiId

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        const color = archived
          ? '#71717a'
          : ownedByMe
            ? '#14b8a6'
            : sharedWithMe
              ? '#3b82f6'
              : isPublic
                ? '#10b981'
                : '#e4e4e7'

        return (
          <CircleMarker
            key={poi.id}
            center={[lat, lng]}
            eventHandlers={{ click: () => onSelect(poi) }}
            pathOptions={{ color, fillColor: color, fillOpacity: isSelected ? 0.95 : 0.8, weight: isSelected ? 3 : 2 }}
            radius={isSelected ? 10 : 7}
          >
            <Tooltip className="poi-marker-label" direction="top" offset={[0, -8]}>
              {poi.name}
            </Tooltip>
          </CircleMarker>
        )
      })}

      {pendingPin ? (
        <CircleMarker
          center={[Number(pendingPin.lat), Number(pendingPin.lng)]}
          pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.85, dashArray: '4 4', weight: 3 }}
          radius={10}
        >
          <Tooltip className="poi-marker-label" direction="top" offset={[0, -8]} permanent>
            Pending POI
          </Tooltip>
        </CircleMarker>
      ) : null}
    </MapContainer>
  )
}
