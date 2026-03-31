'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MapPinned, Menu, Shield, Users, X } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { useAuth } from '@/components/auth/AuthProvider'
import { NavItem } from '@/components/layout/NavItem'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/ui/role-badge'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated, logout, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const primaryItems = useMemo(
    () => [{ href: '/map', label: 'Map', icon: MapPinned }],
    []
  )

  const adminItems = useMemo(
    () => [
      { href: '/admin/categories', label: 'Categories', icon: Shield },
      { href: '/admin/users', label: 'Users', icon: Users }
    ],
    []
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950/95 px-4 py-5 backdrop-blur transition-transform md:static md:translate-x-0',
            collapsed && 'md:w-20',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link href="/map" className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950 ring-1 ring-teal-800">
                <MapPinned className="h-5 w-5 text-teal-200" />
              </div>
              {!collapsed ? (
                <div>
                  <div className="text-sm font-semibold text-zinc-100">POI Platform</div>
                  <div className="text-xs text-zinc-500">High-contrast admin UI</div>
                </div>
              ) : null}
            </Link>
            <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5 text-zinc-400" />
            </Button>
          </div>

          <div className="app-scrollbar flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-2">
              {!collapsed ? <div className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Primary</div> : null}
              <div className="space-y-1">
                {primaryItems.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={pathname?.startsWith(item.href) ?? false}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                {!collapsed ? <div className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Admin</div> : null}
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={pathname?.startsWith(item.href) ?? false}
                      collapsed={collapsed}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 hidden md:block">
            <Button variant="outline" className="w-full" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? 'Expand' : 'Collapse'}
            </Button>
          </div>
        </aside>

        {mobileOpen ? <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} /> : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <div className="text-sm font-medium text-zinc-200">Application POI</div>
                  <div className="text-xs text-zinc-500">Modernized operator workspace</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isAuthenticated && user ? (
                  <div className="hidden items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 sm:flex">
                    <span className="text-sm text-zinc-200">{user.username}</span>
                    <RoleBadge role={user.role} />
                  </div>
                ) : (
                  <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
                    Login
                  </Link>
                )}

                {isAuthenticated ? (
                  <Button variant="outline" onClick={logout}>
                    Logout
                  </Button>
                ) : null}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
