import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'OSM POI Platform',
  description: 'OpenStreetMap point of interests with photos and descriptions'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>
        <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white">Home</Link>
            <Link href="/users" className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white">User Management</Link>
            <Link href="/categories" className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white">Manage Categories</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
