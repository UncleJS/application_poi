'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

import type { AuthTokens, AuthUser, StoredAuthSession } from '@/lib/types'

type AuthStatus = 'loading' | 'guest' | 'authenticated'
type AuthMode = 'optional' | 'required'

interface RequestOptions {
  auth?: AuthMode
  retryOn401?: boolean
}

interface LoginInput {
  username: string
  password: string
}

interface AuthContextValue {
  status: AuthStatus
  hydrated: boolean
  user: AuthUser | null
  accessToken: string
  refreshToken: string
  isAuthenticated: boolean
  isAdmin: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  request: <T>(input: string, init?: RequestInit, options?: RequestOptions) => Promise<T>
}

const STORAGE_KEY = 'poi.auth'

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredSession(): StoredAuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredAuthSession> & { role?: AuthUser['role']; username?: string }

    const user = parsed.user
      ? parsed.user
      : parsed.username && parsed.role
        ? { username: parsed.username, role: parsed.role }
        : null

    return {
      accessToken: parsed.accessToken ?? '',
      refreshToken: parsed.refreshToken ?? '',
      user
    }
  } catch {
    return null
  }
}

function writeStoredSession(session: StoredAuthSession | null) {
  if (typeof window === 'undefined') return

  if (!session || (!session.accessToken && !session.refreshToken && !session.user)) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    const message = isJson && payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error ?? `Request failed: ${response.status}`)
      : String(payload || `Request failed: ${response.status}`)

    throw new Error(message)
  }

  return payload as T
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [hydrated, setHydrated] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)

  const sessionRef = useRef<StoredAuthSession>({ accessToken: '', refreshToken: '', user: null })

  const applySession = useCallback((next: StoredAuthSession | null) => {
    const normalized = next ?? { accessToken: '', refreshToken: '', user: null }

    sessionRef.current = normalized
    setAccessToken(normalized.accessToken)
    setRefreshToken(normalized.refreshToken)
    setUser(normalized.user)
    setStatus(normalized.accessToken || normalized.refreshToken ? 'authenticated' : 'guest')
    writeStoredSession(normalized.user || normalized.accessToken || normalized.refreshToken ? normalized : null)
  }, [])

  const logout = useCallback(() => {
    sessionRef.current = { accessToken: '', refreshToken: '', user: null }
    setAccessToken('')
    setRefreshToken('')
    setUser(null)
    setStatus('guest')
    writeStoredSession(null)
  }, [])

  const refreshSession = useCallback(async (silent = false) => {
    const currentRefreshToken = sessionRef.current.refreshToken
    if (!currentRefreshToken) {
      if (!silent) logout()
      return null
    }

    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken })
      })
      const payload = await parseResponse<AuthTokens>(response)

      const nextSession: StoredAuthSession = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user
      }

      applySession(nextSession)
      return nextSession
    } catch {
      logout()
      return null
    }
  }, [applySession, logout])

  useEffect(() => {
    const stored = readStoredSession()

    if (!stored) {
      setHydrated(true)
      setStatus('guest')
      return
    }

    sessionRef.current = stored
    setAccessToken(stored.accessToken)
    setRefreshToken(stored.refreshToken)
    setUser(stored.user)

    if (!stored.accessToken && stored.refreshToken) {
      void refreshSession(true).finally(() => {
        setHydrated(true)
      })
      return
    }

    setStatus(stored.accessToken ? 'authenticated' : 'guest')
    setHydrated(true)
  }, [refreshSession])

  const login = useCallback(async ({ username, password }: LoginInput) => {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const payload = await parseResponse<AuthTokens>(response)

    applySession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user
    })
  }, [applySession])

  const request = useCallback(
    async <T,>(input: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      const auth = options.auth ?? 'optional'

      const execute = async (token?: string) => {
        const headers = new Headers(init.headers)

        if (token) {
          headers.set('authorization', `Bearer ${token}`)
        } else {
          headers.delete('authorization')
        }

        if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
          headers.set('content-type', 'application/json')
        }

        return fetch(input, { ...init, headers })
      }

      let token = sessionRef.current.accessToken
      if (auth === 'required' && !token) {
        const refreshed = await refreshSession(true)
        token = refreshed?.accessToken ?? ''
      }

      if (auth === 'required' && !token) {
        throw new Error('Login required')
      }

      let response = await execute(token || undefined)

      if (response.status === 401 && options.retryOn401 !== false && sessionRef.current.refreshToken) {
        const refreshed = await refreshSession(true)
        if (refreshed?.accessToken) {
          response = await execute(refreshed.accessToken)
        } else if (auth === 'optional') {
          response = await execute(undefined)
        }
      }

      return parseResponse<T>(response)
    },
    [refreshSession]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      hydrated,
      user,
      accessToken,
      refreshToken,
      isAuthenticated: status === 'authenticated' && Boolean(accessToken),
      isAdmin: user?.role === 'admin',
      login,
      logout,
      refresh: async () => {
        await refreshSession(false)
      },
      request
    }),
    [status, hydrated, user, accessToken, refreshToken, login, logout, refreshSession, request]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
