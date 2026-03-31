'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/components/auth/AuthProvider'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const { hydrated, isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace('/map')
    }
  }, [hydrated, isAuthenticated, router])

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">Loading session…</div>
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/95">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Authenticate to create, edit, and manage POIs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ErrorBanner message={error} />
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <Button
            type="button"
            disabled={!username.trim() || !password || loading}
            onClick={async () => {
              setLoading(true)
              setError('')
              try {
                await login({ username: username.trim(), password })
                router.replace('/map')
              } catch (value) {
                setError(value instanceof Error ? value.message : 'Login failed')
              } finally {
                setLoading(false)
                setPassword('')
              }
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
