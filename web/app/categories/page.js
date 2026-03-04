'use client'

import { useEffect, useState } from 'react'

const storageKey = 'poi.auth'

const loadStoredAuth = () => {
  const fallback = { username: 'admin', password: '', accessToken: '', refreshToken: '', role: '' }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKey)
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

export default function CategoriesPage() {
  const [auth, setAuth] = useState(loadStoredAuth)
  const [categories, setCategories] = useState([])
  const [categoryEdits, setCategoryEdits] = useState({})
  const [includeArchived, setIncludeArchived] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const inputClass = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500'
  const buttonClass = 'rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50'
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

  const fetchCategories = async () => {
    if (!auth.accessToken) {
      setCategories([])
      return
    }
    try {
      const params = new URLSearchParams()
      if (includeArchived && auth.role === 'admin') params.set('includeArchived', 'true')
      const data = await request(`/api/categories?${params.toString()}`, { headers: authHeader })
      const nextCategories = Array.isArray(data) ? data : []
      setCategories(nextCategories)
      setCategoryEdits((prev) => {
        const next = { ...prev }
        nextCategories.forEach((category) => {
          if (!next[category.id]) {
            next[category.id] = category.name || ''
          }
        })
        return next
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const createCategory = async (event) => {
    event.preventDefault()
    try {
      await request('/api/admin/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader },
        body: JSON.stringify({ name: newCategoryName })
      })
      setNewCategoryName('')
      setSuccess('Category saved')
      await fetchCategories()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const archiveCategory = async (categoryId) => {
    try {
      await request(`/api/admin/categories/${categoryId}`, { method: 'DELETE', headers: authHeader })
      setSuccess('Category archived')
      await fetchCategories()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const updateCategory = async (categoryId) => {
    const name = String(categoryEdits[categoryId] || '').trim()
    if (!name) {
      setError('Category name is required')
      return
    }
    try {
      await request(`/api/admin/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeader },
        body: JSON.stringify({ name })
      })
      setSuccess('Category updated')
      await fetchCategories()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const restoreCategory = async (categoryId) => {
    try {
      await request(`/api/admin/categories/${categoryId}/restore`, { method: 'POST', headers: authHeader })
      setSuccess('Category restored')
      await fetchCategories()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify({
      username: auth.username,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      role: auth.role
    }))
  }, [auth.username, auth.accessToken, auth.refreshToken, auth.role])

  useEffect(() => {
    fetchCategories()
  }, [auth.accessToken, auth.role, includeArchived])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Manage Categories</h1>
        <p className="mb-4 text-sm text-zinc-400">POIs now use category foreign keys backed by the categories table.</p>

        <div className="mb-3 grid gap-2">
          {error ? <div className="rounded-lg border border-red-800 bg-red-950 p-2.5 text-sm text-red-300">{error}</div> : null}
          {success ? <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-2.5 text-sm text-emerald-300">{success}</div> : null}
        </div>

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <h2 className="mb-2 text-lg font-medium">Login</h2>
          <div className="grid gap-2">
            <input value={auth.username} onChange={(e) => setAuth((p) => ({ ...p, username: e.target.value }))} placeholder="Username" className={inputClass} />
            <input type="password" value={auth.password} onChange={(e) => setAuth((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className={inputClass} />
            <button onClick={login} className={buttonClass}>Login</button>
            {auth.role ? <p className="text-xs text-zinc-400">Role: {auth.role}</p> : null}
          </div>
        </div>

        {auth.role === 'admin' ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <h2 className="mb-2 text-lg font-medium">Category Admin</h2>
            <form onSubmit={createCategory} className="mb-3 flex gap-2">
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className={inputClass} required />
              <button type="submit" className={buttonClass}>Save</button>
            </form>
            <label className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              Include archived categories
            </label>
            <div className="grid max-h-72 gap-2 overflow-auto">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-xs text-zinc-500">{category.archived_at ? 'Archived' : 'Active'}</div>
                  </div>
                  {!category.archived_at ? (
                    <div className="ml-3 grid min-w-64 gap-2">
                      <input
                        value={categoryEdits[category.id] || ''}
                        onChange={(e) => setCategoryEdits((prev) => ({ ...prev, [category.id]: e.target.value }))}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button type="button" className={buttonClass} onClick={() => updateCategory(category.id)}>Save</button>
                        <button type="button" className={buttonClass} onClick={() => archiveCategory(category.id)}>Archive</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={buttonClass} onClick={() => restoreCategory(category.id)}>Restore</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <h2 className="mb-2 text-lg font-medium">Available Categories</h2>
          <div className="grid gap-2 text-sm">
            {categories.map((category) => (
              <div key={category.id} className="rounded border border-zinc-800 px-3 py-2">
                {category.name}
              </div>
            ))}
            {categories.length === 0 ? <p className="text-zinc-500">No categories found.</p> : null}
          </div>
        </div>
      </section>
    </main>
  )
}
