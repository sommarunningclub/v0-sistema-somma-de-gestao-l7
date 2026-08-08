import { expect, test, type Page } from '@playwright/test'
import { SECTION_LABELS } from '../lib/auth/page-routes'

/**
 * Percurso pelas telas autenticadas.
 *
 * Só roda quando `E2E_EMAIL` e `E2E_PASSWORD` estão definidos, porque exige uma
 * conta real no Supabase. Use uma conta de teste — a suíte navega pelos módulos
 * mas não cria, edita nem exclui registro nenhum.
 */

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.skip(
  !EMAIL || !PASSWORD,
  'Defina E2E_EMAIL e E2E_PASSWORD para rodar os testes autenticados.',
)

const SECTIONS = Object.keys(SECTION_LABELS)

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-?mail/i).first().fill(EMAIL!)
  await page.getByLabel(/senha/i).first().fill(PASSWORD!)
  await page.getByRole('button', { name: /entrar|acessar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  expect(result.scrollWidth, `Estouro horizontal em ${context}`).toBeLessThanOrEqual(
    result.clientWidth + 1,
  )
}

test.describe('Painel autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const section of SECTIONS) {
    test(`o módulo "${SECTION_LABELS[section]}" abre sem erro`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })

      await page.goto(`/?section=${section}`)
      await page.waitForLoadState('networkidle')

      // Sem permissão o painel mostra um aviso explícito em vez de tela branca.
      const body = await page.locator('body').innerText()
      expect(body.trim().length, 'Página renderizou vazia').toBeGreaterThan(0)

      await expectNoHorizontalOverflow(page, section)

      const fatal = errors.filter(
        (message) => !/favicon|service ?worker|manifest|ResizeObserver/i.test(message),
      )
      expect(fatal, `Erros de runtime em ${section}:\n${fatal.join('\n')}`).toHaveLength(0)
    })
  }

  test('a navegação mantém a seção na URL e no histórico', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('iphone'), 'A sidebar é exclusiva do desktop')

    await page.goto('/')
    await page.getByRole('navigation', { name: /navegação principal/i }).getByRole('button', { name: /membros/i }).click()
    await expect(page).toHaveURL(/section=agents/)

    await page.goBack()
    await expect(page).not.toHaveURL(/section=agents/)
  })

  test('a busca global abre por atalho de teclado', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('iphone'), 'Atalho de teclado: desktop')

    await page.goto('/')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
    await expect(page.getByRole('dialog', { name: /busca global/i })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /busca global/i })).toBeHidden()
  })

  test('a barra inferior aparece no celular e navega entre módulos', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('iphone'), 'Barra inferior: só no celular')

    await page.goto('/')
    const tabbar = page.getByRole('navigation', { name: /^navegação$/i })
    await expect(tabbar).toBeVisible()

    await tabbar.getByRole('button', { name: /módulos/i }).click()
    await expect(page.getByText(/módulos disponíveis/i)).toBeVisible()
  })

  test('a sessão é encerrada pelo menu do usuário', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /conta de/i }).first().click()
    await page.getByRole('menuitem', { name: /sair da conta/i }).click()
    await page.waitForURL(/\/login/, { timeout: 20_000 })
  })
})
