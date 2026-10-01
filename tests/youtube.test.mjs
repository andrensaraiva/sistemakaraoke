import assert from 'node:assert/strict'
import test from 'node:test'
import { addVideoToPlaylist, playlistIdFromInput, searchYouTube } from '../src/youtube.ts'

test('extrai playlist do YouTube Music e rejeita outro domínio', () => {
  assert.equal(playlistIdFromInput('https://music.youtube.com/playlist?list=PL1234567890abc'), 'PL1234567890abc')
  assert.equal(playlistIdFromInput('https://youtube.com/playlist?list=PL1234567890abc'), 'PL1234567890abc')
  assert.equal(playlistIdFromInput('https://music.youtube.com.evil.test/playlist?list=PL1234567890abc'), null)
})

test('busca integrada pede vídeos incorporáveis usando a conta conectada', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/youtube/v3/search')
    assert.equal(parsed.searchParams.get('videoEmbeddable'), 'true')
    assert.equal(parsed.searchParams.get('q'), 'karaokê teste')
    assert.equal(options.headers.Authorization, 'Bearer token-de-teste')
    return Response.json({ items: [{ id: { videoId: 'M7lc1UVf-VE' }, snippet: { title: 'Versão', channelTitle: 'Canal', thumbnails: {} } }] })
  }
  try {
    assert.deepEqual(await searchYouTube('karaokê teste', 'token-de-teste'), [
      { id: 'M7lc1UVf-VE', title: 'Versão', channel: 'Canal', thumbnail: '' },
    ])
  } finally { globalThis.fetch = previousFetch }
})

test('não duplica vídeo na playlist e insere quando ainda não está lá', async () => {
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method || 'GET' })
    if (options.method === 'POST') {
      assert.equal(options.headers.Authorization, 'Bearer token-de-teste')
      assert.equal(JSON.parse(options.body).snippet.resourceId.videoId, 'M7lc1UVf-VE')
      return Response.json({ id: 'item-novo' })
    }
    return Response.json({ items: requests.length === 1 ? [{ id: 'item-antigo' }] : [] })
  }
  try {
    assert.equal(await addVideoToPlaylist('PL1234567890abc', 'M7lc1UVf-VE', 'token-de-teste'), 'exists')
    assert.equal(await addVideoToPlaylist('PL1234567890abc', 'M7lc1UVf-VE', 'token-de-teste'), 'added')
    assert.deepEqual(requests.map((item) => item.method), ['GET', 'GET', 'POST'])
  } finally { globalThis.fetch = previousFetch }
})
