import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import {
  collection, doc, getDoc, getFirestore, onSnapshot, query, runTransaction,
  setDoc, updateDoc, where,
} from 'firebase/firestore'
import {
  callNext as advanceCall, emptyRoom, finishSong, markNoShow,
  nextEligibleIndex, removeFromQueue, singerAlreadyQueued, terminalStatuses, toQueueEntry,
  type Room, type SongRequest,
} from './domain'

const settings = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const demoMode = !settings.apiKey || !settings.authDomain || !settings.projectId || !settings.appId
const app = demoMode ? null : initializeApp(settings)
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null
const mainRoom = db ? doc(db, 'rooms', 'main') : null

type Listener = () => void
type DemoData = { room: Room; requests: SongRequest[] }
const demoKey = 'karaoke-retro-demo-v1'
const demoChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(demoKey) : null
const localListeners = new Set<Listener>()

function starterDemo(): DemoData {
  const nightId = 'demonstracao'
  const requests: SongRequest[] = [
    { id: 'sample-ana', nightId, ownerUid: 'sample-ana', name: 'Ana', table: '03', song: 'Evidências', artist: 'Chitãozinho & Xororó', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: 1 },
    { id: 'sample-bruno', nightId, ownerUid: 'sample-bruno', name: 'Bruno', table: '07', song: 'Tempo Perdido', artist: 'Legião Urbana', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: 2 },
    { id: 'sample-carla', nightId, ownerUid: 'sample-carla', name: 'Carla', table: '02', song: 'Dona de Mim', artist: 'Iza', suggestedUrl: '', selectedUrl: '', status: 'queued', misses: 0, onMyWay: false, createdAt: 3 },
  ]
  return {
    room: { ...emptyRoom, nightId, open: true, queue: requests.map(toQueueEntry) },
    requests,
  }
}

function readDemo(): DemoData {
  try {
    const saved = localStorage.getItem(demoKey)
    return saved ? JSON.parse(saved) as DemoData : starterDemo()
  } catch { return starterDemo() }
}

function emitDemo() {
  localListeners.forEach((listener) => listener())
  demoChannel?.postMessage('change')
}
demoChannel?.addEventListener('message', () => localListeners.forEach((listener) => listener()))

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
  const room: Room = { ...emptyRoom, nightId: crypto.randomUUID(), open: true }
  if (demoMode) { mutateDemo((data) => { data.room = room }); return }
  await setDoc(mainRoom!, room)
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
    if (!room.open || request.nightId !== room.nightId || request.status !== 'pending') throw new Error('Este pedido não pode mais ser aprovado.')
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
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(requestRef(id))
    const request = snapshot.data() as SongRequest | undefined
    assertRequest(request)
    if (request.status !== 'pending') throw new Error('Este pedido já foi tratado.')
    transaction.update(requestRef(id), { status: 'rejected' })
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
      request.status = 'singing'; data.room.stage = 'singing'; data.room.calledAt = null
    })
    return
  }
  await runTransaction(db!, async (transaction) => {
    const snapshot = await transaction.get(mainRoom!)
    const room = snapshot.data() as Room | undefined
    assertRoom(room)
    if (room.stage !== 'calling' || !room.queue[0]) throw new Error('Chame o cantor primeiro.')
    const requestSnapshot = await transaction.get(requestRef(room.queue[0].id))
    if (!requestSnapshot.exists()) throw new Error('Pedido não encontrado.')
    transaction.update(mainRoom!, { stage: 'singing', calledAt: null })
    transaction.update(requestRef(room.queue[0].id), { status: 'singing' })
  })
}

export async function completeSong() {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === data.room.queue[0]?.id)
      assertRequest(request)
      data.room = finishSong(data.room, request); request.status = 'completed'
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
  })
}

export async function saveSelectedUrl(id: string, selectedUrl: string) {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      request.selectedUrl = selectedUrl
    })
    return
  }
  await updateDoc(requestRef(id), { selectedUrl })
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

export async function confirmOnMyWay(id: string) {
  if (demoMode) {
    mutateDemo((data) => {
      const request = data.requests.find((item) => item.id === id)
      assertRequest(request)
      if (request.status !== 'calling') throw new Error('A chamada já terminou.')
      request.onMyWay = true
    })
    return
  }
  await updateDoc(requestRef(id), { onMyWay: true })
}
