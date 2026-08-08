import { expect, test, type Page } from '@playwright/test'

/**
 * Regressões estruturais do painel.
 *
 * O foco não é pixel-perfect (screenshots quebram a cada ajuste de copy), e sim
 * as falhas que passaram despercebidas no layout antigo: estouro horizontal,
 * zoom bloqueado, alvos de toque pequenos demais e ausência de foco visível.
 */

const PROTECTED_ROUTES = [
  '/',
  '/checkin',
  '/eventos',
  '/escala',
  '/agent-network',
  '/parceiro',
  '/crm',
  '/tarefas',
  '/popups',
  '/insiders',
  '/systems',
]

/**
 * Nenhuma página do painel pode deslizar de lado.
 *
 * Mede a rolagem real da janela em vez de `scrollWidth`: este último segue
 * reportando a largura do conteúdo mesmo com `overflow-x: hidden` e soma o
 * conteúdo de roladores internos legítimos — como o kanban de Tarefas, que
 * deve rolar dentro do próprio quadro. O defeito que importa é o cabeçalho
 * sair da tela quando o usuário arrasta.
 */
async function expectNoHorizontalOverflow(page: Page) {
  const deslize = await page.evaluate(() => {
    window.scrollTo(99999, 0)
    const x = window.scrollX
    window.scrollTo(0, 0)
    return x
  })

  expect(deslize, 'A página desliza na horizontal').toBeLessThanOrEqual(1)
}

test.describe('Acesso e redirecionamentos', () => {
  // Em `next dev` cada rota é compilada sob demanda no primeiro acesso, o que
  // pode passar de um minuto nos módulos maiores. Contra um build de produção
  // estes testes rodam em milissegundos.
  test.setTimeout(120_000)

  for (const route of PROTECTED_ROUTES) {
    test(`rota protegida ${route} exige sessão`, async ({ page }) => {
      const response = await page.goto(route)
      expect(response?.status(), `${route} respondeu com erro de servidor`).toBeLessThan(500)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test('a página pública de cadastro de insider continua aberta', async ({ page }) => {
    await page.goto('/insider')
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test.describe('Tela de login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('não rola horizontalmente', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })

  test('permite ampliar a página (WCAG 1.4.4)', async ({ page }) => {
    const viewport = await page.evaluate(() =>
      document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    )
    expect(viewport).not.toContain('user-scalable=no')
    expect(viewport).not.toMatch(/maximum-scale=1(\D|$)/)
  })

  test('os campos têm rótulo acessível e tipo de teclado correto', async ({ page }) => {
    const email = page.getByLabel(/e-?mail/i).first()
    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute('type', 'email')

    const password = page.getByLabel(/senha/i).first()
    await expect(password).toBeVisible()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('os controles interativos têm alvo de toque confortável', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('iphone'), 'Regra de toque: só no celular')

    // `.sr-only` fica em 1x1px de propósito (o link "pular para o conteúdo" só
    // ganha tamanho ao receber foco), então não é um alvo de toque real.
    const controls = await page
      .locator('button:visible, a:visible, input:visible')
      .filter({ hasNot: page.locator('.sr-only') })
      .all()

    for (const control of controls) {
      if (await control.evaluate((el) => el.classList.contains('sr-only'))) continue
      const box = await control.boundingBox()
      if (!box) continue
      expect(
        Math.max(box.height, box.width),
        `Alvo de toque pequeno demais: ${await control.evaluate((el) => el.outerHTML.slice(0, 120))}`,
      ).toBeGreaterThanOrEqual(40)
    }
  })

  test('o foco por teclado é visível', async ({ page }) => {
    await page.keyboard.press('Tab')
    const hasVisibleFocus = await page.evaluate(() => {
      const active = document.activeElement
      if (!active || active === document.body) return false
      const style = window.getComputedStyle(active)
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
    })
    expect(hasVisibleFocus).toBe(true)
  })

  test('erros de credencial são anunciados por leitores de tela', async ({ page }) => {
    await page.getByLabel(/e-?mail/i).first().fill('naoexiste@exemplo.invalido')
    await page.getByLabel(/senha/i).first().fill('senha-invalida-para-teste')
    await page.getByRole('button', { name: /entrar|acessar/i }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 15_000 })
  })
})
