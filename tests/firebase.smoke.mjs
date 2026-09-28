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
  const operator = await operatorContext.newPage()
  const guest = await guestContext.newPage()

  await operator.goto(`${origin}/operador`)
  await operator.getByLabel('E-mail').fill(email)
  await operator.getByLabel('Senha').fill(password)
  await operator.getByRole('button', { name: 'Entrar no painel' }).click()
  await operator.getByRole('button', { name: /Abrir nova noite/ }).waitFor()
  await operator.getByRole('button', { name: /Abrir nova noite/ }).click()
  await operator.getByText('Noite aberta', { exact: false }).first().waitFor()

  await guest.goto(`${origin}/mesa/04`)
  await guest.getByLabel(/Seu nome/).fill('Cantora Firebase')
  await guest.getByLabel(/Mesa/).fill('')
  await guest.getByLabel(/Música/).fill('Canção Teste')
  await guest.getByLabel(/Artista/).fill('Artista Teste')
  await guest.getByRole('button', { name: /Entrar na fila/ }).click()
  await guest.getByText('Pedido enviado!').waitFor()
  await operator.getByRole('heading', { name: 'Canção Teste' }).waitFor()
  await operator.getByRole('button', { name: 'Aprovar' }).click()
  await guest.getByText('Na fila', { exact: true }).waitFor()
  await operator.getByRole('button', { name: /Chamar próximo/ }).click()
  await guest.getByRole('button', { name: 'Estou indo' }).waitFor()
  await guest.getByRole('button', { name: 'Estou indo' }).click()
  await operator.getByText('Está a caminho').waitFor()
  await operator.getByRole('button', { name: 'Música iniciada' }).waitFor({ state: 'visible' })
  await operator.waitForTimeout(10_200)
  await operator.getByRole('button', { name: 'Música iniciada' }).click()
  await operator.getByRole('button', { name: 'Concluir música' }).click()
  await guest.getByRole('heading', { name: 'Valeu pelo show!' }).waitFor()

  await operator.goto(`${origin}/operador/relatorios`)
  await operator.getByRole('heading', { name: 'Relatórios da casa' }).waitFor()
  await operator.getByText('Canção Teste').first().waitFor()
  console.log('Firebase emulado: login, pedido sem mesa, sincronização, chamada, conclusão e relatório verificados.')
} finally {
  await browser?.close()
  await server?.close()
  await testEnv.cleanup()
}
