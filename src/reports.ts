import type { SongRequest } from './domain'

export interface NightRecord {
  id: string
  startedAt: number
  endedAt: number | null
}

export interface ReportData {
  nights: NightRecord[]
  requests: SongRequest[]
}

export interface RankedItem {
  label: string
  count: number
  performed: number
}

export interface ReportSummary {
  total: number
  completed: number
  cancelled: number
  rejected: number
  open: number
  missedCalls: number
  uniqueSongs: number
  topSongs: RankedItem[]
  topArtists: RankedItem[]
  topTables: RankedItem[]
  hours: { hour: number; count: number }[]
}

function normalized(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function ranked(map: Map<string, RankedItem>): RankedItem[] {
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}

function addRank(map: Map<string, RankedItem>, key: string, label: string, completed: boolean) {
  const item = map.get(key) ?? { label, count: 0, performed: 0 }
  item.count += 1
  if (completed) item.performed += 1
  map.set(key, item)
}

export function mergeReportRequests(current: SongRequest[], archive: SongRequest[]): SongRequest[] {
  const records = new Map<string, SongRequest>()
  for (const request of current) records.set(`${request.id}:${request.createdAt}`, request)
  for (const request of archive) records.set(`${request.id}:${request.createdAt}`, request)
  return [...records.values()].sort((a, b) => a.createdAt - b.createdAt)
}

export function summarizeRequests(requests: SongRequest[]): ReportSummary {
  const songs = new Map<string, RankedItem>()
  const artists = new Map<string, RankedItem>()
  const tables = new Map<string, RankedItem>()
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  let completed = 0
  let cancelled = 0
  let rejected = 0
  let missedCalls = 0

  for (const request of requests) {
    const performed = request.status === 'completed'
    if (performed) completed += 1
    if (request.status === 'cancelled' || request.status === 'removed') cancelled += 1
    if (request.status === 'rejected') rejected += 1
    missedCalls += request.misses

    const artistKey = normalized(request.artist)
    addRank(artists, artistKey, request.artist.trim(), performed)
    addRank(songs, `${normalized(request.song)}:${artistKey}`, `${request.song.trim()} — ${request.artist.trim()}`, performed)
    if (request.table.trim()) addRank(tables, normalized(request.table), `Mesa ${request.table.trim()}`, performed)
    if (Number.isFinite(request.createdAt) && request.createdAt > 1e12) {
      hours[new Date(request.createdAt).getHours()].count += 1
    }
  }

  return {
    total: requests.length, completed, cancelled, rejected,
    open: requests.length - completed - cancelled - rejected,
    missedCalls, uniqueSongs: songs.size,
    topSongs: ranked(songs), topArtists: ranked(artists), topTables: ranked(tables),
    hours: hours.filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.hour - b.hour),
  }
}

export function requestsForNights(data: ReportData, ids: string[]): SongRequest[] {
  const selected = new Set(ids)
  return data.requests.filter((request) => selected.has(request.nightId))
}

export function buildSummaryCsv(data: ReportData, nights: NightRecord[]): string {
  const rows = [
    ['Data', 'Pedidos', 'Apresentações', 'Cancelados', 'Recusados', 'Em aberto', 'Chamadas perdidas', 'Música mais pedida', 'Artista mais pedido'],
    ...nights.map((night) => {
      const summary = summarizeRequests(requestsForNights(data, [night.id]))
      const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(night.startedAt)
      return [date, summary.total, summary.completed, summary.cancelled, summary.rejected,
        summary.open, summary.missedCalls, summary.topSongs[0]?.label ?? '', summary.topArtists[0]?.label ?? '']
    }),
  ]
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    const raw = String(value)
    const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw
    return `"${safe.replace(/"/g, '""')}"`
  }).join(';')).join('\r\n')
}
