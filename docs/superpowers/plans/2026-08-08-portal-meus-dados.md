# Portal do Insider — Meus dados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o Insider logado altere o próprio cadastro e a foto pelo painel, sem redigitar CPF nem senha.

**Architecture:** Uma rota autenticada `PUT /api/insiders/eu` que reusa o schema e o mapper já existentes, e um componente de formulário próprio do painel — separado do formulário público, que está sendo editado por outra frente na `main`. Antes disso, fecha-se a brecha de CSRF no login, que a revisão final da Fatia 1 marcou como pré-requisito exato deste momento.

**Tech Stack:** Next.js 15.5.10 (App Router), React 19.2.0, TypeScript, Tailwind v3, Supabase (service role), jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-portal-insider-design.md`, seção `PUT /api/insiders/eu` e a emenda de 2026-08-08.
- **A identidade vem sempre do cookie assinado.** Nenhuma rota autenticada pode aceitar `id` ou `cpf` do cliente para decidir qual linha alterar.
- O CPF **não muda** por esta tela. Ele identifica a pessoa em outras telas do admin e a grafia gravada é usada para derivar `asaas_customer_id`.
- As sete colunas de benefício (`evolve`, `dopahmina`, `tex_barbearia`, `cupom_loja_somma`, `big_box`, `assessoria_somma`, `estamina_recovery`) **nunca** são lidas nem escritas por esta feature. `dopahmina` mantém o typo.
- Foto: jpeg/png/webp, 5MB, bucket `insider-fotos`, extensão derivada do MIME validado — nunca do nome do arquivo.
- Erros no formato `{ error: string }` + status; logs prefixados `[insiders/eu]`.
- **Não modificar** `components/insider/insider-cadastro-form.tsx` — outra frente está editando esse arquivo na `main` e um conflito ali é caro. O formulário do painel é componente novo.
- Não modificar `tailwind.config.ts`. Cores por classe arbitrária.
- Typecheck com `npx tsc --noEmit`, filtrando por caminho exato. **Nunca** filtrar a saída por "insider": o worktree se chama `v0-somma-insider` e todo caminho casa. O repositório tem ~31 erros pré-existentes em telas legadas que não são desta feature.
- Suíte em 175 passando; manter verde.
- Commits em português com o trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/auth/same-origin.ts` | **Criar** — checagem de origem para rotas públicas de escrita |
| `lib/auth/__tests__/same-origin.test.ts` | **Criar** — testes da checagem |
| `app/api/insiders/entrar/route.ts` | **Modificar** — aplicar a checagem |
| `app/api/insiders/criar-senha/route.ts` | **Modificar** — aplicar a checagem |
| `app/api/insiders/eu/route.ts` | **Modificar** — acrescentar o handler `PUT` |
| `components/insider/portal-meus-dados.tsx` | **Criar** — formulário de edição no painel |
| `app/insider/painel/page.tsx` | **Modificar** — montar a seção "Meus dados" |

---

### Task 1: Fechar a brecha de CSRF no login

**Files:**
- Create: `lib/auth/same-origin.ts`
- Test: `lib/auth/__tests__/same-origin.test.ts`
- Modify: `app/api/insiders/entrar/route.ts`, `app/api/insiders/criar-senha/route.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `isSameOrigin(req: Request): boolean`

**Por que agora.** A revisão final da Fatia 1 registrou isto como pendência a resolver "na Fatia 2 no mais tardar, porque a Fatia 2 acrescenta `PUT /api/insiders/eu`, onde a mesma brecha vira primitiva de escrita".

O ataque concreto: `entrar` e `criar-senha` usam `req.json()`, que aceita qualquer `Content-Type`. Um formulário em outro site, com `enctype="text/plain"`, consegue montar um corpo com formato JSON e disparar um POST. `SameSite=Lax` impede o cookie de ser *enviado* nesse POST, mas não impede a resposta de *gravar* um cookie novo. O resultado é login forçado: a vítima passa a estar logada na conta do atacante sem perceber. Sozinho isso é chato; com uma rota de edição no ar, a vítima passa a escrever os próprios dados — e a enviar a própria foto — dentro da conta alheia.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/auth/__tests__/same-origin.test.ts
import { isSameOrigin } from '../same-origin'

function req(headers: Record<string, string>): Request {
  return new Request('https://admin.sommaclub.com.br/api/insiders/entrar', {
    method: 'POST',
    headers,
  })
}

describe('isSameOrigin', () => {
  it('aceita quando o Origin bate com o host', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br',
      host: 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('recusa quando o Origin é de outro site', () => {
    expect(isSameOrigin(req({
      origin: 'https://site-malicioso.com',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('recusa quando o Origin tem o host como sufixo', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br.malicioso.com',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('aceita quando não há Origin mas o Referer é do mesmo host', () => {
    expect(isSameOrigin(req({
      referer: 'https://admin.sommaclub.com.br/insider',
      host: 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('recusa quando o Referer é de outro site', () => {
    expect(isSameOrigin(req({
      referer: 'https://site-malicioso.com/pagina',
      host: 'admin.sommaclub.com.br',
    }))).toBe(false)
  })

  it('recusa quando não há nem Origin nem Referer', () => {
    expect(isSameOrigin(req({ host: 'admin.sommaclub.com.br' }))).toBe(false)
  })

  it('recusa quando não há host', () => {
    expect(isSameOrigin(req({ origin: 'https://admin.sommaclub.com.br' }))).toBe(false)
  })

  it('usa x-forwarded-host quando presente, como atrás de proxy', () => {
    expect(isSameOrigin(req({
      origin: 'https://admin.sommaclub.com.br',
      host: 'localhost:3000',
      'x-forwarded-host': 'admin.sommaclub.com.br',
    }))).toBe(true)
  })

  it('ignora Origin malformado sem lançar', () => {
    expect(isSameOrigin(req({ origin: 'nao-e-url', host: 'admin.sommaclub.com.br' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/auth/__tests__/same-origin.test.ts`
Expected: FAIL — `Cannot find module '../same-origin'`.

- [ ] **Step 3: Implementar**

```ts
// lib/auth/same-origin.ts

/**
 * Recusa requisições de escrita vindas de outro site.
 *
 * `entrar` e `criar-senha` são públicas e emitem cookie de sessão. Sem esta
 * checagem, um formulário hospedado em outro domínio consegue disparar um
 * POST com corpo em formato JSON (usando enctype="text/plain") e logar a
 * vítima na conta do atacante — o SameSite=Lax impede o cookie de ser
 * enviado, mas não impede a resposta de gravar um novo.
 *
 * Compara o Origin (ou o Referer, quando o Origin não vem) com o host da
 * própria requisição. Ausência dos dois é recusa: um navegador sempre manda
 * Origin em POST cross-site, então requisição sem nenhum dos dois não veio
 * de um formulário legítimo do site.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!host) return false

  const bruto = req.headers.get('origin') || req.headers.get('referer')
  if (!bruto) return false

  try {
    return new URL(bruto).host === host
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Aplicar nas duas rotas**

Em `app/api/insiders/entrar/route.ts` e `app/api/insiders/criar-senha/route.ts`, logo **depois** da checagem de rate limit e **antes** de ler o corpo:

```ts
    if (!isSameOrigin(req)) {
      console.warn('[insiders/entrar] origem recusada')
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 403 })
    }
```

Ajuste o prefixo do log em cada arquivo (`[insiders/entrar]` e `[insiders/criar-senha]`). Importe `isSameOrigin` de `@/lib/auth/same-origin`.

A ordem importa: o rate limit continua sendo a primeira coisa, para que um atacante não consiga usar a checagem de origem como caminho barato de esgotar recursos.

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: 175 anteriores + 9 novos, todos verdes.

- [ ] **Step 6: Verificar ao vivo**

Com o servidor de dev no ar:

```bash
# Sem Origin -> recusado
curl -s -X POST http://localhost:3000/api/insiders/entrar \
  -H 'Content-Type: application/json' -d '{"cpf":"111.444.777-35","senha":"x"}' -w "\n%{http_code}\n"
```
Expected: `{"error":"Requisição inválida."}` e `403`.

```bash
# Com Origin correto -> volta ao 401 genérico de sempre
curl -s -X POST http://localhost:3000/api/insiders/entrar \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"cpf":"111.444.777-35","senha":"x"}' -w "\n%{http_code}\n"
```
Expected: `{"error":"CPF ou senha incorretos."}` e `401`.

- [ ] **Step 7: Confirmar que o navegador continua entrando**

O `fetch` do próprio site manda `Origin` automaticamente, então o login pela página deve seguir funcionando. Confirme com um script Node que envie `Origin: http://localhost:3000` e as credenciais do cadastro de demonstração (CPF `529.982.247-25`, senha `teste12345`), esperando `200` e o `set-cookie`.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/same-origin.ts lib/auth/__tests__/same-origin.test.ts app/api/insiders/entrar/route.ts app/api/insiders/criar-senha/route.ts
git commit -m "fix(portal): recusa login e criação de senha vindos de outra origem

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `PUT /api/insiders/eu`

**Files:**
- Modify: `app/api/insiders/eu/route.ts` (acrescentar o handler `PUT`; não alterar o `GET`)

**Interfaces:**
- Consumes: `getInsiderFromRequest` de `@/lib/auth/insider-session`; `getAdminClient` de `@/lib/auth/api-auth`; `insiderFormSchema`, `firstZodError`, `onlyDigits` de `@/lib/insider/validation`; `buildInsiderRow` de `@/lib/insider/insider-mapper`.
- Produces: `PUT /api/insiders/eu` — `multipart/form-data`; resposta `{ success: true }`.

**Contexto.** O `GET` já existe no mesmo arquivo e devolve `{ insider, beneficios }`. O `PUT` é o espelho de escrita. Diferente da rota pública `register`, **não** pede `senha_atual`: a sessão assinada já é a prova de identidade. E diferente dela, **não** aceita CPF — a linha alterada é sempre `sessao.sub`.

Campos esperados no FormData: `nome, email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado` e, opcionalmente, `foto`.

- [ ] **Step 1: Implementar o handler**

Acrescentar ao final de `app/api/insiders/eu/route.ts`, mantendo o `GET` intocado:

```ts
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'insider-fotos'

export async function PUT(req: NextRequest) {
  try {
    // A identidade vem do cookie assinado. O CPF não é aceito do cliente e
    // não muda por esta rota: outras telas do admin dependem da grafia gravada.
    const sessao = await getInsiderFromRequest(req)
    if (!sessao) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const formData = await req.formData()
    const campo = (nome: string) => String(formData.get(nome) ?? '').trim()

    const parsed = insiderFormSchema.safeParse({
      cpf: sessao.cpf,
      nome: campo('nome'),
      email: campo('email'),
      telefone: campo('telefone'),
      data_nascimento: campo('data_nascimento'),
      sexo: campo('sexo'),
      cep: campo('cep'),
      logradouro: campo('logradouro'),
      numero: campo('numero'),
      complemento: campo('complemento'),
      bairro: campo('bairro'),
      cidade: campo('cidade'),
      estado: campo('estado'),
      consent_lgpd: true,
      consent_imagem: true,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const supabase = getAdminClient()

    let fotoUrl: string | null = null
    const foto = formData.get('foto')
    if (foto instanceof File && foto.size > 0) {
      if (foto.size > MAX_SIZE) {
        return NextResponse.json({ error: 'A foto deve ter no máximo 5MB.' }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(foto.type)) {
        return NextResponse.json(
          { error: 'Formato de foto não suportado. Use JPG, PNG ou WebP.' },
          { status: 400 }
        )
      }

      const ext = EXT_BY_MIME[foto.type] || 'jpg'
      const path = `${onlyDigits(sessao.cpf)}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, await foto.arrayBuffer(), { contentType: foto.type, upsert: true })

      if (uploadError) {
        console.error('[insiders/eu] upload error:', uploadError)
        return NextResponse.json({ error: 'Erro ao enviar a foto.' }, { status: 500 })
      }

      fotoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    const row = buildInsiderRow(parsed.data)
    // O consentimento já foi dado no cadastro; esta tela não o renegocia.
    delete row.consent_lgpd
    delete row.consent_imagem
    row.atualizado_em = new Date().toISOString()
    if (fotoUrl) row.foto_url = fotoUrl

    const { error: updateError } = await supabase
      .from('dados_insiders')
      .update(row)
      .eq('id', sessao.sub)

    if (updateError) {
      console.error('[insiders/eu] update error:', updateError)
      return NextResponse.json({ error: 'Erro ao salvar seus dados.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
```

Note dois pontos deliberados: `cpf` entra no schema vindo da **sessão**, só para satisfazer a validação, e `buildInsiderRow` já não emite `cpf`, então a coluna nunca é tocada. E os consentimentos são removidos da linha antes do update — foram dados no cadastro e esta tela não os renegocia.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep 'app/api/insiders/eu'`
Expected: nada impresso.

- [ ] **Step 3: Verificar que exige sessão**

```bash
curl -s -X PUT http://localhost:3000/api/insiders/eu -w "\n%{http_code}\n"
```
Expected: `{"error":"Não autenticado."}` e `401`.

- [ ] **Step 4: Verificar a edição com sessão real**

Escreva um script Node em `/tmp` que: faça login como o cadastro de demonstração (CPF `529.982.247-25`, senha `teste12345`, com header `Origin: http://localhost:3000`), capture o cookie, envie um `PUT` multipart alterando a cidade para `Goiânia`, e confirme pelo Supabase que a linha mudou, que o CPF continua igual e que as sete colunas de benefício continuam intactas. Use `FormData` do Node — `curl` corrompe multipart neste ambiente. Devolva a cidade ao valor anterior ao final.

- [ ] **Step 5: Commit**

```bash
git add app/api/insiders/eu/route.ts
git commit -m "feat(portal): rota autenticada de edição do próprio cadastro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Formulário "Meus dados" no painel

**Files:**
- Create: `components/insider/portal-meus-dados.tsx`
- Modify: `app/insider/painel/page.tsx`

**Interfaces:**
- Consumes: `INPUT_CLS`, `InsiderField` de `@/components/insider/insider-form-ui`; `useCepLookup` de `@/hooks/use-cep-lookup`; `maskCep`, `maskDate`, `maskPhone`, `maskUf`, `isValidBirthDate`, `onlyDigits` de `@/lib/insider/validation`; `PUT /api/insiders/eu`.
- Produces: `PortalMeusDados({ insider })`, onde `insider` é o objeto `InsiderPublic` que o painel já carrega.

**Contexto.** Este é um componente novo, não uma extração do formulário público — aquele arquivo está sendo editado por outra frente na `main` e um conflito ali é caro. Aqui a pessoa já está autenticada, então não há CPF, nem busca por CPF, nem consentimentos, nem senha: são apenas os campos do cadastro, todos visíveis de uma vez, com um botão de salvar.

- [ ] **Step 1: Criar o componente**

```tsx
// components/insider/portal-meus-dados.tsx
"use client"

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Loader2 } from 'lucide-react'
import { INPUT_CLS, InsiderField } from '@/components/insider/insider-form-ui'
import { useCepLookup } from '@/hooks/use-cep-lookup'
import {
  isValidBirthDate,
  maskCep,
  maskDate,
  maskPhone,
  maskUf,
  onlyDigits,
} from '@/lib/insider/validation'
import type { InsiderPublic } from '@/lib/insider/insider-mapper'

type Campos = {
  nome: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

export function PortalMeusDados({ insider }: { insider: InsiderPublic }) {
  const [form, setForm] = useState<Campos>({
    nome: insider.nome,
    email: insider.email,
    telefone: insider.telefone,
    data_nascimento: insider.data_nascimento,
    sexo: insider.sexo,
    cep: insider.cep,
    logradouro: insider.logradouro,
    numero: insider.numero,
    complemento: insider.complemento,
    bairro: insider.bairro,
    cidade: insider.cidade,
    estado: insider.estado,
  })
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const cep = useCepLookup()
  const ultimoCep = useRef(onlyDigits(insider.cep))

  const set = (campo: keyof Campos, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    setSalvo(false)
  }

  async function handleCepChange(valor: string) {
    const formatado = maskCep(valor)
    set('cep', formatado)

    const digits = onlyDigits(formatado)
    if (digits.length !== 8 || digits === ultimoCep.current) return

    ultimoCep.current = digits
    const endereco = await cep.buscar(digits)
    if (!endereco) {
      ultimoCep.current = ''
      return
    }
    setForm((f) => ({
      ...f,
      logradouro: endereco.logradouro || f.logradouro,
      bairro: endereco.bairro || f.bairro,
      cidade: endereco.cidade || f.cidade,
      estado: endereco.estado || f.estado,
    }))
  }

  function handleFoto(file: File | null) {
    setSalvo(false)
    if (file && file.size > 5 * 1024 * 1024) {
      setErro('A foto deve ter no máximo 5MB.')
      return
    }
    setErro(null)
    setFoto(file)
    setFotoPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  async function salvar() {
    if (salvando) return
    setErro(null)

    if (!isValidBirthDate(form.data_nascimento)) {
      setErro('Data de nascimento inválida.')
      return
    }

    const payload = new FormData()
    Object.entries(form).forEach(([chave, valor]) => payload.append(chave, valor))
    if (foto) payload.append('foto', foto)

    setSalvando(true)
    try {
      const res = await fetch('/api/insiders/eu', { method: 'PUT', body: payload })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível salvar.')
      }
      setSalvo(true)
      setFoto(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const fotoMostrada = fotoPreview || insider.foto_url

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg md:p-8">
      <div className="flex items-center gap-4">
        {fotoMostrada ? (
          <Image
            src={fotoMostrada}
            alt="Sua foto de perfil"
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FF2C03] text-lg font-semibold text-white">
            {iniciais(insider.nome)}
          </div>
        )}
        <div>
          <label
            htmlFor="foto_perfil"
            className="cursor-pointer text-sm font-medium text-[#FF2C03] underline"
          >
            Trocar foto
          </label>
          <input
            id="foto_perfil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFoto(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <p className="mt-1 text-sm text-[#737373]">JPG, PNG ou WebP, até 5MB.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <InsiderField id="md_nome" label="Nome completo">
          <input
            id="md_nome"
            type="text"
            autoComplete="name"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <InsiderField id="md_email" label="E-mail">
          <input
            id="md_email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="md_telefone" label="WhatsApp">
            <input
              id="md_telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.telefone}
              onChange={(e) => set('telefone', maskPhone(e.target.value))}
              className={INPUT_CLS}
              placeholder="(61) 99999-9999"
            />
          </InsiderField>
          <InsiderField id="md_nascimento" label="Data de nascimento">
            <input
              id="md_nascimento"
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', maskDate(e.target.value))}
              className={INPUT_CLS}
              placeholder="DD/MM/AAAA"
            />
          </InsiderField>
        </div>

        <InsiderField id="md_sexo" label="Sexo">
          <select
            id="md_sexo"
            value={form.sexo}
            onChange={(e) => set('sexo', e.target.value)}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="">Selecione uma opção</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </InsiderField>

        <InsiderField id="md_cep" label="CEP">
          <input
            id="md_cep"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            className={INPUT_CLS}
            placeholder="00000-000"
          />
        </InsiderField>
        {cep.status === 'loading' && (
          <p className="text-sm text-[#737373]">Buscando endereço…</p>
        )}
        {cep.status === 'error' && (
          <p className="text-sm text-[#737373]">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}

        <InsiderField id="md_logradouro" label="Endereço">
          <input
            id="md_logradouro"
            type="text"
            autoComplete="address-line1"
            value={form.logradouro}
            onChange={(e) => set('logradouro', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="md_numero" label="Número">
            <input
              id="md_numero"
              type="text"
              value={form.numero}
              onChange={(e) => set('numero', e.target.value)}
              className={INPUT_CLS}
            />
          </InsiderField>
          <InsiderField id="md_complemento" label="Complemento">
            <input
              id="md_complemento"
              type="text"
              value={form.complemento}
              onChange={(e) => set('complemento', e.target.value)}
              className={INPUT_CLS}
              placeholder="Apto, bloco (opcional)"
            />
          </InsiderField>
        </div>

        <InsiderField id="md_bairro" label="Bairro">
          <input
            id="md_bairro"
            type="text"
            value={form.bairro}
            onChange={(e) => set('bairro', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-[1fr_88px] gap-3">
          <InsiderField id="md_cidade" label="Cidade">
            <input
              id="md_cidade"
              type="text"
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
              className={INPUT_CLS}
            />
          </InsiderField>
          <InsiderField id="md_estado" label="UF">
            <input
              id="md_estado"
              type="text"
              value={form.estado}
              onChange={(e) => set('estado', maskUf(e.target.value))}
              className={INPUT_CLS}
              placeholder="DF"
            />
          </InsiderField>
        </div>
      </div>

      {erro && <p role="alert" className="mt-4 text-sm font-medium text-[#EF4444]">{erro}</p>}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
      >
        {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {salvo && !salvando ? <Check className="h-5 w-5" /> : null}
        {salvo && !salvando ? 'Dados salvos' : 'Salvar alterações'}
      </button>
    </div>
  )
}

function iniciais(nome: string): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0][0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : ''
  return (primeira + ultima).toUpperCase()
}
```

- [ ] **Step 2: Montar a seção no painel**

Em `app/insider/painel/page.tsx`, importar o componente e o mapper, e acrescentar a seção depois da de benefícios. O painel já lê a linha; passe-a por `toInsiderPublic` para obter o objeto que o componente espera:

```tsx
import { INSIDER_PUBLIC_COLUMNS, toInsiderPublic } from '@/lib/insider/insider-mapper'
import { PortalMeusDados } from '@/components/insider/portal-meus-dados'
```

```tsx
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Meus dados</h2>
        <p className="mt-1 text-sm text-white/70">
          Mantenha seu contato e endereço atualizados.
        </p>
        <div className="mt-6">
          <PortalMeusDados insider={toInsiderPublic(row as Record<string, unknown>, true)} />
        </div>
      </section>
```

O segundo argumento de `toInsiderPublic` é `temSenha`, que este componente não usa; passar `true` é indiferente aqui.

- [ ] **Step 3: Typecheck e testes**

Run: `npx tsc --noEmit 2>&1 | grep -E 'portal-meus-dados|app/insider/painel'`
Expected: nada impresso.

Run: `npm test`
Expected: mesma contagem da Task 1, tudo verde.

- [ ] **Step 4: Verificar no painel**

Com o servidor no ar, entre como o cadastro de demonstração (CPF `529.982.247-25`, senha `teste12345`) e confirme no HTML do painel que a seção "Meus dados" aparece com os campos preenchidos — em particular `id="md_nome"` e o valor da cidade atual.

- [ ] **Step 5: Commit**

```bash
git add components/insider/portal-meus-dados.tsx app/insider/painel/page.tsx
git commit -m "feat(portal): seção Meus dados no painel do Insider

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura:**

| Requisito | Task |
|---|---|
| CSRF fechado antes de existir rota de escrita | 1 |
| `PUT /api/insiders/eu` autenticado | 2 |
| Identidade só da sessão; CPF nunca do cliente | 2 |
| Benefícios nunca lidos nem escritos | 2 (`buildInsiderRow` não os emite) |
| Foto com validação de tipo, tamanho e extensão do MIME | 2 |
| Formulário de edição no painel | 3 |
| Autofill de CEP reaproveitado | 3 |

**Fora deste plano, por desenho:** troca de senha pelo painel e a seção de eventos — restante da Fatia 2. A quebra do formulário público em blocos segue adiada, com o motivo registrado nas Global Constraints.
