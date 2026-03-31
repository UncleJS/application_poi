'use client'

import type { Category } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export interface CreatePoiDraft {
  name: string
  description: string
  categoryId: string
  isPublic: boolean
  lat: string
  lng: string
}

export function CreatePoiForm({
  categories,
  draft,
  pendingPin,
  disabled,
  submitting,
  onChange,
  onClearPin,
  onSubmit
}: {
  categories: Category[]
  draft: CreatePoiDraft
  pendingPin: { lat: string; lng: string } | null
  disabled: boolean
  submitting: boolean
  onChange: (next: CreatePoiDraft) => void
  onClearPin: () => void
  onSubmit: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create POI</CardTitle>
        <CardDescription>
          Place a pin on the map, then save the POI with its category and visibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          {pendingPin
            ? `Using pending pin coordinates ${pendingPin.lat}, ${pendingPin.lng}`
            : 'Click on the map to place a pin, or enter coordinates manually.'}
        </div>

        <Input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="POI name" />
        <Textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Description"
        />
        <Select value={draft.categoryId} onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}>
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={draft.isPublic}
            onChange={(event) => onChange({ ...draft, isPublic: event.target.checked })}
          />
          Public POI
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={draft.lat}
            onChange={(event) => onChange({ ...draft, lat: event.target.value })}
            placeholder="Latitude"
            readOnly={Boolean(pendingPin)}
          />
          <Input
            value={draft.lng}
            onChange={(event) => onChange({ ...draft, lng: event.target.value })}
            placeholder="Longitude"
            readOnly={Boolean(pendingPin)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="min-w-36 px-5"
            disabled={disabled || !draft.name.trim() || !draft.categoryId}
            onClick={onSubmit}
          >
            {submitting ? 'Saving…' : 'Save POI'}
          </Button>
          <Button type="button" variant="outline" onClick={onClearPin} disabled={!pendingPin}>
            Clear pin
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
