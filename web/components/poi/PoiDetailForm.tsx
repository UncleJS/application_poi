'use client'

import { useEffect, useMemo, useState } from 'react'

import type { Category, PoiDetail } from '@/lib/types'
import { toBoolean } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function PoiDetailForm({
  detail,
  categories,
  onSaveDetails,
  onSaveCategory
}: {
  detail: PoiDetail
  categories: Category[]
  onSaveDetails: (payload: { name: string; description: string; isPublic: boolean }) => Promise<void>
  onSaveCategory: (categoryId: string) => Promise<void>
}) {
  const [name, setName] = useState(detail.name)
  const [description, setDescription] = useState(detail.description ?? '')
  const [isPublic, setIsPublic] = useState(toBoolean(detail.is_public))
  const [categoryId, setCategoryId] = useState(detail.category_id)

  useEffect(() => {
    setName(detail.name)
    setDescription(detail.description ?? '')
    setIsPublic(toBoolean(detail.is_public))
    setCategoryId(detail.category_id)
  }, [detail])

  const detailDirty = useMemo(
    () => name.trim() !== detail.name || description !== (detail.description ?? '') || isPublic !== toBoolean(detail.is_public),
    [description, detail.description, detail.is_public, detail.name, isPublic, name]
  )

  const categoryDirty = categoryId !== detail.category_id

  if (!detail.canEdit) return null

  return (
    <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div>
        <div className="text-sm font-semibold text-zinc-100">Edit details</div>
        <div className="text-xs text-zinc-500">Owners and admins can change POI details and category.</div>
      </div>

      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
      <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
      <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
        Public POI
      </label>
      <Button type="button" disabled={!name.trim() || !detailDirty} onClick={() => void onSaveDetails({ name: name.trim(), description, isPublic })}>
        Save details
      </Button>

      <div className="h-px bg-zinc-800" />

      <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Button type="button" variant="outline" disabled={!categoryDirty} onClick={() => void onSaveCategory(categoryId)}>
        Save category
      </Button>
    </div>
  )
}
