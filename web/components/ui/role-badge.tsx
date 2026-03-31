import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/lib/types'

export function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <Badge className="border-violet-800 bg-violet-950 text-violet-200">admin</Badge>
  ) : (
    <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300">user</Badge>
  )
}
