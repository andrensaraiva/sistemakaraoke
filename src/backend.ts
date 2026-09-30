import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, onSnapshot, query, runTransaction,
  updateDoc, where,
} from 'firebase/firestore'
import {
  callNext as advanceCall, emptyRoom, finishSong, markNoShow,
  nextEligibleIndex, removeFromQueue, singerAlreadyQueued, terminalStatuses, toQueueEntry,
  youtubeVideoId, type Room, type SongRequest,
} from './domain'
import { mergeReportRequests, type NightRecord, type ReportData } from './reports'

const settings = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const configValues = Object.values(settings).map((value) => value?.trim() ?? '')
const hasAnyConfig = configValues.some(Boolean)
const hasFullConfig = configValues.every(Boolean)
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
export const demoMode = import.meta.env.DEV && !hasAnyConfig && !useEmulators
export const firebaseConfigError = hasAnyConfig && !hasFullConfig
  ? 'A configuração do Firebase está incompleta. Preencha as quatro variáveis em .env.local e reinicie o servidor.'
  : useEmulators && !settings.projectId?.startsWith('demo-')
    ? 'O modo emulador exige um projeto de teste com ID iniciado por demo-.'
    : !hasFullConfig && !demoMode
      ? 'Firebase não configurado. Preencha .env.local e gere uma nova versão do site.'
      : ''
const app = firebaseConfigError || demoMode ? null : initializeApp(settings)
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null
if (useEmulators && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
const mainRoom = db ? doc(db, 'rooms', 'main') : null

type Listener = () => void
type DemoData = { room: Room; requests: SongRequest[]; archive: SongRequest[]; nights: NightRecord[] }
const demoKey = 'karaoke-retro-demo-v1'
const demoChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(demoKey) : null
const localListeners = new Set<Listener>()

function starterDemo(): DemoData {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const nightId = 'demonstracao'
  const requests: SongRequest[] = [
    { id: 'sample-ana', nightId, ownerUid: 'sample-ana', name: 'Ana', table: '03', song: 'Evidências', artist: 'Chitãozinho & Xororó', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: now - 18 * 60_000 },
    { id: 'sample-bruno', nightId, ownerUid: 'sample-bruno', name: 'Bruno', table: '07', song: 'Tempo Perdido', artist: 'Legião Urbana', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: now - 12 * 60_000 },
    { id: 'sample-carla', nightId, ownerUid: 'sample-carla', name: 'Carla', table: '02', song: 'Dona de Mim', artist: 'Iza', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: now - 5 * 60_000 },
  ]
  const pastNights: NightRecord[] = [
    { id: 'demo-sexta', startedAt: now - 7 * day, endedAt: now - 7 * day + 4 * 60 * 60_000 },
    { id: 'demo-sabado', startedAt: now - 14 * day, endedAt: now - 14 * day + 5 * 60 * 60_000 },
  ]
  const sample = (night: NightRecord, index: number, name: string, song: string, artist: string, status: SongRequest['status']): SongRequest => ({
    id: `demo-${night.id}-${index}`, nightId: night.id, ownerUid: `demo-${night.id}-${index}`,
    name, table: index % 2 ? '04' : '', song, artist, suggestedUrl: '', selectedUrl: '', status,
    misses: status === 'cancelled' ? 1 : 0, onMyWay: false, createdAt: night.startedAt + index * 37 * 60_000,
  })
  const archive = [
    sample(pastNights[0], 1, 'Bia', 'Evidências', 'Chitãozinho & Xororó', 'completed'),
    sample(pastNights[0], 2, 'Rafa', 'Tempo Perdido', 'Legião Urbana', 'completed'),
    sample(pastNights[0], 3, 'Lu', 'Evidências', 'Chitãozinho & Xororó', 'completed'),
    sample(pastNights[0], 4, 'Gui', 'Pescador de Ilusões', 'O Rappa', 'cancelled'),
    sample(pastNights[1], 1, 'Nina', 'Dona de Mim', 'Iza', 'completed'),
    sample(pastNights[1], 2, 'Caio', 'Evidencias', 'Chitãozinho & Xororó', 'completed'),
    sample(pastNights[1], 3, 'Mari', 'Tempo Perdido', 'Legião Urbana', 'completed'),
    sample(pastNights[1], 4, 'João', 'Anna Júlia', 'Los Hermanos', 'rejected'),
    sample(pastNights[1], 5, 'Lia', 'Dona de Mim', 'IZA', 'completed'),
  ]
  return {
    room: { ...emptyRoom, nightId, open: true, queue: requests.map(toQueueEntry) },
    requests, archive,
    nights: [{ id: nightId, startedAt: now - 20 * 60_000, endedAt: null }, ...pastNights],
  }
}

function readDemo(): DemoData {
  try {
    const saved = localStorage.getItem(demoKey)
    if (!saved) return starterDemo()
    const data = JSON.parse(saved) as DemoData
    if (!data.nights) {
      const examples = starterDemo()
      data.nights = [
        { id: data.room.nightId, startedAt: Math.min(...data.requests.filter((item) => item.createdAt > 1e12).map((item) => item.createdAt), Date.now()), endedAt: null },
        ...examples.nights.slice(1),
      ]
      data.archive = examples.archive
      localStorage.setItem(demoKey, JSON.stringify(data))
    }
    return data
  } catch { return starterDemo() }
}

function notifyDemoListeners() {
  localListeners.forEach((listener) => listener())
}

function emitDemo() {
  notifyDemoListeners()
  demoChannel?.postMessage('change')
}
demoChannel?.addEventListener('message', notifyDemoListeners)
if (demoMode && typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => { if (event.key === demoKey) notifyDemoListeners() })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) notifyDemoListeners() })
}

function mutateDemo(change: (data: DemoData) => void) {
  const data = readDemo()
  change(data)
  localStorage.setItem(demoKey, JSON.stringify(data))
  emitDemo()
}

function listenDemo(listener: Listener): Listener {
  localListeners.add(listener)
  listener()
  return () => { localListeners.delete(listener) }
}

function requestRef(id: string) {
  if (!db) throw new Error('Firebase não configurado.')
  return doc(db, 'rooms', 'main', 'requests', id)
}

function nightRef(id: string) {
  if (!db) throw new Error('Firebase não configurado.')
  return doc(db, 'rooms', 'main', 'nights', id)
}

function archiveRef(request: SongRequest) {
  if (!db) throw new Error('Firebase não configurado.')
  return doc(db, 'rooms', 'main', 'archive', `${request.id}_${request.createdAt}`)
}

export async function loadReports(): Promise<ReportData> {
  if (demoMode) {
    const data = readDemo()
    return { nights: data.nights, requests: mergeReportRequests(data.requests, data.archive) }
  }
  const [nights, requests, archive] = await Promise.all([
    getDocs(collection(db!, 'rooms', 'main', 'nights')),
    getDocs(collection(db!, 'rooms', 'main', 'requests')),
    getDocs(collection(db!, 'rooms', 'main', 'archive')),
  ])
  return {
    nights: nights.docs.map((item) => item.data() as NightRecord),
    requests: mergeReportRequests(
      requests.docs.map((item) => item.data() as SongRequest),
      archive.docs.map((item) => item.data() as SongRequest),
    ),
  }
}

function assertRoom(room: Room | undefined): asserts room is Room {
  if (!room?.nightId) throw new Error('Abra a noite antes de continuar.')
}

function assertRequest(request: SongRequest | undefined): asserts request is SongRequest {
  if (!request) throw new Error('Pedido não encontrado. Atualize a página.')
}

export function watchRoom(callback: (room: Room) => void): Listener {
  if (demoMode) return listenDemo(() => callback(readDemo().room))
  return onSnapshot(mainRoom!, (snapshot) => callback(snapshot.exists() ? snapshot.data() as Room : emptyRoom))
}

export function watchRequests(nightId: string, callback: (requests: SongRequest[]) => void): Listener {
  if (!nightId) { callback([]); return () => {} }
  if (demoMode) return listenDemo(() => callback(readDemo().requests.filter((item) => item.nightId === nightId)))
  return onSnapshot(query(collection(db!, 'rooms', 'main', 'requests'), where('nightId', '==', nightId)),
    (snapshot) => callback(snapshot.docs.map((item) => item.data() as SongRequest)))
}

export function watchOwnRequest(nightId: string, uid: string, callback: (request: SongRequest | null) => void): Listener {
  if (!nightId || !uid) { callback(null); return () => {} }
  const id = `${nightId}_${uid}`
  if (demoMode) return listenDemo(() => callback(readDemo().requests.find((item) => item.id === id) ?? null))
  return onSnapshot(requestRef(id), (snapshot) => callback(snapshot.exists() ? snapshot.data() as SongRequest : null))
}

export function watchAdmin(callback: (state: { ready: boolean; allowed: boolean; email: string }) => void): Listener {
  if (demoMode) { callback({ ready: true, allowed: true, email: 'Modo de demonstração' }); return () => {} }
  return onAuthStateChanged(auth!, async (user) => {
    if (!user) { callback({ ready: true, allowed: false, email: '' }); return }
    try {
      const admin = await getDoc(doc(db!, 'admins', user.uid))
      callback({ ready: true, allowed: admin.exists() && admin.data().active === true, email: user.email ?? '' })
    } catch {
      callback({ ready: true, allowed: false, email: user.email ?? '' })
    }
  })
}

export async function signInAdmin(email: string, password: string) {
  if (!auth) return
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signOutAdmin() {
  if (auth) await firebaseSignOut(auth)
}

export async function guestUid(): Promise<string> {
  if (demoMode) {
    let uid = localStorage.getItem('karaoke-demo-guest-id')
    if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('karaoke-demo-guest-id', uid) }
    return uid
  }
  await auth!.authStateReady()
  if (auth!.currentUser) return auth!.currentUser.uid
  const credential = await signInAnonymously(auth!)
  return credential.user.uid
}

export async function submitRequest(room: Room, uid: string, values: Pick<SongRequest, 'name' | 'table' | 'song' | 'artist' | 'suggestedUrl'>) {
  if (!room.open) throw new Error('A fila está fechada no momento.')
  const id = `${room.nightId}_${uid}`
  const request: SongRequest = {
    ...values, id, nightId: room.nightId, ownerUid: uid,
    selectedUrl: '', status: 'pending', misses: 0, onMyWay: false, createdAt: Date.now(),
  }
  if (demoMode) {
    mutateDemo((data) => {
      const existing = data.requests.find((item) => item.id === id)
      if (existing && !terminalStatuses.includes(existing.status)) throw new Error('Você já tem um pedido ativo.')
      data.requests = [...data.requests.filter((item) => item.id !== id), request]
    })
    return
  }
  const reference = requestRef(id)
  await runTransaction(db!, async (transaction) => {
    const existing = await transaction.get(reference)
    if (existing.exists() && !terminalStatuses.includes((existing.data() as SongRequest).status)) {
      throw new Error('Você já tem um pedido ativo.')
    }
    transaction.set(reference, request)
  })
}

export async function openNight() {
  const now = Date.now()
  const room: Room = { ...emptyRoom, nightId: crypto.randomUUID(), open: true }
  const night: NightRecord = { id: room.nightId, startedAt: now, endedAt: null }
  if (demoMode) {
    mutateDemo((data) => {
      const previous = data.nights.find((item) => item.id === data.room.nightId)
      if (previous && previous.endedAt === null) previous.endedAt = now
      data.room = room
      data.nights.unshift(night)
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const previousRoomSnapshot = await transaction.get(mainRoom!)
    const previousRoom = previousRoomSnapshot.data() as Room | undefined
    const previousNightSnapshot = previousRoom?.nightId ? await transaction.get(nightRef(previousRoom.nightId)) : null
    if (previousRoom?.nightId) {
      const previousNight = previousNightSnapshot?.data() as NightRecord | undefined
      transaction.set(nightRef(previousRoom.nightId), {
        id: previousRoom.nightId,
        startedAt: previousNight?.startedAt ?? now,
        endedAt: now,
      } satisfies NightRecord)
    }
    transaction.set(mainRoom!, room)
    transaction.set(nightRef(night.id), night)
  })
}

export async function closeNight() {
  if (demoMode) { mutateDemo((data) => { data.room.open = false }); return }
  await updateDoc(mainRoom!, { open: false })
}

export async function reopenNight() {
  if (demoMode) { mutateDemo((data) => { data.room.open = true }); return }
  await updateDoc(mainRoom!, { open: true })
}

export async function approveRequest(id: string, selectedUrl: string) {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (request.status !== 'pending') throw new Error('Este pedido já foi tratado.')
      if (singerAlreadyQueued(data.room, request)) throw new Error('Já existe um pedido com este nome e mesa na fila.')
      request.status = 'queued'; request.selectedUrl = selectedUrl
      data.room.queue.push(toQueueEntry(request))
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const roomSnapshot = await transaction.get(mainRoom!)
    const requestSnapshot = await transaction.get(requestRef(id))
    const room = roomSnapshot.data() as Room | undefined
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRoom(room); assertRequest(request)
    if (request.nightId !== room.nightId || request.status !== 'pending') throw new Error('Este pedido não pode mais ser aprovado.')
    if (singerAlreadyQueued(room, request)) throw new Error('Já existe um pedido com este nome e mesa na fila.')
    transaction.update(requestRef(id), { status: 'queued', selectedUrl })
    transaction.update(mainRoom!, { queue: [...room.queue, toQueueEntry(request)] })
  })
}

export async function rejectRequest(id: string) {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (request.status !== 'pending') throw new Error('Este pedido já foi tratado.')
      request.status = 'rejected'
      data.archive.push({ ...request })
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(requestRef(id))
    const request = snapshot.data() as SongRequest | undefined
    assertRequest(request)
    if (request.status !== 'pending') throw new Error('Este pedido já foi tratado.')
    transaction.update(requestRef(id), { status: 'rejected' })
    transaction.set(archiveRef(request), { ...request, status: 'rejected', closedAt: Date.now() })
  })
}

export async function callNextSinger() {
  if (demoMode) {
    mutateDemo((data) => {
      const index = nextEligibleIndex(data.room)
      if (index < 0) throw new Error('Ninguém está disponível para chamada agora.')
      const request = data.requests.find((item) => item.id === data.room.queue[index].id)
      assertRequest(request)
      data.room = advanceCall(data.room, request)
      request.status = 'calling'; request.onMyWay = false
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const roomSnapshot = await transaction.get(mainRoom!)
    const room = roomSnapshot.data() as Room | undefined
    assertRoom(room)
    const index = nextEligibleIndex(room)
    if (index < 0) throw new Error('Ninguém está disponível para chamada agora.')
    const id = room.queue[index].id
    const requestSnapshot = await transaction.get(requestRef(id))
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRequest(request)
    const nextRoom = advanceCall(room, request)
    transaction.set(mainRoom!, nextRoom)
    transaction.update(requestRef(id), { status: 'calling', onMyWay: false })
  })
}

export async function startSong() {
  if (demoMode) {
    mutateDemo((data) => {
      if (data.room.stage !== 'calling') throw new Error('Chame o cantor primeiro.')
      const request = data.requests.find((item) => item.id === data.room.queue[0]?.id)
      assertRequest(request)
      const playbackUrl = request.selectedUrl || request.suggestedUrl
      if (!youtubeVideoId(playbackUrl)) throw new Error('Escolha um link direto de vídeo do YouTube antes de iniciar.')
      request.status = 'singing'; request.onMyWay = true
      data.room.stage = 'singing'; data.room.calledAt = null
      data.room.playbackUrl = playbackUrl
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(mainRoom!)
    const room = snapshot.data() as Room | undefined
    assertRoom(room)
    if (room.stage !== 'calling' || !room.queue[0]) throw new Error('Chame o cantor primeiro.')
    const requestSnapshot = await transaction.get(requestRef(room.queue[0].id))
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRequest(request)
    const playbackUrl = request.selectedUrl || request.suggestedUrl
    if (!youtubeVideoId(playbackUrl)) throw new Error('Escolha um link direto de vídeo do YouTube antes de iniciar.')
    transaction.update(mainRoom!, { stage: 'singing', calledAt: null, playbackUrl })
    transaction.update(requestRef(room.queue[0].id), { status: 'singing', onMyWay: true })
  })
}

export async function completeSong() {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === data.room.queue[0]?.id)
      assertRequest(request)
      data.room = finishSong(data.room, request); request.status = 'completed'
      data.archive.push({ ...request })
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(mainRoom!)
    const room = snapshot.data() as Room | undefined
    assertRoom(room)
    const id = room.queue[0]?.id
    if (!id) throw new Error('Fila vazia.')
    const requestSnapshot = await transaction.get(requestRef(id))
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRequest(request)
    transaction.set(mainRoom!, finishSong(room, request))
    transaction.update(requestRef(id), { status: 'completed' })
    transaction.set(archiveRef(request), { ...request, status: 'completed', closedAt: Date.now() })
  })
}

export async function markAbsent() {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === data.room.queue[0]?.id)
      assertRequest(request)
      const result = markNoShow(data.room, request)
      data.room = result.room; request.misses = result.misses
      request.status = 'queued'; request.onMyWay = false
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(mainRoom!)
    const room = snapshot.data() as Room | undefined
    assertRoom(room)
    const id = room.queue[0]?.id
    if (!id) throw new Error('Fila vazia.')
    const requestSnapshot = await transaction.get(requestRef(id))
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRequest(request)
    const result = markNoShow(room, request)
    transaction.set(mainRoom!, result.room)
    transaction.update(requestRef(id), { misses: result.misses, status: 'queued', onMyWay: false })
  })
}

export async function cancelRequest(id: string) {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (terminalStatuses.includes(request.status)) return
      request.status = 'cancelled'; data.room = removeFromQueue(data.room, id)
      data.archive.push({ ...request })
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const roomSnapshot = await transaction.get(mainRoom!)
    const requestSnapshot = await transaction.get(requestRef(id))
    const room = roomSnapshot.data() as Room | undefined
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRoom(room); assertRequest(request)
    if (terminalStatuses.includes(request.status)) return
    transaction.set(mainRoom!, removeFromQueue(room, id))
    transaction.update(requestRef(id), { status: 'cancelled' })
    transaction.set(archiveRef(request), { ...request, status: 'cancelled', closedAt: Date.now() })
  })
}

export async function saveSelectedUrl(id: string, selectedUrl: string) {
  if (selectedUrl && !youtubeVideoId(selectedUrl)) throw new Error('Cole um link direto de vídeo do YouTube.')
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (data.room.stage === 'singing' && data.room.queue[0]?.id === id) {
        const playbackUrl = selectedUrl || request.suggestedUrl
        if (!youtubeVideoId(playbackUrl)) throw new Error('A música no telão precisa de um link válido.')
        data.room.playbackUrl = playbackUrl
      }
      request.selectedUrl = selectedUrl
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const roomSnapshot = await transaction.get(mainRoom!)
    const requestSnapshot = await transaction.get(requestRef(id))
    const room = roomSnapshot.data() as Room | undefined
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRoom(room); assertRequest(request)
    if (room.stage === 'singing' && room.queue[0]?.id === id) {
      const playbackUrl = selectedUrl || request.suggestedUrl
      if (!youtubeVideoId(playbackUrl)) throw new Error('A música no telão precisa de um link válido.')
      transaction.update(mainRoom!, { playbackUrl })
    }
    transaction.update(requestRef(id), { selectedUrl })
  })
}

export async function moveQueueEntry(id: string, direction: -1 | 1) {
  const reorder = (room: Room) => {
    const index = room.queue.findIndex((entry) => entry.id === id)
    const target = index + direction
    const firstMovable = room.stage === 'idle' ? 0 : 1
    if (index < firstMovable || target < firstMovable || target >= room.queue.length) return room.queue
    const queue = [...room.queue]
    ;[queue[index], queue[target]] = [queue[target], queue[index]]
    return queue
  }
  if (demoMode) { mutateDemo((data) => { data.room.queue = reorder(data.room) }); return }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(mainRoom!)
    const room = snapshot.data() as Room | undefined
    assertRoom(room)
    transaction.update(mainRoom!, { queue: reorder(room) })
  })
}

export async function confirmSingerPresence(id: string) {
  if (demoMode) {
    mutateDemo((data) => {
      if (data.room.stage !== 'calling' || data.room.queue[0]?.id !== id) throw new Error('Esta chamada já terminou.')
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (request.status !== 'calling') throw new Error('Esta chamada já terminou.')
      request.onMyWay = true
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const roomSnapshot = await transaction.get(mainRoom!)
    const requestSnapshot = await transaction.get(requestRef(id))
    const room = roomSnapshot.data() as Room | undefined
    const request = requestSnapshot.data() as SongRequest | undefined
    assertRoom(room); assertRequest(request)
    if (room.stage !== 'calling' || room.queue[0]?.id !== id || request.status !== 'calling') {
      throw new Error('Esta chamada já terminou.')
    }
    if (!request.onMyWay) transaction.update(requestRef(id), { onMyWay: true })
  })
}
