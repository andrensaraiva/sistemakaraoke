import test from 'node:test'
import assert from 'node:assert/strict'
import {
  callNext, emptyRoom, finishSong, karaokeSearch, markNoShow, nextEligibleIndex, removeFromQueue, singerAlreadyQueued, toQueueEntry, youtubeUrl, youtubeVideoId,
} from '../src/domain.ts'

const nightId = 'test-night'
const person = (name) => ({
  id: name, nightId, ownerUid: name, name, table: '01', song: 'Canção',
  artist: 'Artista', suggestedUrl: '', selectedUrl: '', status: 'queued',
  misses: 0, onMyWay: false, createdAt: 1,
})

test('dar outra chance alterna a fila sem encerrar automaticamente o pedido', () => {
  const ana = person('Ana')
  const bruno = person('Bruno')
  const carla = person('Carla')
  let room = { ...emptyRoom, nightId, open: true, queue: [ana, bruno, carla].map(toQueueEntry) }

  room = callNext(room, ana)
  let absence = markNoShow(room, ana)
  assert.deepEqual(absence.room.queue.map((item) => item.name), ['Bruno', 'Ana', 'Carla'])
  assert.equal(absence.misses, 1)
  ana.misses = absence.misses

  room = callNext(absence.room, bruno)
  room = finishSong({ ...room, stage: 'singing' }, bruno)
  assert.equal(room.queue[nextEligibleIndex(room)].name, 'Ana')

  room = callNext(room, ana)
  absence = markNoShow(room, ana)
  assert.deepEqual(absence.room.queue.map((item) => item.name), ['Carla', 'Ana'])
  ana.misses = absence.misses

  room = callNext(absence.room, carla)
  room = finishSong({ ...room, stage: 'singing' }, carla)
  room = callNext(room, ana)
  absence = markNoShow(room, ana)
  assert.equal(absence.misses, 3)
  assert.deepEqual(absence.room.queue.map((item) => item.name), ['Ana'])
})

test('operador pode cancelar o pedido chamado mesmo após uma ausência', () => {
  const ana = person('Ana')
  const room = callNext({ ...emptyRoom, nightId, open: true, queue: [toQueueEntry(ana)] }, ana)
  const cancelled = removeFromQueue(room, ana.id)
  assert.equal(cancelled.stage, 'idle')
  assert.deepEqual(cancelled.queue, [])
})

test('fila não trava quando todos perderam uma chamada', () => {
  const ana = person('Ana')
  const bruno = person('Bruno')
  let room = { ...emptyRoom, nightId, open: true, queue: [ana, bruno].map(toQueueEntry) }
  room = markNoShow(callNext(room, ana), ana).room
  room = markNoShow(callNext(room, bruno), bruno).room
  assert.equal(nextEligibleIndex(room), 0)
})

test('link sugerido aceita só HTTPS do YouTube', () => {
  assert.equal(youtubeUrl('https://youtu.be/abc'), 'https://youtu.be/abc')
  assert.equal(youtubeUrl('https://music.youtube.com/watch?v=M7lc1UVf-VE'), 'https://music.youtube.com/watch?v=M7lc1UVf-VE')
  assert.equal(youtubeUrl('https://youtube.com.evil.test/watch?v=abc'), null)
  assert.equal(youtubeUrl('javascript:alert(1)'), null)
})

test('o telão usa apenas links diretos de vídeos do YouTube', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=M7lc1UVf-VE&t=10'), 'M7lc1UVf-VE')
  assert.equal(youtubeVideoId('https://youtu.be/M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(youtubeVideoId('https://music.youtube.com/watch?v=M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(youtubeVideoId('https://www.youtube.com/results?search_query=karaoke'), null)
  assert.equal(youtubeVideoId('https://youtube.com.evil.test/watch?v=M7lc1UVf-VE'), null)
})

test('busca de karaokê usa a plataforma escolhida', () => {
  assert.match(karaokeSearch('youtube', 'Canção', 'Artista'), /^https:\/\/www\.youtube\.com\/results\?/)
  assert.match(karaokeSearch('youtube_music', 'Canção', 'Artista'), /^https:\/\/music\.youtube\.com\/search\?/)
  assert.match(karaokeSearch('spotify', 'Canção', 'Artista'), /^https:\/\/open\.spotify\.com\/search\//)
})

test('nome e mesa iguais são detectados como pedido duplicado', () => {
  const ana = person('Ana')
  const duplicate = { ...person('ana'), table: '1' }
  const room = { ...emptyRoom, queue: [toQueueEntry(ana)] }
  assert.equal(singerAlreadyQueued(room, duplicate), true)
  assert.equal(singerAlreadyQueued(room, { ...duplicate, table: '' }), false)
})
