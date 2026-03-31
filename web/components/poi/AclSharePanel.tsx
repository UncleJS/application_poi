'use client'

import { useState } from 'react'

import type { PoiShare } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Timestamp } from '@/components/ui/timestamp'

export function AclSharePanel({
  shares,
  canShare,
  onShare,
  onRevoke
}: {
  shares: PoiShare[]
  canShare: boolean
  onShare: (username: string) => Promise<void>
  onRevoke: (userId: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!canShare) return null

  const activeShares = shares.filter((share) => !share.archived_at)

  const handleSubmit = async () => {
    if (!username.trim()) return
    setSubmitting(true)
    try {
      await onShare(username.trim())
      setUsername('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div>
        <div className="text-sm font-semibold text-zinc-100">Share access</div>
        <div className="text-xs text-zinc-500">Share this private POI with additional users.</div>
      </div>

      <div className="flex gap-2">
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <Button type="button" onClick={handleSubmit} disabled={!username.trim() || submitting}>
          {submitting ? 'Sharing…' : 'Share'}
        </Button>
      </div>

      <div className="grid gap-2">
        {activeShares.length === 0 ? (
          <div className="text-sm text-zinc-500">No active shares.</div>
        ) : (
          activeShares.map((share) => (
            <div key={share.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 px-3 py-2">
              <div>
                <div className="text-sm text-zinc-100">{share.username}</div>
                <Timestamp iso={share.created_at} />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void onRevoke(share.shared_with_user_id)}>
                Revoke
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
