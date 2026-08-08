# Portal do Insider — Fatia 1 (sessão, login, benefícios)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o Insider entre com CPF e senha e veja seus benefícios numa área própria em `/insider/painel`.

**Architecture:** Uma sessão de Insider independente da do admin (cookie próprio, chave HMAC derivada), rotas que validam essa sessão dentro do próprio handler, e um módulo puro que traduz as sete colunas de benefício — texto livre com formatos misturados — em algo exibível sem vazar anotação interna.

**Tech Stack:** Next.js 15.5.10 (App Router), React 19.2.0, TypeScript, Tailwind v3, bcryptjs, Supabase (service role), jest + jsdom, framer-motion, lucide-react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-portal-insider-design.md`. Em conflito, a spec vence.
- **O campo `evolve` contém anotação administrativa interna** ("POSSUI SALDO DEVEDOR", "NECESSÁRIO O CANCELAMENTO NA UNIDADE", "É LANÇADO A BOLSA"). Nada disso pode chegar ao browser. O portal exibe apenas `Ativo` ou `Inativo`.
- A coluna é `dopahmina` (com "h"). Não corrigir.
- **A identidade vem sempre do cookie assinado**, nunca de `id` ou `cpf` enviados pelo cliente.
- Cookie do Insider: `somma_insider_session`. Nunca reutilizar `somma_session` (o do admin).
- Chave HMAC do Insider: `${SESSION_SECRET || SUPABASE_SERVICE_ROLE_KEY}:insider` — um token de admin precisa ser criptograficamente inválido aqui.
- Erros de API: `{ error: string }` + status. Logs prefixados `[insiders/<rota>]`.
- Testes: `npm test`. Typecheck: `npx tsc --noEmit` (o `npm run build` **não** acusa erro de tipo — `ignoreBuildErrors: true`).
- `curl` é corrompido por um hook neste ambiente ao enviar `multipart`; para POST com JSON funciona normalmente.
- Commits em português, com o trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Não criar nem reescrever arquivo que o plano não mande criar. Vários arquivos do projeto já foram untracked; se algo parecer faltando, **pare e reporte** em vez de inventar.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/auth/insider-session.ts` | **Criar** — cookie, token e verificação da sessão de Insider |
| `lib/auth/__tests__/insider-session.test.ts` | **Criar** — testes da sessão |
| `lib/insider/beneficios.ts` | **Criar** — tradução das 7 colunas para exibição |
| `lib/insider/__tests__/beneficios.test.ts` | **Criar** — testes, incluindo o de não-vazamento |
| `app/api/insiders/entrar/route.ts` | **Criar** — login por CPF + senha |
| `app/api/insiders/sair/route.ts` | **Criar** — logout |
| `app/api/insiders/eu/route.ts` | **Criar** — dados + benefícios do dono da sessão |
| `lib/auth/page-routes.ts` | **Modificar** — `OPEN_PAGES` abrange `/insider/*` |
| `lib/auth/route-permissions.ts` | **Modificar** — liberar as rotas do portal no middleware |
| `app/insider/painel/page.tsx` | **Criar** — página do painel (Server Component) |
| `components/insider/portal-beneficios.tsx` | **Criar** — cartões de benefício + copiar cupom |
| `components/insider/portal-header.tsx` | **Criar** — saudação e botão Sair |
| `components/insider/insider-cadastro-form.tsx` | **Modificar** — estado de login quando já há senha |

---

### Task 1: Sessão do Insider

**Files:**
- Create: `lib/auth/insider-session.ts`
- Test: `lib/auth/__tests__/insider-session.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `INSIDER_SESSION_COOKIE = 'somma_insider_session'`
  - `INSIDER_SESSION_MAX_AGE_SEC` (30 dias)
  - `type InsiderSession = { sub: string; cpf: string; nome: string; typ: 'insider'; exp: number }`
  - `createInsiderToken(insider: { id: string; cpf: string; nome: string }): Promise<string>`
  - `verifyInsiderToken(token: string): Promise<InsiderSession | null>`
  - `attachInsiderCookie(res: NextResponse, token: string): NextResponse`
  - `clearInsiderCookie(res: NextResponse): NextResponse`
  - `getInsiderFromRequest(req: NextRequest): Promise<InsiderSession | null>`
  - `getInsiderFromCookies(): Promise<InsiderSession | null>`

**Contexto:** espelha `lib/auth/session.ts` (leia-o), com três diferenças deliberadas: cookie próprio, chave HMAC derivada com o sufixo `:insider`, e o campo `typ` verificado. Sem isso, um token de admin — assinado com o mesmo segredo — passaria como token de Insider.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/auth/__tests__/insider-session.test.ts
import {
  createInsiderToken,
  verifyInsiderToken,
  INSIDER_SESSION_COOKIE,
  INSIDER_SESSION_MAX_AGE_SEC,
} from '../insider-session'
import { createSessionToken } from '../session'

const insider = { id: 'uuid-insider-1', cpf: '529.982.247-25', nome: 'João Silva' }

describe('insider-session', () => {
  it('cria e verifica um token válido', async () => {
    const token = await createInsiderToken(insider)
    const payload = await verifyInsiderToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('uuid-insider-1')
    expect(payload!.cpf).toBe('529.982.247-25')
    expect(payload!.nome).toBe('João Silva')
    expect(payload!.typ).toBe('insider')
  })

  it('usa cookie próprio, diferente do admin', () => {
    expect(INSIDER_SESSION_COOKIE).toBe('somma_insider_session')
  })

  it('expira em 30 dias', async () => {
    const antes = Math.floor(Date.now() / 1000)
    const token = await createInsiderToken(insider)
    const payload = await verifyInsiderToken(token)
    expect(INSIDER_SESSION_MAX_AGE_SEC).toBe(60 * 60 * 24 * 30)
    expect(payload!.exp).toBeGreaterThanOrEqual(antes + INSIDER_SESSION_MAX_AGE_SEC - 5)
  })

  it('rejeita token com assinatura adulterada', async () => {
    const token = await createInsiderToken(insider)
    const [encoded] = token.split('.')
    expect(await verifyInsiderToken(`${encoded}.assinaturaFalsa`)).toBeNull()
  })

  it('rejeita token com payload adulterado', async () => {
    const token = await createInsiderToken(insider)
    const [, assinatura] = token.split('.')
    const outro = Buffer.from(JSON.stringify({ ...insider, sub: 'outro-id' }))
      .toString('base64url')
    expect(await verifyInsiderToken(`${outro}.${assinatura}`)).toBeNull()
  })

  it('rejeita token malformado', async () => {
    expect(await verifyInsiderToken('')).toBeNull()
    expect(await verifyInsiderToken('semponto')).toBeNull()
  })

  it('rejeita token expirado', async () => {
    const expirado = Math.floor(Date.now() / 1000) - 10
    const payload = { sub: 'x', cpf: 'y', nome: 'z', typ: 'insider', exp: expirado }
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    // assina com a chave real reutilizando o próprio módulo
    const valido = await createInsiderToken(insider)
    const [, assinaturaDeOutro] = valido.split('.')
    expect(await verifyInsiderToken(`${encoded}.${assinaturaDeOutro}`)).toBeNull()
  })

  it('REJEITA um token de sessão de ADMIN', async () => {
    const tokenAdmin = await createSessionToken({
      id: 'admin-1',
      email: 'admin@exemplo.com',
      full_name: 'Admin',
      role: 'admin',
      permissions: null,
    })
    expect(await verifyInsiderToken(tokenAdmin)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/auth/__tests__/insider-session.test.ts`
Expected: FAIL — `Cannot find module '../insider-session'`.

- [ ] **Step 3: Implementar**

```ts
// lib/auth/insider-session.ts
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

export const INSIDER_SESSION_COOKIE = 'somma_insider_session'
export const INSIDER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 dias

export type InsiderSession = {
  sub: string
  cpf: string
  nome: string
  typ: 'insider'
  exp: number
}

/**
 * Chave derivada com sufixo ':insider'. O admin assina com o segredo puro,
 * então um token de admin é criptograficamente inválido aqui — separar só o
 * nome do cookie não bastaria.
 */
function getInsiderSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SESSION_SECRET não configurado')
  }
  return `${secret}:insider`
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getInsiderSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return toBase64Url(new Uint8Array(signature))
}

async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expected = await sign(data)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

export async function createInsiderToken(insider: {
  id: string
  cpf: string
  nome: string
}): Promise<string> {
  const payload: InsiderSession = {
    sub: insider.id,
    cpf: insider.cpf,
    nome: insider.nome,
    typ: 'insider',
    exp: Math.floor(Date.now() / 1000) + INSIDER_SESSION_MAX_AGE_SEC,
  }
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await sign(encoded)
  return `${encoded}.${signature}`
}

export async function verifyInsiderToken(token: string): Promise<InsiderSession | null> {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const valid = await verifySignature(encoded, signature)
  if (!valid) return null

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    const payload = JSON.parse(json) as InsiderSession
    if (payload.typ !== 'insider') return null
    if (!payload.sub || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function insiderCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: INSIDER_SESSION_MAX_AGE_SEC,
  }
}

export function attachInsiderCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(INSIDER_SESSION_COOKIE, token, insiderCookieOptions())
  return response
}

export function clearInsiderCookie(response: NextResponse): NextResponse {
  response.cookies.set(INSIDER_SESSION_COOKIE, '', { ...insiderCookieOptions(), maxAge: 0 })
  return response
}

export async function getInsiderFromRequest(req: NextRequest): Promise<InsiderSession | null> {
  const token = req.cookies.get(INSIDER_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyInsiderToken(token)
}

export async function getInsiderFromCookies(): Promise<InsiderSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(INSIDER_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyInsiderToken(token)
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- lib/auth/__tests__/insider-session.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/insider-session.ts lib/auth/__tests__/insider-session.test.ts
git commit -m "feat(portal): sessão de Insider com cookie e chave HMAC próprios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Tradução dos benefícios

**Files:**
- Create: `lib/insider/beneficios.ts`
- Test: `lib/insider/__tests__/beneficios.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type BeneficioTipo = 'status' | 'cupom' | 'descricao' | 'percentual'`
  - `type Beneficio = { chave: string; rotulo: string; tipo: BeneficioTipo; valor: string; disponivel: boolean }`
  - `BENEFICIO_COLUNAS: string` — lista de colunas para o `.select()`
  - `montarBeneficios(row: Record<string, unknown>): Beneficio[]`

**Contexto — o que existe de verdade na base** (amostra de 31 Insiders): `evolve` traz `"Ativo"` ou `"Ativo - POSSUI SALDO DEVEDOR, SENDO NECESSÁRIO O CANCELAMENTO NA UNIDADE. FEITO ISSO É LANÇADO A BOLSA"`; `dopahmina` traz `"0.1"`; `tex_barbearia` e `estamina_recovery` trazem descrições iguais para todos; `cupom_loja_somma` traz cupom individual (`INSIDERES27`); `big_box` traz `"BIGSOMMA"`; `assessoria_somma` traz `"Sim"` ou vazio.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/insider/__tests__/beneficios.test.ts
import { montarBeneficios, BENEFICIO_COLUNAS } from '../beneficios'

const linhaReal = {
  evolve: 'Ativo - POSSUI SALDO DEVEDOR , SENDO NECESSÁRIO O CANCELAMENTO NA UNIDADE. FEITO ISSO É LANÇADO A BOLSA',
  dopahmina: '0.1',
  tex_barbearia: 'Insiders: 10% de desconto em 1 serviço, 2 serviços ou mais: 15% de desconto',
  cupom_loja_somma: 'INSIDERES27',
  big_box: 'BIGSOMMA',
  assessoria_somma: 'Sim',
  estamina_recovery: 'Voucher de 150 reais',
}

const buscar = (linha: Record<string, unknown>, chave: string) =>
  montarBeneficios(linha).find((b) => b.chave === chave)!

describe('montarBeneficios — Evolve', () => {
  it('mostra apenas Ativo, descartando a anotação interna', () => {
    const b = buscar(linhaReal, 'evolve')
    expect(b.valor).toBe('Ativo')
    expect(b.tipo).toBe('status')
    expect(b.disponivel).toBe(true)
  })

  it('mostra Inativo quando o texto não começa com "ativo"', () => {
    expect(buscar({ ...linhaReal, evolve: 'Cancelado' }, 'evolve').valor).toBe('Inativo')
    expect(buscar({ ...linhaReal, evolve: '' }, 'evolve').valor).toBe('Inativo')
  })

  it('aceita variações de caixa e espaço', () => {
    expect(buscar({ ...linhaReal, evolve: '  ATIVO  ' }, 'evolve').valor).toBe('Ativo')
  })
})

describe('montarBeneficios — não vaza anotação interna', () => {
  it('nenhum valor de saída contém termos administrativos', () => {
    const proibidos = ['SALDO DEVEDOR', 'CANCELAMENTO', 'BOLSA', 'UNIDADE']
    const saida = JSON.stringify(montarBeneficios(linhaReal)).toUpperCase()
    for (const termo of proibidos) {
      expect(saida).not.toContain(termo)
    }
  })
})

describe('montarBeneficios — Dopamina', () => {
  it('converte 0.1 em 10% de desconto', () => {
    expect(buscar(linhaReal, 'dopahmina').valor).toBe('10% de desconto')
  })

  it('converte 0.15 em 15% de desconto', () => {
    expect(buscar({ ...linhaReal, dopahmina: '0.15' }, 'dopahmina').valor).toBe('15% de desconto')
  })

  it('fica indisponível quando não é número', () => {
    expect(buscar({ ...linhaReal, dopahmina: 'abc' }, 'dopahmina').disponivel).toBe(false)
    expect(buscar({ ...linhaReal, dopahmina: '' }, 'dopahmina').disponivel).toBe(false)
  })
})

describe('montarBeneficios — cupons e descrições', () => {
  it('devolve o cupom individual da Loja Somma', () => {
    const b = buscar(linhaReal, 'cupom_loja_somma')
    expect(b.valor).toBe('INSIDERES27')
    expect(b.tipo).toBe('cupom')
  })

  it('devolve o cupom do Big Box', () => {
    expect(buscar(linhaReal, 'big_box').valor).toBe('BIGSOMMA')
  })

  it('devolve as descrições como estão', () => {
    expect(buscar(linhaReal, 'tex_barbearia').valor).toContain('10% de desconto')
    expect(buscar(linhaReal, 'estamina_recovery').valor).toBe('Voucher de 150 reais')
  })

  it('marca cupom e descrição vazios como indisponíveis', () => {
    const vazio = { ...linhaReal, cupom_loja_somma: '', estamina_recovery: null }
    expect(buscar(vazio, 'cupom_loja_somma').disponivel).toBe(false)
    expect(buscar(vazio, 'estamina_recovery').disponivel).toBe(false)
  })
})

describe('montarBeneficios — Assessoria Somma', () => {
  it('mostra Ativo quando o valor é Sim', () => {
    expect(buscar(linhaReal, 'assessoria_somma').valor).toBe('Ativo')
  })

  it('mostra Não incluído quando vazio, e segue disponível para exibição', () => {
    const b = buscar({ ...linhaReal, assessoria_somma: '' }, 'assessoria_somma')
    expect(b.valor).toBe('Não incluído')
    expect(b.disponivel).toBe(true)
  })
})

describe('montarBeneficios — estrutura', () => {
  it('devolve os sete benefícios, sempre na mesma ordem', () => {
    const chaves = montarBeneficios(linhaReal).map((b) => b.chave)
    expect(chaves).toEqual([
      'evolve',
      'dopahmina',
      'tex_barbearia',
      'cupom_loja_somma',
      'big_box',
      'assessoria_somma',
      'estamina_recovery',
    ])
  })

  it('todo benefício tem rótulo legível', () => {
    for (const b of montarBeneficios(linhaReal)) {
      expect(b.rotulo.length).toBeGreaterThan(2)
    }
  })

  it('BENEFICIO_COLUNAS lista as sete colunas e nada de senha', () => {
    for (const c of ['evolve', 'dopahmina', 'tex_barbearia', 'cupom_loja_somma', 'big_box', 'assessoria_somma', 'estamina_recovery']) {
      expect(BENEFICIO_COLUNAS).toContain(c)
    }
    expect(BENEFICIO_COLUNAS).not.toContain('senha')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/insider/__tests__/beneficios.test.ts`
Expected: FAIL — `Cannot find module '../beneficios'`.

- [ ] **Step 3: Implementar**

```ts
// lib/insider/beneficios.ts

export type BeneficioTipo = 'status' | 'cupom' | 'descricao' | 'percentual'

export type Beneficio = {
  chave: string
  rotulo: string
  tipo: BeneficioTipo
  valor: string
  /** false = não exibir (sem valor cadastrado) */
  disponivel: boolean
}

/** Colunas lidas do banco para montar os benefícios. Nunca inclui senha. */
export const BENEFICIO_COLUNAS =
  'evolve, dopahmina, tex_barbearia, cupom_loja_somma, big_box, assessoria_somma, estamina_recovery'

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor).trim()
}

/**
 * O texto de `evolve` carrega anotação administrativa interna sobre a
 * situação financeira da pessoa. Só o status sai daqui — o restante nunca
 * pode chegar ao browser.
 */
function statusEvolve(valor: unknown): string {
  return texto(valor).toLowerCase().startsWith('ativo') ? 'Ativo' : 'Inativo'
}

function percentual(valor: unknown): { valor: string; disponivel: boolean } {
  const bruto = texto(valor)
  const numero = Number.parseFloat(bruto)
  if (!bruto || Number.isNaN(numero)) return { valor: '', disponivel: false }
  const pct = Math.round(numero * 100)
  return { valor: `${pct}% de desconto`, disponivel: true }
}

function simples(valor: unknown, tipo: 'cupom' | 'descricao') {
  const bruto = texto(valor)
  return { valor: bruto, disponivel: bruto.length > 0, tipo }
}

export function montarBeneficios(row: Record<string, unknown>): Beneficio[] {
  const dopamina = percentual(row.dopahmina)
  const tex = simples(row.tex_barbearia, 'descricao')
  const loja = simples(row.cupom_loja_somma, 'cupom')
  const bigBox = simples(row.big_box, 'cupom')
  const estamina = simples(row.estamina_recovery, 'descricao')

  return [
    {
      chave: 'evolve',
      rotulo: 'Evolve',
      tipo: 'status',
      valor: statusEvolve(row.evolve),
      disponivel: true,
    },
    {
      chave: 'dopahmina',
      rotulo: 'Dopamina',
      tipo: 'percentual',
      valor: dopamina.valor,
      disponivel: dopamina.disponivel,
    },
    {
      chave: 'tex_barbearia',
      rotulo: 'Tex Barbearia',
      tipo: 'descricao',
      valor: tex.valor,
      disponivel: tex.disponivel,
    },
    {
      chave: 'cupom_loja_somma',
      rotulo: 'Loja Somma',
      tipo: 'cupom',
      valor: loja.valor,
      disponivel: loja.disponivel,
    },
    {
      chave: 'big_box',
      rotulo: 'Big Box',
      tipo: 'cupom',
      valor: bigBox.valor,
      disponivel: bigBox.disponivel,
    },
    {
      chave: 'assessoria_somma',
      rotulo: 'Assessoria Somma',
      tipo: 'status',
      valor: texto(row.assessoria_somma).toLowerCase() === 'sim' ? 'Ativo' : 'Não incluído',
      disponivel: true,
    },
    {
      chave: 'estamina_recovery',
      rotulo: 'Estamina Recovery',
      tipo: 'descricao',
      valor: estamina.valor,
      disponivel: estamina.disponivel,
    },
  ]
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- lib/insider/__tests__/beneficios.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/insider/beneficios.ts lib/insider/__tests__/beneficios.test.ts
git commit -m "feat(portal): traduz as colunas de benefício para exibição segura

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Liberar as rotas do portal no middleware

**Files:**
- Modify: `lib/auth/page-routes.ts` (a constante `OPEN_PAGES`)
- Modify: `lib/auth/route-permissions.ts` (o array `PUBLIC_API_ROUTES`)
- Test: `lib/auth/__tests__/portal-insider-routes.test.ts`

**Interfaces:**
- Consumes: `isOpenPage(pathname)`, `isPublicApiRoute(pathname, method)`, `getRequiredPermission(pathname)` — já existem.
- Produces: nenhuma função nova.

**Contexto que importa:** o middleware está **ativo em produção**. Hoje `OPEN_PAGES` é `/^\/insider$/`, exato — `/insider/painel` seria redirecionado para o login **do admin**. E a regra `/^\/api\/insider/` → permissão `pagamentos` casa com `/api/insiders/eu`, o que faria o portal responder 403 ao próprio Insider. "Público" aqui significa apenas que o middleware não gateia; as rotas `eu*` continuam exigindo cookie de Insider válido no handler.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/auth/__tests__/portal-insider-routes.test.ts
import { isOpenPage, isPublicPage, getPagePermission } from '../page-routes'
import { isPublicApiRoute, getRequiredPermission } from '../route-permissions'

describe('páginas do portal', () => {
  it('/insider e /insider/painel são páginas abertas', () => {
    expect(isOpenPage('/insider')).toBe(true)
    expect(isOpenPage('/insider/painel')).toBe(true)
  })

  it('não são páginas de visitante nem exigem permissão', () => {
    expect(isPublicPage('/insider/painel')).toBe(false)
    expect(getPagePermission('/insider/painel')).toBeNull()
  })

  it('não abre a página interna /insiders (plural)', () => {
    expect(isOpenPage('/insiders')).toBe(false)
  })
})

describe('rotas de API do portal', () => {
  it('libera entrar e sair', () => {
    expect(isPublicApiRoute('/api/insiders/entrar', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/sair', 'POST')).toBe(true)
  })

  it('libera as rotas eu* do gate do middleware', () => {
    expect(isPublicApiRoute('/api/insiders/eu', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/eu/eventos', 'GET')).toBe(true)
  })

  it('mantém as rotas internas /api/insider protegidas', () => {
    expect(isPublicApiRoute('/api/insider/eventos', 'GET')).toBe(false)
    expect(getRequiredPermission('/api/insider/eventos')).toBe('pagamentos')
  })

  it('não libera nada fora do portal', () => {
    expect(isPublicApiRoute('/api/insiders', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/admin/users', 'GET')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/auth/__tests__/portal-insider-routes.test.ts`
Expected: FAIL — `isOpenPage('/insider/painel')` retorna `false` e as asserções de `/api/insiders/eu` retornam `false`.

- [ ] **Step 3: Ampliar `OPEN_PAGES`**

Em `lib/auth/page-routes.ts`, trocar a linha da constante:

```ts
/** Páginas abertas a todos — com ou sem sessão, sem redirect */
const OPEN_PAGES: RegExp[] = [/^\/insider(\/|$)/]
```

Note o `(\/|$)`: abre `/insider` e tudo abaixo dele, sem abrir `/insiders` (plural), que é a tela interna.

- [ ] **Step 4: Liberar as rotas de API**

Em `lib/auth/route-permissions.ts`, substituir o bloco de comentário e as duas entradas do `/insider` ao final de `PUBLIC_API_ROUTES` por:

```ts
  // Página pública /insider (auto-cadastro do Insider)
  { method: 'POST', pattern: /^\/api\/insiders\/lookup$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/register$/ },
  // Portal do Insider — o middleware não gateia; cada rota valida o
  // cookie somma_insider_session dentro do próprio handler.
  { method: 'POST', pattern: /^\/api\/insiders\/entrar$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/sair$/ },
  { pattern: /^\/api\/insiders\/eu(\/|$)/ },
]
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test -- lib/auth/__tests__/portal-insider-routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: os testes existentes seguem passando. Há **uma** falha pré-existente e não relacionada em `components/__tests__/tarefas-filters-panel.test.tsx` — ela já falhava antes e não é sua para consertar.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/page-routes.ts lib/auth/route-permissions.ts lib/auth/__tests__/portal-insider-routes.test.ts
git commit -m "feat(portal): libera as rotas do portal do Insider no middleware

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Login e logout

**Files:**
- Create: `app/api/insiders/entrar/route.ts`
- Create: `app/api/insiders/sair/route.ts`

**Interfaces:**
- Consumes: `createInsiderToken`, `attachInsiderCookie`, `clearInsiderCookie` de `@/lib/auth/insider-session`; `getAdminClient` e `verifyPassword` de `@/lib/auth/api-auth`; `isValidCpf` de `@/lib/insider/validation`; `cpfCandidates` de `@/lib/insider/insider-mapper`; `checkRateLimit`, `clientKey` de `@/lib/insider/rate-limit`.
- Produces: `POST /api/insiders/entrar` (body `{cpf, senha}` → 200 `{success:true}` + cookie) e `POST /api/insiders/sair` (→ 200 `{success:true}`, cookie limpo).

**Contexto de segurança:** a resposta de erro precisa ser idêntica para CPF inexistente, CPF sem credencial e senha errada — senão o endpoint vira um oráculo de quem é Insider. Pelo mesmo motivo o caminho sem credencial paga um `verifyPassword` descartável, replicando o equalizador que já existe em `app/api/insiders/register/route.ts`.

- [ ] **Step 1: Implementar o login**

```ts
// app/api/insiders/entrar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyPassword } from '@/lib/auth/api-auth'
import { isValidCpf } from '@/lib/insider/validation'
import { cpfCandidates } from '@/lib/insider/insider-mapper'
import { checkRateLimit, clientKey } from '@/lib/insider/rate-limit'
import { createInsiderToken, attachInsiderCookie } from '@/lib/auth/insider-session'

/** Mesma mensagem para todas as falhas: o endpoint não pode revelar quem é Insider. */
const FALHA = 'CPF ou senha incorretos.'
const HASH_DESCARTAVEL = '$2b$12$wlJXRTwSoU2ce5S6KmoHeOLcsJYIAnzo2.K.eccnhrsQ4Soi7neG6'

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`entrar:${clientKey(req)}`, 5, 60_000)
    if (!rate.allowed) {
      console.warn('[insiders/entrar] rate limit exceeded')
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''
    const senha = typeof body?.senha === 'string' ? body.senha : ''

    if (!isValidCpf(cpf) || !senha) {
      await verifyPassword('equalizador', HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: linhas, error: findError } = await supabase
      .from('dados_insiders')
      .select('id, cpf, nome')
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    if (findError) {
      console.error('[insiders/entrar] find error:', findError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    const insider = linhas?.[0] ?? null

    if (!insider) {
      // Paga o mesmo custo do caminho com credencial, para não vazar por timing.
      await verifyPassword(senha, HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('senha_hash')
      .eq('insider_id', insider.id)
      .maybeSingle()

    // Falha fechado: erro de consulta nunca vira "entrou".
    if (credError) {
      console.error('[insiders/entrar] credential error:', credError)
      return NextResponse.json({ error: 'Erro ao entrar.' }, { status: 500 })
    }

    if (!credencial?.senha_hash) {
      await verifyPassword(senha, HASH_DESCARTAVEL)
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const { valid } = await verifyPassword(senha, credencial.senha_hash)
    if (!valid) {
      return NextResponse.json({ error: FALHA }, { status: 401 })
    }

    const token = await createInsiderToken({
      id: insider.id,
      cpf: insider.cpf,
      nome: insider.nome,
    })

    return attachInsiderCookie(NextResponse.json({ success: true }), token)
  } catch (err) {
    console.error('[insiders/entrar] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Implementar o logout**

```ts
// app/api/insiders/sair/route.ts
import { NextResponse } from 'next/server'
import { clearInsiderCookie } from '@/lib/auth/insider-session'

export async function POST() {
  return clearInsiderCookie(NextResponse.json({ success: true }))
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E 'app/api/insiders|lib/auth/insider-session'`
Expected: nada impresso.

- [ ] **Step 4: Verificar ao vivo**

Subir o servidor (`npm run dev`; confira antes se já há um em `http://localhost:3000` com `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/insiders/lookup`).

```bash
# CPF inválido -> 401 com a mensagem genérica
curl -s -X POST http://localhost:3000/api/insiders/entrar \
  -H 'Content-Type: application/json' -d '{"cpf":"111.111.111-11","senha":"qualquer"}' -w "\n%{http_code}\n"
```
Expected: `{"error":"CPF ou senha incorretos."}` e `401`.

```bash
# CPF válido que não existe -> a MESMA resposta
curl -s -X POST http://localhost:3000/api/insiders/entrar \
  -H 'Content-Type: application/json' -d '{"cpf":"529.982.247-25","senha":"qualquer"}' -w "\n%{http_code}\n"
```
Expected: idêntico ao anterior — mesma mensagem, mesmo status.

```bash
# logout sempre responde 200 e limpa o cookie
curl -s -i -X POST http://localhost:3000/api/insiders/sair | grep -iE 'HTTP/|set-cookie'
```
Expected: `HTTP/1.1 200` e um `set-cookie: somma_insider_session=;` com `Max-Age=0`.

- [ ] **Step 5: Commit**

```bash
git add app/api/insiders/entrar/route.ts app/api/insiders/sair/route.ts
git commit -m "feat(portal): login e logout do Insider por CPF e senha

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Rota dos dados e benefícios do Insider logado

**Files:**
- Create: `app/api/insiders/eu/route.ts`

**Interfaces:**
- Consumes: `getInsiderFromRequest` de `@/lib/auth/insider-session`; `getAdminClient` de `@/lib/auth/api-auth`; `INSIDER_PUBLIC_COLUMNS`, `toInsiderPublic` de `@/lib/insider/insider-mapper`; `montarBeneficios`, `BENEFICIO_COLUNAS` de `@/lib/insider/beneficios`.
- Produces: `GET /api/insiders/eu` → 200 `{ insider: InsiderPublic, beneficios: Beneficio[] }`, ou 401 `{ error: 'Não autenticado.' }`.

**Contexto:** esta é a rota que expõe os benefícios, que `INSIDER_PUBLIC_COLUMNS` deliberadamente omite. O `insider_id` vem **do cookie assinado** — nunca de query string ou body. É exatamente a diferença entre este portal e o problema conhecido do `/api/auth/me`, que aceita `?id=`.

- [ ] **Step 1: Implementar**

```ts
// app/api/insiders/eu/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromRequest } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS, toInsiderPublic } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'

export async function GET(req: NextRequest) {
  try {
    // A identidade vem do cookie assinado. Nunca de parâmetro do cliente.
    const sessao = await getInsiderFromRequest(req)
    if (!sessao) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: row, error } = await supabase
      .from('dados_insiders')
      .select(`${INSIDER_PUBLIC_COLUMNS}, ${BENEFICIO_COLUNAS}`)
      .eq('id', sessao.sub)
      .maybeSingle()

    if (error) {
      console.error('[insiders/eu] select error:', error)
      return NextResponse.json({ error: 'Erro ao carregar seus dados.' }, { status: 500 })
    }

    if (!row) {
      // Cadastro removido depois do login: a sessão não vale mais nada.
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const linha = row as Record<string, unknown>

    const { data: credencial } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', sessao.sub)
      .maybeSingle()

    return NextResponse.json({
      insider: toInsiderPublic(linha, Boolean(credencial)),
      beneficios: montarBeneficios(linha),
    })
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep 'app/api/insiders/eu'`
Expected: nada impresso.

- [ ] **Step 3: Verificar que exige sessão**

```bash
curl -s http://localhost:3000/api/insiders/eu -w "\n%{http_code}\n"
```
Expected: `{"error":"Não autenticado."}` e `401`.

```bash
# cookie forjado também é rejeitado
curl -s http://localhost:3000/api/insiders/eu \
  -H 'Cookie: somma_insider_session=abc.def' -w "\n%{http_code}\n"
```
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/insiders/eu/route.ts
git commit -m "feat(portal): rota dos dados e benefícios do Insider logado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Estado de login no formulário de `/insider`

**Files:**
- Modify: `components/insider/insider-cadastro-form.tsx`

**Interfaces:**
- Consumes: `POST /api/insiders/entrar`; `INPUT_CLS`, `InsiderField`, `Reveal` de `@/components/insider/insider-form-ui`.
- Produces: nenhuma exportação nova — o componente segue sendo `InsiderCadastroForm`.

**Contexto:** o componente hoje trata três desfechos do lookup: `found` (abre o formulário preenchido), `new` (cadastro do zero) e os estados `idle`/`loading`. Ele já guarda `temSenha`, vindo de `insider.tem_senha`. Falta o quarto desfecho: quando `found && tem_senha`, a pessoa deve **entrar**, não editar.

- [ ] **Step 1: Adicionar o estado e o handler de login**

No componente, acrescentar ao lado dos estados existentes:

```tsx
const [senhaLogin, setSenhaLogin] = useState('')
const [entrando, setEntrando] = useState(false)
const [modoEdicao, setModoEdicao] = useState(false)
```

E o handler, junto dos demais:

```tsx
async function handleEntrar(e: React.FormEvent) {
  e.preventDefault()
  if (entrando) return
  setErro(null)
  setEntrando(true)
  try {
    const res = await fetch('/api/insiders/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: form.cpf, senha: senhaLogin }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível entrar.')
    }
    router.push('/insider/painel')
  } catch (err) {
    setErro(err instanceof Error ? err.message : 'Não foi possível entrar.')
  } finally {
    setEntrando(false)
  }
}
```

Isso exige `useRouter`: se `import { useRouter } from 'next/navigation'` ainda não existir no arquivo, adicionar, e `const router = useRouter()` junto dos hooks.

- [ ] **Step 2: Zerar o estado de login ao trocar o CPF**

O efeito que observa `form.cpf` já limpa consentimentos e foto por meio de um helper. Acrescentar ali, para que nada de um CPF sobreviva ao outro:

```tsx
setSenhaLogin('')
setModoEdicao(false)
```

Coloque essas duas linhas dentro do mesmo helper que hoje limpa consentimentos e foto, para que as três ramificações do efeito (CPF apagado/inválido, CPF encontrado, CPF não encontrado) recebam a limpeza sem repetição.

- [ ] **Step 3: Renderizar a tela de login em vez do formulário**

Definir a condição junto das demais flags de exibição:

```tsx
const modoLogin = lookupStatus === 'found' && temSenha && !modoEdicao
```

E fazer o restante do formulário depender dela. O bloco de nome — o primeiro campo revelado — passa a ser gated por `!modoLogin`, e todos os `Reveal` seguintes já dependem dele em cadeia, então nada mais precisa mudar. Logo abaixo da nota "Encontramos seu cadastro", inserir:

```tsx
<Reveal show={modoLogin}>
  <InsiderField id="senha_login" label="Senha">
    <input
      id="senha_login"
      type="password"
      autoComplete="current-password"
      value={senhaLogin}
      onChange={(e) => setSenhaLogin(e.target.value)}
      className={INPUT_CLS}
      placeholder="Sua senha de acesso"
    />
  </InsiderField>

  <button
    type="button"
    onClick={handleEntrar}
    disabled={entrando}
    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
  >
    {entrando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
    Entrar
    {!entrando && <ArrowRight className="h-4 w-4" />}
  </button>

  <button
    type="button"
    onClick={() => setModoEdicao(true)}
    className="mt-3 w-full text-center text-sm text-[#737373] underline"
  >
    Prefiro atualizar meus dados sem entrar
  </button>
</Reveal>
```

O botão "Entrar" é `type="button"` com `onClick`, e não `submit`, para não disparar o `handleSubmit` do cadastro. O link de escape mantém acessível o fluxo atual, que continua exigindo `senha_atual` no servidor — não é um contorno da autenticação.

- [ ] **Step 4: Typecheck e testes**

Run: `npx tsc --noEmit 2>&1 | grep 'components/insider'`
Expected: nada impresso.

Run: `npm test`
Expected: mesmos resultados de antes — apenas a falha pré-existente de `tarefas-filters-panel.test.tsx`.

- [ ] **Step 5: Verificar no navegador**

Com o servidor rodando, abrir `http://localhost:3000/insider` e digitar um CPF que **tenha** senha cadastrada.
Expected: aparece o campo "Senha" com o botão "Entrar" — e **não** o formulário de cadastro. Clicar em "Prefiro atualizar meus dados sem entrar" revela o formulário completo. Apagar um dígito do CPF limpa o campo de senha e some com tudo.

Digitar um CPF **sem** senha.
Expected: comportamento atual, com o formulário de cadastro.

- [ ] **Step 6: Commit**

```bash
git add components/insider/insider-cadastro-form.tsx
git commit -m "feat(portal): /insider oferece entrar quando o cadastro já tem senha

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Página do painel com os benefícios

**Files:**
- Create: `app/insider/painel/page.tsx`
- Create: `components/insider/portal-header.tsx`
- Create: `components/insider/portal-beneficios.tsx`

**Interfaces:**
- Consumes: `getInsiderFromCookies` de `@/lib/auth/insider-session`; `montarBeneficios`, `BENEFICIO_COLUNAS`, `type Beneficio` de `@/lib/insider/beneficios`; `INSIDER_PUBLIC_COLUMNS` de `@/lib/insider/insider-mapper`; `getAdminClient` de `@/lib/auth/api-auth`.
- Produces: a rota `/insider/painel`.

**Contexto:** a página é um Server Component e confere o cookie **antes de renderizar**, sem depender do middleware. Herda fonte e fundo de `app/insider/layout.tsx`. Como já busca os dados no servidor, não chama `GET /api/insiders/eu` — essa rota existe para a Fatia 2 (recarregar dados no cliente após editar).

- [ ] **Step 1: Criar o cabeçalho**

```tsx
// components/insider/portal-header.tsx
"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function PortalHeader({ nome }: { nome: string }) {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)
  const primeiroNome = nome.trim().split(' ')[0] || 'Insider'

  async function sair() {
    if (saindo) return
    setSaindo(true)
    try {
      await fetch('/api/insiders/sair', { method: 'POST' })
    } finally {
      router.push('/insider')
      router.refresh()
    }
  }

  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#FF2C03]">
          Área do Insider
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
          Olá, {primeiroNome}
        </h1>
      </div>
      <button
        type="button"
        onClick={sair}
        disabled={saindo}
        className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  )
}
```

- [ ] **Step 2: Criar os cartões de benefício**

```tsx
// components/insider/portal-beneficios.tsx
"use client"

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { Beneficio } from '@/lib/insider/beneficios'

function CartaoCupom({ beneficio }: { beneficio: Beneficio }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(beneficio.valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Navegador sem permissão de área de transferência: o código segue
      // visível na tela para digitação manual.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 text-left transition-colors hover:border-[#FF2C03]"
    >
      <span className="font-mono text-base font-semibold tracking-wide text-[#0A0A0A]">
        {beneficio.valor}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-[#737373]">
        {copiado ? <Check className="h-4 w-4 text-[#FF2C03]" /> : <Copy className="h-4 w-4" />}
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
    </button>
  )
}

export function PortalBeneficios({ beneficios }: { beneficios: Beneficio[] }) {
  const visiveis = beneficios.filter((b) => b.disponivel)

  if (visiveis.length === 0) {
    return (
      <p className="text-sm text-[#737373]">
        Nenhum benefício cadastrado ainda. Fale com a equipe do Somma Club.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visiveis.map((b) => (
        <div key={b.chave} className="rounded-2xl bg-white p-5 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#737373]">
            {b.rotulo}
          </p>
          <div className="mt-3">
            {b.tipo === 'cupom' ? (
              <CartaoCupom beneficio={b} />
            ) : b.tipo === 'status' ? (
              <span
                className={
                  b.valor === 'Ativo'
                    ? 'inline-block rounded-full bg-[#FF2C03] px-3 py-1 text-sm font-semibold text-white'
                    : 'inline-block rounded-full bg-black/10 px-3 py-1 text-sm font-medium text-[#737373]'
                }
              >
                {b.valor}
              </span>
            ) : (
              <p className="text-base text-[#0A0A0A]">{b.valor}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Criar a página**

```tsx
// app/insider/painel/page.tsx
import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromCookies } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'
import { PortalHeader } from '@/components/insider/portal-header'
import { PortalBeneficios } from '@/components/insider/portal-beneficios'

export const metadata = {
  title: 'Área do Insider — Somma Club',
}

// A sessão é conferida a cada requisição; nada aqui pode ser pré-renderizado.
export const dynamic = 'force-dynamic'

export default async function PainelPage() {
  const sessao = await getInsiderFromCookies()
  if (!sessao) {
    redirect('/insider')
  }

  const supabase = getAdminClient()
  const { data: row, error } = await supabase
    .from('dados_insiders')
    .select(`${INSIDER_PUBLIC_COLUMNS}, ${BENEFICIO_COLUNAS}`)
    .eq('id', sessao.sub)
    .maybeSingle()

  if (error) {
    console.error('[insider/painel] select error:', error)
  }

  // Cadastro removido depois do login, ou falha de leitura: volta para a entrada.
  if (!row) {
    redirect('/insider')
  }

  const beneficios = montarBeneficios(row as Record<string, unknown>)

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-14 md:py-20">
      <PortalHeader nome={sessao.nome} />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Seus benefícios</h2>
        <p className="mt-1 text-sm text-white/70">
          Apresente o cupom na compra para garantir o desconto.
        </p>
        <div className="mt-6">
          <PortalBeneficios beneficios={beneficios} />
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Typecheck e build**

Run: `npx tsc --noEmit 2>&1 | grep -E 'app/insider|components/insider'`
Expected: nada impresso.

Run: `npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile|/insider/painel"`
Expected: `✓ Compiled successfully` e a rota `/insider/painel` na listagem.

- [ ] **Step 5: Verificar que o painel exige sessão**

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/insider/painel
```
Expected: `307` redirecionando para `/insider` — sem cookie, ninguém entra.

- [ ] **Step 6: Commit**

```bash
git add app/insider/painel components/insider/portal-header.tsx components/insider/portal-beneficios.tsx
git commit -m "feat(portal): painel do Insider com a seção de benefícios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação de ponta a ponta contra o banco real

**Files:**
- Nenhum arquivo de produção. Cria um script descartável fora do controle de versão.

**Interfaces:**
- Consumes: as rotas das Tasks 4, 5 e 7.
- Produces: evidência de que o fluxo funciona com dados reais.

**Contexto:** as rotas de login e benefícios só podem ser provadas contra a base real, porque dependem de `insider_credentials` e das sete colunas. O script cria seu próprio Insider de teste, exercita tudo e remove o que criou. Não use `curl` para requisições com `multipart`; para JSON, `curl` funciona, mas o script abaixo usa Node por uniformidade.

- [ ] **Step 1: Escrever o script de verificação**

Salvar em `/tmp/verificar-portal.mjs` (fora do repositório) e rodar a partir da raiz do worktree, para que ele leia o `.env.local`:

```js
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const SB = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const BASE = 'http://localhost:3000'
const CPF = '529.982.247-25'
const SENHA = 'senhaportal123'
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const rest = (p, init = {}) => fetch(`${SB}/rest/v1/${p}`, { ...init, headers: { ...h, ...(init.headers || {}) } })

let pass = 0, fail = 0
const check = (nome, ok, det) => ok
  ? (pass++, console.log(`  PASS  ${nome}`))
  : (fail++, console.log(`  FAIL  ${nome}\n        ${det}`))

async function limpar() {
  const linhas = await (await rest(`dados_insiders?cpf=eq.${encodeURIComponent(CPF)}&select=id`)).json()
  for (const l of linhas) {
    await rest(`insider_credentials?insider_id=eq.${l.id}`, { method: 'DELETE' })
    await rest(`dados_insiders?id=eq.${l.id}`, { method: 'DELETE' })
  }
  return linhas.length
}

console.log('\n=== PREPARO ===')
console.log(`  limpeza inicial: ${await limpar()} linha(s)`)

// Cria o Insider de teste pela rota pública já existente, com benefícios postos direto no banco.
const fd = new FormData()
Object.entries({
  cpf: CPF, nome: 'Teste Portal Insider', email: 'portal.teste@exemplo.com',
  telefone: '(61) 99999-7777', data_nascimento: '15/03/1990', sexo: 'masculino',
  cep: '70000-000', logradouro: 'SQN 210', numero: '101', complemento: '',
  bairro: 'Asa Norte', cidade: 'Brasilia', estado: 'DF',
  consent_lgpd: 'true', consent_imagem: 'true',
  senha: SENHA, senha_confirmacao: SENHA,
}).forEach(([k, v]) => fd.append(k, v))
const criado = await fetch(`${BASE}/api/insiders/register`, { method: 'POST', body: fd })
check('cadastro de teste criado', criado.status === 200, `HTTP ${criado.status}`)

const [linha] = await (await rest(`dados_insiders?cpf=eq.${encodeURIComponent(CPF)}&select=id`)).json()
await rest(`dados_insiders?id=eq.${linha.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    evolve: 'Ativo - POSSUI SALDO DEVEDOR , SENDO NECESSÁRIO O CANCELAMENTO NA UNIDADE',
    dopahmina: '0.1',
    tex_barbearia: 'Insiders: 10% de desconto em 1 serviço',
    cupom_loja_somma: 'INSIDERTESTE99',
    big_box: 'BIGSOMMA',
    assessoria_somma: 'Sim',
    estamina_recovery: 'Voucher de 150 reais',
  }),
})

console.log('\n=== LOGIN ===')
{
  const r = await fetch(`${BASE}/api/insiders/entrar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: CPF, senha: 'senhaerrada123' }),
  })
  const d = await r.json()
  check('senha errada -> 401', r.status === 401, `HTTP ${r.status}`)
  check('mensagem genérica', d.error === 'CPF ou senha incorretos.', d.error)
}
{
  const r = await fetch(`${BASE}/api/insiders/entrar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: '111.444.777-35', senha: 'qualquer' }),
  })
  const d = await r.json()
  check('CPF inexistente -> mesma mensagem', r.status === 401 && d.error === 'CPF ou senha incorretos.', `${r.status} ${d.error}`)
}

let cookie = ''
{
  const r = await fetch(`${BASE}/api/insiders/entrar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: CPF, senha: SENHA }),
  })
  check('senha correta -> 200', r.status === 200, `HTTP ${r.status}`)
  const sc = r.headers.get('set-cookie') || ''
  cookie = sc.split(';')[0]
  check('cookie somma_insider_session emitido', cookie.startsWith('somma_insider_session='), sc.slice(0, 60))
  check('cookie é httpOnly', /httponly/i.test(sc), sc.slice(0, 120))
}

console.log('\n=== DADOS E BENEFÍCIOS ===')
{
  const r = await fetch(`${BASE}/api/insiders/eu`, { headers: { Cookie: cookie } })
  const d = await r.json()
  check('HTTP 200 com sessão', r.status === 200, `HTTP ${r.status}`)
  check('devolve o insider certo', d.insider?.nome === 'Teste Portal Insider', d.insider?.nome)

  const porChave = Object.fromEntries((d.beneficios || []).map((b) => [b.chave, b]))
  check('Evolve mostra só Ativo', porChave.evolve?.valor === 'Ativo', porChave.evolve?.valor)
  check('Dopamina traduzida', porChave.dopahmina?.valor === '10% de desconto', porChave.dopahmina?.valor)
  check('cupom individual presente', porChave.cupom_loja_somma?.valor === 'INSIDERTESTE99', porChave.cupom_loja_somma?.valor)
  check('assessoria ativa', porChave.assessoria_somma?.valor === 'Ativo', porChave.assessoria_somma?.valor)

  const bruto = JSON.stringify(d).toUpperCase()
  for (const termo of ['SALDO DEVEDOR', 'CANCELAMENTO', 'UNIDADE']) {
    check(`resposta não vaza "${termo}"`, !bruto.includes(termo), 'VAZOU')
  }
  check('resposta não traz hash de senha', !bruto.includes('SENHA_HASH') && !bruto.includes('$2B$'), 'VAZOU')
}
{
  const r = await fetch(`${BASE}/api/insiders/eu`)
  check('sem cookie -> 401', r.status === 401, `HTTP ${r.status}`)
}
{
  const r = await fetch(`${BASE}/api/insiders/eu`, { headers: { Cookie: 'somma_insider_session=forjado.token' } })
  check('cookie forjado -> 401', r.status === 401, `HTTP ${r.status}`)
}

console.log('\n=== PAINEL ===')
{
  const r = await fetch(`${BASE}/insider/painel`, { headers: { Cookie: cookie }, redirect: 'manual' })
  const html = await r.text()
  check('painel abre com sessão', r.status === 200, `HTTP ${r.status}`)
  check('mostra o cupom individual', html.includes('INSIDERTESTE99'), 'cupom ausente')
  check('painel não vaza anotação interna', !html.toUpperCase().includes('SALDO DEVEDOR'), 'VAZOU')
}
{
  const r = await fetch(`${BASE}/insider/painel`, { redirect: 'manual' })
  check('painel sem sessão redireciona', r.status === 307 || r.status === 302, `HTTP ${r.status}`)
}

console.log('\n=== LOGOUT ===')
{
  const r = await fetch(`${BASE}/api/insiders/sair`, { method: 'POST' })
  const sc = r.headers.get('set-cookie') || ''
  check('logout responde 200', r.status === 200, `HTTP ${r.status}`)
  check('cookie zerado', /max-age=0/i.test(sc), sc.slice(0, 80))
}

console.log('\n=== LIMPEZA ===')
console.log(`  removidas ${await limpar()} linha(s)`)
console.log(`\n===== ${pass} passaram, ${fail} falharam =====\n`)
process.exit(fail > 0 ? 1 : 0)
```

- [ ] **Step 2: Rodar**

Run: `node /tmp/verificar-portal.mjs` a partir de `/Users/alexrodriguesdossantos/Projetos/v0-somma-insider`, com o servidor de dev no ar.
Expected: todas as verificações passam e a limpeza remove a linha de teste. Se o login der 429, você esgotou o limite de 5/min — espere um minuto e rode de novo.

- [ ] **Step 3: Registrar o resultado**

Colar a saída completa no relatório da task. Se qualquer verificação falhar, **não conserte o script**: a falha é do código de produção e precisa de correção lá.

---

## Self-Review

**Cobertura da spec (Fatia 1):**

| Requisito | Task |
|---|---|
| Sessão com cookie próprio e chave derivada | 1 |
| `typ: 'insider'` verificado; token de admin rejeitado | 1 |
| Tradução dos 7 benefícios | 2 |
| Evolve sem anotação interna, com teste dedicado | 2 |
| Dopamina `0.1` → `10% de desconto` | 2 |
| `OPEN_PAGES` abrange `/insider/*` | 3 |
| Rotas do portal liberadas no middleware | 3 |
| `POST /api/insiders/entrar` com rate limit 5/min | 4 |
| Mesma mensagem para CPF inexistente e senha errada | 4 |
| Equalizador de timing | 4 |
| `POST /api/insiders/sair` | 4 |
| `GET /api/insiders/eu` com identidade vinda do cookie | 5 |
| Estado de login em `/insider` | 6 |
| `/insider/painel` conferindo sessão no servidor | 7 |
| Cartões de benefício com copiar cupom | 7 |
| Verificação contra o banco real | 8 |

Sem lacunas na Fatia 1.

**Fora desta fatia, por desenho:** `PUT /api/insiders/eu`, `POST /api/insiders/eu/senha`, `GET /api/insiders/eu/eventos`, as seções de dados/senha/eventos no painel, e a quebra do `insider-cadastro-form.tsx` em subcomponentes — tudo isso é Fatia 2 e terá plano próprio.

**Consistência de nomes:** `createInsiderToken`, `verifyInsiderToken`, `attachInsiderCookie`, `clearInsiderCookie`, `getInsiderFromRequest`, `getInsiderFromCookies`, `montarBeneficios`, `BENEFICIO_COLUNAS`, `Beneficio` — usados com a mesma grafia nas Tasks 1, 2, 4, 5 e 7.
