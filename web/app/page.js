'use client'

import { useEffect, useMemo, useState } from 'react'
import Script from 'next/script'

const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; OpenStreetMap contributors'
const uploadLimitMb = 20

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

  const [auth, setAuth] = useState({ username: 'admin', password: '', accessToken: '', refreshToken: '' })
  const [poiForm, setPoiForm] = useState({
    name: '',
    description: '',
    category: 'general',
    lat: '51.505',
    lng: '-0.09'
  })

  const stats = useMemo(() => {
    const total = pois.length
    const archived = pois.filter((p) => p.archived_at).length
    return { total, archived }
  }, [pois])

  useEffect(() => {
    fetchPois()
  }, [includeArchived])

  useEffect(() => {
    initMap(pois)
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

  const initMap = (items) => {
    if (!window.L) return
    const root = document.getElementById('map')
    if (!root) return

    if (!window.__poiMap) {
      const map = window.L.map('map').setView([51.505, -0.09], 11)
      window.L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map)
      window.__poiMap = map
    }

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
        color: poi.archived_at ? '#9ca3af' : '#0f766e',
        fillOpacity: 0.9
      })
      marker.bindPopup(`<strong>${escapeHtml(poi.name)}</strong><br/>${escapeHtml(poi.category)}<br/>${poi.archived_at ? 'Archived' : 'Active'}`)
      marker.on('click', () => {
        setSelectedPoi(poi)
        fetchPoiDetail(poi.id)
      })
      layer.addLayer(marker)
      bounds.push([lat, lng])
    })

    layer.addTo(window.__poiMap)
    window.__poiLayer = layer

    if (bounds.length > 0) {
      window.__poiMap.fitBounds(bounds, { padding: [30, 30] })
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

  const fetchPoiDetail = async (poiId) => {
    try {
      const detail = await request(`/api/pois/${poiId}`)
      setSelectedPoi(detail)
    } catch (err) {
      setError(String(err.message || err))
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

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #fefce8 45%, #f0fdf4 100%)' }}>
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" onLoad={() => initMap(pois)} />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 18 }}>
        <h1 style={{ marginBottom: 8 }}>OSM POI Platform</h1>
        <p style={{ marginTop: 0, marginBottom: 16 }}>Public map browsing, JWT-protected writes, and MariaDB-stored photos.</p>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {error ? <div style={{ color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 8 }}>{error}</div> : null}
          {success ? <div style={{ color: '#065f46', background: '#dcfce7', padding: 10, borderRadius: 8 }}>{success}</div> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name/description" style={{ flex: 1 }} />
              <button onClick={fetchPois} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', padding: '0 10px', borderRadius: 8, border: '1px solid #ddd' }}>
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                Include archived
              </label>
            </div>

            <div id="map" style={{ height: 540, borderRadius: 12, border: '1px solid #d6d3d1', background: '#fff' }} />
            <p style={{ marginTop: 8, fontSize: 12 }}>
              Total: {stats.total} | Archived in result set: {stats.archived}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Admin Login</h2>
              <div style={{ display: 'grid', gap: 6 }}>
                <input value={auth.username} onChange={(e) => setAuth((p) => ({ ...p, username: e.target.value }))} placeholder="Username" />
                <input type="password" value={auth.password} onChange={(e) => setAuth((p) => ({ ...p, password: e.target.value }))} placeholder="Password" />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={login} style={{ flex: 1 }}>Login</button>
                  <button onClick={refresh} disabled={!auth.refreshToken} style={{ flex: 1 }}>Refresh</button>
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create POI</h2>
              <form onSubmit={createPoi} style={{ display: 'grid', gap: 6 }}>
                <input value={poiForm.name} placeholder="Name" onChange={(e) => setPoiForm((p) => ({ ...p, name: e.target.value }))} required />
                <textarea value={poiForm.description} placeholder="Description" onChange={(e) => setPoiForm((p) => ({ ...p, description: e.target.value }))} required />
                <input value={poiForm.category} placeholder="Category" onChange={(e) => setPoiForm((p) => ({ ...p, category: e.target.value }))} required />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={poiForm.lat} placeholder="Latitude" onChange={(e) => setPoiForm((p) => ({ ...p, lat: e.target.value }))} required />
                  <input value={poiForm.lng} placeholder="Longitude" onChange={(e) => setPoiForm((p) => ({ ...p, lng: e.target.value }))} required />
                </div>
                <button type="submit">Save POI</button>
              </form>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Selected POI</h2>
              {!selectedPoi ? (
                <p style={{ margin: 0 }}>Click a marker to view details.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <strong>{selectedPoi.name}</strong>
                  <span>{selectedPoi.description}</span>
                  <span>Category: {selectedPoi.category}</span>
                  <span>Status: {selectedPoi.archived_at ? 'Archived' : 'Active'}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!selectedPoi.archived_at ? (
                      <button onClick={() => archivePoi(selectedPoi.id)} style={{ flex: 1 }}>Archive POI</button>
                    ) : (
                      <button onClick={() => restorePoi(selectedPoi.id)} style={{ flex: 1 }}>Restore POI</button>
                    )}
                    <button onClick={() => fetchPoiDetail(selectedPoi.id)} style={{ flex: 1 }}>Refresh Details</button>
                  </div>

                  <label style={{ display: 'grid', gap: 6 }}>
                    Upload photo (max {uploadLimitMb}MB)
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadPhoto} />
                  </label>

                  <div style={{ display: 'grid', gap: 8, maxHeight: 180, overflow: 'auto' }}>
                    {(selectedPoi.photos || []).map((photo) => (
                      <div key={photo.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                        <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer">{photo.filename}</a>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{photo.mime_type} | {photo.size_bytes} bytes</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Status: {photo.archived_at ? 'Archived' : 'Active'}</div>
                        <div style={{ marginTop: 6 }}>
                          {!photo.archived_at ? (
                            <button onClick={() => archivePhoto(photo.id)}>Archive</button>
                          ) : (
                            <button onClick={() => restorePhoto(photo.id)}>Restore</button>
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
