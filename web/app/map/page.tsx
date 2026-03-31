'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

import { useAuth } from '@/components/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreatePoiForm, type CreatePoiDraft } from '@/components/poi/CreatePoiForm'
import { FilterBar, type PoiFilters } from '@/components/poi/FilterBar'
import { PendingPinBanner } from '@/components/poi/PendingPinBanner'
import { PoiDetailPanel } from '@/components/poi/PoiDetailPanel'
import { PoiList } from '@/components/poi/PoiList'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Category, PoiDetail, PoiListItem } from '@/lib/types'

const PoiMap = dynamic(() => import('@/components/map/PoiMap').then((module) => module.PoiMap), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-[420px] animate-pulse rounded-2xl bg-zinc-900" />
})

const DEFAULT_DRAFT: CreatePoiDraft = {
  name: '',
  description: '',
  categoryId: '',
  isPublic: false,
  lat: '-25.892700',
  lng: '28.129200'
}

const DEFAULT_FILTERS: PoiFilters = {
  q: '',
  categoryId: '',
  scope: 'all',
  includeArchived: false
}

const uploadLimitMb = 20

export default function MapPage() {
  const { hydrated, request, isAuthenticated, isAdmin } = useAuth()
  const [filters, setFilters] = useState<PoiFilters>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<CreatePoiDraft>(DEFAULT_DRAFT)
  const [pendingPin, setPendingPin] = useState<{ lat: string; lng: string } | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const categoryKey = hydrated ? '/api/categories' : null
  const { data: categories = [], error: categoriesError } = useSWR(categoryKey, (url: string) => request<Category[]>(url))

  const poiKey = hydrated ? ['/api/pois', filters.q, filters.categoryId, filters.scope, String(filters.includeArchived), String(isAuthenticated)] : null
  const {
    data: pois = [],
    error: poisError,
    isLoading: poisLoading,
    mutate: mutatePois
  } = useSWR(
    poiKey,
    async ([url, q, categoryId, scope, includeArchived]: [string, string, string, string, string]) => {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (categoryId) params.set('categoryId', categoryId)
      if (isAuthenticated) params.set('scope', scope)
      if (includeArchived === 'true' && isAdmin) params.set('includeArchived', 'true')
      const suffix = params.toString()
      return request<PoiListItem[]>(suffix ? `${url}?${suffix}` : url)
    }
  )

  const detailKey = hydrated && selectedPoiId ? `/api/pois/${selectedPoiId}` : null
  const {
    data: selectedPoi,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail
  } = useSWR(detailKey, (url: string) => request<PoiDetail>(url))

  useEffect(() => {
    if (!draft.categoryId && categories[0]?.id) {
      setDraft((current) => ({ ...current, categoryId: categories[0].id }))
    }
  }, [categories, draft.categoryId])

  useEffect(() => {
    if (pendingPin) {
      setDraft((current) => ({ ...current, lat: pendingPin.lat, lng: pendingPin.lng }))
    }
  }, [pendingPin])

  const selectedPoiPreview = useMemo(
    () => pois.find((poi) => poi.id === selectedPoiId) ?? null,
    [pois, selectedPoiId]
  )

  const runAction = async (name: string, callback: () => Promise<void>, successMessage: string) => {
    setBusyAction(name)
    setActionError('')
    setNotice('')
    try {
      await callback()
      setNotice(successMessage)
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Action failed')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Map"
          description="Browse public, private, and shared points of interest from a single workspace."
          actions={
            <Button type="button" variant="outline" onClick={() => void mutatePois()}>
              Refresh list
            </Button>
          }
        />

        {actionError ? <ErrorBanner message={actionError} /> : null}
        {categoriesError ? <ErrorBanner message={categoriesError.message} /> : null}
        {notice ? <div className="rounded-xl border border-emerald-900 bg-emerald-950/70 px-4 py-3 text-sm text-emerald-200">{notice}</div> : null}
        {!isAuthenticated ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-300">
            Viewing public POIs only. Login to create items, upload photos, and manage sharing.
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[28rem_minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <FilterBar
              filters={filters}
              categories={categories}
              isAuthenticated={isAuthenticated}
              isAdmin={isAdmin}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />

            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-100">POI list</div>
                  <div className="text-sm text-zinc-500">{pois.length} items in current result set</div>
                </div>
              </div>
              <PoiList
                items={pois}
                loading={poisLoading}
                error={poisError?.message}
                selectedPoiId={selectedPoiId}
                onSelect={(poi) => setSelectedPoiId(poi.id)}
              />
            </Card>

            {isAuthenticated ? (
              <CreatePoiForm
                categories={categories}
                draft={draft}
                pendingPin={pendingPin}
                disabled={!isAuthenticated || busyAction === 'create-poi'}
                submitting={busyAction === 'create-poi'}
                onChange={setDraft}
                onClearPin={() => {
                  setPendingPin(null)
                  setDraft((current) => ({ ...current, lat: DEFAULT_DRAFT.lat, lng: DEFAULT_DRAFT.lng }))
                }}
                onSubmit={() =>
                  void runAction(
                    'create-poi',
                    async () => {
                      await request('/api/pois', {
                        method: 'POST',
                        body: JSON.stringify({
                          name: draft.name.trim(),
                          description: draft.description,
                          categoryId: draft.categoryId,
                          isPublic: draft.isPublic,
                          lat: Number(draft.lat),
                          lng: Number(draft.lng)
                        })
                      }, { auth: 'required' })
                      setDraft((current) => ({ ...DEFAULT_DRAFT, categoryId: current.categoryId || categories[0]?.id || '' }))
                      setPendingPin(null)
                      await mutatePois()
                    },
                    'POI created'
                  )
                }
              />
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <PendingPinBanner
                pendingPin={pendingPin}
                onClear={() => {
                  setPendingPin(null)
                  setDraft((current) => ({ ...current, lat: DEFAULT_DRAFT.lat, lng: DEFAULT_DRAFT.lng }))
                }}
              />
              <PoiMap
                items={pois}
                selectedPoiId={selectedPoiId}
                pendingPin={pendingPin}
                onPickPin={(coords) => setPendingPin(coords)}
                onSelect={(poi) => setSelectedPoiId(poi.id)}
                interactive={isAuthenticated}
              />
            </Card>
          </div>

          <PoiDetailPanel
            open={Boolean(selectedPoiId)}
            loading={detailLoading}
            error={detailError?.message}
            detail={selectedPoi ?? undefined}
            categories={categories}
            isAuthenticated={isAuthenticated}
            uploadLimitMb={uploadLimitMb}
            onClose={() => setSelectedPoiId(null)}
            onRefresh={() => void mutateDetail()}
            onSaveDetails={(payload) =>
              runAction(
                'save-poi-details',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}`, { method: 'PATCH', body: JSON.stringify(payload) }, { auth: 'required' })
                  await Promise.all([mutateDetail(), mutatePois()])
                },
                'POI details updated'
              )
            }
            onSaveCategory={(categoryId) =>
              runAction(
                'save-poi-category',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}`, { method: 'PATCH', body: JSON.stringify({ categoryId }) }, { auth: 'required' })
                  await Promise.all([mutateDetail(), mutatePois()])
                },
                'POI category updated'
              )
            }
            onArchive={() =>
              runAction(
                'archive-poi',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}`, { method: 'DELETE' }, { auth: 'required' })
                  await mutatePois()
                  if (isAdmin && filters.includeArchived) {
                    await mutateDetail()
                  } else {
                    setSelectedPoiId(null)
                  }
                },
                'POI archived'
              )
            }
            onRestore={() =>
              runAction(
                'restore-poi',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}/restore`, { method: 'POST' }, { auth: 'required' })
                  await Promise.all([mutateDetail(), mutatePois()])
                },
                'POI restored'
              )
            }
            onShare={(username) =>
              runAction(
                'share-poi',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}/shares`, { method: 'POST', body: JSON.stringify({ username }) }, { auth: 'required' })
                  await mutateDetail()
                },
                'POI shared'
              )
            }
            onRevoke={(userId) =>
              runAction(
                'revoke-share',
                async () => {
                  if (!selectedPoiId) return
                  await request(`/api/pois/${selectedPoiId}/shares/${userId}`, { method: 'DELETE' }, { auth: 'required' })
                  await mutateDetail()
                },
                'Share revoked'
              )
            }
            onUploadPhoto={(file) =>
              runAction(
                'upload-photo',
                async () => {
                  if (!selectedPoiId) return
                  if (file.size > uploadLimitMb * 1024 * 1024) throw new Error(`File too large. Limit is ${uploadLimitMb}MB`)
                  const formData = new FormData()
                  formData.set('photo', file)
                  await request(`/api/pois/${selectedPoiId}/photos`, { method: 'POST', body: formData }, { auth: 'required' })
                  await Promise.all([mutateDetail(), mutatePois()])
                },
                'Photo uploaded'
              )
            }
            onArchivePhoto={(photoId) =>
              runAction(
                'archive-photo',
                async () => {
                  await request(`/api/photos/${photoId}`, { method: 'DELETE' }, { auth: 'required' })
                  await mutateDetail()
                },
                'Photo archived'
              )
            }
            onRestorePhoto={(photoId) =>
              runAction(
                'restore-photo',
                async () => {
                  await request(`/api/photos/${photoId}/restore`, { method: 'POST' }, { auth: 'required' })
                  await mutateDetail()
                },
                'Photo restored'
              )
            }
          />
        </div>

        {selectedPoiId && !selectedPoi && !detailLoading && !detailError && selectedPoiPreview ? (
          <div className="text-xs text-zinc-500">Selected: {selectedPoiPreview.name}</div>
        ) : null}
      </div>
    </AppShell>
  )
}
