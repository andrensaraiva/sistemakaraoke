import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

process.env.VITE_GOOGLE_OAUTH_CLIENT_ID = 'test-client.apps.googleusercontent.com'
const server = await createServer({ envFile: false, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
await server.listen()
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext()
let inserts = 0

await context.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({
  contentType: 'text/javascript',
  body: `window.google={accounts:{oauth2:{
    initTokenClient(config){return {requestAccessToken(){config.callback({access_token:'test-token',expires_in:3600,scope:config.scope})}}},
    hasGrantedAllScopes(){return true}
  }}}`,
}))
await context.route('https://www.googleapis.com/youtube/v3/**', (route) => {
  const url = new URL(route.request().url())
  assert.equal(route.request().headers().authorization, 'Bearer test-token')
  if (url.pathname.endsWith('/search')) return route.fulfill({ json: { items: [{
    id: { videoId: 'M7lc1UVf-VE' },
    snippet: { title: 'Karaokê escolhido', channelTitle: 'Canal', thumbnails: {} },
  }] } })
  if (url.pathname.endsWith('/playlists')) return route.fulfill({ json: { items: [{ snippet: { title: 'Noite de teste' } }] } })
  if (route.request().method() === 'POST') { inserts++; return route.fulfill({ json: { id: 'novo-item' } }) }
  return route.fulfill({ json: { items: [] } })
})

try {
  const operator = await context.newPage()
  await operator.goto(`${origin}/operador`)
  const workbench = operator.getByRole('region', { name: 'Escolha de música do operador' })
  await workbench.getByRole('button', { name: 'YouTube Music', exact: true }).click()
  const originalSite = workbench.getByRole('link', { name: 'Abrir YouTube Music ↗' })
  assert.equal(await originalSite.getAttribute('href'), 'https://music.youtube.com/')
  assert.equal(await originalSite.getAttribute('target'), '_blank')
  await workbench.getByText('Minha playlist da noite').click()
  await workbench.getByLabel('Link da playlist da noite').fill('https://music.youtube.com/playlist?list=PL1234567890abc')
  assert.equal(await workbench.getByRole('link', { name: 'Abrir minha playlist ↗' }).getAttribute('href'), 'https://music.youtube.com/playlist?list=PL1234567890abc')
  await workbench.getByRole('button', { name: 'No painel' }).click()
  await workbench.getByRole('button', { name: 'Conectar conta Google' }).click()
  await workbench.getByText('Conta Google conectada nesta sessão').waitFor()
  await workbench.getByRole('button', { name: 'Selecionar playlist' }).click()
  await workbench.getByText('✓ Noite de teste').waitFor()
  await workbench.getByLabel('Pedido da fila').selectOption({ label: 'Ana · Evidências' })
  await workbench.getByRole('button', { name: 'Buscar', exact: true }).click()
  await workbench.getByText('Karaokê escolhido').waitFor()
  await workbench.getByRole('button', { name: 'Usar na fila' }).click()
  await operator.getByLabel('Link escolhido para Evidências').waitFor()
  await operator.waitForFunction(() => document.querySelector('input[aria-label="Link escolhido para Evidências"]')?.value.includes('M7lc1UVf-VE'))
  await workbench.getByRole('button', { name: 'Adicionar à playlist', exact: true }).click()
  await workbench.getByText('Vídeo adicionado à playlist Noite de teste.').waitFor()
  assert.equal(inserts, 1)
  console.log('Busca interna, escolha para a fila e adição explícita à playlist verificadas.')
} finally {
  await browser.close()
  await server.close()
  delete process.env.VITE_GOOGLE_OAUTH_CLIENT_ID
}

const demoServer = await createServer({ envFile: false, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
await demoServer.listen()
const demoOrigin = `http://127.0.0.1:${demoServer.httpServer.address().port}`
const demoBrowser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const operator = await demoBrowser.newPage()
  await operator.goto(`${demoOrigin}/operador`)
  const workbench = operator.getByRole('region', { name: 'Escolha de música do operador' })
  await workbench.getByText('Demonstração local: a busca retorna um vídeo de teste e a playlist é simulada.').waitFor()
  await workbench.getByLabel('Pedido da fila').selectOption({ label: 'Ana · Evidências' })
  await workbench.getByRole('button', { name: 'Buscar', exact: true }).click()
  await workbench.getByText('Vídeo de teste do YouTube (não é karaokê)').waitFor()
  await workbench.getByRole('button', { name: 'Usar na fila' }).click()
  await operator.waitForFunction(() => document.querySelector('input[aria-label="Link escolhido para Evidências"]')?.value.includes('M7lc1UVf-VE'))
  await workbench.getByRole('button', { name: 'Adicionar à playlist', exact: true }).click()
  await workbench.getByText('Adicionado somente à playlist simulada. Nenhuma conta Google foi alterada.').waitFor()
  await operator.getByRole('button', { name: /Chamar próximo/ }).click()
  assert.equal(await operator.getByRole('button', { name: 'Tocar no telão' }).isEnabled(), true)
  await operator.getByRole('button', { name: 'Tocar no telão' }).click()
  await operator.getByRole('button', { name: 'Concluir música' }).waitFor()
  console.log('Demonstração sem OAuth: busca, playlist simulada e reprodução imediata verificadas.')
} finally {
  await demoBrowser.close()
  await demoServer.close()
}
