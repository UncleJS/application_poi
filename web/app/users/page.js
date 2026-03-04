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

export default function UsersPage() {
  const [auth, setAuth] = useState(loadStoredAuth)
  const [users, setUsers] = useState([])
  const [userEdits, setUserEdits] = useState({})
  const [includeArchived, setIncludeArchived] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user' })
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

  const logout = () => {
    setError('')
    setSuccess('Logged out')
    setUsers([])
    setAuth((prev) => ({
      ...prev,
      password: '',
      accessToken: '',
      refreshToken: '',
      role: ''
    }))
  }

  const fetchUsers = async () => {
    if (auth.role !== 'admin' || !auth.accessToken) {
      setUsers([])
      return
    }
    try {
      const params = new URLSearchParams()
      if (includeArchived) params.set('includeArchived', 'true')
      const data = await request(`/api/admin/users?${params.toString()}`, { headers: authHeader })
      const nextUsers = Array.isArray(data) ? data : []
      setUsers(nextUsers)
      setUserEdits((prev) => {
        const next = { ...prev }
        nextUsers.forEach((userItem) => {
          if (!next[userItem.id]) {
            next[userItem.id] = { role: userItem.role || 'user', password: '' }
          }
        })
        return next
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  const updateUser = async (userId) => {
    const edit = userEdits[userId] || { role: 'user', password: '' }
    const payload = {}
    if (edit.role) payload.role = edit.role
    if (edit.password?.trim()) payload.password = edit.password
    try {
      await request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeader },
        body: JSON.stringify(payload)
      })
      setUserEdits((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          password: ''
        }
      }))
      setSuccess('User updated')
      await fetchUsers()
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
    fetchUsers()
  }, [auth.accessToken, auth.role, includeArchived])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">User Management</h1>
        <p className="mb-4 text-sm text-zinc-400">Admin-only user create, archive, and restore workflows.</p>

        <div className="mb-3 grid gap-2">
          {error ? <div className="rounded-lg border border-red-800 bg-red-950 p-2.5 text-sm text-red-300">{error}</div> : null}
          {success ? <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-2.5 text-sm text-emerald-300">{success}</div> : null}
        </div>

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <h2 className="mb-2 text-lg font-medium">Login</h2>
          <div className="grid gap-2">
            <input value={auth.username} onChange={(e) => setAuth((p) => ({ ...p, username: e.target.value }))} placeholder="Username" className={inputClass} />
            <input type="password" value={auth.password} onChange={(e) => setAuth((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className={inputClass} />
            <div className="flex gap-2">
              <button onClick={login} className={`${buttonClass} flex-1`}>Login</button>
              <button onClick={logout} disabled={!auth.accessToken && !auth.refreshToken} className={`${buttonClass} flex-1`}>Logout</button>
            </div>
            {auth.role ? <p className="text-xs text-zinc-400">Role: {auth.role}</p> : null}
          </div>
        </div>

        {auth.role !== 'admin' ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">Login as an admin to manage users.</div>
        ) : (
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
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              Include archived users
            </label>

            <div className="mt-2 grid max-h-72 gap-2 overflow-auto">
              {users.map((userItem) => (
                <div key={userItem.id} className="rounded border border-zinc-800 p-2 text-xs">
                  <div className="font-semibold">{userItem.username} ({userItem.role})</div>
                  <div className="mt-1 text-zinc-400">{userItem.archived_at ? 'Archived' : 'Active'}</div>
                  {!userItem.archived_at ? (
                    <div className="mt-2 grid gap-2">
                      <select
                        value={userEdits[userItem.id]?.role || userItem.role}
                        onChange={(e) => setUserEdits((prev) => ({
                          ...prev,
                          [userItem.id]: {
                            ...(prev[userItem.id] || {}),
                            role: e.target.value
                          }
                        }))}
                        className={inputClass}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <input
                        type="password"
                        value={userEdits[userItem.id]?.password || ''}
                        onChange={(e) => setUserEdits((prev) => ({
                          ...prev,
                          [userItem.id]: {
                            ...(prev[userItem.id] || {}),
                            password: e.target.value
                          }
                        }))}
                        placeholder="New password (optional)"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button type="button" className={buttonClass} onClick={() => updateUser(userItem.id)}>Save Changes</button>
                        <button type="button" className={buttonClass} onClick={() => archiveUser(userItem.id)}>Archive</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button type="button" className={buttonClass} onClick={() => restoreUser(userItem.id)}>Restore</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
