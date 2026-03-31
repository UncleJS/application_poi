'use client'

import type { PoiPhoto } from '@/lib/types'
import { formatBytes } from '@/lib/format'

import { Button } from '@/components/ui/button'
import { Timestamp } from '@/components/ui/timestamp'

export function PhotoGallery({
  photos,
  isAuthenticated,
  canManage,
  uploadLimitMb,
  onUpload,
  onArchive,
  onRestore
}: {
  photos: PoiPhoto[]
  isAuthenticated: boolean
  canManage: boolean
  uploadLimitMb: number
  onUpload: (file: File) => Promise<void>
  onArchive: (photoId: string) => Promise<void>
  onRestore: (photoId: string) => Promise<void>
}) {
  if (!isAuthenticated) {
    return <div className="text-sm text-zinc-500">Login to view and manage POI photos.</div>
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Photos</div>
          <div className="text-xs text-zinc-500">Upload PNG, JPG, or WEBP up to {uploadLimitMb}MB.</div>
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={!canManage}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            void onUpload(file)
            event.target.value = ''
          }}
          className="block text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-950 file:px-3 file:py-2 file:text-xs file:font-medium file:text-teal-100 hover:file:bg-teal-900"
        />
      </div>

      {photos.length === 0 ? (
        <div className="text-sm text-zinc-500">No photos uploaded yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
              <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer">
                <img src={`/api/photos/${photo.id}`} alt={photo.filename} className="h-40 w-full object-cover" />
              </a>
              <div className="grid gap-2 p-3">
                <div className="text-sm font-medium text-zinc-100">{photo.filename}</div>
                <div className="text-xs text-zinc-500">{photo.mime_type} · {formatBytes(photo.size_bytes)}</div>
                <Timestamp iso={photo.created_at} />
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void (photo.archived_at ? onRestore(photo.id) : onArchive(photo.id))}
                  >
                    {photo.archived_at ? 'Restore photo' : 'Archive photo'}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
