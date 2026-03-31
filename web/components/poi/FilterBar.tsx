'use client'

import type { Category, ScopeFilter } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export interface PoiFilters {
  q: string
  categoryId: string
  scope: ScopeFilter
  includeArchived: boolean
}

export function FilterBar({
  filters,
  categories,
  isAuthenticated,
  isAdmin,
  onChange,
  onReset
}: {
  filters: PoiFilters
  categories: Category[]
  isAuthenticated: boolean
  isAdmin: boolean
  onChange: (next: PoiFilters) => void
  onReset: () => void
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <Input
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
          placeholder="Search POIs by name or description"
        />

        <Select
          value={filters.categoryId}
          onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        {isAuthenticated ? (
          <Select value={filters.scope} onChange={(event) => onChange({ ...filters, scope: event.target.value as ScopeFilter })}>
            <option value="all">All visible POIs</option>
            <option value="mine">Mine</option>
            <option value="shared">Shared with me</option>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isAdmin ? (
          <label className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={filters.includeArchived}
              onChange={(event) => onChange({ ...filters, includeArchived: event.target.checked })}
            />
            Include archived
          </label>
        ) : null}

        <Button type="button" variant="outline" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </div>
  )
}
