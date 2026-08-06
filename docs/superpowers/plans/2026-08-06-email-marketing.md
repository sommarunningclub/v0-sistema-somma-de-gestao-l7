# Módulo E-mail Marketing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo no painel que monta uma campanha de e-mail a partir de qualquer base do Supabase, escolhe template e CTA pela interface, dispara (agora ou agendado) pela Resend e mostra o status completo do disparo.

**Architecture:** Toda lógica pura (normalização de e-mail, dedup, token de descadastro, verificação Svix, renderização de template, fatiamento de lote) vive em `lib/email/` e é coberta por jest sem tocar rede ou banco. As rotas de API e os componentes ficam finos. O motor de disparo é retomável: uma linha por destinatário com `UNIQUE (campaign_id, email)`, de modo que qualquer interrupção retoma sem reenviar. Tabelas próprias, isoladas das do `1-ano-SommaDay`, que compartilha o mesmo banco.

**Tech Stack:** Next.js 15.5.10 (App Router), React 19.2.0, TypeScript, Tailwind v3, shadcn/ui, zod 3.25.76, recharts 2.15.4, Supabase (service role), Resend (a instalar), jest + jsdom.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-05-email-marketing-design.md`. Em caso de conflito, a spec vence.
- **Nunca** reutilizar as tabelas `email_events`, `lista_vip` ou `app_settings` do `1-ano-SommaDay`. Os dois projetos compartilham o banco `riqfjewvygqsbuokvsjw`; gravar nas tabelas dele duplica eventos e corrompe as métricas dos dois sistemas. Todas as tabelas novas usam o prefixo `email_campaign*` / `email_suppressions`.
- **Supressão global é obrigatória em todo disparo**, inclusive no envio de teste. Nenhum caminho de código envia para um endereço presente em `email_suppressions`.
- Todo e-mail em massa carrega os cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click` e um link de descadastro no rodapé.
- **Webhook fail-closed:** sem `RESEND_WEBHOOK_SECRET` válido, retorna 401. Nunca aceitar requisição não assinada (o `1-ano-SommaDay` faz isso e é um defeito a não herdar).
- E-mails sempre normalizados para minúsculas e sem espaços nas bordas, antes de dedup, supressão e gravação.
- Client Supabase com **service role** criado localmente em cada módulo server-side, no padrão de `lib/services/popups.ts:6`. Nunca importar de `lib/supabase-client.ts` (chave anon).
- zod **3** — usar `.refine()` / `errorMap`, nunca a sintaxe de erro do zod 4.
- Rotas dinâmicas do Next 15: `{ params }: { params: Promise<{ id: string }> }` com `await params`.
- Toda API responde erro como `{ error: string }` com status, mensagem em português, e loga com prefixo `[email-campaigns/<rota>]`, seguindo `app/api/admin/users/route.ts`.
- Funções de service **nunca lançam** — logam com `console.error('[email] fn error:', e)` e retornam `[]` / `null` / `false`. A rota traduz para HTTP.
- Estética: `bg-black`, painéis `bg-neutral-900`, bordas `border-neutral-800`, accent `orange-500`, texto `text-neutral-400`.
- Rodar testes com `npm test`. Commits em português, prefixo `feat:` / `test:` / `chore:` / `fix:`.
- **Não** commitar `.env.local` nem a `RESEND_API_KEY` em nenhum arquivo versionado.

---

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `sql/009-create-email-marketing.sql` | 4 tabelas + índices + RLS |
| `sql/010-add-email-permission.sql` | Backfill da permissão `email` |
| `lib/email/types.ts` | Tipos compartilhados do módulo |
| `lib/email/normalize.ts` | Normalização e dedup de e-mails (puro) |
| `lib/email/audiences.ts` | Registro declarativo das bases + `resolveAudience` |
| `lib/email/suppression.ts` | Leitura e escrita da lista de supressão |
| `lib/email/unsubscribe-token.ts` | Assinatura e verificação HMAC do token (puro) |
| `lib/email/svix.ts` | Verificação de assinatura do webhook (puro) |
| `lib/email/templates/shared.ts` | `escapeHtml`, botão CTA, cabeçalho, rodapé |
| `lib/email/templates/index.ts` | Registro dos 3 templates + `renderTemplate` |
| `lib/email/dispatch.ts` | Motor de disparo retomável |
| `lib/services/email-campaigns.ts` | CRUD e métricas |
| `app/api/email-campaigns/route.ts` | GET lista / POST cria |
| `app/api/email-campaigns/[id]/route.ts` | GET / PATCH / DELETE |
| `app/api/email-campaigns/[id]/preview/route.ts` | HTML renderizado |
| `app/api/email-campaigns/[id]/test/route.ts` | Envio de teste |
| `app/api/email-campaigns/[id]/dispatch/route.ts` | Disparo imediato |
| `app/api/email-campaigns/[id]/cancel/route.ts` | Cancelamento |
| `app/api/email-campaigns/[id]/stats/route.ts` | Métricas |
| `app/api/email-audiences/preview/route.ts` | Contagem ao vivo |
| `app/api/cron/email-campaigns/route.ts` | Agendador |
| `app/api/webhooks/resend/route.ts` | Tracking |
| `app/api/unsubscribe/route.ts` | Descadastro público |
| `app/email-marketing/page.tsx` | Lista de campanhas |
| `app/email-marketing/[id]/page.tsx` | Tela de status |
| `components/email-campaign-card.tsx` | Card da lista |
| `components/email-campaign-modal.tsx` | Wizard de 4 passos |
| `components/email-audience-picker.tsx` | Passo 1 |
| `components/email-content-form.tsx` | Passo 2 |

**Modificar:**

| Arquivo | Mudança |
|---|---|
| `lib/auth/types.ts:1-11` | Chave `email` em `ModulePermissions` |
| `lib/auth/route-permissions.ts:4-11` | `/api/unsubscribe` público |
| `lib/auth/route-permissions.ts:21-35` | `/api/email-` → `email` |
| `lib/auth/page-routes.ts` | 4 registros (labels, permissões, legacy, page) |
| `app/page.tsx` | 5 pontos de integração |
| `app/systems/page.tsx` | `DEFAULT_PERMISSIONS` e `MODULE_LABELS` |
| `vercel.json` | Cron a cada 5 min |
| `package.json` | Dependência `resend` |

---

## Task 1: Migrações SQL e permissão `email`

**Files:**
- Create: `sql/009-create-email-marketing.sql`
- Create: `sql/010-add-email-permission.sql`
- Modify: `lib/auth/types.ts:1-11`
- Modify: `lib/auth/route-permissions.ts:4-11` e `:21-35`
- Modify: `lib/auth/page-routes.ts`

**Interfaces:**
- Produces: tabelas `email_campaigns`, `email_campaign_recipients`, `email_campaign_events`, `email_suppressions`; `PermissionKey` passa a aceitar `'email'`.

- [ ] **Step 1: Criar a migração das tabelas**

Criar `sql/009-create-email-marketing.sql`:

```sql
-- sql/009-create-email-marketing.sql
-- Módulo E-mail Marketing. Tabelas isoladas do 1-ano-SommaDay,
-- que compartilha este mesmo banco.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','agendada','enviando','enviada','cancelada','erro')),
  template_key text NOT NULL,
  subject text NOT NULL,
  preheader text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_label text,
  cta_url text,
  audience jsonb NOT NULL DEFAULT '{"bases":[]}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON public.email_campaigns (scheduled_at);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns (id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text,
  source_base text,
  resend_email_id text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviado','entregue','aberto','clicado','bounce','spam','falha')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ecr_campaign_status ON public.email_campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_ecr_resend_email_id ON public.email_campaign_recipients (resend_email_id);

CREATE TABLE IF NOT EXISTS public.email_campaign_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.email_campaigns (id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.email_campaign_recipients (id) ON DELETE SET NULL,
  email text,
  resend_email_id text,
  type text NOT NULL,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ece_campaign_id ON public.email_campaign_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ece_resend_email_id ON public.email_campaign_events (resend_email_id);
CREATE INDEX IF NOT EXISTS idx_ece_type ON public.email_campaign_events (type);

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  campaign_id uuid REFERENCES public.email_campaigns (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON public.email_suppressions (email);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access email_campaigns" ON public.email_campaigns;
CREATE POLICY "Service role full access email_campaigns" ON public.email_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_campaign_recipients" ON public.email_campaign_recipients;
CREATE POLICY "Service role full access email_campaign_recipients" ON public.email_campaign_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_campaign_events" ON public.email_campaign_events;
CREATE POLICY "Service role full access email_campaign_events" ON public.email_campaign_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_suppressions" ON public.email_suppressions;
CREATE POLICY "Service role full access email_suppressions" ON public.email_suppressions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Criar a migração da permissão**

Criar `sql/010-add-email-permission.sql`, no molde exato de `sql/007-add-popups-permission.sql`:

```sql
-- sql/010-add-email-permission.sql

UPDATE users
SET permissions = permissions || '{"email": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'email');

UPDATE users
SET permissions = permissions || '{"email": true}'::jsonb
WHERE role = 'admin';
```

- [ ] **Step 3: Aplicar as duas migrações no Supabase**

Rodar o conteúdo dos dois arquivos no SQL Editor do projeto `riqfjewvygqsbuokvsjw`, nesta ordem.

Verificar: `select count(*) from email_campaigns;` deve retornar `0` sem erro.

- [ ] **Step 4: Adicionar a chave de permissão**

Em `lib/auth/types.ts`, adicionar `email` após `popups`:

```ts
export interface ModulePermissions {
  dashboard: boolean
  checkin: boolean
  membros: boolean
  parceiro: boolean
  pagamentos: boolean
  crm: boolean
  tarefas: boolean
  popups: boolean
  email: boolean
  admin: boolean
}
```

- [ ] **Step 5: Registrar as rotas no controle de acesso**

Em `lib/auth/route-permissions.ts`, adicionar ao array `PUBLIC_API_ROUTES` (o descadastro é acessado por quem não tem sessão — sem isso retorna 401):

```ts
  { pattern: /^\/api\/unsubscribe$/ },
```

E ao array `ROUTE_PERMISSIONS`, após a entrada de `popups`:

```ts
  { pattern: /^\/api\/email-/, permission: 'email' },
```

- [ ] **Step 6: Registrar as rotas de página**

Em `lib/auth/page-routes.ts`, quatro adições:

```ts
// SECTION_LABELS
  email: 'E-mail Marketing',

// SECTION_PERMISSIONS
  email: 'email',

// LEGACY_EXACT
  '/email-marketing': '/?section=email',

// PAGE_PERMISSIONS
  { pattern: /^\/email-marketing/, permission: 'email' },
```

- [ ] **Step 7: Verificar que o projeto compila**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo. Se `app/systems/page.tsx` acusar falta da chave `email`, é esperado — será resolvido na Task 12.

- [ ] **Step 8: Commit**

```bash
git add sql/009-create-email-marketing.sql sql/010-add-email-permission.sql lib/auth/types.ts lib/auth/route-permissions.ts lib/auth/page-routes.ts
git commit -m "feat(email): tabelas do módulo de e-mail marketing e permissão"
```

---

## Task 2: Normalização e dedup de e-mails

**Files:**
- Create: `lib/email/normalize.ts`
- Test: `lib/email/__tests__/normalize.test.ts`

**Interfaces:**
- Produces:
  - `normalizeEmail(value: unknown): string | null`
  - `interface Recipient { email: string; nome: string | null; sourceBase: string }`
  - `dedupeRecipients(lists: Recipient[][]): Recipient[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/email/__tests__/normalize.test.ts`:

```ts
import { normalizeEmail, dedupeRecipients } from '../normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Joao@Example.COM ')).toBe('joao@example.com')
  })

  it('rejects values without @', () => {
    expect(normalizeEmail('joao')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })

  it('rejects malformed addresses', () => {
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('@example.com')).toBeNull()
    expect(normalizeEmail('joao@@example.com')).toBeNull()
    expect(normalizeEmail('joao @example.com')).toBeNull()
  })

  it('accepts a normal address', () => {
    expect(normalizeEmail('joao.silva+tag@example.com.br')).toBe('joao.silva+tag@example.com.br')
  })
})

describe('dedupeRecipients', () => {
  it('keeps the first occurrence across lists', () => {
    const result = dedupeRecipients([
      [{ email: 'a@x.com', nome: 'Ana', sourceBase: 'membros' }],
      [{ email: 'a@x.com', nome: 'Ana Maria', sourceBase: 'checkins' }],
    ])
    expect(result).toHaveLength(1)
    expect(result[0].sourceBase).toBe('membros')
    expect(result[0].nome).toBe('Ana')
  })

  it('dedupes within a single list', () => {
    const result = dedupeRecipients([
      [
        { email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' },
        { email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' },
        { email: 'b@x.com', nome: 'Bia', sourceBase: 'checkins' },
      ],
    ])
    expect(result.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com'])
  })

  it('normalizes before comparing', () => {
    const result = dedupeRecipients([
      [{ email: ' A@X.com ', nome: 'Ana', sourceBase: 'membros' }],
      [{ email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' }],
    ])
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('a@x.com')
  })

  it('drops invalid addresses', () => {
    const result = dedupeRecipients([
      [
        { email: 'sem-arroba', nome: null, sourceBase: 'membros' },
        { email: 'ok@x.com', nome: null, sourceBase: 'membros' },
      ],
    ])
    expect(result.map((r) => r.email)).toEqual(['ok@x.com'])
  })

  it('returns empty for empty input', () => {
    expect(dedupeRecipients([])).toEqual([])
    expect(dedupeRecipients([[], []])).toEqual([])
  })

  it('preserves nome null', () => {
    const result = dedupeRecipients([[{ email: 'a@x.com', nome: null, sourceBase: 'membros' }]])
    expect(result[0].nome).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/normalize.test.ts`
Expected: FAIL — `Cannot find module '../normalize'`

- [ ] **Step 3: Implementar**

Criar `lib/email/normalize.ts`:

```ts
export interface Recipient {
  email: string
  nome: string | null
  sourceBase: string
}

/** Aceita apenas endereços plausíveis: algo@algo.tld, sem espaços. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return null
  return normalized
}

/**
 * Une várias listas de destinatários preservando a PRIMEIRA ocorrência de cada
 * e-mail. A ordem das listas define a prioridade de `sourceBase`.
 */
export function dedupeRecipients(lists: Recipient[][]): Recipient[] {
  const seen = new Set<string>()
  const out: Recipient[] = []

  for (const list of lists) {
    for (const item of list) {
      const email = normalizeEmail(item.email)
      if (!email || seen.has(email)) continue
      seen.add(email)
      out.push({ email, nome: item.nome, sourceBase: item.sourceBase })
    }
  }

  return out
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/normalize.test.ts`
Expected: PASS — 11 testes

- [ ] **Step 5: Commit**

```bash
git add lib/email/normalize.ts lib/email/__tests__/normalize.test.ts
git commit -m "feat(email): normalização e dedup de e-mails"
```

---

## Task 3: Token de descadastro assinado

**Files:**
- Create: `lib/email/unsubscribe-token.ts`
- Test: `lib/email/__tests__/unsubscribe-token.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `signUnsubscribeToken(email: string, campaignId: string | null, secret: string): string`
  - `verifyUnsubscribeToken(token: string, secret: string): { email: string; campaignId: string | null } | null`

O `1-ano-SommaDay` usa o ID do lead cru na URL, o que permite descadastrar terceiros iterando IDs. O token assinado elimina isso.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/email/__tests__/unsubscribe-token.test.ts`:

```ts
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../unsubscribe-token'

const SECRET = 'segredo-de-teste'

describe('unsubscribe token', () => {
  it('round-trips email and campaignId', () => {
    const token = signUnsubscribeToken('joao@x.com', 'camp-1', SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      email: 'joao@x.com',
      campaignId: 'camp-1',
    })
  })

  it('round-trips with null campaignId', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      email: 'joao@x.com',
      campaignId: null,
    })
  })

  it('normalizes the email before signing', () => {
    const token = signUnsubscribeToken('  Joao@X.COM ', null, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)?.email).toBe('joao@x.com')
  })

  it('rejects a token signed with another secret', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    expect(verifyUnsubscribeToken(token, 'outro-segredo')).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    const [payload, sig] = token.split('.')
    const forged = Buffer.from('{"e":"vitima@x.com","c":null}').toString('base64url')
    expect(verifyUnsubscribeToken(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(payload).toBeTruthy()
  })

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('sem-ponto', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('!!!.???', SECRET)).toBeNull()
  })

  it('produces url-safe tokens', () => {
    const token = signUnsubscribeToken('joao+tag@x.com', 'camp-1', SECRET)
    expect(token).toBe(encodeURIComponent(token))
  })

  it('rejects an invalid email at signing time', () => {
    expect(() => signUnsubscribeToken('sem-arroba', null, SECRET)).toThrow()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/unsubscribe-token.test.ts`
Expected: FAIL — `Cannot find module '../unsubscribe-token'`

- [ ] **Step 3: Implementar**

Criar `lib/email/unsubscribe-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto'
import { normalizeEmail } from './normalize'

interface TokenPayload {
  e: string
  c: string | null
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signUnsubscribeToken(
  email: string,
  campaignId: string | null,
  secret: string,
): string {
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error(`E-mail inválido para token de descadastro: ${email}`)

  const body: TokenPayload = { e: normalized, c: campaignId }
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): { email: string; campaignId: string | null } | null {
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = sign(payload, secret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload
    const email = normalizeEmail(body.e)
    if (!email) return null
    return { email, campaignId: typeof body.c === 'string' ? body.c : null }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/unsubscribe-token.test.ts`
Expected: PASS — 8 testes

- [ ] **Step 5: Commit**

```bash
git add lib/email/unsubscribe-token.ts lib/email/__tests__/unsubscribe-token.test.ts
git commit -m "feat(email): token de descadastro assinado com HMAC"
```

---

## Task 4: Verificação de assinatura do webhook (Svix)

**Files:**
- Create: `lib/email/svix.ts`
- Test: `lib/email/__tests__/svix.test.ts`

**Interfaces:**
- Produces: `verifySvixSignature(args: { secret: string | undefined; id: string | null; timestamp: string | null; signature: string | null; body: string; nowMs?: number }): boolean`

A Resend assina via Svix. O `1-ano-SommaDay` implementa isso sem a lib, mas **retorna `true` quando o secret está ausente** e não valida o timestamp. Aqui é fail-closed e com janela anti-replay de 5 minutos.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/email/__tests__/svix.test.ts`:

```ts
import { createHmac } from 'crypto'
import { verifySvixSignature } from '../svix'

const SECRET = `whsec_${Buffer.from('chave-secreta-do-webhook').toString('base64')}`
const ID = 'msg_123'
const BODY = '{"type":"email.delivered"}'
const NOW_MS = 1_700_000_000_000
const TS = String(Math.floor(NOW_MS / 1000))

function validSignature(id = ID, ts = TS, body = BODY, secret = SECRET): string {
  const bytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', bytes).update(`${id}.${ts}.${body}`).digest('base64')
  return `v1,${mac}`
}

const base = { secret: SECRET, id: ID, timestamp: TS, body: BODY, nowMs: NOW_MS }

describe('verifySvixSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySvixSignature({ ...base, signature: validSignature() })).toBe(true)
  })

  it('accepts when one of several space-separated signatures matches', () => {
    const sig = `v1,invalido ${validSignature()}`
    expect(verifySvixSignature({ ...base, signature: sig })).toBe(true)
  })

  it('is fail-closed when the secret is missing', () => {
    expect(verifySvixSignature({ ...base, secret: undefined, signature: validSignature() })).toBe(false)
    expect(verifySvixSignature({ ...base, secret: '', signature: validSignature() })).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(verifySvixSignature({ ...base, signature: null })).toBe(false)
    expect(verifySvixSignature({ ...base, id: null, signature: validSignature() })).toBe(false)
    expect(verifySvixSignature({ ...base, timestamp: null, signature: validSignature() })).toBe(false)
  })

  it('rejects a tampered body', () => {
    const sig = validSignature()
    expect(verifySvixSignature({ ...base, body: '{"type":"email.bounced"}', signature: sig })).toBe(false)
  })

  it('rejects a signature from another secret', () => {
    const other = `whsec_${Buffer.from('outra-chave').toString('base64')}`
    expect(verifySvixSignature({ ...base, signature: validSignature(ID, TS, BODY, other) })).toBe(false)
  })

  it('rejects a timestamp outside the 5 minute window', () => {
    const oldTs = String(Math.floor(NOW_MS / 1000) - 400)
    expect(
      verifySvixSignature({ ...base, timestamp: oldTs, signature: validSignature(ID, oldTs) }),
    ).toBe(false)

    const futureTs = String(Math.floor(NOW_MS / 1000) + 400)
    expect(
      verifySvixSignature({ ...base, timestamp: futureTs, signature: validSignature(ID, futureTs) }),
    ).toBe(false)
  })

  it('accepts a timestamp just inside the window', () => {
    const ts = String(Math.floor(NOW_MS / 1000) - 250)
    expect(verifySvixSignature({ ...base, timestamp: ts, signature: validSignature(ID, ts) })).toBe(true)
  })

  it('rejects a non-numeric timestamp', () => {
    expect(verifySvixSignature({ ...base, timestamp: 'abc', signature: validSignature(ID, 'abc') })).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/svix.test.ts`
Expected: FAIL — `Cannot find module '../svix'`

- [ ] **Step 3: Implementar**

Criar `lib/email/svix.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto'

/** Janela anti-replay, em segundos. */
const TOLERANCE_SECONDS = 300

interface VerifyArgs {
  secret: string | undefined
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  nowMs?: number
}

/**
 * Verifica a assinatura Svix usada pelos webhooks da Resend.
 * Fail-closed: sem secret, sem cabeçalho ou fora da janela de tempo, rejeita.
 */
export function verifySvixSignature({
  secret,
  id,
  timestamp,
  signature,
  body,
  nowMs = Date.now(),
}: VerifyArgs): boolean {
  if (!secret) return false
  if (!id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Math.floor(nowMs / 1000) - ts) > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  const expectedBuf = Buffer.from(expected)

  // O cabeçalho pode trazer várias assinaturas separadas por espaço, no formato "v1,<base64>".
  return signature.split(' ').some((part) => {
    const value = part.includes(',') ? part.split(',')[1] : part
    if (!value) return false
    const actual = Buffer.from(value)
    return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf)
  })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/svix.test.ts`
Expected: PASS — 9 testes

- [ ] **Step 5: Commit**

```bash
git add lib/email/svix.ts lib/email/__tests__/svix.test.ts
git commit -m "feat(email): verificação fail-closed da assinatura Svix"
```

---

## Task 5: Templates de e-mail

**Files:**
- Create: `lib/email/templates/shared.ts`
- Create: `lib/email/templates/index.ts`
- Test: `lib/email/__tests__/templates.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `escapeHtml(value: string): string`
  - `TEMPLATE_KEYS: readonly ['anuncio','simples','evento']`
  - `type TemplateKey = 'anuncio' | 'simples' | 'evento'`
  - `interface TemplateFields { titulo: string; texto: string; imagem_url?: string; data?: string; local?: string }`
  - `renderTemplate(args: { templateKey: TemplateKey; subject: string; preheader?: string | null; content: TemplateFields; ctaLabel?: string | null; ctaUrl?: string | null; nome: string | null; unsubscribeUrl: string }): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/email/__tests__/templates.test.ts`:

```ts
import { escapeHtml, renderTemplate, TEMPLATE_KEYS } from '../templates'

const base = {
  subject: 'Assunto',
  preheader: 'Prévia',
  content: { titulo: 'Título', texto: 'Primeira linha.\n\nSegunda linha.' },
  ctaLabel: 'Quero participar',
  ctaUrl: 'https://sommaclub.com.br/evento',
  nome: 'Ana',
  unsubscribeUrl: 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc',
}

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;',
    )
  })
})

describe('renderTemplate', () => {
  it('exposes the three templates', () => {
    expect(TEMPLATE_KEYS).toEqual(['anuncio', 'simples', 'evento'])
  })

  it.each(TEMPLATE_KEYS)('renders %s with the CTA and the unsubscribe link', (templateKey) => {
    const html = renderTemplate({ ...base, templateKey })

    expect(html).toContain('Quero participar')
    expect(html).toContain('https://sommaclub.com.br/evento')
    expect(html).toContain(base.unsubscribeUrl)
    expect(html).toContain('Título')
    expect(html).toContain('Prévia')
  })

  it('interpolates {{nome}}', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      content: { titulo: 'Oi {{nome}}', texto: 'Tudo bem, {{nome}}?' },
    })
    expect(html).toContain('Oi Ana')
    expect(html).toContain('Tudo bem, Ana?')
    expect(html).not.toContain('{{nome}}')
  })

  it('falls back when nome is null', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      nome: null,
      content: { titulo: 'Oi {{nome}}', texto: 'texto' },
    })
    expect(html).toContain('Oi ')
    expect(html).not.toContain('{{nome}}')
    expect(html).not.toContain('null')
  })

  it('escapes user content', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      content: { titulo: '<script>alert(1)</script>', texto: 'ok' },
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes the name too', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      nome: '<b>Ana</b>',
      content: { titulo: 'Oi {{nome}}', texto: 'ok' },
    })
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
  })

  it('turns blank lines into paragraphs', () => {
    const html = renderTemplate({ ...base, templateKey: 'simples' })
    expect(html).toContain('Primeira linha.')
    expect(html).toContain('Segunda linha.')
    expect((html.match(/<p /g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('omits the CTA when label or url is missing', () => {
    const semLabel = renderTemplate({ ...base, templateKey: 'simples', ctaLabel: null })
    expect(semLabel).not.toContain('https://sommaclub.com.br/evento')

    const semUrl = renderTemplate({ ...base, templateKey: 'simples', ctaUrl: null })
    expect(semUrl).not.toContain('Quero participar')
  })

  it('renders the image only on templates that support it', () => {
    const content = { titulo: 'T', texto: 'x', imagem_url: 'https://cdn.x/img.png' }
    expect(renderTemplate({ ...base, templateKey: 'anuncio', content })).toContain('https://cdn.x/img.png')
    expect(renderTemplate({ ...base, templateKey: 'simples', content })).not.toContain('https://cdn.x/img.png')
  })

  it('renders date and place on the evento template', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'evento',
      content: { titulo: 'T', texto: 'x', data: '12/09 às 7h', local: 'Parque da Cidade' },
    })
    expect(html).toContain('12/09 às 7h')
    expect(html).toContain('Parque da Cidade')
  })

  it('always produces a full html document', () => {
    const html = renderTemplate({ ...base, templateKey: 'anuncio' })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('</html>')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/templates.test.ts`
Expected: FAIL — `Cannot find module '../templates'`

- [ ] **Step 3: Implementar os blocos compartilhados**

Criar `lib/email/templates/shared.ts`:

```ts
export const COLORS = {
  black: '#0a0a0a',
  white: '#ffffff',
  orange: '#f97316',
  gray: '#737373',
  border: '#e5e5e5',
} as const

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Substitui {{nome}} e escapa tudo. Sem nome, o placeholder vira string vazia. */
export function interpolate(text: string, nome: string | null): string {
  const safeNome = nome ? escapeHtml(nome) : ''
  return escapeHtml(text).replace(/\{\{\s*nome\s*\}\}/g, safeNome)
}

/** Quebra o texto em parágrafos por linha em branco. */
export function paragraphs(text: string, nome: string | null): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLORS.black};">${interpolate(
          block,
          nome,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('')
}

export function ctaButton(label: string | null | undefined, url: string | null | undefined): string {
  if (!label || !url) return ''
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-radius:6px;background-color:${COLORS.orange};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${COLORS.white};text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>`
}

export function heroImage(url: string | null | undefined): string {
  if (!url) return ''
  return `<img src="${escapeHtml(url)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;margin:0 0 24px;" />`
}

export function preheaderBlock(preheader: string | null | undefined): string {
  if (!preheader) return ''
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
}

export function footer(unsubscribeUrl: string): string {
  return `
    <hr style="border:0;border-top:1px solid ${COLORS.border};margin:32px 0 16px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.gray};">
      Você recebeu este e-mail porque faz parte da base do Somma Running Club.<br />
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.gray};text-decoration:underline;">Não quero mais receber estes e-mails</a>
    </p>`
}

export function document(inner: string, subject: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:${COLORS.white};border-radius:8px;padding:32px;font-family:Helvetica,Arial,sans-serif;">
<tr><td>${inner}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
```

- [ ] **Step 4: Implementar o registro dos templates**

Criar `lib/email/templates/index.ts`:

```ts
import {
  COLORS,
  ctaButton,
  document,
  escapeHtml,
  footer,
  heroImage,
  interpolate,
  paragraphs,
  preheaderBlock,
} from './shared'

export { escapeHtml }

export const TEMPLATE_KEYS = ['anuncio', 'simples', 'evento'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export interface TemplateFields {
  titulo: string
  texto: string
  imagem_url?: string
  data?: string
  local?: string
}

export interface RenderArgs {
  templateKey: TemplateKey
  subject: string
  preheader?: string | null
  content: TemplateFields
  ctaLabel?: string | null
  ctaUrl?: string | null
  nome: string | null
  unsubscribeUrl: string
}

function title(text: string, nome: string | null): string {
  return `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:${COLORS.black};">${interpolate(text, nome)}</h1>`
}

function metaRow(label: string, value: string | undefined): string {
  if (!value) return ''
  return `<tr>
    <td style="padding:4px 12px 4px 0;font-size:14px;color:${COLORS.gray};">${escapeHtml(label)}</td>
    <td style="padding:4px 0;font-size:14px;font-weight:700;color:${COLORS.black};">${escapeHtml(value)}</td>
  </tr>`
}

export function renderTemplate(args: RenderArgs): string {
  const { templateKey, subject, preheader, content, ctaLabel, ctaUrl, nome, unsubscribeUrl } = args

  let body = ''

  if (templateKey === 'anuncio') {
    body = [
      heroImage(content.imagem_url),
      title(content.titulo, nome),
      paragraphs(content.texto, nome),
      ctaButton(ctaLabel, ctaUrl),
    ].join('')
  } else if (templateKey === 'simples') {
    body = [title(content.titulo, nome), paragraphs(content.texto, nome), ctaButton(ctaLabel, ctaUrl)].join('')
  } else {
    const meta =
      content.data || content.local
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${metaRow('Quando', content.data)}${metaRow('Onde', content.local)}</table>`
        : ''
    body = [
      heroImage(content.imagem_url),
      title(content.titulo, nome),
      meta,
      paragraphs(content.texto, nome),
      ctaButton(ctaLabel, ctaUrl),
    ].join('')
  }

  return document(preheaderBlock(preheader) + body + footer(unsubscribeUrl), subject)
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/templates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/email/templates lib/email/__tests__/templates.test.ts
git commit -m "feat(email): três templates de e-mail com CTA e descadastro"
```

---

## Task 6: Registro de audiências e resolução

**Files:**
- Create: `lib/email/types.ts`
- Create: `lib/email/audiences.ts`
- Test: `lib/email/__tests__/audiences.test.ts`

**Interfaces:**
- Consumes: `Recipient`, `dedupeRecipients` (Task 2).
- Produces:
  - `filterSuppressed(recipients: Recipient[]): Promise<Recipient[]>`
  - `isSuppressed(email: string): Promise<boolean>`
  - `addSuppression(email: string, reason: 'unsubscribe'|'bounce'|'complaint'|'manual', campaignId?: string | null): Promise<boolean>`
  - `AUDIENCE_SOURCES: Record<AudienceKey, AudienceSource>`
  - `type AudienceKey = 'membros' | 'checkins' | 'lista_vip' | 'lista_espera'`
  - `interface AudienceSelection { bases: Array<{ key: AudienceKey; filtros: Record<string, string> }> }`
  - `buildAudienceQuery(source: AudienceSource, filtros: Record<string, string>): { table: string; select: string; eq: Array<[string, string]> }`
  - `resolveAudience(selection: AudienceSelection): Promise<Recipient[]>`

Os filtros são por base, não globais. A união é feita **depois** de filtrar cada base e antes da supressão.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/email/__tests__/audiences.test.ts`. Testa apenas a parte pura — o registro e a montagem da consulta:

```ts
import { AUDIENCE_SOURCES, buildAudienceQuery, isAudienceKey } from '../audiences'

describe('AUDIENCE_SOURCES', () => {
  it('declares the four bases from the spec', () => {
    expect(Object.keys(AUDIENCE_SOURCES).sort()).toEqual(
      ['checkins', 'lista_espera', 'lista_vip', 'membros'].sort(),
    )
  })

  it('maps each base to its real table and columns', () => {
    expect(AUDIENCE_SOURCES.membros.table).toBe('cadastro_site')
    expect(AUDIENCE_SOURCES.membros.nameCol).toBe('nome_completo')

    expect(AUDIENCE_SOURCES.checkins.table).toBe('checkins')
    expect(AUDIENCE_SOURCES.checkins.nameCol).toBe('nome_completo')

    expect(AUDIENCE_SOURCES.lista_vip.table).toBe('lista_vip')
    expect(AUDIENCE_SOURCES.lista_vip.nameCol).toBe('nome')

    expect(AUDIENCE_SOURCES.lista_espera.table).toBe('lista_vip_assessoria')
    expect(AUDIENCE_SOURCES.lista_espera.nameCol).toBe('nome')
  })

  it('uses email as the address column everywhere', () => {
    for (const source of Object.values(AUDIENCE_SOURCES)) {
      expect(source.emailCol).toBe('email')
    }
  })

  it('declares the filters from the spec', () => {
    expect(AUDIENCE_SOURCES.checkins.filters.map((f) => f.key).sort()).toEqual(
      ['evento_id', 'pelotao', 'sexo'].sort(),
    )
    expect(AUDIENCE_SOURCES.membros.filters).toEqual([])
    expect(AUDIENCE_SOURCES.lista_vip.filters.map((f) => f.key)).toEqual(['status_cupom'])
    expect(AUDIENCE_SOURCES.lista_espera.filters.map((f) => f.key).sort()).toEqual(
      ['cidade', 'sexo', 'status'].sort(),
    )
  })
})

describe('isAudienceKey', () => {
  it('accepts known keys and rejects the rest', () => {
    expect(isAudienceKey('membros')).toBe(true)
    expect(isAudienceKey('users')).toBe(false)
    expect(isAudienceKey('')).toBe(false)
  })
})

describe('buildAudienceQuery', () => {
  it('selects the email and name columns', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.membros, {})
    expect(q.table).toBe('cadastro_site')
    expect(q.select).toBe('email,nome_completo')
    expect(q.eq).toEqual([])
  })

  it('applies declared filters', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.checkins, { pelotao: 'A', sexo: 'F' })
    expect(q.eq).toEqual(
      expect.arrayContaining([
        ['pelotao', 'A'],
        ['sexo', 'F'],
      ]),
    )
    expect(q.eq).toHaveLength(2)
  })

  it('ignores undeclared filters', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.membros, { cpf: '123' })
    expect(q.eq).toEqual([])
  })

  it('ignores empty filter values', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.checkins, { pelotao: '', sexo: '   ' })
    expect(q.eq).toEqual([])
  })

  it('trims filter values', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.lista_espera, { cidade: '  Brasília  ' })
    expect(q.eq).toEqual([['cidade', 'Brasília']])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/audiences.test.ts`
Expected: FAIL — `Cannot find module '../audiences'`

- [ ] **Step 3a: Criar os tipos**

Criar `lib/email/types.ts`:

```ts
import type { TemplateKey, TemplateFields } from './templates'

export type CampaignStatus =
  | 'rascunho'
  | 'agendada'
  | 'enviando'
  | 'enviada'
  | 'cancelada'
  | 'erro'

export type RecipientStatus =
  | 'pendente'
  | 'enviado'
  | 'entregue'
  | 'aberto'
  | 'clicado'
  | 'bounce'
  | 'spam'
  | 'falha'

export type AudienceKey = 'membros' | 'checkins' | 'lista_vip' | 'lista_espera'

export interface AudienceSelection {
  bases: Array<{ key: AudienceKey; filtros: Record<string, string> }>
}

export interface EmailCampaign {
  id: string
  nome: string
  status: CampaignStatus
  template_key: TemplateKey
  subject: string
  preheader: string | null
  content: TemplateFields
  cta_label: string | null
  cta_url: string | null
  audience: AudienceSelection
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  total_recipients: number
  error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignStats {
  total: number
  pendente: number
  enviado: number
  entregue: number
  aberto: number
  clicado: number
  bounce: number
  spam: number
  falha: number
  descadastros: number
}
```

- [ ] **Step 3b: Criar a lista de supressão**

`audiences.ts` importa este módulo, então ele precisa existir antes. Criar
`lib/email/suppression.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { normalizeEmail, type Recipient } from './normalize'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const PAGE_SIZE = 1000

/** Carrega a lista inteira de suprimidos. */
async function loadSuppressed(): Promise<Set<string>> {
  const supabase = getSupabase()
  const set = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[email] loadSuppressed error:', error)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const email = normalizeEmail(row.email)
      if (email) set.add(email)
    }

    if (data.length < PAGE_SIZE) break
  }

  return set
}

export async function filterSuppressed(recipients: Recipient[]): Promise<Recipient[]> {
  if (recipients.length === 0) return []
  const suppressed = await loadSuppressed()
  return recipients.filter((r) => !suppressed.has(r.email))
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return true // endereço inválido nunca deve receber

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', normalized)
    .limit(1)

  if (error) {
    console.error('[email] isSuppressed error:', error)
    return true // fail-closed: na dúvida, não envia
  }

  return (data?.length ?? 0) > 0
}

export async function addSuppression(
  email: string,
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual',
  campaignId: string | null = null,
): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const supabase = getSupabase()
  const { error } = await supabase
    .from('email_suppressions')
    .upsert(
      { email: normalized, reason, campaign_id: campaignId },
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[email] addSuppression error:', error)
    return false
  }

  return true
}
```

- [ ] **Step 4: Implementar o registro de audiências**

Criar `lib/email/audiences.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { dedupeRecipients, type Recipient } from './normalize'
import { filterSuppressed } from './suppression'
import type { AudienceKey, AudienceSelection } from './types'

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export interface FilterDef {
  key: string
  label: string
  /** 'text' abre campo livre; 'select' usa as opções; 'evento' é populado da tabela eventos. */
  kind: 'text' | 'select' | 'evento'
  options?: Array<{ value: string; label: string }>
}

export interface AudienceSource {
  key: AudienceKey
  label: string
  table: string
  emailCol: string
  nameCol: string
  filters: FilterDef[]
}

export const AUDIENCE_SOURCES: Record<AudienceKey, AudienceSource> = {
  membros: {
    key: 'membros',
    label: 'Membros do clube',
    table: 'cadastro_site',
    emailCol: 'email',
    nameCol: 'nome_completo',
    filters: [],
  },
  checkins: {
    key: 'checkins',
    label: 'Check-ins de eventos',
    table: 'checkins',
    emailCol: 'email',
    nameCol: 'nome_completo',
    filters: [
      { key: 'evento_id', label: 'Evento', kind: 'evento' },
      { key: 'pelotao', label: 'Pelotão', kind: 'text' },
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ],
      },
    ],
  },
  lista_vip: {
    key: 'lista_vip',
    label: 'Lista VIP SommaDay',
    table: 'lista_vip',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      {
        key: 'status_cupom',
        label: 'Status do cupom',
        kind: 'select',
        options: [
          { value: 'ativo', label: 'Ativo' },
          { value: 'usado', label: 'Usado' },
          { value: 'expirado', label: 'Expirado' },
          { value: 'cancelado', label: 'Cancelado' },
        ],
      },
    ],
  },
  lista_espera: {
    key: 'lista_espera',
    label: 'Lista de espera assessoria',
    table: 'lista_vip_assessoria',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      { key: 'cidade', label: 'Cidade', kind: 'text' },
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'masculino', label: 'Masculino' },
          { value: 'feminino', label: 'Feminino' },
        ],
      },
      { key: 'status', label: 'Status', kind: 'text' },
    ],
  },
}

export function isAudienceKey(value: string): value is AudienceKey {
  return Object.prototype.hasOwnProperty.call(AUDIENCE_SOURCES, value)
}

export function buildAudienceQuery(
  source: AudienceSource,
  filtros: Record<string, string>,
): { table: string; select: string; eq: Array<[string, string]> } {
  const declared = new Set(source.filters.map((f) => f.key))
  const eq: Array<[string, string]> = []

  for (const [key, raw] of Object.entries(filtros ?? {})) {
    if (!declared.has(key)) continue
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) continue
    eq.push([key, value])
  }

  return { table: source.table, select: `${source.emailCol},${source.nameCol}`, eq }
}

const PAGE_SIZE = 1000

async function fetchBase(
  source: AudienceSource,
  filtros: Record<string, string>,
): Promise<Recipient[]> {
  const supabase = getSupabase()
  const { table, select, eq } = buildAudienceQuery(source, filtros)
  const out: Recipient[] = []

  // Paginado — o PostgREST corta em 1000 por requisição.
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    for (const [col, value] of eq) query = query.eq(col, value)

    const { data, error } = await query
    if (error) {
      console.error(`[email] fetchBase ${source.key} error:`, error)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data as Array<Record<string, unknown>>) {
      out.push({
        email: String(row[source.emailCol] ?? ''),
        nome: (row[source.nameCol] as string | null) ?? null,
        sourceBase: source.key,
      })
    }

    if (data.length < PAGE_SIZE) break
  }

  return out
}

/**
 * Resolve a seleção em destinatários finais: filtra cada base, deduplica por
 * e-mail entre todas elas e remove os suprimidos.
 */
export async function resolveAudience(selection: AudienceSelection): Promise<Recipient[]> {
  const bases = selection?.bases ?? []
  const lists: Recipient[][] = []

  for (const base of bases) {
    if (!isAudienceKey(base.key)) continue
    lists.push(await fetchBase(AUDIENCE_SOURCES[base.key], base.filtros ?? {}))
  }

  return filterSuppressed(dedupeRecipients(lists))
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/audiences.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 6: Commit**

```bash
git add lib/email/types.ts lib/email/suppression.ts lib/email/audiences.ts lib/email/__tests__/audiences.test.ts
git commit -m "feat(email): supressão global, registro de audiências e resolução paginada"
```

---

## Task 7: Validação da supressão e da audiência contra o banco

**Files:** nenhum arquivo novo — valida o que a Task 6 criou.

**Interfaces:**
- Consumes: `filterSuppressed`, `isSuppressed`, `addSuppression`, `resolveAudience` (Task 6).

`suppression.ts` e `audiences.ts` são cascas finas sobre o Supabase, e o projeto não mocka
banco em teste (ver `lib/auth/__tests__/`). A verificação aqui é manual, contra o banco real.

Referência do código já criado na Task 6, para consulta:

<details>
<summary><code>lib/email/suppression.ts</code></summary>

```ts
import { createClient } from '@supabase/supabase-js'
import { normalizeEmail, type Recipient } from './normalize'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const PAGE_SIZE = 1000

/** Carrega a lista inteira de suprimidos. */
async function loadSuppressed(): Promise<Set<string>> {
  const supabase = getSupabase()
  const set = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[email] loadSuppressed error:', error)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const email = normalizeEmail(row.email)
      if (email) set.add(email)
    }

    if (data.length < PAGE_SIZE) break
  }

  return set
}

export async function filterSuppressed(recipients: Recipient[]): Promise<Recipient[]> {
  if (recipients.length === 0) return []
  const suppressed = await loadSuppressed()
  return recipients.filter((r) => !suppressed.has(r.email))
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return true // endereço inválido nunca deve receber

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', normalized)
    .limit(1)

  if (error) {
    console.error('[email] isSuppressed error:', error)
    return true // fail-closed: na dúvida, não envia
  }

  return (data?.length ?? 0) > 0
}

export async function addSuppression(
  email: string,
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual',
  campaignId: string | null = null,
): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const supabase = getSupabase()
  const { error } = await supabase
    .from('email_suppressions')
    .upsert({ email: normalized, reason, campaign_id: campaignId }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    console.error('[email] addSuppression error:', error)
    return false
  }

  return true
}
```

</details>

- [ ] **Step 1: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `lib/email/`.

- [ ] **Step 2: Testar a supressão contra o banco**

Criar um script temporário no diretório de scratch (fora do repositório), rodar com
`node --env-file=.env.local`, e conferir:

1. `addSuppression('teste@exemplo.com', 'manual')` retorna `true` e cria a linha.
2. Chamar de novo retorna `true` **sem duplicar** — checar que
   `select count(*) from email_suppressions where email='teste@exemplo.com'` é `1`.
3. `isSuppressed('TESTE@Exemplo.com ')` retorna `true` (a normalização funciona).
4. `isSuppressed('outro@exemplo.com')` retorna `false`.

- [ ] **Step 3: Testar a resolução de audiência contra o banco**

No mesmo script, conferir:

1. `resolveAudience({ bases: [{ key: 'lista_espera', filtros: {} }] })` retorna algo
   próximo de 161 destinatários (é a base pequena, boa para conferir a olho).
2. `resolveAudience({ bases: [{ key: 'membros', filtros: {} }] })` retorna **mais de 1.000**
   — isso prova que a paginação funciona. Sem ela, o PostgREST cortaria exatamente em 1000.
3. A união `[{ key: 'membros' }, { key: 'checkins' }]` retorna **menos** que a soma das duas
   isoladas — isso prova que a dedup entre bases funciona.
4. Nenhum e-mail aparece duas vezes:
   `new Set(r.map(x => x.email)).size === r.length` é `true`.
5. `teste@exemplo.com` não aparece em nenhum resultado (a supressão está sendo aplicada).

> Anotar os números do item 1 ao 3. É o levantamento de e-mails únicos por base que a spec
> deixou pendente, e ele decide o tamanho real do disparo na Fase 4.

- [ ] **Step 4: Limpar**

```sql
delete from email_suppressions where email = 'teste@exemplo.com';
```

Apagar também o script temporário. Nada a commitar nesta task.

---

## Task 8: Motor de disparo retomável

**Files:**
- Create: `lib/email/dispatch.ts`
- Test: `lib/email/__tests__/dispatch.test.ts`
- Modify: `package.json` (dependência `resend`)

**Interfaces:**
- Consumes: `resolveAudience` (Task 6), `renderTemplate` (Task 5), `signUnsubscribeToken` (Task 3), `addSuppression` (Task 7).
- Produces:
  - `chunk<T>(items: T[], size: number): T[][]`
  - `prepareCampaign(campaignId: string): Promise<{ total: number } | null>`
  - `dispatchSlice(campaignId: string, maxRecipients?: number): Promise<{ sent: number; failed: number; remaining: number }>`
  - `sendTestEmail(campaignId: string, to: string): Promise<{ ok: boolean; error?: string }>`

**Como a retomada funciona:** `prepareCampaign` congela a audiência inserindo uma linha `pendente` por destinatário. A constraint `UNIQUE (campaign_id, email)` torna a operação idempotente. `dispatchSlice` pega um lote de pendentes, envia e marca. Uma interrupção deixa os não processados como `pendente`, e a execução seguinte continua daí.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install resend`

Verificar que `package.json` passou a listar `resend` em `dependencies`.

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/email/__tests__/dispatch.test.ts` (cobre a parte pura — o fatiamento):

```ts
import { chunk } from '../dispatch'

describe('chunk', () => {
  it('splits into exact groups', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('leaves the remainder in the last group', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles a group larger than the list', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]])
  })

  it('returns empty for an empty list', () => {
    expect(chunk([], 10)).toEqual([])
  })

  it('never produces empty groups', () => {
    for (const size of [1, 2, 3, 7]) {
      const groups = chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], size)
      expect(groups.every((g) => g.length > 0)).toBe(true)
      expect(groups.flat()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(groups.every((g) => g.length <= size)).toBe(true)
    }
  })

  it('throws on a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow()
    expect(() => chunk([1], -1)).toThrow()
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/email/__tests__/dispatch.test.ts`
Expected: FAIL — `Cannot find module '../dispatch'`

- [ ] **Step 4: Implementar**

Criar `lib/email/dispatch.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveAudience } from './audiences'
import { normalizeEmail } from './normalize'
import { isSuppressed } from './suppression'
import { renderTemplate } from './templates'
import { signUnsubscribeToken } from './unsubscribe-token'
import type { EmailCampaign } from './types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Limite de destinatários por chamada do lote da Resend. */
const BATCH_SIZE = 100
/** Pausa entre lotes, para ficar abaixo do rate limit de 2 req/s da Resend. */
const THROTTLE_MS = 600
/** Teto de destinatários por execução, para caber no maxDuration da rota. */
const DEFAULT_SLICE = 2000
const MAX_RETRIES = 3

export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error(`Tamanho de lote inválido: ${size}`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function unsubscribeUrl(email: string, campaignId: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.sommaclub.com.br'
  const token = signUnsubscribeToken(email, campaignId, getSecret())
  return `${base}/api/unsubscribe?t=${encodeURIComponent(token)}`
}

async function getCampaign(campaignId: string): Promise<EmailCampaign | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) {
    console.error('[email] getCampaign error:', error)
    return null
  }
  return data as EmailCampaign
}

/**
 * Congela a audiência da campanha: uma linha `pendente` por destinatário.
 * Idempotente — a constraint UNIQUE (campaign_id, email) absorve repetições,
 * então chamar duas vezes não duplica nem reenvia.
 */
export async function prepareCampaign(campaignId: string): Promise<{ total: number } | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null

  const recipients = await resolveAudience(campaign.audience)
  const supabase = getSupabase()

  for (const group of chunk(recipients, 500)) {
    const { error } = await supabase.from('email_campaign_recipients').upsert(
      group.map((r) => ({
        campaign_id: campaignId,
        email: r.email,
        nome: r.nome,
        source_base: r.sourceBase,
        status: 'pendente' as const,
      })),
      { onConflict: 'campaign_id,email', ignoreDuplicates: true },
    )

    if (error) {
      console.error('[email] prepareCampaign upsert error:', error)
      return null
    }
  }

  const { count } = await supabase
    .from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  const total = count ?? recipients.length
  await supabase
    .from('email_campaigns')
    .update({ total_recipients: total, updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  return { total }
}

function buildPayload(
  campaign: EmailCampaign,
  recipient: { email: string; nome: string | null },
  from: string,
) {
  const url = unsubscribeUrl(recipient.email, campaign.id)
  return {
    from,
    to: [recipient.email],
    subject: campaign.subject,
    html: renderTemplate({
      templateKey: campaign.template_key,
      subject: campaign.subject,
      preheader: campaign.preheader,
      content: campaign.content,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      nome: recipient.nome,
      unsubscribeUrl: url,
    }),
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

/**
 * Envia uma fatia dos pendentes. Devolve o controle para o chamador com o
 * número de restantes, para que o cron retome na execução seguinte.
 */
export async function dispatchSlice(
  campaignId: string,
  maxRecipients: number = DEFAULT_SLICE,
): Promise<{ sent: number; failed: number; remaining: number }> {
  const campaign = await getCampaign(campaignId)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!campaign || !apiKey || !from) {
    console.error('[email] dispatchSlice: campanha, RESEND_API_KEY ou EMAIL_FROM ausente')
    return { sent: 0, failed: 0, remaining: 0 }
  }

  const supabase = getSupabase()
  const resend = new Resend(apiKey)

  const { data: pending, error } = await supabase
    .from('email_campaign_recipients')
    .select('id,email,nome')
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')
    .limit(maxRecipients)

  if (error) {
    console.error('[email] dispatchSlice select error:', error)
    return { sent: 0, failed: 0, remaining: 0 }
  }

  let sent = 0
  let failed = 0
  const groups = chunk(pending ?? [], BATCH_SIZE)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    const payload = group.map((r) => buildPayload(campaign, r, from))

    let ids: Array<{ id: string }> = []
    let lastError: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error: sendError } = await resend.batch.send(payload)
        if (sendError) {
          lastError = sendError.message
          await sleep(THROTTLE_MS * attempt * 2)
          continue
        }
        // O formato do retorno mudou entre versões do SDK.
        const raw = (data as unknown as { data?: Array<{ id: string }> })?.data
        ids = Array.isArray(raw) ? raw : Array.isArray(data) ? (data as Array<{ id: string }>) : []
        lastError = null
        break
      } catch (e) {
        lastError = String(e)
        await sleep(THROTTLE_MS * attempt * 2)
      }
    }

    const now = new Date().toISOString()

    if (lastError) {
      // Falha após as tentativas: marca o lote e segue. Volta a ser tentado
      // num disparo futuro só se for reposto para 'pendente' manualmente.
      failed += group.length
      for (const r of group) {
        await supabase
          .from('email_campaign_recipients')
          .update({ status: 'falha', error: lastError.slice(0, 500) })
          .eq('id', r.id)
      }
    } else {
      sent += group.length
      for (let idx = 0; idx < group.length; idx++) {
        await supabase
          .from('email_campaign_recipients')
          .update({
            status: 'enviado',
            resend_email_id: ids[idx]?.id ?? null,
            sent_at: now,
            error: null,
          })
          .eq('id', group[idx].id)
      }
    }

    if (i < groups.length - 1) await sleep(THROTTLE_MS)
  }

  const { count } = await supabase
    .from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')

  return { sent, failed, remaining: count ?? 0 }
}

/** Envio de teste. Respeita a supressão, como todo o resto. */
export async function sendTestEmail(
  campaignId: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(to)
  if (!email) return { ok: false, error: 'E-mail de teste inválido' }

  if (await isSuppressed(email)) {
    return { ok: false, error: 'Este e-mail está na lista de descadastro' }
  }

  const campaign = await getCampaign(campaignId)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!campaign) return { ok: false, error: 'Campanha não encontrada' }
  if (!apiKey || !from) return { ok: false, error: 'RESEND_API_KEY ou EMAIL_FROM não configurado' }

  const resend = new Resend(apiKey)
  const payload = buildPayload(campaign, { email, nome: 'Teste' }, from)

  const { error } = await resend.emails.send({
    ...payload,
    subject: `[TESTE] ${campaign.subject}`,
  })

  if (error) {
    console.error('[email] sendTestEmail error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/email/__tests__/dispatch.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 6: Adicionar as variáveis de ambiente**

Acrescentar a `.env.local` (arquivo **não** versionado):

```bash
RESEND_API_KEY=<a mesma chave usada no projeto 1-ano-SommaDay>
EMAIL_FROM="Somma Club <contato@sommaclub.com.br>"
NEXT_PUBLIC_APP_URL=https://admin.sommaclub.com.br
CRON_SECRET=<gerar com: openssl rand -hex 24>
```

`RESEND_WEBHOOK_SECRET` será adicionada na Task 10, ao registrar o endpoint no dashboard da Resend.

As mesmas variáveis precisam ser cadastradas na Vercel, no projeto `sistema-somma-de-gestao`.

- [ ] **Step 7: Commit**

```bash
git add lib/email/dispatch.ts lib/email/__tests__/dispatch.test.ts package.json package-lock.json
git commit -m "feat(email): motor de disparo retomável com lote e retry"
```

---

## Task 9: Service de campanhas

**Files:**
- Create: `lib/services/email-campaigns.ts`

**Interfaces:**
- Consumes: `EmailCampaign`, `CampaignStats` (Task 6).
- Produces:
  - `getCampaigns(): Promise<EmailCampaign[]>`
  - `getCampaignById(id: string): Promise<EmailCampaign | null>`
  - `createCampaign(input: CreateCampaignInput): Promise<EmailCampaign | null>`
  - `updateCampaign(id: string, patch: Partial<CreateCampaignInput> & { status?: CampaignStatus; scheduled_at?: string | null }): Promise<EmailCampaign | null>`
  - `deleteCampaign(id: string): Promise<boolean>`
  - `getCampaignStats(id: string): Promise<CampaignStats | null>`
  - `getCampaignRecipients(id: string, status?: RecipientStatus): Promise<RecipientRow[]>`
  - `getCampaignClickedLinks(id: string): Promise<Array<{ link: string; count: number }>>`

Segue o molde de `lib/services/popups.ts`: service role local, tipos no topo, funções que nunca lançam.

- [ ] **Step 1: Implementar**

Criar `lib/services/email-campaigns.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type {
  CampaignStats,
  CampaignStatus,
  EmailCampaign,
  RecipientStatus,
} from '@/lib/email/types'
import type { TemplateFields, TemplateKey } from '@/lib/email/templates'
import type { AudienceSelection } from '@/lib/email/types'

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Types ───

export interface CreateCampaignInput {
  nome: string
  template_key: TemplateKey
  subject: string
  preheader?: string | null
  content: TemplateFields
  cta_label?: string | null
  cta_url?: string | null
  audience: AudienceSelection
  scheduled_at?: string | null
  created_by?: string | null
}

export interface RecipientRow {
  id: string
  email: string
  nome: string | null
  source_base: string | null
  status: RecipientStatus
  error: string | null
  sent_at: string | null
}

// ─── Queries ───

export async function getCampaigns(): Promise<EmailCampaign[]> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[email-campaigns] getCampaigns error:', error)
      return []
    }
    return (data ?? []) as EmailCampaign[]
  } catch (e) {
    console.error('[email-campaigns] getCampaigns exception:', e)
    return []
  }
}

export async function getCampaignById(id: string): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('email_campaigns').select('*').eq('id', id).single()

    if (error) {
      console.error('[email-campaigns] getCampaignById error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] getCampaignById exception:', e)
    return null
  }
}

export async function createCampaign(input: CreateCampaignInput): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({ ...input, status: input.scheduled_at ? 'agendada' : 'rascunho' })
      .select()
      .single()

    if (error) {
      console.error('[email-campaigns] createCampaign error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] createCampaign exception:', e)
    return null
  }
}

export interface UpdateCampaignPatch extends Partial<CreateCampaignInput> {
  status?: CampaignStatus
  scheduled_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  total_recipients?: number
  error?: string | null
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignPatch,
): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[email-campaigns] updateCampaign error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] updateCampaign exception:', e)
    return null
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id)

    if (error) {
      console.error('[email-campaigns] deleteCampaign error:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[email-campaigns] deleteCampaign exception:', e)
    return false
  }
}

export async function getCampaignStats(id: string): Promise<CampaignStats | null> {
  try {
    const supabase = getSupabase()

    const [recipientsRes, unsubRes] = await Promise.all([
      supabase.from('email_campaign_recipients').select('status').eq('campaign_id', id),
      supabase
        .from('email_suppressions')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('reason', 'unsubscribe'),
    ])

    if (recipientsRes.error) {
      console.error('[email-campaigns] getCampaignStats error:', recipientsRes.error)
      return null
    }

    const stats: CampaignStats = {
      total: 0,
      pendente: 0,
      enviado: 0,
      entregue: 0,
      aberto: 0,
      clicado: 0,
      bounce: 0,
      spam: 0,
      falha: 0,
      descadastros: unsubRes.count ?? 0,
    }

    for (const row of recipientsRes.data ?? []) {
      stats.total++
      const key = row.status as RecipientStatus
      if (key in stats) stats[key]++
    }

    return stats
  } catch (e) {
    console.error('[email-campaigns] getCampaignStats exception:', e)
    return null
  }
}

export async function getCampaignRecipients(
  id: string,
  status?: RecipientStatus,
): Promise<RecipientRow[]> {
  try {
    const supabase = getSupabase()
    let query = supabase
      .from('email_campaign_recipients')
      .select('id,email,nome,source_base,status,error,sent_at')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1000)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      console.error('[email-campaigns] getCampaignRecipients error:', error)
      return []
    }
    return (data ?? []) as RecipientRow[]
  } catch (e) {
    console.error('[email-campaigns] getCampaignRecipients exception:', e)
    return []
  }
}

export async function getCampaignClickedLinks(
  id: string,
): Promise<Array<{ link: string; count: number }>> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaign_events')
      .select('link')
      .eq('campaign_id', id)
      .eq('type', 'clicked')
      .limit(5000)

    if (error) {
      console.error('[email-campaigns] getCampaignClickedLinks error:', error)
      return []
    }

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      if (!row.link) continue
      counts.set(row.link, (counts.get(row.link) ?? 0) + 1)
    }

    return [...counts.entries()]
      .map(([link, count]) => ({ link, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  } catch (e) {
    console.error('[email-campaigns] getCampaignClickedLinks exception:', e)
    return []
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 3: Commit**

```bash
git add lib/services/email-campaigns.ts
git commit -m "feat(email): service de campanhas e métricas"
```

---

## Task 10: Webhook de tracking e descadastro

**Files:**
- Create: `app/api/webhooks/resend/route.ts`
- Create: `app/api/unsubscribe/route.ts`

**Interfaces:**
- Consumes: `verifySvixSignature` (Task 4), `verifyUnsubscribeToken` (Task 3), `addSuppression` (Task 7).
- Produces: nada consumido por outras tasks.

O webhook **só processa eventos cujo `resend_email_id` existe em `email_campaign_recipients`**. Eventos do `1-ano-SommaDay` são ignorados com 200, para não duplicar tracking.

- [ ] **Step 1: Implementar o webhook**

Criar `app/api/webhooks/resend/route.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/email/normalize'
import { addSuppression } from '@/lib/email/suppression'
import { verifySvixSignature } from '@/lib/email/svix'
import type { RecipientStatus } from '@/lib/email/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Impede regressão: um 'delivered' atrasado não sobrescreve um 'clicado'. */
const STATUS_RANK: Record<string, number> = {
  enviado: 1,
  entregue: 2,
  aberto: 3,
  clicado: 4,
}

const EVENT_TO_STATUS: Record<string, RecipientStatus> = {
  sent: 'enviado',
  delivered: 'entregue',
  opened: 'aberto',
  clicked: 'clicado',
  bounced: 'bounce',
  complained: 'spam',
  failed: 'falha',
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  const valid = verifySvixSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    body,
  })

  if (!valid) {
    console.error('[email-campaigns/webhook] assinatura inválida')
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(body) as {
      type?: string
      data?: { email_id?: string; to?: string[]; click?: { link?: string } }
    }

    const type = (payload.type ?? '').replace('email.', '')
    const emailId = payload.data?.email_id
    const link = payload.data?.click?.link ?? null

    if (!type || !emailId) return NextResponse.json({ ok: true })

    const supabase = getSupabase()

    // Só nos interessam envios feitos por este módulo. O 1-ano-SommaDay
    // compartilha o banco e tem o próprio webhook.
    const { data: recipient } = await supabase
      .from('email_campaign_recipients')
      .select('id,campaign_id,email,status')
      .eq('resend_email_id', emailId)
      .maybeSingle()

    if (!recipient) return NextResponse.json({ ok: true })

    await supabase.from('email_campaign_events').insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      email: recipient.email,
      resend_email_id: emailId,
      type,
      link,
    })

    const nextStatus = EVENT_TO_STATUS[type]
    if (nextStatus) {
      const currentRank = STATUS_RANK[recipient.status] ?? 0
      const nextRank = STATUS_RANK[nextStatus] ?? 0
      // bounce/spam/falha não estão no ranking e sempre vencem.
      if (nextRank === 0 || nextRank > currentRank) {
        await supabase
          .from('email_campaign_recipients')
          .update({ status: nextStatus })
          .eq('id', recipient.id)
      }
    }

    if (type === 'bounced' || type === 'complained') {
      const email = normalizeEmail(recipient.email)
      if (email) {
        await addSuppression(email, type === 'bounced' ? 'bounce' : 'complaint', recipient.campaign_id)
      }
    }
  } catch (e) {
    console.error('[email-campaigns/webhook] exception:', e)
  }

  // Sempre 200 depois de autenticado, para a Resend não reenviar em loop.
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Implementar o descadastro**

Criar `app/api/unsubscribe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { addSuppression } from '@/lib/email/suppression'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function page(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;font-family:Helvetica,Arial,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:420px;padding:32px;text-align:center;">
    <h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${message}</p>
  </div>
</body>
</html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function handle(token: string | null): Promise<boolean> {
  if (!token) return false
  const payload = verifyUnsubscribeToken(token, getSecret())
  if (!payload) return false
  return addSuppression(payload.email, 'unsubscribe', payload.campaignId)
}

export async function GET(req: NextRequest) {
  const ok = await handle(req.nextUrl.searchParams.get('t'))
  return ok
    ? page('Pronto', 'Você não receberá mais e-mails do Somma Running Club.')
    : page('Link inválido', 'Este link de descadastro expirou ou está incorreto.')
}

// One-click do Gmail e do Outlook.
export async function POST(req: NextRequest) {
  await handle(req.nextUrl.searchParams.get('t'))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Registrar o webhook na Resend**

No dashboard da Resend, criar um endpoint apontando para
`https://admin.sommaclub.com.br/api/webhooks/resend`, assinando os eventos
`email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
`email.complained`, `email.delivery_delayed`.

Copiar o signing secret gerado e adicionar a `.env.local` e à Vercel:

```bash
RESEND_WEBHOOK_SECRET=whsec_...
```

> Este é um **segundo** endpoint. O do `1-ano-SommaDay` continua ativo e intocado.

- [ ] **Step 4: Verificar o fail-closed**

Run: `npm run dev` e, em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/resend -d '{}'
```

Expected: `401` — sem cabeçalhos de assinatura, rejeita.

- [ ] **Step 5: Verificar o descadastro com token inválido**

```bash
curl -s http://localhost:3000/api/unsubscribe?t=invalido | grep -o "Link inválido"
```

Expected: `Link inválido`

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/resend/route.ts app/api/unsubscribe/route.ts
git commit -m "feat(email): webhook de tracking e descadastro assinado"
```

---

## Task 11: Rotas de API das campanhas

**Files:**
- Create: `app/api/email-campaigns/route.ts`
- Create: `app/api/email-campaigns/[id]/route.ts`
- Create: `app/api/email-campaigns/[id]/preview/route.ts`
- Create: `app/api/email-campaigns/[id]/test/route.ts`
- Create: `app/api/email-campaigns/[id]/dispatch/route.ts`
- Create: `app/api/email-campaigns/[id]/cancel/route.ts`
- Create: `app/api/email-campaigns/[id]/stats/route.ts`
- Create: `app/api/email-audiences/preview/route.ts`
- Create: `app/api/cron/email-campaigns/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: tudo das Tasks 6–9.
- Produces: os endpoints consumidos pela UI nas Tasks 12–13.

- [ ] **Step 1: Listagem e criação**

Criar `app/api/email-campaigns/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/api-auth'
import { createCampaign, getCampaigns } from '@/lib/services/email-campaigns'
import { TEMPLATE_KEYS } from '@/lib/email/templates'
import { isAudienceKey } from '@/lib/email/audiences'

const audienceSchema = z.object({
  bases: z
    .array(
      z.object({
        key: z.string().refine(isAudienceKey, { message: 'Base desconhecida' }),
        filtros: z.record(z.string()).default({}),
      }),
    )
    .min(1, 'Selecione ao menos uma base'),
})

const createSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto').max(120),
  template_key: z.enum(TEMPLATE_KEYS),
  subject: z.string().min(2, 'Assunto muito curto').max(200),
  preheader: z.string().max(200).nullable().optional(),
  content: z.object({
    titulo: z.string().min(1, 'Título obrigatório').max(200),
    texto: z.string().min(1, 'Texto obrigatório').max(5000),
    imagem_url: z.string().url('URL de imagem inválida').optional(),
    data: z.string().max(120).optional(),
    local: z.string().max(200).optional(),
  }),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url: z.string().url('URL do CTA inválida').nullable().optional(),
  audience: audienceSchema,
  scheduled_at: z.string().datetime().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await getCampaigns())
  } catch (err) {
    console.error('[email-campaigns] GET exception:', err)
    return NextResponse.json({ error: 'Erro ao listar campanhas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    const parsed = createSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const campaign = await createCampaign({ ...parsed.data, created_by: auth.session.sub })
    if (!campaign) return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 })

    return NextResponse.json(campaign, { status: 201 })
  } catch (err) {
    console.error('[email-campaigns] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 })
  }
}
```

> Assinatura já verificada em `lib/auth/api-auth.ts:43`:
> `requirePermission(req, permission): Promise<{ session: SessionPayload } | NextResponse>`.
> O guard é `if (auth instanceof NextResponse) return auth`, e o id do usuário é
> **`auth.session.sub`** — não `auth.sub`.
>
> `apiFetch` (`lib/api-client.ts:5`) devolve o `Response` cru, sem parsear JSON:
> `apiFetch(input, init?): Promise<Response>`. Nas páginas, chamar `.json()` no resultado.

- [ ] **Step 2: Detalhe, edição e exclusão**

Criar `app/api/email-campaigns/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  deleteCampaign,
  getCampaignById,
  updateCampaign,
} from '@/lib/services/email-campaigns'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const existing = await getCampaignById(id)
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (existing.status === 'enviando' || existing.status === 'enviada') {
    return NextResponse.json(
      { error: 'Não é possível editar uma campanha já disparada' },
      { status: 409 },
    )
  }

  const updated = await updateCampaign(id, await req.json())
  if (!updated) return NextResponse.json({ error: 'Erro ao atualizar campanha' }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const existing = await getCampaignById(id)
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (existing.status === 'enviando') {
    return NextResponse.json(
      { error: 'Cancele a campanha antes de excluí-la' },
      { status: 409 },
    )
  }

  const ok = await deleteCampaign(id)
  if (!ok) return NextResponse.json({ error: 'Erro ao excluir campanha' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Preview, teste, disparo, cancelamento e métricas**

Criar `app/api/email-campaigns/[id]/preview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById } from '@/lib/services/email-campaigns'
import { renderTemplate } from '@/lib/email/templates'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  const html = renderTemplate({
    templateKey: campaign.template_key,
    subject: campaign.subject,
    preheader: campaign.preheader,
    content: campaign.content,
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    nome: 'Ana',
    unsubscribeUrl: '#',
  })

  return NextResponse.json({ html })
}
```

Criar `app/api/email-campaigns/[id]/test/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { sendTestEmail } from '@/lib/email/dispatch'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { email } = (await req.json()) as { email?: string }
  if (!email) return NextResponse.json({ error: 'Informe um e-mail' }, { status: 400 })

  const result = await sendTestEmail(id, email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
```

Criar `app/api/email-campaigns/[id]/dispatch/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, updateCampaign } from '@/lib/services/email-campaigns'
import { dispatchSlice, prepareCampaign } from '@/lib/email/dispatch'

export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (campaign.status === 'enviando' || campaign.status === 'enviada') {
    return NextResponse.json({ error: 'Esta campanha já foi disparada' }, { status: 409 })
  }

  const prepared = await prepareCampaign(id)
  if (!prepared) return NextResponse.json({ error: 'Erro ao montar a audiência' }, { status: 500 })
  if (prepared.total === 0) {
    return NextResponse.json({ error: 'A audiência selecionada está vazia' }, { status: 400 })
  }

  await updateCampaign(id, { status: 'enviando', started_at: new Date().toISOString() })

  const result = await dispatchSlice(id)

  if (result.remaining === 0) {
    await updateCampaign(id, { status: 'enviada', finished_at: new Date().toISOString() })
  }

  return NextResponse.json({ ...result, total: prepared.total })
}
```

Criar `app/api/email-campaigns/[id]/cancel/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, updateCampaign } from '@/lib/services/email-campaigns'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (campaign.status === 'enviada') {
    return NextResponse.json({ error: 'Campanha já foi enviada' }, { status: 409 })
  }

  const updated = await updateCampaign(id, {
    status: 'cancelada',
    finished_at: new Date().toISOString(),
  })

  if (!updated) return NextResponse.json({ error: 'Erro ao cancelar' }, { status: 500 })
  return NextResponse.json(updated)
}
```

Criar `app/api/email-campaigns/[id]/stats/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  getCampaignClickedLinks,
  getCampaignRecipients,
  getCampaignStats,
} from '@/lib/services/email-campaigns'
import type { RecipientStatus } from '@/lib/email/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const statusParam = req.nextUrl.searchParams.get('status') as RecipientStatus | null

  const [stats, recipients, links] = await Promise.all([
    getCampaignStats(id),
    getCampaignRecipients(id, statusParam ?? undefined),
    getCampaignClickedLinks(id),
  ])

  if (!stats) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  return NextResponse.json({ stats, recipients, links })
}
```

- [ ] **Step 4: Contagem de audiência ao vivo**

Criar `app/api/email-audiences/preview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { AUDIENCE_SOURCES, resolveAudience } from '@/lib/email/audiences'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({ sources: Object.values(AUDIENCE_SOURCES) })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    const audience = await req.json()
    const recipients = await resolveAudience(audience)

    const porBase: Record<string, number> = {}
    for (const r of recipients) porBase[r.sourceBase] = (porBase[r.sourceBase] ?? 0) + 1

    return NextResponse.json({ total: recipients.length, porBase })
  } catch (err) {
    console.error('[email-audiences/preview] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao calcular a audiência' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Agendador**

Criar `app/api/cron/email-campaigns/route.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchSlice, prepareCampaign } from '@/lib/email/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Fail-closed, igual a app/api/cron/eventos/route.ts.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()
  const processed: Array<{ id: string; sent: number; remaining: number }> = []

  try {
    // 1) Promove as agendadas que já venceram.
    const { data: due } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'agendada')
      .lte('scheduled_at', now)

    for (const campaign of due ?? []) {
      const prepared = await prepareCampaign(campaign.id)
      await supabase
        .from('email_campaigns')
        .update(
          prepared && prepared.total > 0
            ? { status: 'enviando', started_at: now }
            : { status: 'erro', error: 'Audiência vazia', finished_at: now },
        )
        .eq('id', campaign.id)
    }

    // 2) Processa uma fatia de cada campanha em andamento.
    const { data: running } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'enviando')

    for (const campaign of running ?? []) {
      const result = await dispatchSlice(campaign.id)
      processed.push({ id: campaign.id, sent: result.sent, remaining: result.remaining })

      if (result.remaining === 0) {
        await supabase
          .from('email_campaigns')
          .update({ status: 'enviada', finished_at: new Date().toISOString() })
          .eq('id', campaign.id)
      }
    }
  } catch (err) {
    console.error('[email-campaigns/cron] exception:', err)
    return NextResponse.json({ error: 'Erro no agendador' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, processed })
}
```

- [ ] **Step 6: Registrar o cron**

Substituir `vercel.json` por:

```json
{
  "crons": [
    {
      "path": "/api/cron/eventos",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/email-campaigns",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 7: Verificar que compila e que o cron é fail-closed**

Run: `npx tsc --noEmit`
Expected: nenhum erro.

Run: `npm run dev` e:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/email-campaigns
```

Expected: `401`

- [ ] **Step 8: Commit**

```bash
git add app/api/email-campaigns app/api/email-audiences app/api/cron/email-campaigns vercel.json
git commit -m "feat(email): rotas de campanha, audiência e agendador"
```

---

## Task 12: Interface — lista e wizard de campanha

**Files:**
- Create: `app/email-marketing/page.tsx`
- Create: `components/email-campaign-card.tsx`
- Create: `components/email-campaign-modal.tsx`
- Create: `components/email-audience-picker.tsx`
- Create: `components/email-content-form.tsx`
- Modify: `app/page.tsx`
- Modify: `app/systems/page.tsx`

**Interfaces:**
- Consumes: os endpoints da Task 11.
- Produces: a seção `email` da SPA.

Seguir o padrão de `app/popups/page.tsx`: client component, `apiFetch`, `useState` + `useEffect` + `useCallback`, `<ErrorBanner>`, `<PageLoading>`, busca client-side com `matchesTextSearch` de `lib/search-utils.ts`.

- [ ] **Step 1: Ler os arquivos de referência**

Ler na íntegra, para replicar convenções de estado, estilo e tratamento de erro:
- `app/popups/page.tsx`
- `components/popups-modal.tsx`
- `components/ui/error-banner.tsx`
- `components/ui/page-loading.tsx`
- `lib/api-client.ts` (assinatura de `apiFetch`)

- [ ] **Step 2: Construir o seletor de audiência**

Criar `components/email-audience-picker.tsx` — passo 1 do wizard:

- `GET /api/email-audiences/preview` para listar as bases e seus filtros.
- Um card por base com checkbox de seleção; ao marcar, expande os filtros declarados.
- Filtro `kind: 'evento'` popula o select com `GET /api/eventos/ativos`.
- A cada mudança, chama `POST /api/email-audiences/preview` com a seleção atual (debounce de 500 ms) e mostra **"N destinatários únicos"** mais a quebra por base.
- Deixar explícito na tela: *"já descontados os duplicados e os descadastrados"*.

- [ ] **Step 3: Construir o formulário de conteúdo**

Criar `components/email-content-form.tsx` — passo 2 do wizard:

- Select de template (`anuncio` / `simples` / `evento`), com descrição de cada um.
- Campos: assunto, preheader, título, texto (textarea), e conforme o template: URL de imagem, data, local.
- Campos de CTA: rótulo e URL, lado a lado. Deixar claro que os dois são necessários para o botão aparecer.
- Preview: `<iframe srcDoc={html} />` alimentado por `GET /api/email-campaigns/:id/preview`, atualizado ao salvar o rascunho. Para campanha ainda não criada, renderizar o preview só após o primeiro salvamento.

- [ ] **Step 4: Construir o modal de 4 passos**

Criar `components/email-campaign-modal.tsx`:

1. Audiência (`<EmailAudiencePicker/>`)
2. Conteúdo (`<EmailContentForm/>`)
3. Revisão — resumo dos passos 1 e 2, campo de e-mail de teste e botão "Enviar teste" (`POST /api/email-campaigns/:id/test`)
4. Disparo — escolha entre "Disparar agora" (`POST /api/email-campaigns/:id/dispatch`) e "Agendar", com input `datetime-local` em horário de Brasília convertido para UTC na gravação:

```ts
// datetime-local devolve 'YYYY-MM-DDTHH:mm' sem fuso; Brasília é UTC-3.
const scheduledAt = new Date(`${valorLocal}:00-03:00`).toISOString()
```

Antes de disparar, `confirm()` nativo mostrando o total de destinatários. O disparo é irreversível para quem já recebeu.

- [ ] **Step 5: Construir o card e a página de lista**

Criar `components/email-campaign-card.tsx`: nome, badge de status colorido, template, total de destinatários, data de disparo ou agendamento e, quando `enviada`, taxa de entrega e de abertura. Ações: editar (só se `rascunho` ou `agendada`), ver status, cancelar, excluir.

Criar `app/email-marketing/page.tsx` no molde de `app/popups/page.tsx`, com `loadCampaigns` em `useCallback`, busca client-side por nome e assunto, e filtro por status.

- [ ] **Step 6: Registrar na SPA**

Em `app/page.tsx`, cinco mudanças:

```ts
// 1. import do ícone (linha ~5), somar Mail à lista existente
import { ..., Mail } from "lucide-react"

// 2. import da página (após a linha 22)
import EmailMarketingPage from "./email-marketing/page"

// 3. objeto de permissões (após a linha 46)
email: hasPermission('email'),

// 4a. array do <nav> (após a linha 164)
{ id: "email", icon: Mail, label: "E-MAIL MKT", permissionKey: "email" },

// 4b. grid do modal de APPs (após a linha 260)
{ id: "email", icon: Mail, label: "E-mail Mkt", permissionKey: "email" },

// 5. render condicional (após a linha 349)
{activeSection === "email" && permissions.email && <EmailMarketingPage />}
```

Em `app/systems/page.tsx`, adicionar `email` à interface local de permissões, a `DEFAULT_PERMISSIONS` (como `false`), a `MODULE_LABELS` (como `'E-mail Marketing'`) e aos dois blocos que hoje setam `popups: true`.

- [ ] **Step 7: Verificar no navegador**

Run: `npm run dev`

Conferir, logado como admin:
1. "E-MAIL MKT" aparece no menu lateral.
2. A lista abre vazia, sem erro no console.
3. Criar campanha: o passo 1 mostra as 4 bases e a contagem ao vivo muda ao marcar/desmarcar.
4. O passo 2 renderiza o preview.
5. O envio de teste chega na caixa de entrada, com o rodapé de descadastro.
6. Clicar no link de descadastro do e-mail de teste mostra "Pronto" e cria a linha em `email_suppressions`.

Apagar a linha de teste ao final.

- [ ] **Step 8: Commit**

```bash
git add app/email-marketing components/email-campaign-card.tsx components/email-campaign-modal.tsx components/email-audience-picker.tsx components/email-content-form.tsx app/page.tsx app/systems/page.tsx
git commit -m "feat(email): interface de criação e disparo de campanhas"
```

---

## Task 13: Interface — tela de status

**Files:**
- Create: `app/email-marketing/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/email-campaigns/:id/stats` (Task 11).

Roda fora da SPA, com `<AuthenticatedChrome>`, no mesmo padrão de `app/popups/[id]/analytics`.

- [ ] **Step 1: Ler a referência**

Ler `app/popups/[id]/analytics/page.tsx` e `app/popups/[id]/analytics/layout.tsx` na íntegra, além de `components/authenticated-chrome.tsx`.

- [ ] **Step 2: Implementar a tela**

Criar `app/email-marketing/[id]/page.tsx` com:

- **Cards de métrica:** total, enviados, entregues, abertos, clicados, bounces, spam, descadastros. Percentual sobre entregues (não sobre o total), porque é assim que se lê taxa de abertura.
- **Barra de progresso** enquanto `status === 'enviando'`, com polling de 10 s: `enviados / total`.
- **Gráfico** de aberturas e cliques ao longo do tempo, com `recharts` (já instalado) via `components/ui/chart.tsx`.
- **Ranking de links clicados**, a partir de `links` na resposta.
- **Tabela de destinatários** com busca por e-mail e filtro por status, alimentada por `?status=` na query.

Reaproveitar a estética dos cards de `app/popups/[id]/analytics/page.tsx`.

- [ ] **Step 3: Verificar no navegador**

Run: `npm run dev`

Com uma campanha já disparada para uma lista interna pequena, conferir que os cards batem com o banco:

```sql
select status, count(*) from email_campaign_recipients where campaign_id = '<id>' group by status;
```

- [ ] **Step 4: Commit**

```bash
git add app/email-marketing/\[id\]/page.tsx
git commit -m "feat(email): tela de status do disparo"
```

---

## Task 14: Validação ponta a ponta

**Files:** nenhum arquivo novo — é a verificação do conjunto.

- [ ] **Step 1: Rodar toda a suíte**

Run: `npm test`
Expected: todas as suítes passam, incluindo as 5 pré-existentes.

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build conclui. Conferir que as rotas `/api/email-campaigns/*`, `/api/cron/email-campaigns`, `/api/webhooks/resend` e `/api/unsubscribe` aparecem na listagem.

- [ ] **Step 4: Disparo real para a lista interna**

Criar uma campanha cuja audiência seja `lista_espera` com um filtro que resulte em 2–3 endereços da própria equipe (ou inserir manualmente as linhas em `email_campaign_recipients`). Disparar e confirmar:

1. Os e-mails chegam.
2. `email_campaign_recipients.status` vira `enviado` e depois `entregue`.
3. Abrir o e-mail muda para `aberto`; clicar no CTA muda para `clicado`.
4. `email_campaign_events` recebe as linhas correspondentes, com `campaign_id` preenchido.
5. A tela de status reflete tudo.
6. **Conferir que a `email_events` do `1-ano-SommaDay` não recebeu nada deste disparo:**

```sql
select count(*) from email_events where created_at > '<horário do disparo>';
```

Deve permanecer no valor anterior (fora eventos do próprio SommaDay).

- [ ] **Step 5: Verificar a retomada**

Com uma campanha de audiência maior, interromper o processo (`Ctrl+C`) no meio do disparo. Confirmar que:
1. Parte dos destinatários está `enviado` e parte `pendente`.
2. Chamar `/api/email-campaigns/:id/dispatch` de novo retorna 409 (já está `enviando`), e o cron retoma.
3. Ninguém recebeu duas vezes:

```sql
select email, count(*) from email_campaign_recipients
where campaign_id = '<id>' group by email having count(*) > 1;
```

Deve retornar zero linhas.

- [ ] **Step 6: Verificar a supressão**

Descadastrar um dos endereços de teste, criar nova campanha que o inclua e confirmar que a contagem da audiência o exclui e que ele não recebe.

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "chore(email): validação ponta a ponta do módulo"
```

---

## Notas de implantação

Depois do merge, a implantação segue a Fase 4 da spec — **nesta ordem, medindo bounce e reclamação antes de avançar**:

1. Lista interna (equipe)
2. `lista_espera` — 161, intenção declarada
3. `lista_vip` — 599, intenção declarada
4. `membros` — 6.293, **só após decisão sobre consentimento**
5. `checkins` — 7.484, **só após decisão sobre consentimento**

Bounce acima de 5% ou reclamação acima de 0,1% degradam a entregabilidade de todo o
domínio `sommaclub.com.br` — inclusive dos e-mails transacionais do `1-ano-SommaDay`,
que compartilham o mesmo domínio e a mesma reputação. Parar e investigar antes de seguir.

A questão do consentimento (LGPD) permanece **em aberto** e é decisão do responsável pelo
produto, não do implementador.
