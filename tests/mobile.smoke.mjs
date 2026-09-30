import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const server = await createServer({ envFile: false, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
await server.listen()
const port = server.httpServer.address().port
const origin = `http://127.0.0.1:${port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function audit(page, label) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth
    const overflow = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewport
    const smallTargets = [...document.querySelectorAll('button, input, select, a')]
      .filter((item) => {
        const box = item.getBoundingClientRect()
        const style = getComputedStyle(item)
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && (box.width < 24 || box.height < 24)
      })
      .map((item) => ({ text: item.getAttribute('aria-label') || item.textContent?.trim().slice(0, 35) || item.tagName, height: Math.round(item.getBoundingClientRect().height) }))
    return { viewport, overflow, smallTargets }
  })
  console.log(`${label}: ${JSON.stringify(result)}`)
  assert.ok(result.overflow <= 1, `${label}: conteúdo cortado horizontalmente por ${result.overflow}px`)
  assert.equal(result.smallTargets.length, 0, `${label}: controles de toque menores que 24px`)
  return result
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'pt-BR' })
  const guest = await context.newPage()
  await guest.goto(`${origin}/mesa/04`)
  await guest.getByRole('heading', { name: 'Escolha sua música' }).waitFor()
  await audit(guest, 'cliente 390px')
  if (process.env.MOBILE_SCREENSHOTS) await guest.screenshot({ path: 'guest-preview.png', fullPage: true })

  await guest.getByLabel(/Seu nome/).fill('Pessoa Mobile')
  await guest.getByLabel(/Mesa/).fill('')
  await guest.getByLabel(/Música/).fill('Música Mobile')
  await guest.getByLabel(/Artista/).fill('Artista Mobile')
  await guest.getByRole('button', { name: /Entrar na fila/ }).click()
  await guest.getByText('Pedido enviado!').waitFor()

  const operator = await context.newPage()
  await operator.goto(`${origin}/operador`)
  await operator.getByRole('heading', { name: 'Música Mobile' }).waitFor()
  await audit(operator, 'operador 390px')
  await operator.getByRole('button', { name: 'Encerrar novos pedidos' }).click()
  await operator.getByRole('dialog', { name: 'Encerrar novos pedidos?' }).waitFor()
  await audit(operator, 'confirmação 390px')
  await operator.getByRole('button', { name: 'Continuar recebendo' }).click()
  await operator.getByText('Noite aberta', { exact: false }).first().waitFor()
  const pendingTop = await operator.locator('.pending-list').boundingBox()
  const queueTop = await operator.locator('.operator-queue').boundingBox()
  assert.ok(pendingTop.y < queueTop.y, 'Novos pedidos devem aparecer antes da fila no celular')
  if (process.env.MOBILE_SCREENSHOTS) await operator.screenshot({ path: 'operator-preview.png', fullPage: true })
  await operator.getByLabel('Vídeo escolhido').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE')
  await operator.getByRole('button', { name: 'Aprovar' }).click()
  await guest.bringToFront()
  await guest.getByText('Na fila', { exact: true }).waitFor()

  await operator.bringToFront()
  for (let index = 0; index < 3; index += 1) {
    await operator.getByRole('button', { name: 'Subir Pessoa Mobile na fila' }).click()
  }
  await guest.bringToFront()
  await guest.getByText('Você é o próximo. Fique perto do palco!').waitFor()
  await operator.bringToFront()
  await operator.getByRole('button', { name: /Chamar próximo/ }).click()
  await audit(operator, 'chamada 390px')
  await guest.bringToFront()
  await guest.getByRole('button', { name: 'Estou indo' }).waitFor()
  await guest.getByRole('button', { name: 'Estou indo' }).click()
  await operator.bringToFront()
  await operator.getByText('Está a caminho').waitFor()
  assert.equal(await operator.getByRole('button', { name: 'Tocar no telão' }).isDisabled(), true)
  await operator.waitForTimeout(10_200)
  assert.equal(await operator.getByRole('button', { name: 'Tocar no telão' }).isEnabled(), true)
  await operator.getByRole('button', { name: 'Tocar no telão' }).click()
  await operator.getByRole('button', { name: 'Concluir música' }).click()
  await guest.bringToFront()
  await guest.getByRole('heading', { name: 'Valeu pelo show!' }).waitFor()

  await operator.getByRole('button', { name: 'Encerrar novos pedidos' }).click()
  await operator.getByRole('button', { name: 'Encerrar pedidos', exact: true }).click()
  await operator.getByText('Pedidos encerrados. A fila atual continua em andamento.').waitFor()

  await operator.goto(`${origin}/operador/relatorios`)
  await operator.getByRole('heading', { name: 'Relatórios da casa' }).waitFor()
  await operator.getByText('Músicas mais pedidas').waitFor()
  await audit(operator, 'relatórios 390px')
  if (process.env.MOBILE_SCREENSHOTS) await operator.screenshot({ path: 'mobile-preview.png', fullPage: true })

  await guest.setViewportSize({ width: 320, height: 700 })
  await guest.goto(`${origin}/mesa/04`)
  await guest.getByRole('heading', { name: 'Valeu pelo show!' }).waitFor()
  assert.equal(await guest.getByRole('heading', { name: 'Escolha sua música' }).count(), 0, 'O novo pedido só deve abrir após tocar no botão')
  await audit(guest, 'cliente 320px')
  if (process.env.MOBILE_SCREENSHOTS) await guest.screenshot({ path: 'guest-320-preview.png', fullPage: true })
  await operator.setViewportSize({ width: 320, height: 700 })
  await operator.goto(`${origin}/operador`)
  await audit(operator, 'operador 320px')
  if (process.env.MOBILE_SCREENSHOTS) await operator.screenshot({ path: 'operator-320-preview.png', fullPage: true })
  await operator.goto(`${origin}/operador/relatorios`)
  await operator.getByText('Músicas mais pedidas').waitFor()
  await audit(operator, 'relatórios 320px')
  await operator.setViewportSize({ width: 768, height: 1024 })
  await operator.goto(`${origin}/operador`)
  await audit(operator, 'operador tablet 768px')
  if (process.env.MOBILE_SCREENSHOTS) await operator.screenshot({ path: 'operator-tablet-preview.png', fullPage: true })
  await operator.setViewportSize({ width: 1024, height: 768 })
  await audit(operator, 'operador tablet 1024px')
  await operator.goto(`${origin}/imprimir`)
  assert.equal(await operator.locator('.print-single').count(), 1, 'A impressão padrão deve mostrar um único QR')
  await operator.goto(`${origin}/imprimir?mesas=2`)
  assert.equal(await operator.locator('.print-card').count(), 2, 'As cartelas por mesa continuam disponíveis')
  console.log('Fluxo móvel: pedido sem mesa, aprovação e relatórios verificados.')
  await context.close()
} finally {
  await browser.close()
  await server.close()
}
