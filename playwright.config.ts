import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/*
 * `next start` sem build falha com um "exit code 1" cru, e o Playwright só
 * reporta "0 testes" — parece que a suíte passou vazia. Melhor falhar aqui,
 * dizendo o que fazer.
 */
if (!process.env.E2E_BASE_URL && !existsSync('.next/BUILD_ID')) {
  throw new Error(
    'Build de produção ausente. Rode `npm run build` antes de `npm run test:e2e` ' +
      '(ou aponte E2E_BASE_URL para um servidor já no ar).',
  )
}

/**
 * Testes de interface do painel Somma.
 *
 * Roda contra o servidor de desenvolvimento local. As telas autenticadas
 * exigem credenciais reais (`E2E_EMAIL`/`E2E_PASSWORD`); sem elas, a suíte
 * cobre apenas o que é acessível sem sessão — login, redirecionamentos do
 * middleware e o comportamento responsivo do chrome público.
 *
 * Os perfis de celular emulam viewport, toque e user agent sobre o Chromium.
 * O motor do Safari (WebKit) fica atrás de `E2E_WEBKIT=1` porque o build
 * distribuído pelo Playwright dá segfault em algumas versões do macOS; quando
 * disponível, vale rodar antes de publicar, já que o painel é instalado como
 * PWA em iPhone.
 */
const withWebkit = process.env.E2E_WEBKIT === '1'

/*
 * Porta própria, fora da 3000.
 *
 * Com `reuseExistingServer` na porta padrão, a suíte adota qualquer servidor
 * que já esteja de pé — inclusive um `next dev` esquecido de horas atrás,
 * servindo um build antigo. O resultado são falhas (ou aprovações) que não
 * correspondem ao código atual. Numa porta dedicada isso não acontece.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210)
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

/** Perfil de celular sem depender do WebKit. */
function mobileChromium(device: keyof typeof devices) {
  const { defaultBrowserType: _ignored, ...profile } = devices[device]
  return { ...profile, browserName: 'chromium' as const }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-se', use: mobileChromium('iPhone SE') },
    { name: 'iphone-15', use: mobileChromium('iPhone 14 Pro') },
    { name: 'android', use: mobileChromium('Pixel 7') },
    { name: 'ipad', use: mobileChromium('iPad (gen 7)') },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'ultrawide',
      use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1080 } },
    },
    ...(withWebkit
      ? [
          { name: 'safari-desktop', use: { ...devices['Desktop Safari'] } },
          { name: 'safari-iphone', use: { ...devices['iPhone 14 Pro'] } },
        ]
      : []),
  ],
  webServer: {
    // `next start` (produção) em vez de `next dev`: sem compilação sob demanda
    // as rotas respondem em milissegundos e o que se testa é o build real.
    command: `npx next start -p ${PORT}`,
    url: `${BASE}/login`,
    reuseExistingServer: !!process.env.E2E_BASE_URL,
    timeout: 120_000,
  },
})
