'use client'

import { useEffect, useState } from 'react'

import type { UserListItem, UserRole } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Input } from '@/components/ui/input'
import { RoleBadge } from '@/components/ui/role-badge'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton-rows'
import { StatusBadge } from '@/components/ui/status-badge'
import { Timestamp } from '@/components/ui/timestamp'

export function UserTable({
  users,
  loading,
  error,
  onUpdate,
  onArchive,
  onRestore
}: {
  users: UserListItem[]
  loading: boolean
  error?: string | null
  onUpdate: (userId: string, payload: { role?: UserRole; password?: string }) => Promise<void>
  onArchive: (userId: string) => Promise<void>
  onRestore: (userId: string) => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, { role: UserRole; password: string }>>({})

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current }
      users.forEach((user) => {
        next[user.id] = current[user.id] ?? { role: user.role, password: '' }
      })
      return next
    })
  }, [users])

  if (loading) return <SkeletonRows rows={6} />
  if (error) return <ErrorBanner message={error} />
  if (users.length === 0) {
    return <EmptyState title="No users" description="Create a user to grant access to the POI application." />
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/80 text-left text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Username</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {users.map((user) => {
            const draft = drafts[user.id] ?? { role: user.role, password: '' }
            const dirty = draft.role !== user.role || Boolean(draft.password.trim())

            return (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-zinc-100">{user.username}</td>
                <td className="px-4 py-3">
                  <div className="grid gap-2 md:grid-cols-[120px_1fr_auto] md:items-center">
                    <RoleBadge role={user.role} />
                    <Select
                      value={draft.role}
                      onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, role: event.target.value as UserRole } }))}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </Select>
                    <Input
                      type="password"
                      value={draft.password}
                      onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, password: event.target.value } }))}
                      placeholder="New password"
                    />
                  </div>
                </td>
                <td className="px-4 py-3"><Timestamp iso={user.created_at} /></td>
                <td className="px-4 py-3">{user.archived_at ? <StatusBadge label="Archived" /> : <StatusBadge label="Public" />}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!dirty}
                      onClick={() =>
                        void onUpdate(user.id, {
                          role: draft.role !== user.role ? draft.role : undefined,
                          password: draft.password.trim() || undefined
                        }).then(() => {
                          setDrafts((current) => ({ ...current, [user.id]: { role: draft.role, password: '' } }))
                        })
                      }
                    >
                      Save
                    </Button>
                    {user.archived_at ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void onRestore(user.id)}>
                        Restore
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" size="sm" onClick={() => void onArchive(user.id)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
