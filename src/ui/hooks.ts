import { useEffect, useState } from 'react'
import { watchRequests, watchRoom } from '../backend'
import { emptyRoom, type Room, type SongRequest } from '../domain'

export function useRoom() {
  const [room, setRoom] = useState<Room>(emptyRoom)
  useEffect(() => watchRoom(setRoom), [])
  return room
}

export function useRequests(nightId: string, enabled: boolean) {
  const [requests, setRequests] = useState<SongRequest[]>([])
  useEffect(() => {
    if (!enabled) return
    return watchRequests(nightId, setRequests)
  }, [nightId, enabled])
  return requests
}

export function useCountdown(calledAt: number | null) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!calledAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [calledAt])
  return calledAt ? Math.min(10, Math.max(0, 10 - Math.floor(((now || calledAt) - calledAt) / 1000))) : 0
}
