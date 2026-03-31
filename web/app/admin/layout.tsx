'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/components/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { hydrated, isAdmin } = useAuth()

  useEffect(() => {
    if (hydrated && !isAdmin) {
      router.replace('/map')
    }
  }, [hydrated, isAdmin, router])

  return (
    <AppShell>
      {hydrated && isAdmin ? (
        children
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-6 text-sm text-zinc-400">
          Checking admin access…
        </div>
      )}
    </AppShell>
  )
}
