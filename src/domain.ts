export type RequestStatus = 'pending' | 'queued' | 'calling' | 'singing' | 'completed' | 'removed' | 'rejected' | 'cancelled'
export type Stage = 'idle' | 'calling' | 'singing'

export interface SongRequest {
  id: string
  nightId: string
  ownerUid: string
  name: string
  table: string
  song: string
  artist: string
  suggestedUrl: string
  selectedUrl: string
  status: RequestStatus
  misses: number
  // Legacy Firestore key; now records presence confirmed by the operator.
  onMyWay: boolean
  createdAt: number
}

export interface QueueEntry {
  id: string
  name: string
  table: string
  song: string
  artist: string
  misses: number
  eligibleAfter: number
}

export interface Room {
  nightId: string
  open: boolean
  completedCount: number
  stage: Stage
  calledAt: number | null
  playbackUrl?: string
  queue: QueueEntry[]
}

export const emptyRoom: Room = {
  nightId: '', open: false, completedCount: 0,
  stage: 'idle', calledAt: null, playbackUrl: '', queue: [],
}

export const terminalStatuses: RequestStatus[] = ['completed', 'removed', 'rejected', 'cancelled']

export function toQueueEntry(request: SongRequest): QueueEntry {
  return {
    id: request.id, name: request.name, table: request.table,
    song: request.song, artist: request.artist, misses: request.misses, eligibleAfter: 0,
  }
}

export function singerAlreadyQueued(room: Room, request: SongRequest): boolean {
  if (!request.table.trim()) return false
  const name = request.name.trim().toLocaleLowerCase('pt-BR')
  const table = String(Number(request.table) || request.table.trim())
  return room.queue.some((entry) =>
    entry.table.trim() !== '' &&
    entry.name.trim().toLocaleLowerCase('pt-BR') === name &&
    String(Number(entry.table) || entry.table.trim()) === table,
  )
}

export function publicPosition(room: Room, id: string): number {
  return room.queue.findIndex((entry) => entry.id === id) + 1
}

export function nextEligibleIndex(room: Room): number {
  const index = room.queue.findIndex((entry) => entry.eligibleAfter <= room.completedCount)
  // If everyone missed a call, let the operator retry rather than deadlock the night.
  return index >= 0 ? index : room.queue.length ? 0 : -1
}

export function callNext(room: Room, request: SongRequest, now = Date.now()): Room {
  if (room.stage !== 'idle') throw new Error('Finalize a chamada ou apresentação atual primeiro.')
  const index = nextEligibleIndex(room)
  if (index < 0) throw new Error('Aguarde uma apresentação antes de chamar novamente.')
  if (room.queue[index].id !== request.id) throw new Error('A fila mudou. Tente novamente.')
  const queue = [...room.queue]
  const [entry] = queue.splice(index, 1)
  queue.unshift(entry)
  return { ...room, queue, stage: 'calling', calledAt: now, playbackUrl: '' }
}

export function markNoShow(room: Room, request: SongRequest): { room: Room; misses: number } {
  if (room.stage !== 'calling' || room.queue[0]?.id !== request.id) {
    throw new Error('Chame esta pessoa antes de registrar ausência.')
  }
  const misses = request.misses + 1
  const [, ...rest] = room.queue
  const deferred: QueueEntry = {
    ...room.queue[0], misses, eligibleAfter: room.completedCount + 1,
  }
  const queue = rest.length ? [rest[0], deferred, ...rest.slice(1)] : [deferred]
  return { room: { ...room, queue, stage: 'idle', calledAt: null, playbackUrl: '' }, misses }
}

export function finishSong(room: Room, request: SongRequest): Room {
  if (room.stage !== 'singing' || room.queue[0]?.id !== request.id) {
    throw new Error('Não há apresentação em andamento para concluir.')
  }
  return {
    ...room, queue: room.queue.slice(1), stage: 'idle', calledAt: null, playbackUrl: '',
    completedCount: room.completedCount + 1,
  }
}

export function removeFromQueue(room: Room, id: string): Room {
  return {
    ...room,
    queue: room.queue.filter((entry) => entry.id !== id),
    stage: room.queue[0]?.id === id ? 'idle' : room.stage,
    calledAt: room.queue[0]?.id === id ? null : room.calledAt,
    playbackUrl: room.queue[0]?.id === id ? '' : room.playbackUrl,
  }
}

export function youtubeUrl(value: string): string | null {
  if (!value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(url.hostname)) {
      return url.toString()
    }
  } catch { /* invalid URL */ }
  return null
}

export function youtubeVideoId(value: string): string | null {
  if (!youtubeUrl(value)) return null
  const url = new URL(value)
  const path = url.pathname.split('/').filter(Boolean)
  const id = url.hostname.endsWith('youtu.be')
    ? path[0]
    : path[0] === 'watch'
      ? url.searchParams.get('v')
      : ['shorts', 'live', 'embed'].includes(path[0]) ? path[1] : null
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

export function youtubeSearch(song: string, artist: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song} ${artist} karaoke com letra`)}`
}
