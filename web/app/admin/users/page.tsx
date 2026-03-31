'use client'

import useSWR from 'swr'

import { useAuth } from '@/components/auth/AuthProvider'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { UserForm } from '@/components/users/UserForm'
import { UserTable } from '@/components/users/UserTable'
import type { UserListItem, UserRole } from '@/lib/types'

export default function AdminUsersPage() {
  const { hydrated, request } = useAuth()

  const key = hydrated ? '/api/admin/users?includeArchived=true' : null
  const { data = [], error, isLoading, mutate } = useSWR(key, (url: string) => request<UserListItem[]>(url, {}, { auth: 'required' }))

  const users = Array.isArray(data) ? data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create users, update roles or passwords, and restore archived accounts."
        actions={<Button type="button" variant="outline" onClick={() => void mutate()}>Refresh</Button>}
      />

      {error ? <ErrorBanner message={error.message} /> : null}

      <UserForm
        onCreate={async (payload) => {
          await request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) }, { auth: 'required' })
          await mutate()
        }}
      />

      <UserTable
        users={users}
        loading={isLoading}
        error={error?.message}
        onUpdate={async (userId, payload: { role?: UserRole; password?: string }) => {
          await request(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }, { auth: 'required' })
          await mutate()
        }}
        onArchive={async (userId) => {
          await request(`/api/admin/users/${userId}`, { method: 'DELETE' }, { auth: 'required' })
          await mutate()
        }}
        onRestore={async (userId) => {
          await request(`/api/admin/users/${userId}/restore`, { method: 'POST' }, { auth: 'required' })
          await mutate()
        }}
      />
    </div>
  )
}
