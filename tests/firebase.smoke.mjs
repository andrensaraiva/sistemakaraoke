import assert from 'node:assert/strict'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const projectId = 'demo-sistema-karaoke'
const email = 'operador@karaoke.test'
const password = 'senha-de-teste-123'
const authResponse = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
})
const account = await authResponse.json()
assert.ok(authResponse.ok, `Não foi possível criar operador no emulador: ${JSON.stringify(account)}`)

const testEnv = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080 } })
let server
let browser
try {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`admins/${account.localId}`).set({ active: true })
  })
  server = await createServer({ mode: 'emulator', server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const viewport = { width: 390, height: 844 }
  const operatorContext = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  const guestContext = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  await operatorContext.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.YT = { Player: class {
      constructor(element, options) {
        this.options = options;
        element.className = 'mock-youtube-player';
        element.textContent = options.videoId;
        window.__mockPlayer = this;
        setTimeout(() => options.events.onReady({ target: this }), 0);
      }
      playVideo() { this.options.events.onStateChange({ target: this, data: 1 }); }
      destroy() {}
    }};
    window.onYouTubeIframeAPIReady?.();`,
  }))
  const operator = await operatorContext.newPage()
  const guest = await guestContext.newPage()

  await operator.goto(`${origin}/operador`)
  await operator.getByLabel('E-mail').fill(email)
  await operator.getByLabel('Senha').fill(password)
  await operator.getByRole('button', { name: 'Entrar no painel' }).click()
  await operator.getByRole('button', { name: /Abrir nova noite/ }).waitFor()
  await operator.getByRole('button', { name: /Abrir nova noite/ }).click()
  await operator.getByText('Noite aberta', { exact: false }).first().waitFor()
  const tv = await operatorContext.newPage()
  await tv.goto(`${origin}/telao`)
  await tv.getByText('O palco espera por você.').waitFor()

  await guest.goto(`${origin}/mesa/04`)
  await guest.getByLabel(/Seu nome/).fill('Cantora Firebase')
  await guest.getByLabel(/Mesa/).fill('')
  await guest.getByLabel(/Música/).fill('Canção Teste')
  await guest.getByLabel(/Artista/).fill('Artista Teste')
  await guest.getByRole('button', { name: /Entrar na fila/ }).click()
  await guest.getByText('Pedido enviado!').waitFor()
  await operator.getByRole('heading', { name: 'Canção Teste' }).waitFor()
  await operator.getByRole('button', { name: 'Encerrar novos pedidos' }).click()
  await operator.getByRole('dialog', { name: 'Encerrar novos pedidos?' }).waitFor()
  await operator.getByRole('button', { name: 'Encerrar pedidos', exact: true }).click()
  await operator.getByText('Pedidos encerrados. A fila atual continua em andamento.').waitFor()
  await operator.getByLabel('Vídeo escolhido').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE')
  await operator.getByRole('button', { name: 'Aprovar' }).click()
  await guest.getByText('Na fila', { exact: true }).waitFor()
  await operator.getByRole('button', { name: /Chamar próximo/ }).click()
  await tv.getByText('Chegou a sua vez de brilhar.').waitFor()
  await guest.getByRole('button', { name: 'Estou indo' }).waitFor()
  await guest.getByRole('button', { name: 'Estou indo' }).click()
  await operator.getByText('Está a caminho').waitFor()
  await operator.getByRole('button', { name: 'Tocar no telão' }).waitFor({ state: 'visible' })
  await operator.waitForTimeout(10_200)
  await operator.getByRole('button', { name: 'Tocar no telão' }).click()
  await tv.locator('.mock-youtube-player').waitFor()
  assert.equal(await tv.locator('.mock-youtube-player').textContent(), 'M7lc1UVf-VE')
  await tv.setViewportSize({ width: 1920, height: 1080 })
  const playerBox = await tv.locator('.tv-player-frame').boundingBox()
  const queueBox = await tv.locator('.tv-list-panel').boundingBox()
  assert.ok(playerBox.x + playerBox.width <= queueBox.x, 'A fila não deve cobrir o player do YouTube')
  await tv.evaluate(() => window.__mockPlayer.options.events.onAutoplayBlocked())
  await tv.getByRole('button', { name: 'Tocar vídeo' }).click()
  await tv.getByRole('button', { name: 'Tocar vídeo' }).waitFor({ state: 'hidden' })
  if (process.env.TV_SCREENSHOTS) {
    await tv.screenshot({ path: 'tv-preview.png', fullPage: true })
  }
  await tv.evaluate(() => window.__mockPlayer.options.events.onStateChange({ target: window.__mockPlayer, data: 0 }))
  await tv.getByText('Valeu pelo show!').waitFor()
  await operator.getByRole('button', { name: 'Concluir música' }).click()
  await guest.getByRole('heading', { name: 'Valeu pelo show!' }).waitFor()
  await tv.getByText('Quem será o próximo?').waitFor()

  await operator.goto(`${origin}/operador/relatorios`)
  await operator.getByRole('heading', { name: 'Relatórios da casa' }).waitFor()
  await operator.getByText('Canção Teste').first().waitFor()
  console.log('Firebase emulado: login, pedido sem mesa, sincronização, chamada, conclusão e relatório verificados.')
} finally {
  await browser?.close()
  await server?.close()
  await testEnv.cleanup()
}
