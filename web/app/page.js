'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Script from 'next/script'

const uploadLimitMb = 20
const defaultLat = '-25.892700'
const defaultLng = '28.129200'
const defaultMapTheme = 'osm'
const defaultMapHeight = 540
const storageKeys = {
  mapTheme: 'poi.mapTheme',
  mapHeight: 'poi.mapHeight',
  auth: 'poi.auth'
}

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

const clampMapHeight = (value) => Math.max(300, Math.min(900, value))

const loadStoredTheme = () => {
  if (typeof window === 'undefined') return defaultMapTheme
  const stored = window.localStorage.getItem(storageKeys.mapTheme)
  return stored && mapThemes[stored] ? stored : defaultMapTheme
}

const loadStoredHeight = () => {
  if (typeof window === 'undefined') return defaultMapHeight
  const parsed = Number.parseInt(window.localStorage.getItem(storageKeys.mapHeight) || '', 10)
  if (Number.isNaN(parsed)) return defaultMapHeight
  return clampMapHeight(parsed)
}

const loadStoredAuth = () => {
  const fallback = { username: 'admin', password: '', accessToken: '', refreshToken: '', role: '' }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKeys.auth)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return {
      username: parsed.username || 'admin',
      password: '',
      accessToken: parsed.accessToken || '',
      refreshToken: parsed.refreshToken || '',
      role: parsed.role || ''
    }
  } catch {
    return fallback
  }
}

export default function HomePage() {
  const [pois, setPois] = useState([])
  const [selectedPoi, setSelectedPoi] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState(null)
  const [mapTheme, setMapTheme] = useState(loadStoredTheme)
  const [mapHeight, setMapHeight] = useState(loadStoredHeight)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [shareUsername, setShareUsername] = useState('')

  const [auth, setAuth] = useState(loadStoredAuth)
  const [poiForm, setPoiForm] = useState({
    name: '',
    description: '',
    category: 'general',
    lat: defaultLat,
    lng: defaultLng
  })

  const [users, setUsers] = useState([])
  const [includeArchivedUsers, setIncludeArchivedUsers] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user' })

  const dragState = useRef({ dragging: false, startY: 0, startHeight: defaultMapHeight })

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

  const fetchUsers = async () => {
    if (auth.role !== 'admin' || !auth.accessToken) return
    try {
      const params = new URLSearchParams()
      if (includeArchivedUsers) params.set('includeArchived', 'true')
      const data = await request(`/api/admin/users?${params.toString()}`, { headers: authHeader })
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const fetchPoiDetail = async (poiId) => {
    if (!auth.accessToken) return
    try {
      const detail = await request(`/api/pois/${poiId}`, { headers: authHeader })
      setSelectedPoi(detail)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const centerMapOnPoi = (poi, preferredZoom = 15) => {
    if (!window.__poiMap) return
    const lat = Number(poi.lat)
    const lng = Number(poi.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const zoom = Math.max(window.__poiMap.getZoom(), preferredZoom)
    window.__poiMap.setView([lat, lng], zoom)
  }

  const selectPoi = async (poi) => {
    setSelectedPoi(poi)
    centerMapOnPoi(poi)
    await fetchPoiDetail(poi.id)
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
        color: poi.archived_at ? '#9ca3af' : poi.owned_by_me ? '#14b8a6' : '#3b82f6',
        fillOpacity: 0.9
      })
      marker.bindPopup(`<strong>${escapeHtml(poi.name)}</strong><br/>${escapeHtml(poi.category)}<br/>owner: ${escapeHtml(poi.owner_username || '')}`)
      marker.bindTooltip(escapeHtml(poi.name), {
        permanent: true,
        direction: 'right',
        offset: [10, 0],
        className: 'poi-marker-label'
      })
      marker.on('click', (event) => {
        window.L.DomEvent.stopPropagation(event)
        void selectPoi(poi)
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

    if (pendingLatLng) {
      const currentZoom = window.__poiMap.getZoom()
      window.__poiMap.setView([Number(pendingLatLng.lat), Number(pendingLatLng.lng)], Math.max(currentZoom, 14))
    } else if (bounds.length > 0 && !window.__poiHasAutoFit) {
      window.__poiMap.fitBounds(bounds, { padding: [30, 30] })
      window.__poiHasAutoFit = true
    }
  }

  const fetchPois = async () => {
    if (!auth.accessToken) {
      setPois([])
      setSelectedPoi(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (includeArchived) params.set('includeArchived', 'true')
      if (categoryFilter.trim()) params.set('category', categoryFilter.trim())
      params.set('scope', scopeFilter)
      const data = await request(`/api/pois?${params.toString()}`, { headers: authHeader })
      if (typeof window !== 'undefined') {
        window.__poiHasAutoFit = false
      }
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
      setAuth((prev) => ({
        ...prev,
        password: '',
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.user?.role || ''
      }))
      setSuccess('Logged in successfully')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const refreshAccessToken = async ({ announceSuccess } = { announceSuccess: true }) => {
    if (!auth.refreshToken) return
    try {
      const data = await request('/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      })
      setAuth((prev) => ({
        ...prev,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.user?.role || prev.role
      }))
      if (announceSuccess) setSuccess('Token refreshed')
    } catch (err) {
      setAuth((prev) => ({ ...prev, accessToken: '', refreshToken: '', role: '' }))
      setError(String(err.message || err))
    }
  }

  const refresh = async () => {
    await refreshAccessToken({ announceSuccess: true })
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

  const sharePoi = async () => {
    if (!selectedPoi?.id || !shareUsername.trim()) return
    try {
      await request(`/api/pois/${selectedPoi.id}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader },
        body: JSON.stringify({ username: shareUsername.trim() })
      })
      setShareUsername('')
      setSuccess('POI shared')
      await fetchPoiDetail(selectedPoi.id)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const revokeShare = async (userId) => {
    if (!selectedPoi?.id) return
    try {
      await request(`/api/pois/${selectedPoi.id}/shares/${userId}`, { method: 'DELETE', headers: authHeader })
      setSuccess('Share revoked')
      await fetchPoiDetail(selectedPoi.id)
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

  const createUser = async (event) => {
    event.preventDefault()
    try {
      await request('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader },
        body: JSON.stringify(userForm)
      })
      setUserForm({ username: '', password: '', role: 'user' })
      setSuccess('User created')
      await fetchUsers()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const archiveUser = async (userId) => {
    try {
      await request(`/api/admin/users/${userId}`, { method: 'DELETE', headers: authHeader })
      setSuccess('User archived')
      await fetchUsers()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const restoreUser = async (userId) => {
    try {
      await request(`/api/admin/users/${userId}/restore`, { method: 'POST', headers: authHeader })
      setSuccess('User restored')
      await fetchUsers()
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
    const nextHeight = clampMapHeight(dragState.current.startHeight + delta)
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
    if (!auth.accessToken) {
      setPois([])
      return
    }
    fetchPois()
  }, [includeArchived, categoryFilter, scopeFilter, auth.accessToken])

  useEffect(() => {
    initMap(pois)
  }, [pois, mapTheme, pendingLatLng])

  useEffect(() => {
    if (window.__poiMap) {
      window.__poiMap.invalidateSize()
    }
  }, [mapHeight])

  useEffect(() => {
    if (auth.role === 'admin') {
      fetchUsers()
    }
  }, [auth.role, includeArchivedUsers])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKeys.mapTheme, mapTheme)
  }, [mapTheme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKeys.mapHeight, String(mapHeight))
  }, [mapHeight])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKeys.auth, JSON.stringify({
      username: auth.username,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      role: auth.role
    }))
  }, [auth.username, auth.accessToken, auth.refreshToken, auth.role])

  useEffect(() => {
    if (!auth.refreshToken || auth.accessToken) return
    refreshAccessToken({ announceSuccess: false })
  }, [])

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
        <p className="mb-4 text-sm text-zinc-400">Per-user POIs with share controls, admin user management, and archive lifecycle.</p>

        <div className="mb-3 grid gap-2">
          {error ? <div className="rounded-lg border border-red-800 bg-red-950 p-2.5 text-sm text-red-300">{error}</div> : null}
          {success ? <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-2.5 text-sm text-emerald-300">{success}</div> : null}
          {!auth.accessToken ? <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300">Login is required to load and manage POIs.</div> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name/description" className={`${inputClass} sm:flex-1`} />
              <input value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="Category filter" className={`${inputClass} sm:w-40`} />
              <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className={`${inputClass} sm:w-32`}>
                <option value="all">All</option>
                <option value="mine">Mine</option>
                <option value="shared">Shared</option>
              </select>
              <select value={mapTheme} onChange={(event) => setMapTheme(event.target.value)} className={`${inputClass} sm:w-44`}>
                {Object.entries(mapThemes).map(([value, theme]) => (
                  <option key={value} value={value}>{theme.label}</option>
                ))}
              </select>
              <button onClick={fetchPois} disabled={loading || !auth.accessToken} className={buttonClass}>{loading ? 'Loading...' : 'Search'}</button>
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

            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">POI List</h2>
              <div className="grid max-h-64 gap-2 overflow-auto">
                {pois.map((poi) => (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() => void selectPoi(poi)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-left text-sm hover:border-teal-600"
                  >
                    <div className="font-semibold">{poi.name}</div>
                    <div className="text-xs text-zinc-400">{poi.category} | owner: {poi.owner_username}</div>
                    <div className="mt-1 flex gap-2 text-[11px]">
                      {poi.owned_by_me ? <span className="rounded bg-teal-900 px-2 py-0.5 text-teal-200">Mine</span> : null}
                      {poi.shared_with_me ? <span className="rounded bg-blue-900 px-2 py-0.5 text-blue-200">Shared</span> : null}
                      {poi.archived_at ? <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">Archived</span> : null}
                    </div>
                  </button>
                ))}
                {pois.length === 0 ? <p className="text-sm text-zinc-500">No POIs found for current filters.</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">Login</h2>
              <div className="grid gap-2">
                <input value={auth.username} onChange={(e) => setAuth((p) => ({ ...p, username: e.target.value }))} placeholder="Username" className={inputClass} />
                <input type="password" value={auth.password} onChange={(e) => setAuth((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className={inputClass} />
                <div className="flex gap-2">
                  <button onClick={login} className={`${buttonClass} flex-1`}>Login</button>
                  <button onClick={refresh} disabled={!auth.refreshToken} className={`${buttonClass} flex-1`}>Refresh</button>
                </div>
                {auth.role ? <p className="text-xs text-zinc-400">Role: {auth.role}</p> : null}
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
                <textarea value={poiForm.description} placeholder="Description (optional)" onChange={(e) => setPoiForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} />
                <input value={poiForm.category} placeholder="Category" onChange={(e) => setPoiForm((p) => ({ ...p, category: e.target.value }))} className={inputClass} required />
                <div className="flex gap-2">
                  <input value={poiForm.lat} placeholder="Latitude" onChange={(e) => setPoiForm((p) => ({ ...p, lat: e.target.value }))} className={inputClass} readOnly={Boolean(pendingLatLng)} required />
                  <input value={poiForm.lng} placeholder="Longitude" onChange={(e) => setPoiForm((p) => ({ ...p, lng: e.target.value }))} className={inputClass} readOnly={Boolean(pendingLatLng)} required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={!auth.accessToken} className={`${buttonClass} flex-1`}>Save POI</button>
                  <button type="button" onClick={clearPendingPin} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700">Clear pin</button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-2 text-lg font-medium">Selected POI</h2>
              {!selectedPoi ? (
                <p className="m-0 text-sm text-zinc-400">Click a marker or list item to view details.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  <strong>{selectedPoi.name}</strong>
                  <span className="text-zinc-300">{selectedPoi.description || 'No description provided'}</span>
                  <span className="text-zinc-300">Category: {selectedPoi.category}</span>
                  <span className="text-zinc-300">Owner: {selectedPoi.owner_username}</span>
                  <span className="text-zinc-300">Status: {selectedPoi.archived_at ? 'Archived' : 'Active'}</span>
                  <div className="flex gap-2">
                    {selectedPoi.canEdit && !selectedPoi.archived_at ? (
                      <button onClick={() => archivePoi(selectedPoi.id)} className={`${buttonClass} flex-1`}>Archive POI</button>
                    ) : null}
                    {selectedPoi.canEdit && selectedPoi.archived_at ? (
                      <button onClick={() => restorePoi(selectedPoi.id)} className={`${buttonClass} flex-1`}>Restore POI</button>
                    ) : null}
                    <button onClick={() => fetchPoiDetail(selectedPoi.id)} className={`${buttonClass} flex-1`}>Refresh Details</button>
                  </div>

                  {selectedPoi.canShare ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">Share with user</div>
                      <div className="flex gap-2">
                        <input value={shareUsername} onChange={(e) => setShareUsername(e.target.value)} placeholder="Username" className={inputClass} />
                        <button type="button" onClick={sharePoi} className={buttonClass}>Share</button>
                      </div>
                      <div className="mt-2 grid gap-1">
                        {(selectedPoi.shares || []).filter((share) => !share.archived_at).map((share) => (
                          <div key={share.id} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1 text-xs">
                            <span>{share.username}</span>
                            <button type="button" className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700" onClick={() => revokeShare(share.shared_with_user_id)}>
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <label className="grid gap-2 text-sm text-zinc-300">
                    Upload photo (max {uploadLimitMb}MB)
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadPhoto} className={inputClass} disabled={!selectedPoi.canEdit} />
                  </label>

                  <div className="grid max-h-48 gap-2 overflow-auto">
                    {(selectedPoi.photos || []).map((photo) => (
                      <div key={photo.id} className="rounded-lg border border-zinc-800 p-2">
                        <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300">{photo.filename}</a>
                        <div className="mt-1 text-xs text-zinc-400">{photo.mime_type} | {photo.size_bytes} bytes</div>
                        <div className="mt-1 text-xs text-zinc-400">Status: {photo.archived_at ? 'Archived' : 'Active'}</div>
                        {selectedPoi.canEdit ? (
                          <div className="mt-2">
                            {!photo.archived_at ? (
                              <button onClick={() => archivePhoto(photo.id)} className={buttonClass}>Archive</button>
                            ) : (
                              <button onClick={() => restorePhoto(photo.id)} className={buttonClass}>Restore</button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {auth.role === 'admin' ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <h2 className="mb-2 text-lg font-medium">Admin Users</h2>
                <form onSubmit={createUser} className="grid gap-2">
                  <input value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} placeholder="Username" className={inputClass} required />
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className={inputClass} required />
                  <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))} className={inputClass}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <button type="submit" className={buttonClass}>Create User</button>
                </form>

                <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={includeArchivedUsers} onChange={(e) => setIncludeArchivedUsers(e.target.checked)} />
                  Include archived users
                </label>

                <div className="mt-2 grid max-h-56 gap-2 overflow-auto">
                  {users.map((userItem) => (
                    <div key={userItem.id} className="rounded border border-zinc-800 p-2 text-xs">
                      <div className="font-semibold">{userItem.username} ({userItem.role})</div>
                      <div className="mt-1 text-zinc-400">{userItem.archived_at ? 'Archived' : 'Active'}</div>
                      <div className="mt-2">
                        {!userItem.archived_at ? (
                          <button type="button" className={buttonClass} onClick={() => archiveUser(userItem.id)}>Archive</button>
                        ) : (
                          <button type="button" className={buttonClass} onClick={() => restoreUser(userItem.id)}>Restore</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
