'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function CategoryForm({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create category</CardTitle>
        <CardDescription>Categories are archive-only and stay available for restore flows.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" />
        <Button
          type="button"
          disabled={!name.trim() || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await onCreate(name.trim())
              setName('')
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
