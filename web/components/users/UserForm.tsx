'use client'

import { useState } from 'react'

import type { UserRole } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export function UserForm({
  onCreate
}: {
  onCreate: (payload: { username: string; password: string; role: UserRole }) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [submitting, setSubmitting] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create user</CardTitle>
        <CardDescription>Admins can create users and restore archived accounts without deleting history.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
        <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </Select>
        <Button
          type="button"
          disabled={!username.trim() || !password.trim() || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await onCreate({ username: username.trim(), password, role })
              setUsername('')
              setPassword('')
              setRole('user')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {submitting ? 'Saving…' : 'Create'}
        </Button>
      </CardContent>
    </Card>
  )
}
