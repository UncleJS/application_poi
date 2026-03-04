'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Script from 'next/script'

const uploadLimitMb = 20
const defaultLat = '-25.892700'
const defaultLng = '28.129200'

const mapThemes = {
  osm: {
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  dark: {
    label: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  light: {
    label: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  topo: {
    label: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors'
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri'
  }
}

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export default function HomePage() {
  const [pois, setPois] = useState([])
  const [selectedPoi, setSelectedPoi] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState(null)
  const [mapTheme, setMapTheme] = useState('osm')
  const [mapHeight, setMapHeight] = useState(540)

  const [auth, setAuth] = useState({ username: 'admin', password: '', accessToken: '', refreshToken: '' })
  const [poiForm, setPoiForm] = useState({
    name: '',
    description: '',
    category: 'general',
    lat: defaultLat,
    lng: defaultLng
  })

  const dragState = useRef({ dragging: false, startY: 0, startHeight: 540 })

  const inputClass = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500'
  const buttonClass = 'rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50'

  const stats = useMemo(() => {
    const total = pois.length
    const archived = pois.filter((p) => p.archived_at).length
    return { total, archived }
  }, [pois])

  const authHeader = auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : {}

  const request = async (url, options = {}) => {
    const res = await fetch(url, options)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed: ${res.status}`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) return res.json()
    return res.text()
  }

  const fetchPoiDetail = async (poiId) => {
    try {
      const detail = await request(`/api/pois/${poiId}`)
      setSelectedPoi(detail)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const initMap = (items) => {
    if (!window.L) return
    const root = document.getElementById('map')
    if (!root) return

    const theme = mapThemes[mapTheme] || mapThemes.osm

    if (!window.__poiMap) {
      const map = window.L.map('map').setView([Number(defaultLat), Number(defaultLng)], 13)
      window.__poiMap = map
    }

    if (window.__poiMapClickHandler) {
      window.__poiMap.off('click', window.__poiMapClickHandler)
    }

    window.__poiMapClickHandler = (event) => {
      const lat = Number(event.latlng.lat).toFixed(6)
      const lng = Number(event.latlng.lng).toFixed(6)
      setPendingLatLng({ lat, lng })
      setSelectedPoi(null)
      setPoiForm((prev) => ({ ...prev, lat, lng }))
    }

    window.__poiMap.on('click', window.__poiMapClickHandler)

    if (window.__poiTileLayer) {
      window.__poiTileLayer.remove()
    }
    window.__poiTileLayer = window.L.tileLayer(theme.url, {
      attribution: theme.attribution,
      maxZoom: 19
    }).addTo(window.__poiMap)

    if (window.__poiLayer) {
      window.__poiLayer.remove()
    }

    const layer = window.L.layerGroup()
    const bounds = []
    items.forEach((poi) => {
      const lat = Number(poi.lat)
      const lng = Number(poi.lng)
      const marker = window.L.circleMarker([lat, lng], {
        radius: 7,
        color: poi.archived_at ? '#9ca3af' : '#14b8a6',
        fillOpacity: 0.9
      })
      marker.bindPopup(`<strong>${escapeHtml(poi.name)}</strong><br/>${escapeHtml(poi.category)}<br/>${poi.archived_at ? 'Archived' : 'Active'}`)
      marker.on('click', (event) => {
        window.L.DomEvent.stopPropagation(event)
        setSelectedPoi(poi)
        fetchPoiDetail(poi.id)
      })
      layer.addLayer(marker)
      bounds.push([lat, lng])
    })

    layer.addTo(window.__poiMap)
    window.__poiLayer = layer

    if (window.__pendingMarker) {
      window.__pendingMarker.remove()
      window.__pendingMarker = null
    }
    if (pendingLatLng) {
      window.__pendingMarker = window.L.circleMarker([Number(pendingLatLng.lat), Number(pendingLatLng.lng)], {
        radius: 10,
        color: '#f59e0b',
        fillColor: '#fbbf24',
        fillOpacity: 0.85,
        weight: 2,
        dashArray: '4'
      })
      window.__pendingMarker.bindPopup('Pending POI location')
      window.__pendingMarker.addTo(window.__poiMap)
    }

    if (bounds.length > 0) {
      window.__poiMap.fitBounds(bounds, { padding: [30, 30] })
    } else if (pendingLatLng) {
      window.__poiMap.setView([Number(pendingLatLng.lat), Number(pendingLatLng.lng)], 13)
    }
  }

  const fetchPois = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (includeArchived) params.set('includeArchived', 'true')
      const data = await request(`/api/pois?${params.toString()}`)
      setPois(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const login = async () => {
    setError('')
    setSuccess('')
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: auth.username, password: auth.password })
      })
      setAuth((prev) => ({ ...prev, accessToken: data.accessToken, refreshToken: data.refreshToken }))
      setSuccess('Logged in successfully')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const refresh = async () => {
    if (!auth.refreshToken) return
    try {
      const data = await request('/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      })
      setAuth((prev) => ({ ...prev, accessToken: data.accessToken, refreshToken: data.refreshToken }))
      setSuccess('Token refreshed')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const createPoi = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    try {
      await request('/api/pois', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          ...poiForm,
          lat: Number(poiForm.lat),
          lng: Number(poiForm.lng)
        })
      })
      setPoiForm((prev) => ({ ...prev, name: '', description: '' }))
      setPendingLatLng(null)
      setSuccess('POI created')
      await fetchPois()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const archivePoi = async (poiId) => {
    try {
      await request(`/api/pois/${poiId}`, { method: 'DELETE', headers: authHeader })
      setSuccess('POI archived')
      setSelectedPoi(null)
      await fetchPois()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const restorePoi = async (poiId) => {
    try {
      await request(`/api/pois/${poiId}/restore`, { method: 'POST', headers: authHeader })
      setSuccess('POI restored')
      await fetchPois()
      await fetchPoiDetail(poiId)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !selectedPoi?.id) return
    if (file.size > uploadLimitMb * 1024 * 1024) {
      setError(`File too large. Limit is ${uploadLimitMb}MB`)
      return
    }

    const formData = new FormData()
    formData.set('photo', file)
    try {
      await request(`/api/pois/${selectedPoi.id}/photos`, {
        method: 'POST',
        headers: authHeader,
        body: formData
      })
      setSuccess('Photo uploaded')
      await fetchPoiDetail(selectedPoi.id)
      await fetchPois()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      event.target.value = ''
    }
  }

  const archivePhoto = async (photoId) => {
    try {
      await request(`/api/photos/${photoId}`, { method: 'DELETE', headers: authHeader })
      if (selectedPoi?.id) await fetchPoiDetail(selectedPoi.id)
      setSuccess('Photo archived')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const restorePhoto = async (photoId) => {
    try {
      await request(`/api/photos/${photoId}/restore`, { method: 'POST', headers: authHeader })
      if (selectedPoi?.id) await fetchPoiDetail(selectedPoi.id)
      setSuccess('Photo restored')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const clearPendingPin = () => {
    setPendingLatLng(null)
    setPoiForm((prev) => ({ ...prev, lat: defaultLat, lng: defaultLng }))
  }

  const handleDragMove = (event) => {
    if (!dragState.current.dragging) return
    const delta = event.clientY - dragState.current.startY
    const nextHeight = Math.max(300, Math.min(900, dragState.current.startHeight + delta))
    setMapHeight(nextHeight)
  }

  const handleDragEnd = () => {
    if (!dragState.current.dragging) return
    dragState.current.dragging = false
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
    if (window.__poiMap) {
      window.__poiMap.invalidateSize()
    }
  }

  const handleDragStart = (event) => {
    event.preventDefault()
    dragState.current = {
      dragging: true,
      startY: event.clientY,
      startHeight: mapHeight
    }
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }

  useEffect(() => {
    fetchPois()
  }, [includeArchived])

  useEffect(() => {
    initMap(pois)
  }, [pois, mapTheme, pendingLatLng])

  useEffect(() => {
    if (window.__poiMap) {
      window.__poiMap.invalidateSize()
    }
  }, [mapHeight])

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" onLoad={() => initMap(pois)} />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">OSM POI Platform</h1>
        <p className="mb-4 text-sm text-zinc-400">Public map browsing, JWT-protected writes, and MariaDB-stored photos.</p>

        <div className="mb-3 grid gap-2">
          {error ? <div className="rounded-lg border border-red-800 bg-red-950 p-2.5 text-sm text-red-300">{error}</div> : null}
          {success ? <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-2.5 text-sm text-emerald-300">{success}</div> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name/description" className={`${inputClass} sm:flex-1`} />
              <select value={mapTheme} onChange={(event) => setMapTheme(event.target.value)} className={`${inputClass} sm:w-44`}>
                {Object.entries(mapThemes).map(([value, theme]) => (
                  <option key={value} value={value}>{theme.label}</option>
                ))}
              </select>
              <button onClick={fetchPois} disabled={loading} className={buttonClass}>{loading ? 'Loading...' : 'Search'}</button>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                Include archived
              </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div id="map" style={{ height: mapHeight }} className="w-full bg-zinc-900" />
              <button type="button" onMouseDown={handleDragStart} className="block h-3 w-full cursor-ns-resize bg-zinc-800 text-[10px] text-zinc-400 transition hover:bg-zinc-700">
                Drag to resize
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">Total: {stats.total} | Archived in result set: {stats.archived}</p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">Admin Login</h2>
              <div className="grid gap-2">
                <input value={auth.username} onChange={(e) => setAuth((p) => ({ ...p, username: e.target.value }))} placeholder="Username" className={inputClass} />
                <input type="password" value={auth.password} onChange={(e) => setAuth((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className={inputClass} />
                <div className="flex gap-2">
                  <button onClick={login} className={`${buttonClass} flex-1`}>Login</button>
                  <button onClick={refresh} disabled={!auth.refreshToken} className={`${buttonClass} flex-1`}>Refresh</button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">Create POI</h2>
              {pendingLatLng ? (
                <div className="mb-2 rounded-lg border border-amber-700 bg-amber-950 p-2 text-xs text-amber-300">
                  Pin placed on the map. Coordinates are locked until you clear the pin.
                </div>
              ) : (
                <p className="mb-2 text-xs text-zinc-500">Click on the map to place a pin or enter coordinates manually.</p>
              )}
              <form onSubmit={createPoi} className="grid gap-2">
                <input value={poiForm.name} placeholder="Name" onChange={(e) => setPoiForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} required />
                <textarea value={poiForm.description} placeholder="Description" onChange={(e) => setPoiForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} required />
                <input value={poiForm.category} placeholder="Category" onChange={(e) => setPoiForm((p) => ({ ...p, category: e.target.value }))} className={inputClass} required />
                <div className="flex gap-2">
                  <input value={poiForm.lat} placeholder="Latitude" onChange={(e) => setPoiForm((p) => ({ ...p, lat: e.target.value }))} className={inputClass} readOnly={Boolean(pendingLatLng)} required />
                  <input value={poiForm.lng} placeholder="Longitude" onChange={(e) => setPoiForm((p) => ({ ...p, lng: e.target.value }))} className={inputClass} readOnly={Boolean(pendingLatLng)} required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={`${buttonClass} flex-1`}>Save POI</button>
                  <button type="button" onClick={clearPendingPin} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700">Clear pin</button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">Selected POI</h2>
              {!selectedPoi ? (
                <p className="m-0 text-sm text-zinc-400">Click a marker to view details.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  <strong>{selectedPoi.name}</strong>
                  <span className="text-zinc-300">{selectedPoi.description}</span>
                  <span className="text-zinc-300">Category: {selectedPoi.category}</span>
                  <span className="text-zinc-300">Status: {selectedPoi.archived_at ? 'Archived' : 'Active'}</span>
                  <div className="flex gap-2">
                    {!selectedPoi.archived_at ? (
                      <button onClick={() => archivePoi(selectedPoi.id)} className={`${buttonClass} flex-1`}>Archive POI</button>
                    ) : (
                      <button onClick={() => restorePoi(selectedPoi.id)} className={`${buttonClass} flex-1`}>Restore POI</button>
                    )}
                    <button onClick={() => fetchPoiDetail(selectedPoi.id)} className={`${buttonClass} flex-1`}>Refresh Details</button>
                  </div>

                  <label className="grid gap-2 text-sm text-zinc-300">
                    Upload photo (max {uploadLimitMb}MB)
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadPhoto} className={inputClass} />
                  </label>

                  <div className="grid max-h-48 gap-2 overflow-auto">
                    {(selectedPoi.photos || []).map((photo) => (
                      <div key={photo.id} className="rounded-lg border border-zinc-800 p-2">
                        <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300">{photo.filename}</a>
                        <div className="mt-1 text-xs text-zinc-400">{photo.mime_type} | {photo.size_bytes} bytes</div>
                        <div className="mt-1 text-xs text-zinc-400">Status: {photo.archived_at ? 'Archived' : 'Active'}</div>
                        <div className="mt-2">
                          {!photo.archived_at ? (
                            <button onClick={() => archivePhoto(photo.id)} className={buttonClass}>Archive</button>
                          ) : (
                            <button onClick={() => restorePhoto(photo.id)} className={buttonClass}>Restore</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
