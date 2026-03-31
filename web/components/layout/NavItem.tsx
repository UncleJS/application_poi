'use client'

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function NavItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  onNavigate
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-teal-950 text-teal-100 ring-1 ring-teal-800' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  )
}
