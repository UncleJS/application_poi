'use client'

import { useEffect, useState } from 'react'

import type { Category } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Input } from '@/components/ui/input'
import { SkeletonRows } from '@/components/ui/skeleton-rows'
import { StatusBadge } from '@/components/ui/status-badge'
import { Timestamp } from '@/components/ui/timestamp'

export function CategoryTable({
  categories,
  loading,
  error,
  onRename,
  onArchive,
  onRestore
}: {
  categories: Category[]
  loading: boolean
  error?: string | null
  onRename: (categoryId: string, name: string) => Promise<void>
  onArchive: (categoryId: string) => Promise<void>
  onRestore: (categoryId: string) => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current }
      categories.forEach((category) => {
        next[category.id] = current[category.id] ?? category.name
      })
      return next
    })
  }, [categories])

  if (loading) return <SkeletonRows rows={6} />
  if (error) return <ErrorBanner message={error} />
  if (categories.length === 0) {
    return <EmptyState title="No categories" description="Create the first category to classify map points." />
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/80 text-left text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {categories.map((category) => (
            <tr key={category.id}>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Input
                    value={drafts[category.id] ?? category.name}
                    onChange={(event) => setDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!drafts[category.id]?.trim() || drafts[category.id] === category.name}
                    onClick={() => void onRename(category.id, drafts[category.id].trim())}
                  >
                    Save
                  </Button>
                </div>
              </td>
              <td className="px-4 py-3"><Timestamp iso={category.created_at} /></td>
              <td className="px-4 py-3">{category.archived_at ? <StatusBadge label="Archived" /> : <StatusBadge label="Public" />}</td>
              <td className="px-4 py-3">
                {category.archived_at ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void onRestore(category.id)}>
                    Restore
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" size="sm" onClick={() => void onArchive(category.id)}>
                    Archive
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
