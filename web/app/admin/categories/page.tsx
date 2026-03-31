'use client'

import useSWR from 'swr'

import { useAuth } from '@/components/auth/AuthProvider'
import { CategoryForm } from '@/components/categories/CategoryForm'
import { CategoryTable } from '@/components/categories/CategoryTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import type { Category } from '@/lib/types'

export default function AdminCategoriesPage() {
  const { hydrated, request } = useAuth()

  const key = hydrated ? '/api/categories?includeArchived=true' : null
  const { data = [], error, isLoading, mutate } = useSWR(key, (url: string) => request<Category[]>(url, {}, { auth: 'required' }))

  const categories = Array.isArray(data) ? data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Create, rename, archive, and restore category records."
        actions={<Button type="button" variant="outline" onClick={() => void mutate()}>Refresh</Button>}
      />

      {error ? <ErrorBanner message={error.message} /> : null}

      <CategoryForm
        onCreate={async (name) => {
          await request('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name }) }, { auth: 'required' })
          await mutate()
        }}
      />

      <CategoryTable
        categories={categories}
        loading={isLoading}
        error={error?.message}
        onRename={async (categoryId, name) => {
          await request(`/api/admin/categories/${categoryId}`, { method: 'PATCH', body: JSON.stringify({ name }) }, { auth: 'required' })
          await mutate()
        }}
        onArchive={async (categoryId) => {
          await request(`/api/admin/categories/${categoryId}`, { method: 'DELETE' }, { auth: 'required' })
          await mutate()
        }}
        onRestore={async (categoryId) => {
          await request(`/api/admin/categories/${categoryId}/restore`, { method: 'POST' }, { auth: 'required' })
          await mutate()
        }}
      />
    </div>
  )
}
