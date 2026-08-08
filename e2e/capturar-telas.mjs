/**
 * Captura as telas do painel em celular e desktop, para revisão visual.
 *
 * Uso:
 *   1. preencha `.env.e2e` com uma conta de teste
 *   2. `npm run telas`
 *
 * O script sobe o próprio servidor de produção numa porta livre e o derruba no
 * fim — não é preciso ter nada rodando antes. Se já houver um servidor de pé,
 * aponte para ele com `E2E_BASE_URL`.
 *
 * Só faz leitura: entra, navega pelos módulos e fotografa. Não cria, edita nem
 * exclui registro nenhum. As imagens vão para `somma-shots/` (gitignorado).
 */
import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const OUT = 'somma-shots'

/** Uma porta que ninguém está usando, para não brigar com um dev server aberto. */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

async function esperarServidor(base, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(`${base}/login`, { redirect: 'manual' })
      if (res.status < 500) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`O servidor não respondeu em ${base} a tempo.`)
}

/** Sobe `next start` numa porta livre. Devolve a base e como encerrar. */
async function subirServidor() {
  if (process.env.E2E_BASE_URL) {
    return { base: process.env.E2E_BASE_URL, encerrar: () => {} }
  }
  if (!existsSync('.next/BUILD_ID')) {
    throw new Error('Build ausente. Rode `npm run build` antes de `npm run telas`.')
  }

  const porta = await portaLivre()
  const base = `http://localhost:${porta}`
  process.stdout.write(`· subindo o servidor em ${base}\n`)

  const proc = spawn('npx', ['next', 'start', '-p', String(porta)], {
    stdio: 'ignore',
    detached: false,
  })

  await esperarServidor(base)
  return { base, encerrar: () => proc.kill('SIGTERM') }
}

/** Lê `.env.e2e` sem despejar o conteúdo no console. */
async function loadCredentials() {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
    return { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }
  }
  if (!existsSync('.env.e2e')) {
    throw new Error(
      'Credenciais ausentes. Copie `.env.e2e.example` para `.env.e2e` e preencha, ' +
        'ou exporte E2E_EMAIL e E2E_PASSWORD.',
    )
  }
  const env = Object.fromEntries(
    (await readFile('.env.e2e', 'utf8'))
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
  if (!env.E2E_EMAIL || !env.E2E_PASSWORD) {
    throw new Error('`.env.e2e` existe mas E2E_EMAIL/E2E_PASSWORD estão vazios.')
  }
  return { email: env.E2E_EMAIL, password: env.E2E_PASSWORD }
}

const SECOES = [
  ['dashboard', 'overview'],
  ['checkin', 'checkin'],
  ['eventos', 'eventos'],
  ['escala', 'escala'],
  ['membros', 'agents'],
  ['parceiros', 'parceiro'],
  ['insiders', 'insiders'],
  ['crm', 'crm'],
  ['tarefas', 'tarefas'],
  ['popups', 'popups'],
  ['admin', 'systems'],
]

const PERFIS = [
  { nome: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { nome: 'desktop', viewport: { width: 1440, height: 900 } },
]

const { email, password } = await loadCredentials()
await mkdir(OUT, { recursive: true })

const { base: BASE, encerrar } = await subirServidor()
const browser = await chromium.launch()
const problemas = []

try {
for (const perfil of PERFIS) {
  const context = await browser.newContext({
    viewport: perfil.viewport,
    isMobile: perfil.isMobile,
    hasTouch: perfil.hasTouch,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  page.on('pageerror', (error) => problemas.push(`[${perfil.nome}] runtime: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|service ?worker|manifest/i.test(message.text())) {
      problemas.push(`[${perfil.nome}] console: ${message.text().slice(0, 160)}`)
    }
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel(/e-?mail/i).first().fill(email)
  await page.getByLabel(/senha/i).first().fill(password)
  await page.getByRole('button', { name: /entrar|acessar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })

  for (const [rotulo, secao] of SECOES) {
    /*
     * `networkidle` com tolerância: módulos que consultam bases grandes (o
     * check-in varre milhares de linhas) podem nunca ficar totalmente ociosos.
     * Um módulo lento não deve abortar a captura dos outros — registramos o
     * ocorrido e seguimos, fotografando o que estiver na tela.
     */
    try {
      await page.goto(`${BASE}/?section=${secao}`, {
        waitUntil: 'networkidle',
        timeout: 25_000,
      })
    } catch {
      problemas.push(`[${perfil.nome}] ${rotulo}: não estabilizou em 25s (rede ainda ativa)`)
      await page.goto(`${BASE}/?section=${secao}`, {
        waitUntil: 'domcontentloaded',
        timeout: 25_000,
      })
    }
    // Espera os esqueletos darem lugar ao conteúdo real.
    await page.waitForTimeout(1800)

    /*
     * Mede se a PÁGINA de fato desliza de lado, e não `scrollWidth` — que
     * segue reportando a largura do conteúdo mesmo com `overflow-x: hidden`,
     * e conta o conteúdo de roladores internos legítimos (o kanban). O que
     * incomoda o usuário é o cabeçalho sair da tela ao arrastar.
     */
    const deslize = await page.evaluate(() => {
      window.scrollTo(99999, 0)
      const x = window.scrollX
      window.scrollTo(0, 0)
      return x
    })
    if (deslize > 1) {
      problemas.push(`[${perfil.nome}] ${rotulo}: a página desliza ${deslize}px na horizontal`)
    }

    await page.screenshot({
      path: `${OUT}/${String(SECOES.findIndex((s) => s[1] === secao) + 1).padStart(2, '0')}-${rotulo}-${perfil.nome}.png`,
      fullPage: false,
    })
    process.stdout.write(`✓ ${rotulo} (${perfil.nome})\n`)
  }

  await context.close()
}
} finally {
  await browser.close()
  encerrar()
}

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s) encontrado(s):`)
  for (const problema of [...new Set(problemas)]) console.log(`  · ${problema}`)
  process.exitCode = 1
} else {
  console.log('\nNenhum erro de runtime ou estouro horizontal.')
}
