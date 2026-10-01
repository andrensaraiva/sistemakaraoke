import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'

const projectId = 'demo-sistema-karaoke'
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1', port: 8080,
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
})

const room = {
  nightId: 'night-1', open: true, completedCount: 0,
  stage: 'idle', calledAt: null, queue: [],
}
const request = {
  id: 'night-1_guest-1', nightId: 'night-1', ownerUid: 'guest-1',
  name: 'Ana', table: '04', song: 'Evidências', artist: 'Chitãozinho & Xororó',
  suggestedUrl: '', selectedUrl: '', status: 'pending', misses: 0,
  onMyWay: false, createdAt: Date.now(),
}

try {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('rooms/main').set(room)
    await context.firestore().doc('admins/operator-1').set({ active: true })
  })

  const guest = testEnv.authenticatedContext('guest-1').firestore()
  const stranger = testEnv.authenticatedContext('guest-2').firestore()
  const operator = testEnv.authenticatedContext('operator-1').firestore()
  const roomRef = guest.doc('rooms/main')
  const ownRef = guest.doc(`rooms/main/requests/${request.id}`)

  await assertSucceeds(roomRef.get())
  await assertSucceeds(ownRef.get())
  await assertFails(stranger.doc(`rooms/main/requests/${request.id}`).get())
  await assertFails(roomRef.update({ open: false }))
  await assertFails(ownRef.set({ ...request, status: 'queued' }))
  await assertFails(ownRef.set({ ...request, suggestedUrl: 'https://youtube.com.evil.test/watch' }))
  await assertSucceeds(ownRef.set({ ...request, suggestedUrl: 'https://music.youtube.com/watch?v=M7lc1UVf-VE' }))
  await assertSucceeds(stranger.doc('rooms/main/requests/night-1_guest-2').set({
    ...request, id: 'night-1_guest-2', ownerUid: 'guest-2', table: '',
  }))
  await assertSucceeds(ownRef.get())
  await assertFails(stranger.doc(`rooms/main/requests/${request.id}`).get())
  await assertFails(guest.collection('rooms/main/requests').get())
  await assertFails(guest.collection('rooms/main/nights').get())
  await assertFails(guest.collection('rooms/main/archive').get())
  await assertFails(guest.doc('rooms/main/nights/night-1').set({ id: 'night-1', startedAt: Date.now(), endedAt: null }))
  await assertSucceeds(operator.doc('rooms/main/nights/night-1').set({ id: 'night-1', startedAt: Date.now(), endedAt: null }))
  await assertSucceeds(operator.collection('rooms/main/nights').get())
  await assertSucceeds(operator.doc('rooms/main/archive/first').set({ ...request, status: 'completed' }))
  await assertFails(guest.doc('rooms/main/archive/first').get())
  await assertFails(ownRef.update({ status: 'queued' }))
  await assertSucceeds(operator.doc(`rooms/main/requests/${request.id}`).update({ status: 'calling' }))
  await assertFails(ownRef.update({ onMyWay: true }))
  await assertSucceeds(operator.doc(`rooms/main/requests/${request.id}`).update({ onMyWay: true }))
  await assertFails(stranger.doc(`rooms/main/requests/${request.id}`).update({ onMyWay: false }))
  await assertSucceeds(operator.doc(`rooms/main/requests/${request.id}`).update({ status: 'cancelled', misses: 1 }))
  await assertSucceeds(ownRef.set({ ...request, song: 'Outra música', createdAt: Date.now() + 1 }))
  const saved = await ownRef.get()
  assert.equal(saved.data().status, 'pending')

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const store = context.firestore()
    await store.doc('venues/bar-teste').set({ name: 'Bar de Teste', active: true })
    await store.doc('venues/outro-bar').set({ name: 'Outro Bar', active: true })
    await store.doc('venues/bar-teste/rooms/main').set(room)
    await store.doc('venues/outro-bar/rooms/main').set(room)
    await store.doc('venues/bar-teste/operators/operator-2').set({ active: true })
    await store.doc('venues/outro-bar/operators/operator-3').set({ active: true })
  })
  const barOperator = testEnv.authenticatedContext('operator-2').firestore()
  const otherOperator = testEnv.authenticatedContext('operator-3').firestore()
  const barRoom = 'venues/bar-teste/rooms/main'
  const otherRoom = 'venues/outro-bar/rooms/main'
  await assertSucceeds(guest.doc('venues/bar-teste').get())
  await assertFails(guest.collection('venues').get())
  await assertFails(guest.doc('venues/bar-teste').update({ name: 'Invadido' }))
  await assertFails(guest.doc('venues/bar-teste/operators/operator-2').get())
  await assertSucceeds(barOperator.doc('venues/bar-teste/operators/operator-2').get())
  await assertSucceeds(guest.doc(barRoom).get())
  await assertSucceeds(barOperator.doc(barRoom).update({ open: false }))
  await assertFails(barOperator.doc('rooms/main').update({ open: false }))
  await assertFails(barOperator.doc(otherRoom).update({ open: false }))
  await assertFails(otherOperator.doc(barRoom).update({ open: false }))
  await assertFails(operator.doc(barRoom).update({ open: false }))
  await assertFails(barOperator.collection(`${otherRoom}/nights`).get())
  await assertFails(barOperator.collection(`${otherRoom}/requests`).get())
  await assertSucceeds(barOperator.collection(`${barRoom}/nights`).get())
  await assertSucceeds(barOperator.doc(barRoom).update({ open: true }))
  await assertSucceeds(guest.doc(`${barRoom}/requests/${request.id}`).set(request))
  await assertFails(stranger.doc(`${barRoom}/requests/${request.id}`).get())
  await assertFails(guest.doc(`${otherRoom}/requests/night-1_guest-2`).get())
  await assertFails(guest.collection(`${barRoom}/requests`).get())
  await assertFails(guest.doc(`${barRoom}/requests/${request.id}`).update({ status: 'calling' }))
  await assertSucceeds(barOperator.doc(`${barRoom}/requests/${request.id}`).update({ status: 'calling' }))
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('venues/bar-teste').update({ active: false })
  })
  await assertFails(guest.doc(barRoom).get())
  await assertFails(barOperator.doc(barRoom).update({ open: false }))
  await assertFails(guest.doc(`${barRoom}/requests/night-1_guest-1`).get())
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('admins/operator-1').update({ active: false })
  })
  await assertFails(operator.doc('rooms/main').update({ open: false }))
  console.log('Firestore rules: guest and operator permissions verified.')
} finally {
  await testEnv.cleanup()
}
