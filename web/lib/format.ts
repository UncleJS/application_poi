export function formatLocalTimestamp(iso: string | null | undefined) {
  if (!iso) return '—'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatBytes(value: number | null | undefined) {
  if (!value || value < 1024) return `${value ?? 0} B`

  const units = ['KB', 'MB', 'GB']
  let size = value
  let unit = 'B'

  for (const nextUnit of units) {
    size /= 1024
    unit = nextUnit
    if (size < 1024) break
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`
}
