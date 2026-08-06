# CRUD completo de Insiders no admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o admin edite todos os dados de um insider existente e cadastre um novo, direto em `admin.sommaclub.com.br/?section=insiders`.

**Architecture:** Reaproveita a tabela `dados_insiders` (+ 1 coluna nova `ativo`), segue o padrão de CRUD já usado no módulo Membros (`GET`/`PATCH`/`DELETE` em `[id]/route.ts`, whitelist de campos em `lib/api/writable-fields.ts`, camada de serviço em `lib/services/*.ts`, modal de edição em componente próprio). Sem Supabase Auth — todas as rotas passam por `requirePermission(request, 'pagamentos')`.

**Tech Stack:** Next.js App Router (route handlers), Supabase (`getAdminClient()` com service role), React client components, Tailwind, shadcn/ui (`Card`, `Button`, `Input`, `Switch`), Jest + Testing Library.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-06-insiders-admin-crud-design.md`.
- Chave de permissão do módulo é `pagamentos`, não `insiders` — usar `requirePermission(request, 'pagamentos')` em toda rota nova.
- Ao criar um insider novo, só `nome` e `cpf` são obrigatórios; todo o resto aceita vazio.
- `consent_lgpd` e `consent_imagem` nunca são graváveis por essas rotas — somente leitura no admin.
- `foto_url` é campo de texto (URL) nesta entrega — sem upload de arquivo.
- Este repositório não tem testes automatizados para route handlers do Next (nenhum precedente em `app/api/**`); a verificação desses handlers é manual (dev server + `curl`), como já é o padrão do projeto. Funções puras (whitelist de campos, componentes React) seguem TDD normalmente.

---

### Task 1: Migration — coluna `ativo` em `dados_insiders`

**Files:**
- Create: `sql/013-insider-ativo.sql`

**Interfaces:**
- Produces: coluna `dados_insiders.ativo` (`boolean not null default true`), consumida por todas as tasks seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
-- sql/013-insider-ativo.sql
-- Adiciona a coluna de status (ativo/inativo) aos Insiders, usada pelo CRUD
-- do admin para desativar sem apagar o cadastro.
-- Aditiva: não remove nem renomeia nada existente.

BEGIN;

ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMIT;
```

- [ ] **Step 2: Rodar a migration no Supabase**

Abra o SQL Editor do projeto Supabase (mesmo usado nas migrations anteriores, ex.: `009-insider-cadastro.sql`) e execute o conteúdo de `sql/013-insider-ativo.sql`.

- [ ] **Step 3: Confirmar que a coluna existe**

No SQL Editor, rode:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'dados_insiders' AND column_name = 'ativo';
```

Esperado: uma linha com `data_type = boolean` e `column_default` contendo `true`.

- [ ] **Step 4: Commit**

```bash
git add sql/013-insider-ativo.sql
git commit -m "feat(insiders): adiciona coluna ativo em dados_insiders"
```

---

### Task 2: Expandir a whitelist de campos graváveis (`INSIDER_COLUMNS`)

**Files:**
- Modify: `lib/api/writable-fields.ts:42-51`
- Test: `lib/api/__tests__/writable-fields.test.ts`

**Interfaces:**
- Consumes: nenhuma (task independente).
- Produces: `pickInsiderFields(body: unknown): Record<string, unknown>` (já existe, só passa a aceitar mais colunas) — consumida pelas Tasks 3 e 6.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/api/__tests__/writable-fields.test.ts`:

```ts
import { pickInsiderFields } from '../writable-fields'

describe('pickInsiderFields', () => {
  const fullBody = {
    id: 'should-be-dropped',
    nome: 'Maria Silva',
    cpf: '52998224725',
    evolve: 'VIP',
    dopahmina: 'D10',
    tex_barbearia: 'T10',
    big_box: 'B10',
    cupom_loja_somma: 'CUPOM10',
    assessoria_somma: 'Sim',
    estamina_recovery: 'R10',
    tamanho_camisa: 'M',
    email: 'maria@exemplo.com',
    telefone: '(61) 99999-8888',
    data_nascimento: '1990-03-15',
    sexo: 'feminino',
    cep: '70000-000',
    logradouro: 'SQN 210',
    numero: '101',
    complemento: 'Bloco A',
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    estado: 'DF',
    foto_url: 'https://exemplo.com/foto.jpg',
    ativo: false,
    consent_lgpd: true,
    consent_imagem: true,
    criado_em: 'should-be-dropped',
    atualizado_em: 'should-be-dropped',
    senha_hash: 'should-be-dropped',
  }

  it('mantém todos os campos editáveis pelo admin', () => {
    const result = pickInsiderFields(fullBody)
    expect(result).toMatchObject({
      nome: 'Maria Silva',
      cpf: '52998224725',
      evolve: 'VIP',
      dopahmina: 'D10',
      tex_barbearia: 'T10',
      big_box: 'B10',
      cupom_loja_somma: 'CUPOM10',
      assessoria_somma: 'Sim',
      estamina_recovery: 'R10',
      tamanho_camisa: 'M',
      email: 'maria@exemplo.com',
      telefone: '(61) 99999-8888',
      data_nascimento: '1990-03-15',
      sexo: 'feminino',
      cep: '70000-000',
      logradouro: 'SQN 210',
      numero: '101',
      complemento: 'Bloco A',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      estado: 'DF',
      foto_url: 'https://exemplo.com/foto.jpg',
      ativo: false,
    })
  })

  it('descarta campos fora da whitelist (id, timestamps, consentimento e senha)', () => {
    const result = pickInsiderFields(fullBody)
    for (const proibido of [
      'id',
      'criado_em',
      'atualizado_em',
      'senha_hash',
      'consent_lgpd',
      'consent_imagem',
    ]) {
      expect(result).not.toHaveProperty(proibido)
    }
  })

  it('descarta campos ausentes do corpo em vez de gravar undefined', () => {
    const result = pickInsiderFields({ nome: 'Só nome' })
    expect(Object.keys(result)).toEqual(['nome'])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest lib/api/__tests__/writable-fields.test.ts`
Expected: FAIL nos dois primeiros `it` — os campos novos (`estamina_recovery`, `tamanho_camisa`, `email`, etc.) ainda não estão em `INSIDER_COLUMNS`, então `result` não bate com o `toMatchObject`.

- [ ] **Step 3: Expandir `INSIDER_COLUMNS`**

Em `lib/api/writable-fields.ts`, substituir o bloco `INSIDER_COLUMNS` (linhas 42-51) por:

```ts
const INSIDER_COLUMNS = [
  'nome',
  'cpf',
  'evolve',
  'dopahmina',
  'tex_barbearia',
  'big_box',
  'cupom_loja_somma',
  'assessoria_somma',
  'estamina_recovery',
  'tamanho_camisa',
  'email',
  'telefone',
  'data_nascimento',
  'sexo',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'foto_url',
  'ativo',
] as const
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest lib/api/__tests__/writable-fields.test.ts`
Expected: PASS nos 3 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/api/writable-fields.ts lib/api/__tests__/writable-fields.test.ts
git commit -m "feat(insiders): expande INSIDER_COLUMNS para dados pessoais e status"
```

---

### Task 3: `GET` e `PATCH` em `app/api/insiders/[id]/route.ts`

**Files:**
- Modify: `app/api/insiders/[id]/route.ts` (hoje só tem `DELETE`, linhas 1-42)

**Interfaces:**
- Consumes: `pickInsiderFields` de `lib/api/writable-fields.ts` (Task 2); `getAdminClient`, `requirePermission` de `@/lib/auth/api-auth` (já existentes).
- Produces: `GET /api/insiders/:id` → `{ data: <linha completa> }` ou `404`; `PATCH /api/insiders/:id` → `{ data: <linha atualizada> }` ou `404`/`400` — consumidos por `lib/services/insiders.ts` (Task 4).

- [ ] **Step 1: Reescrever o arquivo com `GET`, `PATCH` e o `DELETE` existente**

Substituir todo o conteúdo de `app/api/insiders/[id]/route.ts` por:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickInsiderFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[insiders] Erro ao buscar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Insider não encontrado' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[insiders] Erro inesperado no GET [id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  try {
    const fields = pickInsiderFields(await request.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .update(fields)
      .eq('id', id)
      .select('*')

    if (error) {
      console.error('[insiders] Erro ao atualizar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Insider não encontrado (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: data[0] })
  } catch (err) {
    console.error('[insiders] Erro inesperado no PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[insiders] Erro ao deletar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Insider não encontrado (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[insiders] Erro inesperado no DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verificar manualmente com o servidor de dev**

Run: `npm run dev` (ou `pnpm dev`, conforme o gerenciador do projeto).

Com uma sessão de admin válida (cookie `somma_session` do browser logado), pegue um `id` existente via `GET /api/insiders` e teste:

```bash
curl -b "somma_session=<cookie>" http://localhost:3000/api/insiders/<id>
# Esperado: 200, { "data": { ...todas as colunas... } }

curl -b "somma_session=<cookie>" http://localhost:3000/api/insiders/00000000-0000-0000-0000-000000000000
# Esperado: 404, { "error": "Insider não encontrado" }

curl -b "somma_session=<cookie>" -X PATCH -H "Content-Type: application/json" \
  -d '{"estamina_recovery":"TESTE","consent_lgpd":true}' \
  http://localhost:3000/api/insiders/<id>
# Esperado: 200, { "data": { ..., "estamina_recovery": "TESTE" } } — repare que
# consent_lgpd NÃO deve ter mudado (whitelist descarta o campo).

curl -b "somma_session=<cookie>" -X PATCH -H "Content-Type: application/json" \
  -d '{}' http://localhost:3000/api/insiders/<id>
# Esperado: 400, { "error": "Nenhum campo válido para atualizar" }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/insiders/\[id\]/route.ts
git commit -m "feat(insiders): adiciona GET e PATCH em /api/insiders/[id]"
```

---

### Task 4: Camada de serviço `lib/services/insiders.ts`

**Files:**
- Create: `lib/services/insiders.ts`

**Interfaces:**
- Consumes: `apiFetch` de `@/lib/api-client` (já existente); as rotas da Task 3 e a `POST /api/insiders` já existente.
- Produces:
  - `type Insider = { id: string; nome: string; cpf: string; evolve: string | null; dopahmina: string | null; tex_barbearia: string | null; big_box: string | null; cupom_loja_somma: string | null; assessoria_somma: string | null; estamina_recovery: string | null; tamanho_camisa: string | null; email: string | null; telefone: string | null; data_nascimento: string | null; sexo: string | null; cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null; foto_url: string | null; ativo: boolean; consent_lgpd: boolean; consent_imagem: boolean; criado_em: string | null; atualizado_em: string | null }`
  - `type InsiderInput = Partial<Omit<Insider, 'id' | 'consent_lgpd' | 'consent_imagem' | 'criado_em' | 'atualizado_em'>>`
  - `getInsiders(): Promise<Insider[]>`
  - `getInsiderById(id: string): Promise<Insider | null>`
  - `createInsider(insider: InsiderInput): Promise<Insider>`
  - `updateInsider(id: string, updates: InsiderInput): Promise<Insider>`
  - `deleteInsider(id: string): Promise<void>`

  Consumidos pelas Tasks 5 e 6.

- [ ] **Step 1: Criar o arquivo**

```ts
import { apiFetch } from '@/lib/api-client'

export interface Insider {
  id: string
  nome: string
  cpf: string
  evolve: string | null
  dopahmina: string | null
  tex_barbearia: string | null
  big_box: string | null
  cupom_loja_somma: string | null
  assessoria_somma: string | null
  estamina_recovery: string | null
  tamanho_camisa: string | null
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  sexo: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  foto_url: string | null
  ativo: boolean
  consent_lgpd: boolean
  consent_imagem: boolean
  criado_em: string | null
  atualizado_em: string | null
}

export type InsiderInput = Partial<
  Omit<Insider, 'id' | 'consent_lgpd' | 'consent_imagem' | 'criado_em' | 'atualizado_em'>
>

async function readJson(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error || `Falha na requisição (HTTP ${res.status})`)
  }
  return body
}

export async function getInsiders(): Promise<Insider[]> {
  const res = await apiFetch('/api/insiders')
  const body = await readJson(res)
  return body.data || []
}

export async function getInsiderById(id: string): Promise<Insider | null> {
  const res = await apiFetch(`/api/insiders/${id}`)
  if (res.status === 404) return null
  const body = await readJson(res)
  return body.data ?? null
}

export async function createInsider(insider: InsiderInput): Promise<Insider> {
  const res = await apiFetch('/api/insiders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insider),
  })
  const body = await readJson(res)
  return body.data
}

export async function updateInsider(id: string, updates: InsiderInput): Promise<Insider> {
  const res = await apiFetch(`/api/insiders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const body = await readJson(res)
  return body.data
}

export async function deleteInsider(id: string): Promise<void> {
  const res = await apiFetch(`/api/insiders/${id}`, { method: 'DELETE' })
  await readJson(res)
}
```

Nota: assim como `lib/services/members.ts`, este arquivo é um wrapper fino de `fetch` — o projeto não tem testes automatizados para essa camada (só para rotas puras). A verificação acontece na Task 6, usando os componentes de UI.

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `lib/services/insiders.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/services/insiders.ts
git commit -m "feat(insiders): adiciona camada de serviço lib/services/insiders.ts"
```

---

### Task 5: Componente `InsiderFormModal` (criar + editar)

**Files:**
- Create: `components/insider-form-modal.tsx`
- Test: `components/__tests__/insider-form-modal.test.tsx`

**Interfaces:**
- Consumes: `Insider`, `InsiderInput`, `createInsider`, `updateInsider` de `@/lib/services/insiders` (Task 4); `maskCpf`, `maskCep`, `maskPhone`, `maskUf` de `@/lib/insider/validation` (já existentes, testadas); `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Button`, `Input`, `Switch` de `@/components/ui/*` (já existentes).
- Produces: `InsiderFormModal(props: { insider: Insider | null; onClose: () => void; onSaved: (insider: Insider) => void; onDelete: (id: string) => Promise<void> })` — consumido pela Task 6.

- [ ] **Step 1: Escrever o teste que falha**

Criar `components/__tests__/insider-form-modal.test.tsx`:

```tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InsiderFormModal } from '../insider-form-modal'
import * as insidersService from '@/lib/services/insiders'
import type { Insider } from '@/lib/services/insiders'

jest.mock('@/lib/services/insiders')

const mockInsider: Insider = {
  id: 'insider-1',
  nome: 'João Silva',
  cpf: '529.982.247-25',
  evolve: 'VIP',
  dopahmina: null,
  tex_barbearia: null,
  big_box: null,
  cupom_loja_somma: null,
  assessoria_somma: null,
  estamina_recovery: null,
  tamanho_camisa: null,
  email: 'joao@exemplo.com',
  telefone: null,
  data_nascimento: null,
  sexo: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  estado: null,
  foto_url: null,
  ativo: true,
  consent_lgpd: true,
  consent_imagem: false,
  criado_em: null,
  atualizado_em: null,
}

describe('InsiderFormModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('em modo edição, preenche os campos com os dados do insider', () => {
    render(
      <InsiderFormModal
        insider={mockInsider}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument()
    expect(screen.getByDisplayValue('joao@exemplo.com')).toBeInTheDocument()
  })

  it('em modo edição, mostra os badges de consentimento como somente leitura (sem input)', () => {
    render(
      <InsiderFormModal
        insider={mockInsider}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    expect(screen.getByText(/consentimento lgpd/i)).toBeInTheDocument()
    expect(screen.getByText(/consentimento lgpd/i).closest('div')).toHaveTextContent('Sim')
  })

  it('em modo criação, nome e cpf começam vazios e o restante também', () => {
    render(
      <InsiderFormModal insider={null} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />
    )

    expect(screen.getByLabelText(/^nome/i)).toHaveValue('')
    expect(screen.getByLabelText(/^cpf/i)).toHaveValue('')
  })

  it('bloqueia salvar sem nome/cpf e mostra erro', async () => {
    render(
      <InsiderFormModal insider={null} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(screen.getByText(/nome e cpf são obrigatórios/i)).toBeInTheDocument()
    })
    expect(insidersService.createInsider).not.toHaveBeenCalled()
  })

  it('cria um insider novo e chama onSaved com o resultado', async () => {
    const created = { ...mockInsider, id: 'novo-id', nome: 'Nova Pessoa' }
    ;(insidersService.createInsider as jest.Mock).mockResolvedValue(created)
    const onSaved = jest.fn()

    render(
      <InsiderFormModal insider={null} onClose={jest.fn()} onSaved={onSaved} onDelete={jest.fn()} />
    )

    fireEvent.change(screen.getByLabelText(/^nome/i), { target: { value: 'Nova Pessoa' } })
    fireEvent.change(screen.getByLabelText(/^cpf/i), { target: { value: '52998224725' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(insidersService.createInsider).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Nova Pessoa' })
      )
      expect(onSaved).toHaveBeenCalledWith(created)
    })
  })

  it('edita um insider existente e chama updateInsider com o id certo', async () => {
    const updated = { ...mockInsider, evolve: 'PREMIUM' }
    ;(insidersService.updateInsider as jest.Mock).mockResolvedValue(updated)
    const onSaved = jest.fn()

    render(
      <InsiderFormModal insider={mockInsider} onClose={jest.fn()} onSaved={onSaved} onDelete={jest.fn()} />
    )

    fireEvent.change(screen.getByLabelText(/evolve/i), { target: { value: 'PREMIUM' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(insidersService.updateInsider).toHaveBeenCalledWith(
        'insider-1',
        expect.objectContaining({ evolve: 'PREMIUM' })
      )
      expect(onSaved).toHaveBeenCalledWith(updated)
    })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest components/__tests__/insider-form-modal.test.tsx`
Expected: FAIL — `../insider-form-modal` ainda não existe (`Cannot find module`).

- [ ] **Step 3: Implementar `components/insider-form-modal.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import { createInsider, updateInsider, type Insider, type InsiderInput } from "@/lib/services/insiders"
import { maskCpf, maskCep, maskPhone, maskUf } from "@/lib/insider/validation"

interface InsiderFormModalProps {
  insider: Insider | null
  onClose: () => void
  onSaved: (insider: Insider) => void
  onDelete: (id: string) => Promise<void>
}

type FormState = {
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  tamanho_camisa: string
  foto_url: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  evolve: string
  dopahmina: string
  tex_barbearia: string
  big_box: string
  cupom_loja_somma: string
  assessoria_somma: string
  estamina_recovery: string
  ativo: boolean
}

function toFormState(insider: Insider | null): FormState {
  return {
    nome: insider?.nome ?? "",
    cpf: insider?.cpf ?? "",
    email: insider?.email ?? "",
    telefone: insider?.telefone ?? "",
    data_nascimento: insider?.data_nascimento ?? "",
    sexo: insider?.sexo ?? "",
    tamanho_camisa: insider?.tamanho_camisa ?? "",
    foto_url: insider?.foto_url ?? "",
    cep: insider?.cep ?? "",
    logradouro: insider?.logradouro ?? "",
    numero: insider?.numero ?? "",
    complemento: insider?.complemento ?? "",
    bairro: insider?.bairro ?? "",
    cidade: insider?.cidade ?? "",
    estado: insider?.estado ?? "",
    evolve: insider?.evolve ?? "",
    dopahmina: insider?.dopahmina ?? "",
    tex_barbearia: insider?.tex_barbearia ?? "",
    big_box: insider?.big_box ?? "",
    cupom_loja_somma: insider?.cupom_loja_somma ?? "",
    assessoria_somma: insider?.assessoria_somma ?? "",
    estamina_recovery: insider?.estamina_recovery ?? "",
    ativo: insider?.ativo ?? true,
  }
}

const inputCls = "bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500"
const labelCls = "text-neutral-400 text-xs block mb-2 tracking-wide font-medium"

export function InsiderFormModal({ insider, onClose, onSaved, onDelete }: InsiderFormModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(insider))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setError(null)
    if (!form.nome.trim() || !form.cpf.trim()) {
      setError("Nome e CPF são obrigatórios")
      return
    }

    const payload: InsiderInput = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo,
      tamanho_camisa: form.tamanho_camisa,
      foto_url: form.foto_url.trim(),
      cep: form.cep.trim(),
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      complemento: form.complemento.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim(),
      evolve: form.evolve.trim(),
      dopahmina: form.dopahmina.trim(),
      tex_barbearia: form.tex_barbearia.trim(),
      big_box: form.big_box.trim(),
      cupom_loja_somma: form.cupom_loja_somma.trim(),
      assessoria_somma: form.assessoria_somma.trim(),
      estamina_recovery: form.estamina_recovery.trim(),
      ativo: form.ativo,
    }

    setSaving(true)
    try {
      const saved = insider ? await updateInsider(insider.id, payload) : await createInsider(payload)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar insider")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!insider) return
    if (!window.confirm("Tem certeza que deseja excluir este insider?")) return

    setDeleting(true)
    try {
      await onDelete(insider.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir insider")
      setDeleting(false)
    }
  }

  const busy = saving || deleting

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl my-4">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white text-lg">
            {insider ? insider.nome.toUpperCase() : "NOVO INSIDER"}
          </CardTitle>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-neutral-400 hover:text-white active:scale-90 transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-neutral-700 pb-4">
            <Label htmlFor="insider-ativo" className="text-white text-sm font-medium">
              Insider ativo
            </Label>
            <Switch
              id="insider-ativo"
              checked={form.ativo}
              onCheckedChange={(checked) => set("ativo", checked)}
              disabled={busy}
            />
          </div>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-300 tracking-wider">DADOS BÁSICOS</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="insider-nome" className={labelCls}>NOME *</label>
                <Input
                  id="insider-nome"
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label htmlFor="insider-cpf" className={labelCls}>CPF *</label>
                <Input
                  id="insider-cpf"
                  value={form.cpf}
                  onChange={(e) => set("cpf", maskCpf(e.target.value))}
                  disabled={busy}
                  className={inputCls}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label htmlFor="insider-email" className={labelCls}>EMAIL</label>
                <Input
                  id="insider-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label htmlFor="insider-telefone" className={labelCls}>TELEFONE</label>
                <Input
                  id="insider-telefone"
                  value={form.telefone}
                  onChange={(e) => set("telefone", maskPhone(e.target.value))}
                  disabled={busy}
                  className={inputCls}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label htmlFor="insider-nascimento" className={labelCls}>DATA DE NASCIMENTO</label>
                <Input
                  id="insider-nascimento"
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => set("data_nascimento", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="insider-sexo" className={labelCls}>SEXO</label>
                <select
                  id="insider-sexo"
                  value={form.sexo}
                  onChange={(e) => set("sexo", e.target.value)}
                  disabled={busy}
                  className={`${inputCls} w-full rounded-md h-10 px-3 text-sm`}
                >
                  <option value="">—</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>
              <div>
                <label htmlFor="insider-camisa" className={labelCls}>TAMANHO DE CAMISA</label>
                <select
                  id="insider-camisa"
                  value={form.tamanho_camisa}
                  onChange={(e) => set("tamanho_camisa", e.target.value)}
                  disabled={busy}
                  className={`${inputCls} w-full rounded-md h-10 px-3 text-sm`}
                >
                  <option value="">—</option>
                  {["PP", "P", "M", "G", "GG"].map((tam) => (
                    <option key={tam} value={tam}>{tam}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="insider-foto" className={labelCls}>FOTO (URL)</label>
                <Input
                  id="insider-foto"
                  value={form.foto_url}
                  onChange={(e) => set("foto_url", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>
            </div>

            {insider && (
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="text-xs bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded">
                  Consentimento LGPD: {insider.consent_lgpd ? "Sim" : "Não"}
                </div>
                <div className="text-xs bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded">
                  Consentimento de imagem: {insider.consent_imagem ? "Sim" : "Não"}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-300 tracking-wider">ENDEREÇO</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="insider-cep" className={labelCls}>CEP</label>
                <Input
                  id="insider-cep"
                  value={form.cep}
                  onChange={(e) => set("cep", maskCep(e.target.value))}
                  disabled={busy}
                  className={inputCls}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <label htmlFor="insider-estado" className={labelCls}>UF</label>
                <Input
                  id="insider-estado"
                  value={form.estado}
                  onChange={(e) => set("estado", maskUf(e.target.value))}
                  disabled={busy}
                  className={inputCls}
                  placeholder="DF"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="insider-logradouro" className={labelCls}>LOGRADOURO</label>
                <Input
                  id="insider-logradouro"
                  value={form.logradouro}
                  onChange={(e) => set("logradouro", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                  placeholder="Rua, avenida..."
                />
              </div>
              <div>
                <label htmlFor="insider-numero" className={labelCls}>NÚMERO</label>
                <Input
                  id="insider-numero"
                  value={form.numero}
                  onChange={(e) => set("numero", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="insider-complemento" className={labelCls}>COMPLEMENTO</label>
                <Input
                  id="insider-complemento"
                  value={form.complemento}
                  onChange={(e) => set("complemento", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="insider-bairro" className={labelCls}>BAIRRO</label>
                <Input
                  id="insider-bairro"
                  value={form.bairro}
                  onChange={(e) => set("bairro", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="insider-cidade" className={labelCls}>CIDADE</label>
                <Input
                  id="insider-cidade"
                  value={form.cidade}
                  onChange={(e) => set("cidade", e.target.value)}
                  disabled={busy}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-300 tracking-wider">BENEFÍCIOS</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="insider-evolve" className={labelCls}>EVOLVE</label>
                <Input id="insider-evolve" value={form.evolve} onChange={(e) => set("evolve", e.target.value)} disabled={busy} className={inputCls} placeholder="ex: VIP, Premium" />
              </div>
              <div>
                <label htmlFor="insider-dopamina" className={labelCls}>DOPAMINA</label>
                <Input id="insider-dopamina" value={form.dopahmina} onChange={(e) => set("dopahmina", e.target.value)} disabled={busy} className={inputCls} placeholder="Código ou benefício" />
              </div>
              <div>
                <label htmlFor="insider-tex" className={labelCls}>TEX BARBEARIA</label>
                <Input id="insider-tex" value={form.tex_barbearia} onChange={(e) => set("tex_barbearia", e.target.value)} disabled={busy} className={inputCls} placeholder="Desconto ou código" />
              </div>
              <div>
                <label htmlFor="insider-bigbox" className={labelCls}>BIG BOX</label>
                <Input id="insider-bigbox" value={form.big_box} onChange={(e) => set("big_box", e.target.value)} disabled={busy} className={inputCls} placeholder="Desconto ou código" />
              </div>
              <div>
                <label htmlFor="insider-cupom" className={labelCls}>CUPOM SOMMA</label>
                <Input id="insider-cupom" value={form.cupom_loja_somma} onChange={(e) => set("cupom_loja_somma", e.target.value)} disabled={busy} className={inputCls} placeholder="Código do cupom" />
              </div>
              <div>
                <label htmlFor="insider-assessoria" className={labelCls}>ASSESSORIA SOMMA</label>
                <Input id="insider-assessoria" value={form.assessoria_somma} onChange={(e) => set("assessoria_somma", e.target.value)} disabled={busy} className={inputCls} placeholder="Descrição do benefício" />
              </div>
              <div>
                <label htmlFor="insider-estamina" className={labelCls}>ESTAMINA RECOVERY</label>
                <Input id="insider-estamina" value={form.estamina_recovery} onChange={(e) => set("estamina_recovery", e.target.value)} disabled={busy} className={inputCls} placeholder="Desconto ou código" />
              </div>
            </div>
          </section>

          <div className="flex gap-2 pt-4 border-t border-neutral-700">
            <Button onClick={onClose} variant="outline" disabled={busy} className="flex-1 border-neutral-700 text-neutral-400 hover:text-white">
              Cancelar
            </Button>
            {insider && (
              <Button onClick={handleDelete} variant="destructive" disabled={busy} className="flex-1">
                {deleting ? "Excluindo..." : "Excluir"}
              </Button>
            )}
            <Button onClick={handleSave} disabled={busy} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest components/__tests__/insider-form-modal.test.tsx`
Expected: PASS em todos os `it`.

- [ ] **Step 5: Commit**

```bash
git add components/insider-form-modal.tsx components/__tests__/insider-form-modal.test.tsx
git commit -m "feat(insiders): adiciona InsiderFormModal (criar e editar)"
```

---

### Task 6: Ligar tudo em `app/insiders/page.tsx`

**Files:**
- Modify: `app/insiders/page.tsx` (arquivo inteiro, 547 linhas — reescrita completa)

**Interfaces:**
- Consumes: `Insider`, `getInsiders`, `deleteInsider` de `@/lib/services/insiders` (Task 4); `InsiderFormModal` de `@/components/insider-form-modal` (Task 5).
- Produces: nenhuma (ponta final da feature).

- [ ] **Step 1: Reescrever `app/insiders/page.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Search, Plus, Pencil, Trash2, MoreHorizontal, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { matchesTextSearch } from "@/lib/search-utils"
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import { getInsiders, deleteInsider, type Insider } from "@/lib/services/insiders"
import { InsiderFormModal } from "@/components/insider-form-modal"

export default function InsidersPage() {
  const [insiders, setInsiders] = useState<Insider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showInativos, setShowInativos] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingInsider, setEditingInsider] = useState<Insider | null>(null)

  useEffect(() => {
    fetchInsiders()
  }, [])

  const fetchInsiders = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getInsiders()
      setInsiders(data)
    } catch (err: any) {
      console.error("[insiders] Error fetching insiders:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteInsider(id)
    setInsiders((prev) => prev.filter((i) => i.id !== id))
  }

  const handleDeleteFromCard = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este insider?")) return
    try {
      await handleDelete(id)
    } catch (err: any) {
      console.error("[insiders] Error deleting insider:", err)
      alert(err.message || "Erro ao deletar insider")
    }
  }

  const openCreateModal = () => {
    setEditingInsider(null)
    setFormModalOpen(true)
  }

  const openEditModal = (insider: Insider) => {
    setEditingInsider(insider)
    setFormModalOpen(true)
  }

  const handleSaved = (saved: Insider) => {
    setInsiders((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
    })
    setFormModalOpen(false)
    setEditingInsider(null)
  }

  const visibleInsiders = showInativos ? insiders : insiders.filter((i) => i.ativo)
  const filteredInsiders = visibleInsiders.filter((insider) =>
    matchesTextSearch(searchTerm, [insider.nome, insider.cpf])
  )

  const exportToCSV = () => {
    const headers = ["Nome", "CPF", "Ativo", "Evolve", "Dopamina", "Tex Barbearia", "Big Box", "Cupom Somma", "Assessoria Somma"]
    const data = filteredInsiders.map((i) => [
      i.nome,
      i.cpf,
      i.ativo ? "Sim" : "Não",
      i.evolve || "—",
      i.dopahmina || "—",
      i.tex_barbearia || "—",
      i.big_box || "—",
      i.cupom_loja_somma || "—",
      i.assessoria_somma || "—",
    ])

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `insiders-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">INSIDERS</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">Gerencie membros VIP e seus benefícios</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="border-neutral-700 text-neutral-400 hover:text-white h-9 px-3 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Exportar
          </Button>
          <Button
            onClick={openCreateModal}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">TOTAL</p>
            <p className="text-2xl font-bold text-white font-mono">{insiders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">ATIVOS</p>
            <p className="text-2xl font-bold text-green-500 font-mono">
              {insiders.filter((i) => i.ativo).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">COM EVOLVE</p>
            <p className="text-2xl font-bold text-orange-500 font-mono">
              {insiders.filter((i) => i.evolve).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] text-neutral-400 tracking-wider mb-1">COM CUPOM</p>
            <p className="text-2xl font-bold text-blue-500 font-mono">
              {insiders.filter((i) => i.cupom_loja_somma).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 text-sm h-10"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400 shrink-0 px-1">
          <input
            type="checkbox"
            checked={showInativos}
            onChange={(e) => setShowInativos(e.target.checked)}
            className="accent-orange-500"
          />
          Mostrar inativos
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoading label="Carregando insiders..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchInsiders} />
      ) : filteredInsiders.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400">{searchTerm ? "Nenhum insider encontrado" : "Nenhum insider cadastrado"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsiders.map((insider) => (
            <div
              key={insider.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-orange-500/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{insider.nome.toUpperCase()}</h3>
                    {!insider.ativo && (
                      <span className="text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded shrink-0">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{insider.cpf}</p>
                </div>
                <button
                  onClick={() => openEditModal(insider)}
                  className="p-1.5 text-neutral-400 hover:text-orange-500 active:scale-90 transition-all shrink-0 ml-2"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4 py-3 border-t border-b border-neutral-800">
                {[
                  { label: "Evolve", value: insider.evolve },
                  { label: "Dopamina", value: insider.dopahmina },
                  { label: "Tex Barbearia", value: insider.tex_barbearia },
                  { label: "Big Box", value: insider.big_box },
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{benefit.label}</span>
                    <span className="text-xs font-mono text-white">
                      {benefit.value ? "✓" : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 mb-4">
                {insider.cupom_loja_somma && (
                  <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Cupom: {insider.cupom_loja_somma}
                  </div>
                )}
                {insider.assessoria_somma && (
                  <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Assessoria: {insider.assessoria_somma}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(insider)}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 text-xs font-medium active:scale-95 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-1" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteFromCard(insider.id)}
                  className="py-1.5 px-2 rounded-lg border border-neutral-700 text-neutral-400 hover:text-red-500 hover:border-red-700/50 text-xs font-medium active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {formModalOpen && (
        <InsiderFormModal
          insider={editingInsider}
          onClose={() => {
            setFormModalOpen(false)
            setEditingInsider(null)
          }}
          onSaved={handleSaved}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npx jest`
Expected: todos os testes passam, incluindo os novos de `writable-fields` e `insider-form-modal`.

- [ ] **Step 4: Verificação manual no admin**

Com `npm run dev` rodando e uma sessão de admin logada, em `?section=insiders`:

1. Clicar em "Novo" → preencher só Nome e CPF → Salvar → confirmar que o card aparece na lista.
2. Clicar em "Editar" nesse card → preencher email, telefone, endereço e um benefício → Salvar → reabrir o modal e confirmar que os dados persistiram.
3. Desativar o switch "Insider ativo" → Salvar → confirmar que o card some da lista e que "Mostrar inativos" o traz de volta com o badge "Inativo".
4. Clicar em "Excluir" (no card ou dentro do modal) → confirmar que o insider some definitivamente.

- [ ] **Step 5: Commit**

```bash
git add app/insiders/page.tsx
git commit -m "feat(insiders): liga InsiderFormModal e filtro de ativos na página do admin"
```

---

## Self-Review

**Cobertura da spec:**
- Coluna `ativo` + migration → Task 1.
- Whitelist expandida (benefícios + pessoais + `estamina_recovery` + `tamanho_camisa`, excluindo `consent_*`/senha) → Task 2.
- `GET`/`PATCH` em `/api/insiders/[id]`, `DELETE` preservado → Task 3.
- Camada de serviço → Task 4.
- Modal único de criar/editar com seções, badges de consentimento somente leitura, campo `foto_url` como texto → Task 5.
- Página do admin: botão "Editar" no lugar de "Ver", filtro/badge de inativos, exclusão preservada → Task 6.
- Fora de escopo (senha, upload de foto, edição de consentimento, paginação) → não implementado em nenhuma task, como esperado.

**Placeholders:** nenhum `TBD`/`TODO` — todos os steps têm código completo.

**Consistência de tipos:** `Insider`/`InsiderInput` definidos na Task 4 e usados sem alteração de forma nas Tasks 5 e 6; `InsiderFormModal` props (`insider`, `onClose`, `onSaved`, `onDelete`) idênticas entre a definição (Task 5) e o uso (Task 6); `pickInsiderFields` (Task 2) é o único ponto que lista as colunas graváveis e é consumido sem redefinição nas Tasks 3 e 6.
