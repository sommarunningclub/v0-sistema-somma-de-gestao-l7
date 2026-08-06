# Módulo Escala — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o módulo Escala no admin, onde o coordenador escala Insiders nos eventos do Somma (quem corre em cada pelotão, quem vai só apoiar, quem não vai) com visão de calendário mensal.

**Architecture:** Next.js App Router em modo SPA — `app/page.tsx` é o shell com a sidebar e importa cada módulo de `app/<modulo>/page.tsx`. O módulo tem quatro camadas: regras puras testáveis (`lib/escala-rules.ts`), acesso a dados (`lib/services/escala.ts`, service role), rotas REST em `app/api/escala/**` protegidas pelo middleware, e componentes client em `components/escala-*.tsx`. As tabelas já existem no Supabase; este plano versiona o DDL, adiciona RLS e constrói tudo acima delas.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Supabase (`@supabase/supabase-js`), Tailwind + shadcn/ui, lucide-react, Jest + Testing Library.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-05-escala-insiders-design.md`. Toda decisão de produto sai de lá.
- Idioma da UI e das mensagens de erro: **português do Brasil**.
- Tema escuro dos demais módulos: fundos `bg-neutral-900` / `bg-neutral-800`, bordas `border-neutral-700`, texto `text-white` / `text-neutral-400`, acento `orange-500`.
- Semáforo de preenchimento: `completo` → verde (`green-500`), `parcial` → amarelo (`yellow-500`), `vazio` → vermelho (`red-500`).
- `META_POR_PELOTAO = 2` é meta, **nunca** trava: o sistema aceita um terceiro insider no mesmo pelotão e apenas sinaliza.
- Status válidos: exatamente `'corre' | 'apoio' | 'nao_vai'`.
- Acesso a dados sempre server-side com `getAdminClient()` de `@/lib/auth/api-auth` ou o `getSupabase()` local do service — **nunca** com a chave anon no browser.
- Chamadas do client para a API sempre via `apiFetch` de `@/lib/api-client` (envia o cookie de sessão).
- Nome exato da permissão nova: `escala`.
- Rodar testes com `npx jest <caminho>`; typecheck com `npx tsc --noEmit`.
- Commits em português, prefixo convencional (`feat:`, `test:`, `chore:`).

---

### Task 1: Banco — versionar DDL, ligar RLS e criar a permissão

As três tabelas já foram criadas manualmente no Supabase. Esta task registra o DDL no repo (idempotente, para reproduzir o ambiente do zero), adiciona o RLS que faltou e libera a permissão `escala` nos usuários.

**Files:**
- Create: `sql/010-create-escala.sql`
- Create: `sql/011-add-escala-permission.sql`
- Create: `scripts/verify-escala-schema.mjs`

**Interfaces:**
- Consumes: tabelas `eventos`, `dados_insiders`, `users` (já existentes).
- Produces: tabelas `escala_atividades`, `escala_insiders`, `escala_insider_atividades` com RLS ligado; chave `escala` no JSONB `users.permissions`.

- [ ] **Step 1: Escrever `sql/010-create-escala.sql`**

```sql
-- ============================================================
-- Migration: Módulo Escala — escalação de Insiders por evento
-- Idempotente. Rodar no SQL Editor do Supabase.
-- ============================================================

-- 1. Catálogo de atividades (responsabilidades)
CREATE TABLE IF NOT EXISTS escala_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#F97316',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insider escalado em um evento
CREATE TABLE IF NOT EXISTS escala_insiders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  insider_id UUID NOT NULL REFERENCES dados_insiders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('corre', 'apoio', 'nao_vai')),
  pelotao TEXT,
  motivo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT escala_insiders_evento_insider_unico UNIQUE (evento_id, insider_id),
  CONSTRAINT escala_insiders_corre_exige_pelotao
    CHECK (status <> 'corre' OR pelotao IS NOT NULL),
  CONSTRAINT escala_insiders_nao_vai_exige_motivo
    CHECK (status <> 'nao_vai' OR (motivo IS NOT NULL AND btrim(motivo) <> ''))
);

-- 3. Vínculo N:N insider escalado ↔ atividade
CREATE TABLE IF NOT EXISTS escala_insider_atividades (
  escala_insider_id UUID NOT NULL REFERENCES escala_insiders(id) ON DELETE CASCADE,
  atividade_id UUID NOT NULL REFERENCES escala_atividades(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (escala_insider_id, atividade_id)
);

-- 4. Índices de consulta
CREATE INDEX IF NOT EXISTS idx_escala_insiders_evento ON escala_insiders(evento_id);
CREATE INDEX IF NOT EXISTS idx_escala_insiders_insider ON escala_insiders(insider_id);
CREATE INDEX IF NOT EXISTS idx_escala_atividades_ativo ON escala_atividades(ativo);
CREATE INDEX IF NOT EXISTS idx_escala_ia_atividade ON escala_insider_atividades(atividade_id);

-- 5. Trigger: pelotão precisa existir em eventos.pelotoes
CREATE OR REPLACE FUNCTION escala_valida_pelotao()
RETURNS TRIGGER AS $$
DECLARE
  pelotoes_evento TEXT[];
BEGIN
  IF NEW.status <> 'corre' OR NEW.pelotao IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pelotoes INTO pelotoes_evento FROM eventos WHERE id = NEW.evento_id;

  IF pelotoes_evento IS NULL OR NOT (NEW.pelotao = ANY(pelotoes_evento)) THEN
    RAISE EXCEPTION 'Pelotão "%" não existe neste evento', NEW.pelotao;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escala_valida_pelotao_trigger ON escala_insiders;
CREATE TRIGGER escala_valida_pelotao_trigger
  BEFORE INSERT OR UPDATE ON escala_insiders
  FOR EACH ROW EXECUTE FUNCTION escala_valida_pelotao();

-- 6. updated_at automático (função update_updated_at criada em 001-create-eventos-table.sql)
DROP TRIGGER IF EXISTS set_updated_at ON escala_atividades;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escala_atividades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON escala_insiders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escala_insiders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. RLS — todo acesso passa pelas APIs server-side com service_role
ALTER TABLE escala_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_insiders ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_insider_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages escala_atividades" ON escala_atividades;
CREATE POLICY "Service role manages escala_atividades" ON escala_atividades
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages escala_insiders" ON escala_insiders;
CREATE POLICY "Service role manages escala_insiders" ON escala_insiders
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages escala_insider_atividades" ON escala_insider_atividades;
CREATE POLICY "Service role manages escala_insider_atividades" ON escala_insider_atividades
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Escrever `sql/011-add-escala-permission.sql`**

Mesmo molde de `sql/005-add-tarefas-permission.sql`: quem já tem `checkin` ganha `escala`.

```sql
-- Migration: adiciona a chave "escala" ao JSONB de permissões dos usuários
-- Rodar uma vez no SQL Editor do Supabase

-- 1. Todo usuário sem a chave recebe escala = false
UPDATE users
SET permissions = permissions || '{"escala": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'escala');

-- 2. Quem já coordena o check-in ganha acesso à escala
UPDATE users
SET permissions = permissions || '{"escala": true}'::jsonb
WHERE permissions IS NOT NULL
  AND (permissions->>'checkin')::boolean IS TRUE;

-- 3. Admin tem tudo
UPDATE users
SET permissions = permissions || '{"escala": true}'::jsonb
WHERE role = 'admin';

-- Verificação
SELECT id, email, role, permissions->>'escala' AS escala_permission
FROM users
ORDER BY role, email;
```

- [ ] **Step 3: Escrever o script de verificação `scripts/verify-escala-schema.mjs`**

Atenção ao detalhe que torna esta verificação não-trivial: com RLS ligado e **sem** policy para o
papel `anon`, o PostgREST não devolve 403 — devolve `200` com lista **vazia**, exatamente igual a uma
tabela que existe e está vazia. Por isso o script grava uma linha-sonda com a service role e checa
que a chave anon **não** consegue enxergá-la.

```js
// Confere que as tabelas da Escala existem e que o RLS esconde os dados da chave anon.
// Uso: set -a; . ./.env.local; set +a; node scripts/verify-escala-schema.mjs
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const headers = (key, extra = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  ...extra,
})

let falhou = false
const falha = (msg) => { falhou = true; console.log(`FALHA ${msg}`) }

// 1. As três tabelas existem e respondem à service role
for (const tabela of ['escala_atividades', 'escala_insiders', 'escala_insider_atividades']) {
  const res = await fetch(`${url}/rest/v1/${tabela}?select=*&limit=1`, { headers: headers(serviceKey) })
  if (res.status === 200) console.log(`OK    ${tabela} existe`)
  else falha(`${tabela}: service role recebeu ${res.status}`)
}

// 2. Linha-sonda: a chave anon não pode enxergá-la
const NOME_SONDA = '__sonda_rls__'
const criada = await fetch(`${url}/rest/v1/escala_atividades`, {
  method: 'POST',
  headers: headers(serviceKey, { Prefer: 'return=representation' }),
  body: JSON.stringify({ nome: NOME_SONDA }),
})

if (criada.status !== 201) {
  falha(`não consegui criar a linha-sonda (status ${criada.status})`)
} else {
  const [sonda] = await criada.json()

  const viaAnon = await fetch(
    `${url}/rest/v1/escala_atividades?select=id&nome=eq.${NOME_SONDA}`,
    { headers: headers(anonKey) }
  )
  const visiveis = viaAnon.status === 200 ? await viaAnon.json() : []

  if (viaAnon.status === 200 && visiveis.length > 0) {
    falha('a chave anon está lendo escala_atividades — RLS não está protegendo')
  } else {
    console.log(`OK    RLS esconde os dados da chave anon (status ${viaAnon.status})`)
  }

  await fetch(`${url}/rest/v1/escala_atividades?id=eq.${sonda.id}`, {
    method: 'DELETE',
    headers: headers(serviceKey),
  })
  console.log('OK    linha-sonda removida')
}

console.log(falhou ? '\nSchema ou RLS com problema.' : '\nSchema e RLS OK.')
process.exit(falhou ? 1 : 0)
```

- [ ] **Step 4: Rodar as duas migrations no Supabase**

Abrir o SQL Editor do projeto no Supabase e executar, nesta ordem, o conteúdo de `sql/010-create-escala.sql` e depois `sql/011-add-escala-permission.sql`. As duas são idempotentes — rodar de novo em cima do que já existe não quebra.

- [ ] **Step 5: Verificar schema e RLS**

Run:
```bash
set -a; . ./.env.local; set +a; node scripts/verify-escala-schema.mjs
```
Expected: as três linhas `OK ... existe`, `OK RLS esconde os dados da chave anon`, `OK linha-sonda removida` e, ao final, `Schema e RLS OK.` (exit 0).

Se aparecer `FALHA a chave anon está lendo escala_atividades`, o RLS não pegou — reexecutar o bloco 7 de `sql/010-create-escala.sql`.

- [ ] **Step 6: Commit**

```bash
git add sql/010-create-escala.sql sql/011-add-escala-permission.sql scripts/verify-escala-schema.mjs
git commit -m "feat(escala): versiona DDL, habilita RLS e cria permissão escala"
```

---

### Task 2: Permissão `escala` no app

Registra a permissão nova nas camadas de auth e na tela de Administração, e liga a rota `/escala` à SPA.

**Files:**
- Modify: `lib/auth/types.ts`
- Modify: `lib/auth/route-permissions.ts`
- Modify: `lib/auth/page-routes.ts`
- Modify: `app/systems/page.tsx`
- Test: `lib/auth/__tests__/escala-routes.test.ts` (criar)

**Interfaces:**
- Consumes: `PermissionKey`, `getRequiredPermission`, `getPagePermission`, `SECTION_PERMISSIONS`.
- Produces: `'escala'` como `PermissionKey` válido; `/api/escala*` exige `escala`; `/escala` redireciona para `/?section=escala`; seção `escala` na SPA.

- [ ] **Step 1: Escrever o teste que falha**

Create `lib/auth/__tests__/escala-routes.test.ts`:

```ts
import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'

describe('rotas do módulo Escala', () => {
  it('exige a permissão escala nas rotas de API', () => {
    expect(getRequiredPermission('/api/escala')).toBe('escala')
    expect(getRequiredPermission('/api/escala/atividades')).toBe('escala')
    expect(getRequiredPermission('/api/escala/evento/abc-123')).toBe('escala')
  })

  it('não afeta as rotas de outros módulos', () => {
    expect(getRequiredPermission('/api/checkin')).toBe('checkin')
    expect(getRequiredPermission('/api/tarefas/tasks')).toBe('tarefas')
  })

  it('exige a permissão escala na página', () => {
    expect(getPagePermission('/escala')).toBe('escala')
  })

  it('redireciona /escala para a seção da SPA', () => {
    expect(getSpaRedirect('/escala', '')).toBe('/?section=escala')
  })

  it('registra a seção escala', () => {
    expect(SECTION_PERMISSIONS.escala).toBe('escala')
    expect(SECTION_LABELS.escala).toBe('Escala')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest lib/auth/__tests__/escala-routes.test.ts`
Expected: FAIL — `getRequiredPermission('/api/escala')` retorna `null`.

- [ ] **Step 3: Adicionar a chave em `lib/auth/types.ts`**

Em `ModulePermissions`, incluir a linha `escala` logo abaixo de `checkin`:

```ts
export interface ModulePermissions {
  dashboard: boolean
  checkin: boolean
  escala: boolean
  membros: boolean
  parceiro: boolean
  carteiras: boolean
  pagamentos: boolean
  crm: boolean
  tarefas: boolean
  popups: boolean
  admin: boolean
}
```

- [ ] **Step 4: Registrar a rota de API em `lib/auth/route-permissions.ts`**

Em `ROUTE_PERMISSIONS`, logo após a entrada de `checkin`:

```ts
  { pattern: /^\/api\/escala/, permission: 'escala' },
```

- [ ] **Step 5: Registrar a seção e a página em `lib/auth/page-routes.ts`**

Quatro edições:

```ts
// SECTION_LABELS — depois de eventos:
  escala: 'Escala',

// SECTION_PERMISSIONS — depois de eventos:
  escala: 'escala',

// LEGACY_EXACT — depois de '/eventos':
  '/escala': '/?section=escala',

// PAGE_PERMISSIONS — depois da entrada de /eventos:
  { pattern: /^\/escala/, permission: 'escala' },
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx jest lib/auth/__tests__/escala-routes.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 7: Expor a permissão na tela de Administração**

`app/systems/page.tsx` mantém uma cópia local do tipo e dos defaults. Três edições, todas inserindo `escala` logo abaixo de `checkin`:

```ts
// interface ModulePermissions (linha ~16)
  escala: boolean

// DEFAULT_PERMISSIONS (linha ~38)
  escala: false,

// MODULE_LABELS (linha ~50)
  escala: "Escala",
```

E no bloco que dá tudo ao admin (linha ~131, dentro de `if (formData.role === "admin")`), incluir `escala: true,` junto das demais.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `escala`.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/types.ts lib/auth/route-permissions.ts lib/auth/page-routes.ts app/systems/page.tsx lib/auth/__tests__/escala-routes.test.ts
git commit -m "feat(escala): registra a permissão escala nas rotas e na administração"
```

---

### Task 3: Constantes, tipos e regras puras

O coração testável do módulo: contagem por pelotão, estado do dia, validação de escalação e a grade do calendário.

**Files:**
- Create: `lib/escala-constants.ts`
- Create: `lib/types/escala.ts`
- Create: `lib/escala-rules.ts`
- Test: `lib/__tests__/escala-rules.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `META_POR_PELOTAO: number`, `ESCALA_STATUS`, `EscalaStatus`, `ESCALA_STATUS_LABELS`, `ATIVIDADE_CORES`, `ATIVIDADE_COR_PADRAO`
  - Tipos `EscalaAtividade`, `EscalaInsider`, `EscalaInsiderInput`, `PelotaoResumo`, `EscalaDiaResumo`, `EscalaDia`, `InsiderOption`, `EstadoPreenchimento`
  - `resumirPelotoes(pelotoes, insiders): PelotaoResumo[]`
  - `estadoDoDia(resumos): EstadoPreenchimento`
  - `validarEscalacao(input, pelotoesDoEvento): string | null`
  - `buildMonthGrid(ano, mes): CelulaCalendario[]`

- [ ] **Step 1: Criar `lib/escala-constants.ts`**

```ts
/** Meta de insiders corredores por pelotão. É alvo visual, nunca trava. */
export const META_POR_PELOTAO = 2

export const ESCALA_STATUS = ['corre', 'apoio', 'nao_vai'] as const
export type EscalaStatus = (typeof ESCALA_STATUS)[number]

export const ESCALA_STATUS_LABELS: Record<EscalaStatus, string> = {
  corre: 'Corre',
  apoio: 'Apoio (não corre)',
  nao_vai: 'Não vai',
}

export const ATIVIDADE_COR_PADRAO = '#F97316'

export const ATIVIDADE_CORES = [
  '#F97316', '#22C55E', '#3B82F6', '#A855F7',
  '#EAB308', '#EC4899', '#14B8A6', '#EF4444',
] as const
```

- [ ] **Step 2: Criar `lib/types/escala.ts`**

```ts
import type { EscalaStatus } from '@/lib/escala-constants'

export type EstadoPreenchimento = 'completo' | 'parcial' | 'vazio'

export interface EscalaAtividade {
  id: string
  nome: string
  descricao: string | null
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EscalaInsider {
  id: string
  evento_id: string
  insider_id: string
  insider_nome: string
  status: EscalaStatus
  pelotao: string | null
  motivo: string | null
  observacao: string | null
  atividades: EscalaAtividade[]
}

export interface EscalaInsiderInput {
  insider_id: string
  status: EscalaStatus
  pelotao?: string | null
  motivo?: string | null
  observacao?: string | null
  atividade_ids?: string[]
}

export interface PelotaoResumo {
  pelotao: string
  escalados: number
  meta: number
  estado: EstadoPreenchimento
}

export interface EscalaDiaResumo {
  evento_id: string
  titulo: string
  data_evento: string
  horario_inicio: string
  tipo: 'corrida' | 'personalizado'
  pelotoes: string[]
  pelotoes_resumo: PelotaoResumo[]
  corredores: number
  meta_total: number
  apoio: number
  nao_vai: number
  estado: EstadoPreenchimento
}

export interface EscalaDia extends EscalaDiaResumo {
  insiders: EscalaInsider[]
}

export interface InsiderOption {
  id: string
  nome: string
}

export interface CelulaCalendario {
  /** 'YYYY-MM-DD' */
  data: string
  dia: number
  /** false para os dias de preenchimento do mês anterior/seguinte */
  no_mes: boolean
}
```

- [ ] **Step 3: Escrever o teste que falha**

Create `lib/__tests__/escala-rules.test.ts`:

```ts
import {
  resumirPelotoes,
  estadoDoDia,
  validarEscalacao,
  buildMonthGrid,
} from '@/lib/escala-rules'
import { META_POR_PELOTAO } from '@/lib/escala-constants'

const PELOTOES = ['4km', '6km', '8km']

describe('resumirPelotoes', () => {
  it('conta só quem tem status corre, por pelotão', () => {
    const resumo = resumirPelotoes(PELOTOES, [
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '6km' },
      { status: 'apoio', pelotao: null },
      { status: 'nao_vai', pelotao: null },
    ])

    expect(resumo).toEqual([
      { pelotao: '4km', escalados: 2, meta: META_POR_PELOTAO, estado: 'completo' },
      { pelotao: '6km', escalados: 1, meta: META_POR_PELOTAO, estado: 'parcial' },
      { pelotao: '8km', escalados: 0, meta: META_POR_PELOTAO, estado: 'vazio' },
    ])
  })

  it('marca completo quando passa da meta', () => {
    const resumo = resumirPelotoes(['4km'], [
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
    ])
    expect(resumo[0]).toEqual({ pelotao: '4km', escalados: 3, meta: META_POR_PELOTAO, estado: 'completo' })
  })

  it('ignora corredor com pelotão que não é do evento', () => {
    const resumo = resumirPelotoes(['4km'], [{ status: 'corre', pelotao: '10km' }])
    expect(resumo[0].escalados).toBe(0)
  })
})

describe('estadoDoDia', () => {
  const resumo = (escalados: number[]) =>
    resumirPelotoes(
      PELOTOES,
      escalados.flatMap((n, i) =>
        Array.from({ length: n }, () => ({ status: 'corre' as const, pelotao: PELOTOES[i] }))
      )
    )

  it('é completo quando todo pelotão bate a meta', () => {
    expect(estadoDoDia(resumo([2, 2, 2]))).toBe('completo')
  })

  it('é parcial quando falta alguém', () => {
    expect(estadoDoDia(resumo([2, 1, 0]))).toBe('parcial')
  })

  it('é vazio quando ninguém foi escalado', () => {
    expect(estadoDoDia(resumo([0, 0, 0]))).toBe('vazio')
  })

  it('é vazio quando o evento não tem pelotões', () => {
    expect(estadoDoDia([])).toBe('vazio')
  })
})

describe('validarEscalacao', () => {
  it('aceita corre com pelotão do evento', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre', pelotao: '6km' }, PELOTOES)).toBeNull()
  })

  it('recusa corre sem pelotão', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre' }, PELOTOES))
      .toBe('Selecione o pelotão de quem vai correr')
  })

  it('recusa pelotão que não é do evento', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre', pelotao: '10km' }, PELOTOES))
      .toBe('Pelotão "10km" não existe neste evento')
  })

  it('recusa nao_vai sem motivo', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'nao_vai', motivo: '  ' }, PELOTOES))
      .toBe('Informe o motivo da ausência')
  })

  it('recusa nao_vai com atividade', () => {
    expect(validarEscalacao(
      { insider_id: 'i1', status: 'nao_vai', motivo: 'Viagem', atividade_ids: ['a1'] },
      PELOTOES
    )).toBe('Quem não vai não pode ter atividades')
  })

  it('aceita apoio com atividades e sem pelotão', () => {
    expect(validarEscalacao(
      { insider_id: 'i1', status: 'apoio', atividade_ids: ['a1', 'a2'] },
      PELOTOES
    )).toBeNull()
  })

  it('recusa insider_id vazio', () => {
    expect(validarEscalacao({ insider_id: '', status: 'apoio' }, PELOTOES))
      .toBe('Selecione o insider')
  })

  it('recusa status inválido', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'correndo' as never }, PELOTOES))
      .toBe('Status inválido')
  })
})

describe('buildMonthGrid', () => {
  it('monta 42 células começando no domingo anterior', () => {
    const grid = buildMonthGrid(2026, 8)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toEqual({ data: '2026-07-26', dia: 26, no_mes: false })
    expect(grid[41].data).toBe('2026-09-05')
  })

  it('marca no_mes só para os dias do mês pedido', () => {
    const grid = buildMonthGrid(2026, 8)
    expect(grid.filter(c => c.no_mes)).toHaveLength(31)
    expect(grid.find(c => c.data === '2026-08-01')).toEqual({ data: '2026-08-01', dia: 1, no_mes: true })
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx jest lib/__tests__/escala-rules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/escala-rules'`.

- [ ] **Step 5: Criar `lib/escala-rules.ts`**

```ts
import { ESCALA_STATUS, META_POR_PELOTAO } from '@/lib/escala-constants'
import type {
  CelulaCalendario,
  EscalaInsiderInput,
  EstadoPreenchimento,
  PelotaoResumo,
} from '@/lib/types/escala'

type InsiderContavel = { status: string; pelotao: string | null }

/** Quantos corredores cada pelotão do evento tem, e como está em relação à meta. */
export function resumirPelotoes(
  pelotoes: string[],
  insiders: InsiderContavel[]
): PelotaoResumo[] {
  return pelotoes.map((pelotao) => {
    const escalados = insiders.filter(
      (i) => i.status === 'corre' && i.pelotao === pelotao
    ).length

    const estado: EstadoPreenchimento =
      escalados >= META_POR_PELOTAO ? 'completo' : escalados > 0 ? 'parcial' : 'vazio'

    return { pelotao, escalados, meta: META_POR_PELOTAO, estado }
  })
}

/** Completo só quando todos os pelotões batem a meta; vazio quando ninguém corre. */
export function estadoDoDia(resumos: PelotaoResumo[]): EstadoPreenchimento {
  if (resumos.length === 0) return 'vazio'
  if (resumos.every((r) => r.estado === 'completo')) return 'completo'
  if (resumos.every((r) => r.escalados === 0)) return 'vazio'
  return 'parcial'
}

/** Retorna a mensagem de erro em pt-BR, ou null quando a escalação é válida. */
export function validarEscalacao(
  input: EscalaInsiderInput,
  pelotoesDoEvento: string[]
): string | null {
  if (!input.insider_id) return 'Selecione o insider'

  if (!ESCALA_STATUS.includes(input.status)) return 'Status inválido'

  if (input.status === 'corre') {
    if (!input.pelotao) return 'Selecione o pelotão de quem vai correr'
    if (!pelotoesDoEvento.includes(input.pelotao)) {
      return `Pelotão "${input.pelotao}" não existe neste evento`
    }
  }

  if (input.status === 'nao_vai') {
    if (!input.motivo || !input.motivo.trim()) return 'Informe o motivo da ausência'
    if (input.atividade_ids && input.atividade_ids.length > 0) {
      return 'Quem não vai não pode ter atividades'
    }
  }

  return null
}

function toISODate(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Grade de 6 semanas (42 células) começando no domingo, para o calendário mensal.
 * `mes` é 1-based: 8 = agosto.
 */
export function buildMonthGrid(ano: number, mes: number): CelulaCalendario[] {
  const primeiro = new Date(ano, mes - 1, 1)
  const inicio = new Date(ano, mes - 1, 1 - primeiro.getDay())

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    return {
      data: toISODate(d),
      dia: d.getDate(),
      no_mes: d.getMonth() === mes - 1 && d.getFullYear() === ano,
    }
  })
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx jest lib/__tests__/escala-rules.test.ts`
Expected: PASS, 15 testes.

- [ ] **Step 7: Commit**

```bash
git add lib/escala-constants.ts lib/types/escala.ts lib/escala-rules.ts lib/__tests__/escala-rules.test.ts
git commit -m "feat(escala): constantes, tipos e regras de preenchimento com testes"
```

---

### Task 4: Camada de serviço

Todo o acesso ao Supabase do módulo, em um arquivo só, no padrão de `lib/services/tarefas.ts`.

**Files:**
- Create: `lib/services/escala.ts`

**Interfaces:**
- Consumes: `resumirPelotoes`, `estadoDoDia` de `@/lib/escala-rules`; tipos de `@/lib/types/escala`; `META_POR_PELOTAO`.
- Produces:
  - `getAtividades(incluirInativas?: boolean): Promise<EscalaAtividade[]>`
  - `createAtividade(input: { nome: string; descricao: string | null; cor: string }): Promise<EscalaAtividade | null>`
  - `updateAtividade(id: string, updates: Partial<Pick<EscalaAtividade,'nome'|'descricao'|'cor'|'ativo'>>): Promise<EscalaAtividade | null>`
  - `removeAtividade(id: string): Promise<'removida' | 'inativada'>`
  - `getEscalaDoMes(mes: string): Promise<EscalaDiaResumo[]>`
  - `getEscalaDoEvento(eventoId: string): Promise<EscalaDia | null>`
  - `upsertEscalacao(eventoId: string, input: EscalaInsiderInput): Promise<EscalaInsider | null>`
  - `removeEscalacao(id: string): Promise<boolean>`
  - `listInsiders(): Promise<InsiderOption[]>`
  - `getPelotoesDoEvento(eventoId: string): Promise<string[] | null>`

- [ ] **Step 1: Criar `lib/services/escala.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import { estadoDoDia, resumirPelotoes } from '@/lib/escala-rules'
import { META_POR_PELOTAO } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaDiaResumo,
  EscalaInsider,
  EscalaInsiderInput,
  InsiderOption,
} from '@/lib/types/escala'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

const SELECT_ESCALACAO = `
  id, evento_id, insider_id, status, pelotao, motivo, observacao,
  dados_insiders ( nome ),
  escala_insider_atividades ( escala_atividades ( * ) )
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEscalacao(row: any): EscalaInsider {
  return {
    id: row.id,
    evento_id: row.evento_id,
    insider_id: row.insider_id,
    insider_nome: row.dados_insiders?.nome ?? 'Insider removido',
    status: row.status,
    pelotao: row.pelotao,
    motivo: row.motivo,
    observacao: row.observacao,
    atividades: (row.escala_insider_atividades ?? [])
      .map((v: any) => v.escala_atividades)
      .filter(Boolean),
  }
}

// ---------- Catálogo de atividades ----------

export async function getAtividades(incluirInativas = false): Promise<EscalaAtividade[]> {
  let query = getSupabase().from('escala_atividades').select('*').order('nome')
  if (!incluirInativas) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) {
    console.error('[escala] getAtividades:', error)
    return []
  }
  return data ?? []
}

export async function createAtividade(
  input: { nome: string; descricao: string | null; cor: string }
): Promise<EscalaAtividade | null> {
  const { data, error } = await getSupabase()
    .from('escala_atividades')
    .insert(input)
    .select('*')
    .single()

  if (error) {
    console.error('[escala] createAtividade:', error)
    return null
  }
  return data
}

export async function updateAtividade(
  id: string,
  updates: Partial<Pick<EscalaAtividade, 'nome' | 'descricao' | 'cor' | 'ativo'>>
): Promise<EscalaAtividade | null> {
  const { data, error } = await getSupabase()
    .from('escala_atividades')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[escala] updateAtividade:', error)
    return null
  }
  return data
}

/** Remove de vez se nunca foi usada; senão apenas inativa (a FK é ON DELETE RESTRICT). */
export async function removeAtividade(id: string): Promise<'removida' | 'inativada'> {
  const supabase = getSupabase()

  const { count } = await supabase
    .from('escala_insider_atividades')
    .select('atividade_id', { count: 'exact', head: true })
    .eq('atividade_id', id)

  if ((count ?? 0) > 0) {
    await supabase.from('escala_atividades').update({ ativo: false }).eq('id', id)
    return 'inativada'
  }

  await supabase.from('escala_atividades').delete().eq('id', id)
  return 'removida'
}

// ---------- Escala ----------

export async function getPelotoesDoEvento(eventoId: string): Promise<string[] | null> {
  const { data, error } = await getSupabase()
    .from('eventos')
    .select('pelotoes')
    .eq('id', eventoId)
    .single()

  if (error || !data) return null
  return data.pelotoes ?? []
}

/** `mes` no formato 'YYYY-MM'. Retorna um resumo por evento do mês. */
export async function getEscalaDoMes(mes: string): Promise<EscalaDiaResumo[]> {
  const supabase = getSupabase()
  const [ano, m] = mes.split('-').map(Number)
  const primeiroDia = `${mes}-01`
  const ultimoDia = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`

  const { data: eventos, error } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento, horario_inicio, tipo, pelotoes')
    .gte('data_evento', primeiroDia)
    .lte('data_evento', ultimoDia)
    .order('data_evento')

  if (error || !eventos) {
    console.error('[escala] getEscalaDoMes:', error)
    return []
  }
  if (eventos.length === 0) return []

  const { data: escalacoes } = await supabase
    .from('escala_insiders')
    .select('evento_id, status, pelotao')
    .in('evento_id', eventos.map((e) => e.id))

  return eventos.map((evento) => {
    const doEvento = (escalacoes ?? []).filter((e) => e.evento_id === evento.id)
    const pelotoes: string[] = evento.pelotoes ?? []
    const pelotoes_resumo = resumirPelotoes(pelotoes, doEvento)

    return {
      evento_id: evento.id,
      titulo: evento.titulo,
      data_evento: evento.data_evento,
      horario_inicio: evento.horario_inicio,
      tipo: evento.tipo,
      pelotoes,
      pelotoes_resumo,
      corredores: pelotoes_resumo.reduce((soma, p) => soma + p.escalados, 0),
      meta_total: pelotoes.length * META_POR_PELOTAO,
      apoio: doEvento.filter((e) => e.status === 'apoio').length,
      nao_vai: doEvento.filter((e) => e.status === 'nao_vai').length,
      estado: estadoDoDia(pelotoes_resumo),
    }
  })
}

export async function getEscalaDoEvento(eventoId: string): Promise<EscalaDia | null> {
  const supabase = getSupabase()

  const { data: evento, error: erroEvento } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento, horario_inicio, tipo, pelotoes')
    .eq('id', eventoId)
    .single()

  if (erroEvento || !evento) return null

  const { data: rows, error } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALACAO)
    .eq('evento_id', eventoId)

  if (error) {
    console.error('[escala] getEscalaDoEvento:', error)
    return null
  }

  const insiders = (rows ?? []).map(mapEscalacao)
  const pelotoes: string[] = evento.pelotoes ?? []
  const pelotoes_resumo = resumirPelotoes(pelotoes, insiders)

  return {
    evento_id: evento.id,
    titulo: evento.titulo,
    data_evento: evento.data_evento,
    horario_inicio: evento.horario_inicio,
    tipo: evento.tipo,
    pelotoes,
    pelotoes_resumo,
    corredores: pelotoes_resumo.reduce((soma, p) => soma + p.escalados, 0),
    meta_total: pelotoes.length * META_POR_PELOTAO,
    apoio: insiders.filter((i) => i.status === 'apoio').length,
    nao_vai: insiders.filter((i) => i.status === 'nao_vai').length,
    estado: estadoDoDia(pelotoes_resumo),
    insiders: insiders.sort((a, b) => a.insider_nome.localeCompare(b.insider_nome, 'pt-BR')),
  }
}

/** Cria ou atualiza a escalação do insider naquele evento e sincroniza as atividades. */
export async function upsertEscalacao(
  eventoId: string,
  input: EscalaInsiderInput
): Promise<EscalaInsider | null> {
  const supabase = getSupabase()

  const registro = {
    evento_id: eventoId,
    insider_id: input.insider_id,
    status: input.status,
    pelotao: input.status === 'corre' ? input.pelotao ?? null : null,
    motivo: input.status === 'nao_vai' ? input.motivo ?? null : null,
    observacao: input.observacao ?? null,
  }

  const { data: salvo, error } = await supabase
    .from('escala_insiders')
    .upsert(registro, { onConflict: 'evento_id,insider_id' })
    .select('id')
    .single()

  if (error || !salvo) {
    console.error('[escala] upsertEscalacao:', error)
    return null
  }

  const atividadeIds = input.status === 'nao_vai' ? [] : input.atividade_ids ?? []

  await supabase.from('escala_insider_atividades').delete().eq('escala_insider_id', salvo.id)

  if (atividadeIds.length > 0) {
    const { error: erroVinculo } = await supabase.from('escala_insider_atividades').insert(
      atividadeIds.map((atividade_id) => ({
        escala_insider_id: salvo.id,
        atividade_id,
      }))
    )
    if (erroVinculo) console.error('[escala] vincular atividades:', erroVinculo)
  }

  const { data: completo } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALACAO)
    .eq('id', salvo.id)
    .single()

  return completo ? mapEscalacao(completo) : null
}

export async function removeEscalacao(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('escala_insiders').delete().eq('id', id)
  if (error) {
    console.error('[escala] removeEscalacao:', error)
    return false
  }
  return true
}

export async function listInsiders(): Promise<InsiderOption[]> {
  const { data, error } = await getSupabase()
    .from('dados_insiders')
    .select('id, nome')
    .order('nome')

  if (error) {
    console.error('[escala] listInsiders:', error)
    return []
  }
  return (data ?? []).filter((i) => i.nome)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/services/escala.ts
git commit -m "feat(escala): camada de serviço com queries de atividades e escalação"
```

---

### Task 5: API do catálogo de atividades

**Files:**
- Create: `app/api/escala/atividades/route.ts`
- Create: `app/api/escala/atividades/[id]/route.ts`

**Interfaces:**
- Consumes: `getAtividades`, `createAtividade`, `updateAtividade`, `removeAtividade` de `@/lib/services/escala`; `ATIVIDADE_COR_PADRAO` de `@/lib/escala-constants`.
- Produces:
  - `GET /api/escala/atividades?incluir_inativas=1` → `EscalaAtividade[]`
  - `POST /api/escala/atividades` body `{ nome, descricao?, cor? }` → `EscalaAtividade` (201)
  - `PATCH /api/escala/atividades/[id]` body `{ nome?, descricao?, cor?, ativo? }` → `EscalaAtividade`
  - `DELETE /api/escala/atividades/[id]` → `{ resultado: 'removida' | 'inativada' }`

O middleware já exige a permissão `escala` para tudo em `/api/escala` (Task 2), então as rotas não repetem a checagem — mesmo padrão de `app/api/tarefas/tasks/route.ts`.

- [ ] **Step 1: Criar `app/api/escala/atividades/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAtividades, createAtividade } from '@/lib/services/escala'
import { ATIVIDADE_COR_PADRAO } from '@/lib/escala-constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const incluirInativas = req.nextUrl.searchParams.get('incluir_inativas') === '1'
  const atividades = await getAtividades(incluirInativas)
  return NextResponse.json(atividades)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome da atividade' }, { status: 400 })
    }

    const atividade = await createAtividade({
      nome,
      descricao: typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : null,
      cor: typeof body.cor === 'string' && body.cor ? body.cor : ATIVIDADE_COR_PADRAO,
    })

    if (!atividade) {
      return NextResponse.json({ error: 'Erro ao criar atividade' }, { status: 500 })
    }
    return NextResponse.json(atividade, { status: 201 })
  } catch (err) {
    console.error('[escala] atividades POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Criar `app/api/escala/atividades/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { updateAtividade, removeAtividade } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.nome === 'string') {
      const nome = body.nome.trim()
      if (!nome) return NextResponse.json({ error: 'Informe o nome da atividade' }, { status: 400 })
      updates.nome = nome
    }
    if ('descricao' in body) {
      updates.descricao = typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : null
    }
    if (typeof body.cor === 'string' && body.cor) updates.cor = body.cor
    if (typeof body.ativo === 'boolean') updates.ativo = body.ativo

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const atividade = await updateAtividade(params.id, updates)
    if (!atividade) {
      return NextResponse.json({ error: 'Atividade não encontrada' }, { status: 404 })
    }
    return NextResponse.json(atividade)
  } catch (err) {
    console.error('[escala] atividades PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resultado = await removeAtividade(params.id)
    return NextResponse.json({ resultado })
  } catch (err) {
    console.error('[escala] atividades DELETE:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Subir o dev server e testar as rotas**

Run (terminal 1): `npm run dev`

Run (terminal 2) — precisa de um cookie de sessão válido; logar no navegador em `http://localhost:3000/login` e copiar o cookie, ou testar direto pelo devtools do navegador com:

```js
await (await fetch('/api/escala/atividades', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ nome: 'Montagem', descricao: 'Montar arco e mesa', cor: '#22C55E' }),
})).json()
```
Expected: objeto com `id`, `nome: 'Montagem'`, `ativo: true`.

Depois: `await (await fetch('/api/escala/atividades', { credentials: 'include' })).json()`
Expected: array contendo a atividade criada.

E o caso de erro: `POST` com `{ nome: '  ' }` → status 400, `{ error: 'Informe o nome da atividade' }`.

- [ ] **Step 4: Commit**

```bash
git add app/api/escala/atividades
git commit -m "feat(escala): API do catálogo de atividades"
```

---

### Task 6: API da escala

**Files:**
- Create: `app/api/escala/route.ts`
- Create: `app/api/escala/evento/[eventoId]/route.ts`
- Create: `app/api/escala/[id]/route.ts`
- Create: `app/api/escala/insiders/route.ts`

**Interfaces:**
- Consumes: `getEscalaDoMes`, `getEscalaDoEvento`, `upsertEscalacao`, `removeEscalacao`, `listInsiders`, `getPelotoesDoEvento`; `validarEscalacao` de `@/lib/escala-rules`.
- Produces:
  - `GET /api/escala?mes=YYYY-MM` → `EscalaDiaResumo[]`
  - `GET /api/escala/evento/[eventoId]` → `EscalaDia`
  - `POST /api/escala/evento/[eventoId]` body `EscalaInsiderInput` → `EscalaInsider` (201)
  - `DELETE /api/escala/[id]` → `{ success: true }`
  - `GET /api/escala/insiders` → `InsiderOption[]`

Next.js resolve segmento estático antes de dinâmico, então `/api/escala/evento/...`, `/api/escala/atividades` e `/api/escala/insiders` não colidem com `/api/escala/[id]`.

- [ ] **Step 1: Criar `app/api/escala/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getEscalaDoMes } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get('mes')

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'Parâmetro mes obrigatório no formato YYYY-MM' }, { status: 400 })
  }

  const dias = await getEscalaDoMes(mes)
  return NextResponse.json(dias)
}
```

- [ ] **Step 2: Criar `app/api/escala/evento/[eventoId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getEscalaDoEvento, getPelotoesDoEvento, upsertEscalacao } from '@/lib/services/escala'
import { validarEscalacao } from '@/lib/escala-rules'
import type { EscalaInsiderInput } from '@/lib/types/escala'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { eventoId: string } }) {
  const escala = await getEscalaDoEvento(params.eventoId)
  if (!escala) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }
  return NextResponse.json(escala)
}

export async function POST(req: NextRequest, { params }: { params: { eventoId: string } }) {
  try {
    const body = await req.json()

    const input: EscalaInsiderInput = {
      insider_id: body.insider_id,
      status: body.status,
      pelotao: body.pelotao ?? null,
      motivo: body.motivo ?? null,
      observacao: body.observacao ?? null,
      atividade_ids: Array.isArray(body.atividade_ids) ? body.atividade_ids : [],
    }

    const pelotoes = await getPelotoesDoEvento(params.eventoId)
    if (pelotoes === null) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const erro = validarEscalacao(input, pelotoes)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const escalacao = await upsertEscalacao(params.eventoId, input)
    if (!escalacao) {
      return NextResponse.json({ error: 'Erro ao salvar a escalação' }, { status: 500 })
    }
    return NextResponse.json(escalacao, { status: 201 })
  } catch (err) {
    console.error('[escala] evento POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Criar `app/api/escala/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { removeEscalacao } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await removeEscalacao(params.id)
  if (!ok) {
    return NextResponse.json({ error: 'Erro ao remover a escalação' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Criar `app/api/escala/insiders/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { listInsiders } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function GET() {
  const insiders = await listInsiders()
  return NextResponse.json(insiders)
}
```

- [ ] **Step 5: Testar o fluxo pelo devtools do navegador**

Com `npm run dev` rodando e sessão iniciada, no console de `http://localhost:3000`:

```js
// 1. Descobrir um evento do mês
const dias = await (await fetch('/api/escala?mes=2026-08', { credentials: 'include' })).json()
// 2. Escalar alguém para correr
const insiders = await (await fetch('/api/escala/insiders', { credentials: 'include' })).json()
await (await fetch(`/api/escala/evento/${dias[0].evento_id}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
  body: JSON.stringify({ insider_id: insiders[0].id, status: 'corre', pelotao: dias[0].pelotoes[0] }),
})).json()
// 3. Conferir o dia
await (await fetch(`/api/escala/evento/${dias[0].evento_id}`, { credentials: 'include' })).json()
```

Expected: o passo 2 devolve a escalação com `insider_nome` preenchido; o passo 3 mostra `corredores: 1` e o pelotão correspondente em `estado: 'parcial'`.

Caso de erro: repetir o passo 2 com `{ status: 'corre' }` sem `pelotao` → 400 com `Selecione o pelotão de quem vai correr`; com `{ status: 'nao_vai' }` sem motivo → 400 com `Informe o motivo da ausência`.

- [ ] **Step 6: Commit**

```bash
git add app/api/escala
git commit -m "feat(escala): API de escalação por evento e resumo mensal"
```

---

### Task 7: Calendário mensal e registro do módulo na SPA

Entrega a primeira tela navegável: sidebar com ESCALA e o calendário do mês com o resumo de preenchimento.

**Files:**
- Create: `lib/escala-ui.ts`
- Create: `components/escala-calendario.tsx`
- Create: `app/escala/page.tsx`
- Modify: `app/page.tsx` (nav linha ~156-165, modal de apps linha ~251-261, render linha ~341-350)

**Interfaces:**
- Consumes: `GET /api/escala?mes=`, `buildMonthGrid`, tipos `EscalaDiaResumo`, `CelulaCalendario`.
- Produces:
  - `lib/escala-ui.ts`: `CORES_ESTADO: Record<EstadoPreenchimento, { texto: string; fundo: string; borda: string; ponto: string }>`, `DIAS_SEMANA: string[]`, `nomeDoMes(ano, mes): string`
  - `components/escala-calendario.tsx`: `<EscalaCalendario ano mes dias onSelecionarDia onMudarMes />`
  - `app/escala/page.tsx`: `export default function EscalaPage()`

- [ ] **Step 1: Criar `lib/escala-ui.ts`**

```ts
import type { EstadoPreenchimento } from '@/lib/types/escala'

export const CORES_ESTADO: Record<
  EstadoPreenchimento,
  { texto: string; fundo: string; borda: string; ponto: string }
> = {
  completo: { texto: 'text-green-400', fundo: 'bg-green-500/15', borda: 'border-green-500/30', ponto: 'bg-green-500' },
  parcial: { texto: 'text-yellow-400', fundo: 'bg-yellow-500/15', borda: 'border-yellow-500/30', ponto: 'bg-yellow-500' },
  vazio: { texto: 'text-red-400', fundo: 'bg-red-500/10', borda: 'border-red-500/30', ponto: 'bg-red-500' },
}

export const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

/** `mes` 1-based. Ex.: nomeDoMes(2026, 8) === 'agosto de 2026' */
export function nomeDoMes(ano: number, mes: number): string {
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}
```

- [ ] **Step 2: Criar `components/escala-calendario.tsx`**

```tsx
'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid } from '@/lib/escala-rules'
import { CORES_ESTADO, DIAS_SEMANA, nomeDoMes } from '@/lib/escala-ui'
import type { EscalaDiaResumo } from '@/lib/types/escala'

interface EscalaCalendarioProps {
  ano: number
  /** 1-based: 8 = agosto */
  mes: number
  dias: EscalaDiaResumo[]
  onMudarMes: (ano: number, mes: number) => void
  onSelecionarDia: (dia: EscalaDiaResumo) => void
}

export function EscalaCalendario({
  ano,
  mes,
  dias,
  onMudarMes,
  onSelecionarDia,
}: EscalaCalendarioProps) {
  const grid = buildMonthGrid(ano, mes)
  const porData = new Map(dias.map((d) => [d.data_evento, d]))

  const irPara = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1)
    onMudarMes(d.getFullYear(), d.getMonth() + 1)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => irPara(-1)}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-white font-bold text-lg capitalize">{nomeDoMes(ano, mes)}</h2>
        <button
          onClick={() => irPara(1)}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-[10px] md:text-xs text-neutral-500 font-bold text-center py-1">
            {d}
          </div>
        ))}

        {grid.map((celula) => {
          const dia = porData.get(celula.data)

          if (!dia) {
            return (
              <div
                key={celula.data}
                className={`min-h-[64px] md:min-h-[92px] rounded-lg border border-neutral-800 p-1.5 ${
                  celula.no_mes ? 'bg-neutral-900' : 'bg-neutral-950'
                }`}
              >
                <span className={`text-xs ${celula.no_mes ? 'text-neutral-500' : 'text-neutral-700'}`}>
                  {celula.dia}
                </span>
              </div>
            )
          }

          const cores = CORES_ESTADO[dia.estado]
          const incompletos = dia.pelotoes_resumo.filter((p) => p.estado !== 'completo')

          return (
            <button
              key={celula.data}
              onClick={() => onSelecionarDia(dia)}
              className={`min-h-[64px] md:min-h-[92px] rounded-lg border p-1.5 text-left transition-all hover:brightness-125 active:scale-95 ${cores.fundo} ${cores.borda}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{celula.dia}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${cores.ponto}`} />
              </div>
              <p className="text-[10px] text-neutral-300 truncate mt-0.5">{dia.titulo}</p>
              <p className={`text-[11px] font-bold ${cores.texto}`}>
                {dia.corredores}/{dia.meta_total}
              </p>
              {dia.apoio > 0 && (
                <p className="text-[10px] text-neutral-400">+{dia.apoio} apoio</p>
              )}
              {incompletos.length > 0 && (
                <p className="text-[10px] text-neutral-400 truncate hidden md:block">
                  {incompletos.map((p) => `${p.pelotao} ${p.escalados}/${p.meta}`).join(' · ')}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar `app/escala/page.tsx`**

O painel do dia entra na Task 8; por ora o clique só guarda o dia selecionado.

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { EscalaCalendario } from '@/components/escala-calendario'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import type { EscalaDiaResumo } from '@/lib/types/escala'

export default function EscalaPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [dias, setDias] = useState<EscalaDiaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const mesParam = `${ano}-${String(mes).padStart(2, '0')}`
      const res = await apiFetch(`/api/escala?mes=${mesParam}`)
      if (!res.ok) throw new Error('Não foi possível carregar a escala do mês')
      setDias(await res.json())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar a escala')
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-orange-500" />
        <h1 className="text-white font-bold text-xl">Escala</h1>
      </div>

      {erro && <ErrorBanner message={erro} onRetry={carregar} />}

      {loading ? (
        <PageLoading label="Carregando escala..." />
      ) : (
        <EscalaCalendario
          ano={ano}
          mes={mes}
          dias={dias}
          onMudarMes={(novoAno, novoMes) => {
            setAno(novoAno)
            setMes(novoMes)
          }}
          onSelecionarDia={(dia) => setEventoSelecionado(dia.evento_id)}
        />
      )}

      {dias.length === 0 && !loading && !erro && (
        <p className="text-sm text-neutral-500">
          Nenhum evento neste mês. Cadastre um treino no módulo Eventos para poder escalar insiders.
        </p>
      )}

      {eventoSelecionado && (
        <p className="text-xs text-neutral-600">Evento selecionado: {eventoSelecionado}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Registrar o módulo em `app/page.tsx`**

Quatro edições:

1. Import, junto dos demais (após a linha do `EventosSommaPage`):
```tsx
import EscalaPage from "./escala/page"
```

2. Ícone — adicionar `CalendarRange` à lista de ícones importados de `lucide-react` no topo do arquivo.

3. Nav da sidebar (array na linha ~156), logo depois da entrada de `eventos`:
```tsx
                { id: "escala", icon: CalendarRange, label: "ESCALA", permissionKey: "escala" },
```

4. Modal de APPs (array na linha ~251), depois da entrada de `eventos`:
```tsx
                  { id: "escala",        icon: CalendarRange, label: "Escala",      permissionKey: "escala" },
```

5. Render (linha ~343), depois da linha de `eventos`:
```tsx
            {activeSection === "escala" && permissions.escala && <EscalaPage />}
```

- [ ] **Step 5: Verificar no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/?section=escala` logado como admin.

Expected: item **ESCALA** na sidebar; calendário do mês corrente; dias com evento clicáveis e coloridos pelo preenchimento; dias sem evento apagados; `◀ ▶` trocam de mês e recarregam. Abrir `http://localhost:3000/escala` deve redirecionar para `/?section=escala`.

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
git add lib/escala-ui.ts components/escala-calendario.tsx app/escala/page.tsx app/page.tsx
git commit -m "feat(escala): calendário mensal e registro do módulo na SPA"
```

---

### Task 8: Painel do dia e seletor de insider

Onde a escala é de fato montada: slots por pelotão, bloco de apoio e bloco de ausências.

**Files:**
- Create: `components/escala-insider-picker.tsx`
- Create: `components/escala-dia-panel.tsx`
- Modify: `app/escala/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/escala/evento/[eventoId]`, `DELETE /api/escala/[id]`, `GET /api/escala/insiders`, `GET /api/escala/atividades`; `ESCALA_STATUS_LABELS`, `CORES_ESTADO`, `matchesTextSearch` de `@/lib/search-utils`.
- Produces:
  - `<EscalaInsiderPicker insiders jaEscalados onSelecionar />`
  - `<EscalaDiaPanel eventoId onFechar onAlterado />`

- [ ] **Step 1: Criar `components/escala-insider-picker.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { matchesTextSearch } from '@/lib/search-utils'
import type { InsiderOption } from '@/lib/types/escala'

interface EscalaInsiderPickerProps {
  insiders: InsiderOption[]
  /** ids já escalados neste evento — ficam desabilitados */
  jaEscalados: string[]
  onSelecionar: (insider: InsiderOption) => void
}

export function EscalaInsiderPicker({
  insiders,
  jaEscalados,
  onSelecionar,
}: EscalaInsiderPickerProps) {
  const [busca, setBusca] = useState('')

  const filtrados = insiders
    .filter((i) => matchesTextSearch(busca, [i.nome]))
    .slice(0, 50)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar insider pelo nome"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="max-h-56 overflow-auto space-y-1">
        {filtrados.map((insider) => {
          const escalado = jaEscalados.includes(insider.id)
          return (
            <button
              key={insider.id}
              disabled={escalado}
              onClick={() => onSelecionar(insider)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                escalado
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {insider.nome}
              {escalado && <span className="text-xs text-neutral-600 ml-2">já escalado</span>}
            </button>
          )
        })}
        {filtrados.length === 0 && (
          <p className="text-sm text-neutral-500 px-3 py-2">Nenhum insider encontrado.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Conferir a assinatura de `matchesTextSearch`**

Run: `grep -n "export function matchesTextSearch" -A 6 lib/search-utils.ts`

Se a ordem dos parâmetros for `(campos, termo)` em vez de `(termo, campos)`, ajustar a chamada do Step 1 para bater com a real. O uso existente em `app/eventos/page.tsx` serve de referência.

- [ ] **Step 3: Criar `components/escala-dia-panel.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import { EscalaInsiderPicker } from '@/components/escala-insider-picker'
import { CORES_ESTADO } from '@/lib/escala-ui'
import { ESCALA_STATUS_LABELS, type EscalaStatus } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaInsider,
  InsiderOption,
} from '@/lib/types/escala'

interface EscalaDiaPanelProps {
  eventoId: string
  onFechar: () => void
  /** chamado depois de qualquer gravação, para o calendário recarregar */
  onAlterado: () => void
}

interface Rascunho {
  insider: InsiderOption
  status: EscalaStatus
  pelotao: string
  motivo: string
  atividadeIds: string[]
}

export function EscalaDiaPanel({ eventoId, onFechar, onAlterado }: EscalaDiaPanelProps) {
  const [escala, setEscala] = useState<EscalaDia | null>(null)
  const [insiders, setInsiders] = useState<InsiderOption[]>([])
  const [atividades, setAtividades] = useState<EscalaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [resEscala, resInsiders, resAtividades] = await Promise.all([
        apiFetch(`/api/escala/evento/${eventoId}`),
        apiFetch('/api/escala/insiders'),
        apiFetch('/api/escala/atividades'),
      ])
      if (!resEscala.ok) throw new Error('Não foi possível carregar a escala deste dia')
      setEscala(await resEscala.json())
      setInsiders(resInsiders.ok ? await resInsiders.json() : [])
      setAtividades(resAtividades.ok ? await resAtividades.json() : [])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [eventoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const salvar = async () => {
    if (!rascunho) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await apiFetch(`/api/escala/evento/${eventoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insider_id: rascunho.insider.id,
          status: rascunho.status,
          pelotao: rascunho.status === 'corre' ? rascunho.pelotao : null,
          motivo: rascunho.status === 'nao_vai' ? rascunho.motivo : null,
          atividade_ids: rascunho.status === 'nao_vai' ? [] : rascunho.atividadeIds,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao salvar')
      setRascunho(null)
      await carregar()
      onAlterado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (id: string) => {
    setErro(null)
    const res = await apiFetch(`/api/escala/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setErro('Erro ao remover a escalação')
      return
    }
    await carregar()
    onAlterado()
  }

  const linhaInsider = (item: EscalaInsider) => (
    <div
      key={item.id}
      className="flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{item.insider_nome}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {item.atividades.map((a) => (
            <span
              key={a.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full border"
              style={{ color: a.cor, borderColor: `${a.cor}55`, backgroundColor: `${a.cor}1A` }}
            >
              {a.nome}
            </span>
          ))}
          {item.motivo && <span className="text-[10px] text-neutral-400">{item.motivo}</span>}
        </div>
      </div>
      <button
        onClick={() => remover(item.id)}
        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0"
        aria-label={`Remover ${item.insider_nome} da escala`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center md:justify-center" onClick={onFechar}>
      <div
        className="w-full md:max-w-2xl max-h-[90vh] overflow-auto bg-neutral-900 border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-white font-bold">
              {escala ? escala.titulo : 'Escala do dia'}
            </h2>
            {escala && (
              <p className="text-xs text-neutral-400">
                {new Date(`${escala.data_evento}T12:00:00`).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}{' '}
                · {escala.horario_inicio}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="p-1 text-neutral-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && <ErrorBanner message={erro} />}

        {loading || !escala ? (
          <PageLoading label="Carregando o dia..." />
        ) : (
          <>
            {/* Pelotões */}
            <div className="space-y-2">
              {escala.pelotoes_resumo.map((resumo) => {
                const cores = CORES_ESTADO[resumo.estado]
                const corredores = escala.insiders.filter(
                  (i) => i.status === 'corre' && i.pelotao === resumo.pelotao
                )
                return (
                  <div key={resumo.pelotao} className={`rounded-lg border p-2.5 space-y-2 ${cores.borda} ${cores.fundo}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{resumo.pelotao}</span>
                      <span className={`text-xs font-bold ${cores.texto}`}>
                        {resumo.escalados}/{resumo.meta}
                      </span>
                    </div>
                    {corredores.map(linhaInsider)}
                    {corredores.length === 0 && (
                      <p className="text-xs text-neutral-500">Ninguém escalado neste pelotão.</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Apoio */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 tracking-wide">APOIO (NÃO CORRE)</h3>
              {escala.insiders.filter((i) => i.status === 'apoio').map(linhaInsider)}
              {escala.apoio === 0 && <p className="text-xs text-neutral-500">Ninguém no apoio.</p>}
            </div>

            {/* Ausências */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 tracking-wide">NÃO VAI</h3>
              {escala.insiders.filter((i) => i.status === 'nao_vai').map(linhaInsider)}
              {escala.nao_vai === 0 && <p className="text-xs text-neutral-500">Nenhuma ausência registrada.</p>}
            </div>

            {/* Formulário */}
            {rascunho ? (
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 space-y-3">
                <p className="text-sm text-white font-bold">{rascunho.insider.nome}</p>

                <div className="flex gap-2">
                  {(Object.keys(ESCALA_STATUS_LABELS) as EscalaStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setRascunho({ ...rascunho, status })}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                        rascunho.status === status
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {ESCALA_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>

                {rascunho.status === 'corre' && (
                  <select
                    value={rascunho.pelotao}
                    onChange={(e) => setRascunho({ ...rascunho, pelotao: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione o pelotão</option>
                    {escala.pelotoes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                {rascunho.status === 'nao_vai' && (
                  <input
                    value={rascunho.motivo}
                    onChange={(e) => setRascunho({ ...rascunho, motivo: e.target.value })}
                    placeholder="Motivo da ausência"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                )}

                {rascunho.status !== 'nao_vai' && atividades.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {atividades.map((a) => {
                      const marcada = rascunho.atividadeIds.includes(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() =>
                            setRascunho({
                              ...rascunho,
                              atividadeIds: marcada
                                ? rascunho.atividadeIds.filter((id) => id !== a.id)
                                : [...rascunho.atividadeIds, a.id],
                            })
                          }
                          className="text-xs px-2 py-1 rounded-full border transition-all"
                          style={{
                            color: a.cor,
                            borderColor: a.cor,
                            backgroundColor: marcada ? `${a.cor}33` : 'transparent',
                            opacity: marcada ? 1 : 0.6,
                          }}
                        >
                          {a.nome}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={salvar}
                    disabled={salvando}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setRascunho(null)}
                    className="px-4 text-sm text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <details className="bg-neutral-800 border border-neutral-700 rounded-lg p-3">
                <summary className="text-sm text-orange-400 cursor-pointer flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Escalar insider
                </summary>
                <div className="pt-3">
                  <EscalaInsiderPicker
                    insiders={insiders}
                    jaEscalados={escala.insiders.map((i) => i.insider_id)}
                    onSelecionar={(insider) =>
                      setRascunho({
                        insider,
                        status: 'corre',
                        pelotao: '',
                        motivo: '',
                        atividadeIds: [],
                      })
                    }
                  />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ligar o painel em `app/escala/page.tsx`**

Substituir o `<p className="text-xs text-neutral-600">Evento selecionado...</p>` do Step 3 da Task 7 por:

```tsx
      {eventoSelecionado && (
        <EscalaDiaPanel
          eventoId={eventoSelecionado}
          onFechar={() => setEventoSelecionado(null)}
          onAlterado={carregar}
        />
      )}
```

E adicionar o import:

```tsx
import { EscalaDiaPanel } from '@/components/escala-dia-panel'
```

- [ ] **Step 5: Verificar no navegador**

Run: `npm run dev`, abrir `/?section=escala`, clicar num sábado com evento.

Expected:
- O painel abre com um bloco por pelotão do evento e o contador `0/2` em vermelho.
- "Escalar insider" → busca → escolher alguém → status **Corre** → selecionar pelotão → Salvar. A pessoa aparece no bloco do pelotão, o contador vira `1/2` amarelo, e o número no calendário atrás atualiza.
- Status **Apoio** com duas atividades marcadas salva e mostra os badges coloridos.
- Status **Não vai** sem motivo → erro `Informe o motivo da ausência` no banner.
- Lixeira remove a escalação e o contador volta.

- [ ] **Step 6: Typecheck e commit**

```bash
npx tsc --noEmit
git add components/escala-insider-picker.tsx components/escala-dia-panel.tsx app/escala/page.tsx
git commit -m "feat(escala): painel do dia com escalação por pelotão, apoio e ausências"
```

---

### Task 9: Gerenciador do catálogo de atividades

**Files:**
- Create: `components/escala-atividades-manager.tsx`
- Modify: `app/escala/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/escala/atividades`, `PATCH/DELETE /api/escala/atividades/[id]`; `ATIVIDADE_CORES`, `ATIVIDADE_COR_PADRAO`.
- Produces: `<EscalaAtividadesManager onFechar />`

- [ ] **Step 1: Criar `components/escala-atividades-manager.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import { ATIVIDADE_CORES, ATIVIDADE_COR_PADRAO } from '@/lib/escala-constants'
import type { EscalaAtividade } from '@/lib/types/escala'

export function EscalaAtividadesManager({ onFechar }: { onFechar: () => void }) {
  const [atividades, setAtividades] = useState<EscalaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState<string>(ATIVIDADE_COR_PADRAO)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/escala/atividades?incluir_inativas=1')
      if (!res.ok) throw new Error('Não foi possível carregar as atividades')
      setAtividades(await res.json())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const criar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/escala/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, descricao, cor }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao criar atividade')
      setNome('')
      setDescricao('')
      setCor(ATIVIDADE_COR_PADRAO)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar atividade')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (atividade: EscalaAtividade) => {
    await apiFetch(`/api/escala/atividades/${atividade.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !atividade.ativo }),
    })
    await carregar()
  }

  const remover = async (id: string) => {
    const res = await apiFetch(`/api/escala/atividades/${id}`, { method: 'DELETE' })
    const body = await res.json()
    if (body.resultado === 'inativada') {
      setErro('A atividade já foi usada na escala, então foi apenas inativada.')
    }
    await carregar()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center md:justify-center" onClick={onFechar}>
      <div
        className="w-full md:max-w-lg max-h-[90vh] overflow-auto bg-neutral-900 border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Atividades</h2>
          <button onClick={onFechar} className="p-1 text-neutral-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && <ErrorBanner message={erro} />}

        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 space-y-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da atividade (ex.: Montagem)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
          <div className="flex items-center gap-2">
            {ATIVIDADE_CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  cor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={criar}
            disabled={salvando || !nome.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {salvando ? 'Criando...' : 'Criar atividade'}
          </button>
        </div>

        {loading ? (
          <PageLoading label="Carregando atividades..." />
        ) : (
          <div className="space-y-1.5">
            {atividades.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.cor }} />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${a.ativo ? 'text-white' : 'text-neutral-500 line-through'}`}>
                      {a.nome}
                    </p>
                    {a.descricao && <p className="text-xs text-neutral-500 truncate">{a.descricao}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => alternarAtivo(a)}
                    className="text-xs text-neutral-400 hover:text-white px-2 py-1"
                  >
                    {a.ativo ? 'Inativar' : 'Reativar'}
                  </button>
                  <button
                    onClick={() => remover(a.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400"
                    aria-label={`Remover ${a.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {atividades.length === 0 && (
              <p className="text-sm text-neutral-500">Nenhuma atividade cadastrada ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar o botão no header de `app/escala/page.tsx`**

Import:
```tsx
import { EscalaAtividadesManager } from '@/components/escala-atividades-manager'
import { ListChecks } from 'lucide-react'
```

Estado, junto dos demais `useState`:
```tsx
  const [mostrarAtividades, setMostrarAtividades] = useState(false)
```

Trocar o bloco do título por um header com o botão à direita:
```tsx
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-orange-500" />
          <h1 className="text-white font-bold text-xl">Escala</h1>
        </div>
        <button
          onClick={() => setMostrarAtividades(true)}
          className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white bg-neutral-800 border border-neutral-700 hover:border-neutral-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ListChecks className="w-4 h-4" />
          Atividades
        </button>
      </div>
```

E, no fim do componente:
```tsx
      {mostrarAtividades && (
        <EscalaAtividadesManager onFechar={() => setMostrarAtividades(false)} />
      )}
```

- [ ] **Step 3: Verificar no navegador**

Run: `npm run dev`, `/?section=escala` → botão **Atividades**.

Expected: criar "Montagem" com cor verde aparece na lista; "Inativar" risca o nome; a atividade inativa **não** aparece nos chips do painel do dia; tentar remover uma atividade já usada mostra o aviso de que foi apenas inativada.

- [ ] **Step 4: Typecheck e commit**

```bash
npx tsc --noEmit
git add components/escala-atividades-manager.tsx app/escala/page.tsx
git commit -m "feat(escala): gerenciador do catálogo de atividades"
```

---

### Task 10: Verificação final

**Files:** nenhum arquivo novo — só verificação e correções pontuais se algo falhar.

- [ ] **Step 1: Suíte de testes completa**

Run: `npx jest`
Expected: todos os testes passam, incluindo `lib/__tests__/escala-rules.test.ts` (15) e `lib/auth/__tests__/escala-routes.test.ts` (5).

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 3: Roteiro manual de ponta a ponta**

Com `npm run dev` e sessão de admin:

1. `/?section=escala` abre no mês corrente com o calendário.
2. `◀ ▶` navegam e recarregam os dados do mês.
3. Um sábado com evento: escalar 2 insiders no primeiro pelotão → contador `2/2` verde.
4. Escalar um 3º no mesmo pelotão → **aceita** (meta, não trava) e continua verde.
5. Escalar alguém como Apoio com 2 atividades → aparece no bloco APOIO com os badges.
6. Registrar uma ausência com motivo → aparece em NÃO VAI com o motivo.
7. Remover uma escalação → contador e calendário atualizam.
8. Quando todos os pelotões estiverem em `2/2`, a célula do calendário fica verde.

- [ ] **Step 4: Verificar o isolamento por permissão**

Em Administração, criar um usuário com `escala: false` e todas as outras permissões, logar com ele.
Expected: **ESCALA** aparece esmaecido e desabilitado na sidebar; acessar `/escala` direto redireciona para `/?error=forbidden`; `fetch('/api/escala?mes=2026-08')` responde 403.

- [ ] **Step 5: Commit final se houve ajuste**

```bash
git add -A
git commit -m "chore(escala): ajustes da verificação final"
```

---

## Cobertura do spec

| Requisito do spec | Task |
|---|---|
| Tabelas, CHECKs, trigger de pelotão, índices | 1 |
| RLS `service_role` nas três tabelas | 1 |
| Migration da permissão `escala` no JSONB | 1 |
| `sql/010-create-escala.sql` versionado no repo | 1 |
| `ModulePermissions.escala`, route/page permissions, tela de Administração | 2 |
| `META_POR_PELOTAO`, tipos, `escala-rules` (contagem, estado, validação) | 3 |
| `lib/services/escala.ts` | 4 |
| APIs do catálogo de atividades (incl. inativação em vez de delete) | 5 |
| APIs de escala: mês, dia, upsert, delete, insiders | 6 |
| Calendário mensal com semáforo e registro na SPA | 7 |
| Painel do dia: pelotões, apoio, ausências, seletor de insider | 8 |
| Gerenciador de atividades com cor e ativo/inativo | 9 |
| Testes unitários + verificação manual | 3, 10 |
