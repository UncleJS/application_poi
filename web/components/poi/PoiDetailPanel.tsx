'use client'

import type { Category, PoiDetail } from '@/lib/types'
import { toBoolean } from '@/lib/utils'

import { AclSharePanel } from '@/components/poi/AclSharePanel'
import { PhotoGallery } from '@/components/poi/PhotoGallery'
import { PoiDetailForm } from '@/components/poi/PoiDetailForm'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Timestamp } from '@/components/ui/timestamp'

function PanelBody({
  open,
  loading,
  error,
  detail,
  categories,
  isAuthenticated,
  uploadLimitMb,
  onClose,
  onRefresh,
  onSaveDetails,
  onSaveCategory,
  onArchive,
  onRestore,
  onShare,
  onRevoke,
  onUploadPhoto,
  onArchivePhoto,
  onRestorePhoto
}: {
  open: boolean
  loading: boolean
  error?: string | null
  detail?: PoiDetail | null
  categories: Category[]
  isAuthenticated: boolean
  uploadLimitMb: number
  onClose: () => void
  onRefresh: () => void
  onSaveDetails: (payload: { name: string; description: string; isPublic: boolean }) => Promise<void>
  onSaveCategory: (categoryId: string) => Promise<void>
  onArchive: () => Promise<void>
  onRestore: () => Promise<void>
  onShare: (username: string) => Promise<void>
  onRevoke: (userId: string) => Promise<void>
  onUploadPhoto: (file: File) => Promise<void>
  onArchivePhoto: (photoId: string) => Promise<void>
  onRestorePhoto: (photoId: string) => Promise<void>
}) {
  if (!open) {
    return <EmptyState title="No POI selected" description="Choose a marker or list item to inspect details, photos, and sharing." />
  }

  if (loading) {
    return <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"><div className="h-5 w-1/2 rounded bg-zinc-800" /><div className="mt-3 h-4 w-3/4 rounded bg-zinc-900" /><div className="mt-6 h-28 rounded bg-zinc-900" /></div>
  }

  if (error) {
    return <ErrorBanner message={error} />
  }

  if (!detail) {
    return <EmptyState title="POI unavailable" description="This item could not be loaded or is no longer visible to the current user." />
  }

  return (
    <div className="app-scrollbar grid max-h-[calc(100vh-10rem)] gap-4 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-100">{detail.name}</div>
          <div className="mt-1 text-sm text-zinc-400">Owned by {detail.owner_username}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <p className="text-sm text-zinc-300">{detail.description || 'No description provided.'}</p>

      <div className="flex flex-wrap gap-2">
        <StatusBadge label={toBoolean(detail.is_public) ? 'Public' : 'Private'} />
        {detail.canEdit ? <StatusBadge label="Mine" /> : null}
        {detail.archived_at ? <StatusBadge label="Archived" /> : null}
      </div>

      <dl className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-zinc-500">Category</dt>
          <dd className="text-zinc-100">{detail.category}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-zinc-500">Created</dt>
          <dd><Timestamp iso={detail.created_at} /></dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-zinc-500">Updated</dt>
          <dd><Timestamp iso={detail.updated_at} /></dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        {detail.canEdit ? (
          detail.archived_at ? (
            <Button type="button" onClick={() => void onRestore()}>
              Restore POI
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={() => void onArchive()}>
              Archive POI
            </Button>
          )
        ) : null}
        <Button type="button" variant="outline" onClick={onRefresh}>
          Refresh details
        </Button>
      </div>

      <PoiDetailForm detail={detail} categories={categories} onSaveDetails={onSaveDetails} onSaveCategory={onSaveCategory} />

      <AclSharePanel shares={detail.shares ?? []} canShare={detail.canShare} onShare={onShare} onRevoke={onRevoke} />

      <PhotoGallery
        photos={detail.photos ?? []}
        isAuthenticated={isAuthenticated}
        canManage={detail.canEdit}
        uploadLimitMb={uploadLimitMb}
        onUpload={onUploadPhoto}
        onArchive={onArchivePhoto}
        onRestore={onRestorePhoto}
      />
    </div>
  )
}

export function PoiDetailPanel(props: Parameters<typeof PanelBody>[0]) {
  return (
    <>
      <div className="hidden xl:block rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
        <PanelBody {...props} />
      </div>

      {props.open ? (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/60" onClick={props.onClose} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-zinc-700" />
            <PanelBody {...props} />
          </div>
        </div>
      ) : null}
    </>
  )
}
