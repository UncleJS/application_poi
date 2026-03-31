import type { ReactNode } from 'react'
import type { Metadata } from 'next'

import 'leaflet/dist/leaflet.css'
import './globals.css'

import { AuthProvider } from '@/components/auth/AuthProvider'

export const metadata: Metadata = {
  title: 'OSM POI Platform',
  description: 'OpenStreetMap points of interest with shared auth and admin workflows'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
