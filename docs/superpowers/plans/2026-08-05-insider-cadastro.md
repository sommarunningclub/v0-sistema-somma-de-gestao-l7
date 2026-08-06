# Página pública `/insider` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `admin.sommaclub.com.br/insider` — página pública onde o Insider digita o CPF e, encontrado ou não na tabela `dados_insiders`, completa/atualiza seu cadastro (contato, endereço, foto, senha) com o visual do formulário da home do site novo.

**Architecture:** Rota standalone no App Router do admin (`app/insider/`), fora da SPA e sem chrome. Duas API routes públicas (`/api/insiders/lookup` e `/api/insiders/register`) rodam server-side com service role — o browser nunca fala com o Supabase direto. Lógica pura (máscaras, validação, mapeamento de linha) vive em `lib/insider/` e é coberta por testes jest; as rotas e o componente ficam finos.

**Tech Stack:** Next.js 15.5.10 (App Router), React 19.2.0, TypeScript, Tailwind v3, zod 3.25.76, bcryptjs, framer-motion (a instalar), lucide-react, Supabase (service role + Storage), jest + jsdom.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-05-insider-cadastro-design.md`. Em caso de conflito, a spec vence.
- **Rotas de API no plural** (`/api/insiders/...`). O prefixo singular `/api/insider` já existe e casa com `{ pattern: /^\/api\/insider/, permission: 'pagamentos' }` em `lib/auth/route-permissions.ts:33`.
- **Nunca** expor hash de senha em resposta de API, nem ler/escrever as colunas de benefícios (`evolve`, `dopahmina`, `tex_barbearia`, `cupom_loja_somma`, `big_box`, `assessoria_somma`, `estamina_recovery`) nesta feature.
- A coluna é `dopahmina` (com "h") — não corrigir o typo aqui.
- Senha vive em tabela separada `insider_credentials` com RLS `service_role`, porque `dados_insiders` é lida com `select("*")` pela chave **anon** em `app/pagamentos/insiders/page.tsx:54-57`.
- Cores por classe arbitrária (`bg-[#FF2C03]`, `hover:bg-[#FB4C00]`, `text-[#0A0A0A]`, `text-[#737373]`, `bg-[#0A0A0A]`, `text-[#EF4444]`). **Não** alterar `tailwind.config.ts` — o token `primary` já é usado pela UI shadcn do admin inteiro.
- zod **3** — usar `.refine()` / `errorMap`, nunca a sintaxe de erro do zod 4 (`z.literal(true, { message })`).
- Toda API responde erro como `{ error: string }` com status, e loga com prefixo `[insiders/<rota>]`, seguindo `app/api/admin/users/route.ts`.
- Rodar testes com `npm test`. Commits em português, prefixo `feat:` / `test:` / `chore:`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `sql/009-insider-cadastro.sql` | **Criar** — colunas novas em `dados_insiders`, tabela `insider_credentials`, bucket `insider-fotos` |
| `lib/insider/validation.ts` | **Criar** — máscaras, validadores, schema zod, regra de senha |
| `lib/insider/__tests__/validation.test.ts` | **Criar** — testes da lógica acima |
| `lib/insider/insider-mapper.ts` | **Criar** — CPF candidates, linha do banco ↔ objeto público |
| `lib/insider/__tests__/insider-mapper.test.ts` | **Criar** — testes do mapper |
| `lib/auth/page-routes.ts` | **Modificar** — `isOpenPage()` para páginas abertas a todos |
| `lib/auth/route-permissions.ts` | **Modificar** — liberar as duas rotas em `PUBLIC_API_ROUTES` |
| `lib/auth/__tests__/insider-public-routes.test.ts` | **Criar** — garante que as rotas seguem públicas |
| `middleware.ts` | **Modificar** — checar `isOpenPage` antes de `isPublicPage` |
| `app/api/insiders/lookup/route.ts` | **Criar** — busca por CPF |
| `app/api/insiders/register/route.ts` | **Criar** — upsert + foto + senha |
| `hooks/use-cep-lookup.ts` | **Criar** — autofill de endereço via BrasilAPI |
| `app/insider/layout.tsx` | **Criar** — fonte Geist + fundo escuro, sem chrome |
| `app/insider/page.tsx` | **Criar** — seção 2 colunas (texto + card) |
| `components/insider/insider-form-ui.tsx` | **Criar** — `Reveal`, `InsiderField`, `inputCls` |
| `components/insider/insider-cadastro-form.tsx` | **Criar** — estado, fluxo do CPF, submit |
| `package.json` | **Modificar** — dependência `framer-motion` |

---

### Task 1: Migration do banco

**Files:**
- Create: `sql/009-insider-cadastro.sql`

**Interfaces:**
- Consumes: nada.
- Produces: colunas `email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado, foto_url, consent_lgpd, consent_imagem, criado_em, atualizado_em` em `dados_insiders`; tabela `insider_credentials(insider_id uuid PK, senha_hash text, criado_em, atualizado_em)`; bucket `insider-fotos`.

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- sql/009-insider-cadastro.sql
-- Página pública /insider: cadastro e atualização de Insiders.
-- Aditiva: não remove nem renomeia nada existente.

-- 1. Novas colunas de cadastro em dados_insiders
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS telefone        text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS sexo            text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS cep             text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS logradouro      text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS numero          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS complemento     text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS bairro          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS cidade          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS estado          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS foto_url        text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS consent_lgpd    boolean NOT NULL DEFAULT false;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS consent_imagem  boolean NOT NULL DEFAULT false;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS criado_em       timestamptz NOT NULL DEFAULT now();
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS atualizado_em   timestamptz NOT NULL DEFAULT now();

-- 2. Colunas de benefício ganham DEFAULT '' para que INSERTs que não as
--    mencionam funcionem mesmo se forem NOT NULL. Não altera linhas existentes.
ALTER TABLE dados_insiders ALTER COLUMN evolve            SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN dopahmina         SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN tex_barbearia     SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN cupom_loja_somma  SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN big_box           SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN assessoria_somma  SET DEFAULT '';
ALTER TABLE dados_insiders ALTER COLUMN estamina_recovery SET DEFAULT '';

-- 3. Índice para busca por CPF (a API busca com e sem máscara)
CREATE INDEX IF NOT EXISTS idx_dados_insiders_cpf ON dados_insiders(cpf);

-- 4. Credenciais em tabela separada: dados_insiders é lida com a chave anon
--    no browser, então o hash não pode morar lá.
CREATE TABLE IF NOT EXISTS insider_credentials (
  insider_id    uuid PRIMARY KEY REFERENCES dados_insiders(id) ON DELETE CASCADE,
  senha_hash    text NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE insider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on insider_credentials" ON insider_credentials;
CREATE POLICY "Service role full access on insider_credentials"
ON insider_credentials FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. Bucket de fotos de perfil (leitura pública, escrita só service_role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('insider-fotos', 'insider-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read insider fotos" ON storage.objects;
CREATE POLICY "Public read insider fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'insider-fotos');

DROP POLICY IF EXISTS "Service role upload insider fotos" ON storage.objects;
CREATE POLICY "Service role upload insider fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role update insider fotos" ON storage.objects;
CREATE POLICY "Service role update insider fotos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role delete insider fotos" ON storage.objects;
CREATE POLICY "Service role delete insider fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');
```

- [ ] **Step 2: Aplicar no Supabase**

Abrir o SQL Editor do projeto Supabase, colar o conteúdo do arquivo e executar. Esperado: "Success. No rows returned".

- [ ] **Step 3: Verificar o resultado**

Rodar no SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'dados_insiders'
ORDER BY ordinal_position;

SELECT id, name, public FROM storage.buckets WHERE id = 'insider-fotos';
SELECT to_regclass('public.insider_credentials');
```

Esperado: as 16 colunas novas aparecem na primeira query; a segunda retorna 1 linha com `public = true`; a terceira retorna `insider_credentials`.

- [ ] **Step 4: Commit**

```bash
git add sql/009-insider-cadastro.sql
git commit -m "feat(insider): migration de cadastro, credenciais e bucket de fotos"
```

---

### Task 2: Biblioteca de validação e máscaras

**Files:**
- Create: `lib/insider/validation.ts`
- Test: `lib/insider/__tests__/validation.test.ts`

**Interfaces:**
- Consumes: `zod` (v3).
- Produces:
  - `onlyDigits(v: string): string`
  - `maskCpf(v: string): string`, `isValidCpf(v: string): boolean`
  - `maskDate(v: string): string`, `isValidBirthDate(v: string): boolean`
  - `brDateToISO(v: string): string | null`, `isoToBrDate(v: string | null | undefined): string`
  - `maskCep(v: string): string`, `maskPhone(v: string): string`, `maskUf(v: string): string`
  - `insiderFormSchema` (zod object) e `type InsiderFormInput = z.infer<typeof insiderFormSchema>`
  - `validateSenha(senha: string, confirmacao: string, obrigatoria: boolean): string | null`
  - `firstZodError(error: z.ZodError): string`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/insider/__tests__/validation.test.ts
import {
  onlyDigits,
  maskCpf,
  isValidCpf,
  maskDate,
  isValidBirthDate,
  brDateToISO,
  isoToBrDate,
  maskCep,
  maskPhone,
  maskUf,
  insiderFormSchema,
  validateSenha,
  firstZodError,
} from '../validation'

const validForm = {
  cpf: '529.982.247-25',
  nome: 'João Silva Santos',
  email: 'joao@exemplo.com',
  telefone: '(61) 99999-9999',
  data_nascimento: '15/03/1990',
  sexo: 'masculino',
  cep: '70000-000',
  logradouro: 'SQN 210 Bloco A',
  numero: '101',
  complemento: '',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  estado: 'DF',
  consent_lgpd: true,
  consent_imagem: true,
}

describe('máscaras', () => {
  it('maskCpf formata progressivamente e trava em 11 dígitos', () => {
    expect(maskCpf('529')).toBe('529')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('529982247259999')).toBe('529.982.247-25')
  })

  it('maskCep formata 8 dígitos', () => {
    expect(maskCep('70000')).toBe('70000')
    expect(maskCep('70000000')).toBe('70000-000')
  })

  it('maskPhone formata fixo e celular', () => {
    expect(maskPhone('6133334444')).toBe('(61) 3333-4444')
    expect(maskPhone('61999998888')).toBe('(61) 99999-8888')
  })

  it('maskDate formata DD/MM/AAAA', () => {
    expect(maskDate('15')).toBe('15')
    expect(maskDate('1503')).toBe('15/03')
    expect(maskDate('15031990')).toBe('15/03/1990')
  })

  it('maskUf devolve 2 letras maiúsculas', () => {
    expect(maskUf('df')).toBe('DF')
    expect(maskUf('s1p')).toBe('SP')
  })

  it('onlyDigits remove tudo que não é dígito', () => {
    expect(onlyDigits('(61) 99999-8888')).toBe('61999998888')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejeita dígito verificador errado, tamanho errado e repetição', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
})

describe('datas', () => {
  it('isValidBirthDate aceita data real e rejeita inválidas', () => {
    expect(isValidBirthDate('15/03/1990')).toBe(true)
    expect(isValidBirthDate('31/02/1990')).toBe(false)
    expect(isValidBirthDate('15/13/1990')).toBe(false)
    expect(isValidBirthDate('15/03/1890')).toBe(false)
    expect(isValidBirthDate('15-03-1990')).toBe(false)
  })

  it('rejeita ano no futuro', () => {
    const futuro = new Date().getFullYear() + 1
    expect(isValidBirthDate(`15/03/${futuro}`)).toBe(false)
  })

  it('converte entre BR e ISO', () => {
    expect(brDateToISO('15/03/1990')).toBe('1990-03-15')
    expect(brDateToISO('15/03/90')).toBeNull()
    expect(isoToBrDate('1990-03-15')).toBe('15/03/1990')
    expect(isoToBrDate(null)).toBe('')
    expect(isoToBrDate('')).toBe('')
  })
})

describe('insiderFormSchema', () => {
  it('aceita um formulário completo', () => {
    const result = insiderFormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
  })

  it('normaliza e-mail para minúsculas e sem espaços', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, email: '  JOAO@Exemplo.COM ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('joao@exemplo.com')
  })

  it('rejeita CPF inválido', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, cpf: '111.111.111-11' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('CPF inválido.')
  })

  it('rejeita nome curto', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, nome: 'Jo' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('Informe seu nome completo.')
  })

  it('rejeita CEP com menos de 8 dígitos', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, cep: '70000-0' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('CEP inválido.')
  })

  it('rejeita UF com tamanho diferente de 2', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, estado: 'DFF' })
    expect(result.success).toBe(false)
  })

  it('rejeita sexo fora das opções', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, sexo: 'outro' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('Selecione uma opção.')
  })

  it('exige os dois consentimentos', () => {
    const semLgpd = insiderFormSchema.safeParse({ ...validForm, consent_lgpd: false })
    expect(semLgpd.success).toBe(false)
    if (!semLgpd.success) {
      expect(firstZodError(semLgpd.error)).toBe(
        'É preciso aceitar o Termo de Consentimento de Dados (LGPD).'
      )
    }

    const semImagem = insiderFormSchema.safeParse({ ...validForm, consent_imagem: false })
    expect(semImagem.success).toBe(false)
  })

  it('aceita complemento vazio', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, complemento: '' })
    expect(result.success).toBe(true)
  })
})

describe('validateSenha', () => {
  it('exige senha quando obrigatória', () => {
    expect(validateSenha('', '', true)).toBe('Crie uma senha de acesso.')
  })

  it('permite senha vazia quando não obrigatória', () => {
    expect(validateSenha('', '', false)).toBeNull()
  })

  it('exige mínimo de 8 caracteres', () => {
    expect(validateSenha('1234567', '1234567', true)).toBe(
      'A senha deve ter ao menos 8 caracteres.'
    )
  })

  it('exige confirmação igual', () => {
    expect(validateSenha('senha12345', 'senha54321', true)).toBe('As senhas não conferem.')
  })

  it('aceita senha válida', () => {
    expect(validateSenha('senha12345', 'senha12345', true)).toBeNull()
    expect(validateSenha('senha12345', 'senha12345', false)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/insider/__tests__/validation.test.ts`
Expected: FAIL — `Cannot find module '../validation'`.

- [ ] **Step 3: Implementar**

```ts
// lib/insider/validation.ts
import { z } from 'zod'

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '')
}

// ---------- CPF ----------

export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (factor: number) => {
    let sum = 0
    for (let i = 0; i < factor - 1; i++) sum += Number(cpf[i]) * (factor - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10])
}

// ---------- Data ----------

export function maskDate(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function isValidBirthDate(value: string): boolean {
  const m = (value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return false
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  if (year < 1900 || year > new Date().getFullYear()) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

/** DD/MM/AAAA -> AAAA-MM-DD (coluna date) */
export function brDateToISO(value: string): string | null {
  const m = (value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** AAAA-MM-DD (ou timestamp ISO) -> DD/MM/AAAA */
export function isoToBrDate(value: string | null | undefined): string {
  if (!value) return ''
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

// ---------- Outras máscaras ----------

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function maskUf(value: string): string {
  return (value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
}

// ---------- Schema ----------

export const insiderFormSchema = z.object({
  cpf: z.string().trim().refine((v) => isValidCpf(v), 'CPF inválido.'),
  nome: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo.')
    .max(120, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  telefone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10, 'WhatsApp inválido.'),
  data_nascimento: z
    .string()
    .trim()
    .refine((v) => isValidBirthDate(v), 'Data de nascimento inválida.'),
  sexo: z
    .string()
    .trim()
    .refine((v) => v === 'masculino' || v === 'feminino', 'Selecione uma opção.'),
  cep: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length === 8, 'CEP inválido.'),
  logradouro: z.string().trim().min(3, 'Informe o endereço.').max(160, 'Endereço muito longo.'),
  numero: z.string().trim().min(1, 'Informe o número.').max(20, 'Número muito longo.'),
  complemento: z.string().trim().max(80, 'Complemento muito longo.'),
  bairro: z.string().trim().min(2, 'Informe o bairro.').max(80, 'Bairro muito longo.'),
  cidade: z.string().trim().min(2, 'Informe a cidade.').max(80, 'Cidade muito longa.'),
  estado: z
    .string()
    .trim()
    .refine((v) => /^[A-Za-z]{2}$/.test(v), 'UF inválida.'),
  consent_lgpd: z
    .boolean()
    .refine((v) => v === true, 'É preciso aceitar o Termo de Consentimento de Dados (LGPD).'),
  consent_imagem: z
    .boolean()
    .refine((v) => v === true, 'É preciso aceitar o Termo de Uso de Imagem.'),
})

export type InsiderFormInput = z.infer<typeof insiderFormSchema>

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Verifique os dados informados.'
}

/**
 * Regra de senha compartilhada client/server.
 * `obrigatoria` = true quando o insider ainda não tem credencial salva.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export function validateSenha(
  senha: string,
  confirmacao: string,
  obrigatoria: boolean
): string | null {
  if (!senha) {
    return obrigatoria ? 'Crie uma senha de acesso.' : null
  }
  if (senha.length < 8) return 'A senha deve ter ao menos 8 caracteres.'
  if (senha !== confirmacao) return 'As senhas não conferem.'
  return null
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- lib/insider/__tests__/validation.test.ts`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/insider/validation.ts lib/insider/__tests__/validation.test.ts
git commit -m "feat(insider): máscaras, validação e schema do cadastro"
```

---

### Task 3: Mapper entre formulário e banco

**Files:**
- Create: `lib/insider/insider-mapper.ts`
- Test: `lib/insider/__tests__/insider-mapper.test.ts`

**Interfaces:**
- Consumes: de `./validation` — `onlyDigits`, `maskCpf`, `maskPhone`, `maskCep`, `brDateToISO`, `isoToBrDate`, `type InsiderFormInput`.
- Produces:
  - `INSIDER_PUBLIC_COLUMNS: string` — lista de colunas para o `.select()`
  - `type InsiderPublic`
  - `cpfCandidates(cpf: string): string[]`
  - `toInsiderPublic(row: Record<string, unknown>, temSenha: boolean): InsiderPublic`
  - `buildInsiderRow(input: InsiderFormInput): Record<string, unknown>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/insider/__tests__/insider-mapper.test.ts
import {
  cpfCandidates,
  toInsiderPublic,
  buildInsiderRow,
  INSIDER_PUBLIC_COLUMNS,
} from '../insider-mapper'

describe('cpfCandidates', () => {
  it('devolve as duas grafias a partir do formato com máscara', () => {
    expect(cpfCandidates('529.982.247-25')).toEqual(['52998224725', '529.982.247-25'])
  })

  it('devolve as duas grafias a partir dos dígitos crus', () => {
    expect(cpfCandidates('52998224725')).toEqual(['52998224725', '529.982.247-25'])
  })

  it('não duplica quando não há 11 dígitos', () => {
    expect(cpfCandidates('529')).toEqual(['529'])
  })
})

describe('INSIDER_PUBLIC_COLUMNS', () => {
  it('não expõe colunas de benefício', () => {
    for (const proibida of [
      'evolve',
      'dopahmina',
      'tex_barbearia',
      'cupom_loja_somma',
      'big_box',
      'assessoria_somma',
      'estamina_recovery',
    ]) {
      expect(INSIDER_PUBLIC_COLUMNS).not.toContain(proibida)
    }
  })

  it('inclui o id e os campos de cadastro', () => {
    expect(INSIDER_PUBLIC_COLUMNS).toContain('id')
    expect(INSIDER_PUBLIC_COLUMNS).toContain('foto_url')
    expect(INSIDER_PUBLIC_COLUMNS).toContain('data_nascimento')
  })
})

describe('toInsiderPublic', () => {
  const row = {
    id: 'uuid-1',
    nome: 'João Silva',
    email: 'joao@exemplo.com',
    telefone: '(61) 99999-8888',
    data_nascimento: '1990-03-15',
    sexo: 'masculino',
    cep: '70000-000',
    logradouro: 'SQN 210',
    numero: '101',
    complemento: null,
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    estado: 'DF',
    foto_url: 'https://exemplo.com/foto.jpg',
  }

  it('converte a data ISO para DD/MM/AAAA', () => {
    expect(toInsiderPublic(row, false).data_nascimento).toBe('15/03/1990')
  })

  it('troca nulos por string vazia', () => {
    expect(toInsiderPublic(row, false).complemento).toBe('')
  })

  it('propaga temSenha', () => {
    expect(toInsiderPublic(row, true).tem_senha).toBe(true)
    expect(toInsiderPublic(row, false).tem_senha).toBe(false)
  })

  it('nunca inclui hash de senha nem benefícios', () => {
    const publico = toInsiderPublic({ ...row, senha_hash: 'x', evolve: 'CUPOM10' }, false) as Record<
      string,
      unknown
    >
    expect(publico.senha_hash).toBeUndefined()
    expect(publico.evolve).toBeUndefined()
  })
})

describe('buildInsiderRow', () => {
  const input = {
    cpf: '529.982.247-25',
    nome: '  João Silva  ',
    email: 'joao@exemplo.com',
    telefone: '61999998888',
    data_nascimento: '15/03/1990',
    sexo: 'masculino',
    cep: '70000000',
    logradouro: 'SQN 210',
    numero: '101',
    complemento: '',
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    estado: 'df',
    consent_lgpd: true,
    consent_imagem: true,
  }

  it('normaliza telefone, cep, uf e data', () => {
    const row = buildInsiderRow(input)
    expect(row.telefone).toBe('(61) 99999-8888')
    expect(row.cep).toBe('70000-000')
    expect(row.estado).toBe('DF')
    expect(row.data_nascimento).toBe('1990-03-15')
    expect(row.nome).toBe('João Silva')
  })

  it('não inclui cpf nem foto_url (a rota decide)', () => {
    const row = buildInsiderRow(input)
    expect(row.cpf).toBeUndefined()
    expect(row.foto_url).toBeUndefined()
  })

  it('não toca em colunas de benefício', () => {
    const row = buildInsiderRow(input)
    expect(Object.keys(row)).not.toContain('evolve')
    expect(Object.keys(row)).not.toContain('dopahmina')
  })

  it('grava complemento vazio como null', () => {
    expect(buildInsiderRow(input).complemento).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/insider/__tests__/insider-mapper.test.ts`
Expected: FAIL — `Cannot find module '../insider-mapper'`.

- [ ] **Step 3: Implementar**

```ts
// lib/insider/insider-mapper.ts
import {
  brDateToISO,
  isoToBrDate,
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
  type InsiderFormInput,
} from './validation'

/** Colunas devolvidas ao browser. Nunca inclui senha nem benefícios. */
export const INSIDER_PUBLIC_COLUMNS =
  'id, nome, email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado, foto_url'

export type InsiderPublic = {
  id: string
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
  foto_url: string
  tem_senha: boolean
}

/**
 * A base legada tem CPF gravado com e sem máscara.
 * Devolve as duas grafias para usar em `.in('cpf', ...)`.
 */
export function cpfCandidates(cpf: string): string[] {
  const digits = onlyDigits(cpf)
  if (digits.length !== 11) return [digits]
  return [digits, maskCpf(digits)]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function toInsiderPublic(
  row: Record<string, unknown>,
  temSenha: boolean
): InsiderPublic {
  return {
    id: text(row.id),
    nome: text(row.nome),
    email: text(row.email),
    telefone: text(row.telefone),
    data_nascimento: isoToBrDate(text(row.data_nascimento)),
    sexo: text(row.sexo),
    cep: text(row.cep),
    logradouro: text(row.logradouro),
    numero: text(row.numero),
    complemento: text(row.complemento),
    bairro: text(row.bairro),
    cidade: text(row.cidade),
    estado: text(row.estado),
    foto_url: text(row.foto_url),
    tem_senha: temSenha,
  }
}

/**
 * Campos editáveis do formulário -> colunas de dados_insiders.
 * `cpf` e `foto_url` ficam de fora: a rota decide se insere ou preserva.
 */
export function buildInsiderRow(input: InsiderFormInput): Record<string, unknown> {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    telefone: maskPhone(input.telefone),
    data_nascimento: brDateToISO(input.data_nascimento),
    sexo: input.sexo,
    cep: maskCep(input.cep),
    logradouro: input.logradouro.trim(),
    numero: input.numero.trim(),
    complemento: input.complemento.trim() || null,
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    estado: input.estado.trim().toUpperCase(),
    consent_lgpd: input.consent_lgpd,
    consent_imagem: input.consent_imagem,
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- lib/insider/__tests__/insider-mapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/insider/insider-mapper.ts lib/insider/__tests__/insider-mapper.test.ts
git commit -m "feat(insider): mapper entre formulário e tabela dados_insiders"
```

---

### Task 4: Liberar rota pública no middleware

**Files:**
- Modify: `lib/auth/page-routes.ts` (adicionar `isOpenPage`, perto de `isPublicPage:92-94`)
- Modify: `lib/auth/route-permissions.ts` (adicionar entradas em `PUBLIC_API_ROUTES:4-11`)
- Modify: `middleware.ts` (chamar `isOpenPage` em `handlePageAuth`, antes do bloco `isPublicPage:60`)
- Test: `lib/auth/__tests__/insider-public-routes.test.ts`

**Interfaces:**
- Consumes: `isPublicApiRoute(pathname, method)` e `getRequiredPermission(pathname)` já existentes.
- Produces: `isOpenPage(pathname: string): boolean` exportado de `lib/auth/page-routes.ts`.

**Contexto que o implementador precisa:** `isPublicPage` tem semântica de *só visitante* — `middleware.ts:60-68` redireciona quem já tem sessão para `/`. Se `/insider` usasse isso, ninguém da equipe logado conseguiria abrir a página. Por isso o conceito novo `isOpenPage`: aberta a todos, logados ou não, sem redirect.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/auth/__tests__/insider-public-routes.test.ts
import { isPublicApiRoute, getRequiredPermission } from '../route-permissions'
import { isOpenPage, isPublicPage, getSpaRedirect, getPagePermission } from '../page-routes'

describe('rotas públicas do /insider', () => {
  it('libera lookup e register sem sessão', () => {
    expect(isPublicApiRoute('/api/insiders/lookup', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/insiders/register', 'POST')).toBe(true)
  })

  it('não libera outros métodos nessas rotas', () => {
    expect(isPublicApiRoute('/api/insiders/lookup', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/insiders/register', 'DELETE')).toBe(false)
  })

  it('mantém a rota interna /api/insider protegida', () => {
    expect(isPublicApiRoute('/api/insider/eventos', 'GET')).toBe(false)
    expect(getRequiredPermission('/api/insider/eventos')).toBe('pagamentos')
  })

  it('/insider é página aberta, não página de visitante', () => {
    expect(isOpenPage('/insider')).toBe(true)
    expect(isPublicPage('/insider')).toBe(false)
    expect(isOpenPage('/login')).toBe(false)
    expect(isOpenPage('/crm')).toBe(false)
  })

  it('/insider não redireciona para a SPA nem exige permissão', () => {
    expect(getSpaRedirect('/insider', '')).toBeNull()
    expect(getPagePermission('/insider')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/auth/__tests__/insider-public-routes.test.ts`
Expected: FAIL — `isOpenPage is not a function` e as asserções de `isPublicApiRoute` retornando `false`.

- [ ] **Step 3: Liberar as rotas de API**

Em `lib/auth/route-permissions.ts`, acrescentar as duas entradas ao final do array `PUBLIC_API_ROUTES` (linha 10, depois de `/^\/api\/eventos\/ativos$/`):

```ts
  { pattern: /^\/api\/eventos\/ativos$/ },
  // Página pública /insider (auto-cadastro do Insider)
  { method: 'POST', pattern: /^\/api\/insiders\/lookup$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/register$/ },
]
```

Nada mais muda nesse arquivo: `middleware.ts:24` consulta `isPublicApiRoute` antes de `getRequiredPermission`, então a regra `/^\/api\/insider/` da linha 33 não chega a ser aplicada.

- [ ] **Step 4: Adicionar `isOpenPage`**

Em `lib/auth/page-routes.ts`, logo acima de `isPublicPage` (linha 92):

```ts
/** Páginas abertas a todos — com ou sem sessão, sem redirect */
const OPEN_PAGES: RegExp[] = [/^\/insider$/]

export function isOpenPage(pathname: string): boolean {
  return OPEN_PAGES.some((pattern) => pattern.test(pathname))
}

export function isPublicPage(pathname: string): boolean {
  return pathname === '/login'
}
```

- [ ] **Step 5: Usar no middleware**

Em `middleware.ts`, importar `isOpenPage` junto dos demais (linhas 10-15) e inserir a checagem em `handlePageAuth` logo depois do bloco de `spaRedirect` (após a linha 58), antes do `if (isPublicPage(pathname))`:

```ts
import {
  getPagePermission,
  getSpaRedirect,
  isOpenPage,
  isPublicPage,
  isStaticAsset,
} from '@/lib/auth/page-routes'
```

```ts
  // Página aberta: passa direto, tenha sessão ou não
  if (isOpenPage(pathname)) {
    return NextResponse.next()
  }

  if (isPublicPage(pathname)) {
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test -- lib/auth/__tests__/insider-public-routes.test.ts`
Expected: PASS.

- [ ] **Step 7: Rodar a suíte inteira para garantir que nada quebrou**

Run: `npm test`
Expected: PASS em todos os arquivos.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/page-routes.ts lib/auth/route-permissions.ts middleware.ts lib/auth/__tests__/insider-public-routes.test.ts
git commit -m "feat(insider): libera /insider e as rotas de cadastro no middleware"
```

---

### Task 5: API de busca por CPF

**Files:**
- Create: `app/api/insiders/lookup/route.ts`

**Interfaces:**
- Consumes: `getAdminClient()` de `@/lib/auth/api-auth`; `isValidCpf` de `@/lib/insider/validation`; `cpfCandidates`, `toInsiderPublic`, `INSIDER_PUBLIC_COLUMNS` de `@/lib/insider/insider-mapper`.
- Produces: `POST /api/insiders/lookup` — body `{ cpf: string }`; resposta `{ found: false }` ou `{ found: true, insider: InsiderPublic }`.

- [ ] **Step 1: Implementar a rota**

```ts
// app/api/insiders/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { isValidCpf } from '@/lib/insider/validation'
import {
  cpfCandidates,
  toInsiderPublic,
  INSIDER_PUBLIC_COLUMNS,
} from '@/lib/insider/insider-mapper'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const cpf = typeof body?.cpf === 'string' ? body.cpf : ''

    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('dados_insiders')
      .select(INSIDER_PUBLIC_COLUMNS)
      .in('cpf', cpfCandidates(cpf))
      .limit(1)

    if (error) {
      console.error('[insiders/lookup] select error:', error)
      return NextResponse.json({ error: 'Erro ao consultar o cadastro.' }, { status: 500 })
    }

    const row = data?.[0]
    if (!row) {
      return NextResponse.json({ found: false })
    }

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', (row as { id: string }).id)
      .maybeSingle()

    if (credError) {
      console.error('[insiders/lookup] credential error:', credError)
    }

    return NextResponse.json({
      found: true,
      insider: toInsiderPublic(row as Record<string, unknown>, Boolean(credencial)),
    })
  } catch (err) {
    console.error('[insiders/lookup] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Subir o servidor de dev**

Run: `npm run dev`
Expected: servidor em `http://localhost:3000` sem erros de compilação.

- [ ] **Step 3: Testar CPF inválido**

Run:
```bash
curl -s -X POST http://localhost:3000/api/insiders/lookup \
  -H 'Content-Type: application/json' -d '{"cpf":"111.111.111-11"}'
```
Expected: `{"error":"CPF inválido."}`

- [ ] **Step 4: Testar CPF não cadastrado**

Run:
```bash
curl -s -X POST http://localhost:3000/api/insiders/lookup \
  -H 'Content-Type: application/json' -d '{"cpf":"529.982.247-25"}'
```
Expected: `{"found":false}` (assumindo que esse CPF não está na base). Se estiver, use qualquer CPF válido ausente da tabela.

- [ ] **Step 5: Testar CPF real da base**

Pegar um CPF existente no SQL Editor (`SELECT cpf FROM dados_insiders WHERE cpf <> '' LIMIT 1;`) e repetir o curl com ele.
Expected: `{"found":true,"insider":{...}}` com `nome` preenchido, `tem_senha:false` e **sem** nenhuma chave de benefício ou senha.

- [ ] **Step 6: Commit**

```bash
git add app/api/insiders/lookup/route.ts
git commit -m "feat(insider): rota pública de busca de cadastro por CPF"
```

---

### Task 6: API de cadastro/atualização

**Files:**
- Create: `app/api/insiders/register/route.ts`

**Interfaces:**
- Consumes: `getAdminClient()` e `hashPassword` de `@/lib/auth/api-auth`; `insiderFormSchema`, `firstZodError`, `validateSenha`, `maskCpf`, `onlyDigits` de `@/lib/insider/validation`; `cpfCandidates`, `buildInsiderRow` de `@/lib/insider/insider-mapper`.
- Produces: `POST /api/insiders/register` — `multipart/form-data`; resposta `{ success: true, atualizado: boolean }`.

**Campos esperados no FormData:** `cpf, nome, email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado, consent_lgpd, consent_imagem, senha, senha_confirmacao, foto`. Os consentimentos chegam como as strings `"true"` / `"false"`; `foto` é opcional.

- [ ] **Step 1: Implementar a rota**

```ts
// app/api/insiders/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, hashPassword } from '@/lib/auth/api-auth'
import {
  insiderFormSchema,
  firstZodError,
  validateSenha,
  maskCpf,
  onlyDigits,
} from '@/lib/insider/validation'
import { cpfCandidates, buildInsiderRow } from '@/lib/insider/insider-mapper'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'insider-fotos'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const campo = (nome: string) => String(formData.get(nome) ?? '').trim()

    const parsed = insiderFormSchema.safeParse({
      cpf: campo('cpf'),
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
      consent_lgpd: campo('consent_lgpd') === 'true',
      consent_imagem: campo('consent_imagem') === 'true',
    })

    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Já existe cadastro para esse CPF?
    const { data: encontrados, error: findError } = await supabase
      .from('dados_insiders')
      .select('id')
      .in('cpf', cpfCandidates(parsed.data.cpf))
      .limit(1)

    if (findError) {
      console.error('[insiders/register] find error:', findError)
      return NextResponse.json({ error: 'Erro ao consultar o cadastro.' }, { status: 500 })
    }

    const existente = encontrados?.[0] ?? null

    // 2. Senha é obrigatória enquanto não houver credencial salva
    let temSenha = false
    if (existente) {
      const { data: credencial } = await supabase
        .from('insider_credentials')
        .select('insider_id')
        .eq('insider_id', existente.id)
        .maybeSingle()
      temSenha = Boolean(credencial)
    }

    const senha = String(formData.get('senha') ?? '')
    const senhaConfirmacao = String(formData.get('senha_confirmacao') ?? '')
    const erroSenha = validateSenha(senha, senhaConfirmacao, !temSenha)
    if (erroSenha) {
      return NextResponse.json({ error: erroSenha }, { status: 400 })
    }

    // 3. Foto de perfil (opcional)
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

      const ext = foto.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${onlyDigits(parsed.data.cpf)}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, await foto.arrayBuffer(), { contentType: foto.type, upsert: true })

      if (uploadError) {
        console.error('[insiders/register] upload error:', uploadError)
        return NextResponse.json({ error: 'Erro ao enviar a foto.' }, { status: 500 })
      }

      fotoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    // 4. Grava o cadastro
    const row = buildInsiderRow(parsed.data)
    row.atualizado_em = new Date().toISOString()
    if (fotoUrl) row.foto_url = fotoUrl

    let insiderId: string

    if (existente) {
      // Não sobrescreve o cpf: a grafia gravada é usada por outras telas.
      const { error: updateError } = await supabase
        .from('dados_insiders')
        .update(row)
        .eq('id', existente.id)

      if (updateError) {
        console.error('[insiders/register] update error:', updateError)
        return NextResponse.json({ error: 'Erro ao salvar o cadastro.' }, { status: 500 })
      }
      insiderId = existente.id
    } else {
      const { data: inserido, error: insertError } = await supabase
        .from('dados_insiders')
        .insert({ ...row, cpf: maskCpf(parsed.data.cpf) })
        .select('id')
        .single()

      if (insertError || !inserido) {
        console.error('[insiders/register] insert error:', insertError)
        return NextResponse.json({ error: 'Erro ao criar o cadastro.' }, { status: 500 })
      }
      insiderId = inserido.id
    }

    // 5. Senha (só quando informada)
    if (senha) {
      const senhaHash = await hashPassword(senha)
      const { error: credError } = await supabase.from('insider_credentials').upsert(
        {
          insider_id: insiderId,
          senha_hash: senhaHash,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'insider_id' }
      )

      if (credError) {
        console.error('[insiders/register] credential error:', credError)
        return NextResponse.json(
          { error: 'Cadastro salvo, mas houve erro ao gravar a senha.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, atualizado: Boolean(existente) })
  } catch (err) {
    console.error('[insiders/register] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Testar cadastro novo**

Com `npm run dev` rodando:

```bash
curl -s -X POST http://localhost:3000/api/insiders/register \
  -F 'cpf=529.982.247-25' -F 'nome=Teste Cadastro Insider' \
  -F 'email=teste.insider@exemplo.com' -F 'telefone=(61) 99999-8888' \
  -F 'data_nascimento=15/03/1990' -F 'sexo=masculino' \
  -F 'cep=70000-000' -F 'logradouro=SQN 210 Bloco A' -F 'numero=101' \
  -F 'complemento=' -F 'bairro=Asa Norte' -F 'cidade=Brasilia' -F 'estado=DF' \
  -F 'consent_lgpd=true' -F 'consent_imagem=true' \
  -F 'senha=senha12345' -F 'senha_confirmacao=senha12345'
```
Expected: `{"success":true,"atualizado":false}`

- [ ] **Step 3: Testar que repetir o CPF atualiza em vez de duplicar**

Repetir o comando do Step 2 trocando o nome para `Teste Cadastro Atualizado` e **removendo** os dois campos de senha.
Expected: `{"success":true,"atualizado":true}`

Confirmar no SQL Editor que existe uma linha só:
```sql
SELECT id, nome, email, cidade FROM dados_insiders WHERE cpf IN ('52998224725','529.982.247-25');
```
Expected: 1 linha, com `nome = 'Teste Cadastro Atualizado'`.

- [ ] **Step 4: Testar as validações**

```bash
# senha curta
curl -s -X POST http://localhost:3000/api/insiders/register \
  -F 'cpf=529.982.247-25' -F 'nome=Teste' -F 'email=a@b.com' -F 'telefone=61999998888' \
  -F 'data_nascimento=15/03/1990' -F 'sexo=masculino' -F 'cep=70000000' \
  -F 'logradouro=Rua X' -F 'numero=1' -F 'complemento=' -F 'bairro=Centro' \
  -F 'cidade=Brasilia' -F 'estado=DF' -F 'consent_lgpd=true' -F 'consent_imagem=true' \
  -F 'senha=123' -F 'senha_confirmacao=123'
```
Expected: `{"error":"A senha deve ter ao menos 8 caracteres."}`

```bash
# sem consentimento LGPD
curl -s -X POST http://localhost:3000/api/insiders/register \
  -F 'cpf=529.982.247-25' -F 'nome=Teste Nome' -F 'email=a@b.com' -F 'telefone=61999998888' \
  -F 'data_nascimento=15/03/1990' -F 'sexo=masculino' -F 'cep=70000000' \
  -F 'logradouro=Rua X' -F 'numero=1' -F 'complemento=' -F 'bairro=Centro' \
  -F 'cidade=Brasilia' -F 'estado=DF' -F 'consent_lgpd=false' -F 'consent_imagem=true'
```
Expected: `{"error":"É preciso aceitar o Termo de Consentimento de Dados (LGPD)."}`

- [ ] **Step 5: Limpar o registro de teste**

```sql
DELETE FROM dados_insiders WHERE cpf IN ('52998224725','529.982.247-25');
```
(o `ON DELETE CASCADE` remove a credencial junto)

- [ ] **Step 6: Commit**

```bash
git add app/api/insiders/register/route.ts
git commit -m "feat(insider): rota pública de cadastro e atualização de Insider"
```

---

### Task 7: Estrutura visual da página

**Files:**
- Modify: `package.json` (dependência `framer-motion`)
- Create: `hooks/use-cep-lookup.ts`
- Create: `app/insider/layout.tsx`
- Create: `app/insider/page.tsx`
- Create: `components/insider/insider-form-ui.tsx`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  - `useCepLookup(): { status: 'idle' | 'loading' | 'error'; buscar: (cep: string) => Promise<EnderecoCep | null> }` e `type EnderecoCep = { logradouro: string; bairro: string; cidade: string; estado: string }`
  - `Reveal({ show, children }): JSX.Element`
  - `InsiderField({ id, label, children }): JSX.Element`
  - `INPUT_CLS: string`

**Contexto:** o root layout (`app/layout.tsx:51`) aplica `geistMono.className bg-black text-white` no `<body>` e não pode ser alterado. O layout da rota compensa envolvendo tudo num wrapper com a fonte Geist e o fundo `#0A0A0A`.

- [ ] **Step 1: Instalar framer-motion**

Run: `npm install framer-motion@^12`
Expected: instala sem conflito de peer dependency (React 19 é suportado).

- [ ] **Step 2: Criar o hook de CEP**

```ts
// hooks/use-cep-lookup.ts
"use client"

import { useCallback, useState } from 'react'

export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

type Status = 'idle' | 'loading' | 'error'

/** Autofill de endereço via BrasilAPI (mesmo endpoint do checkout do site). */
export function useCepLookup() {
  const [status, setStatus] = useState<Status>('idle')

  const buscar = useCallback(async (cep: string): Promise<EnderecoCep | null> => {
    const digits = (cep || '').replace(/\D/g, '')
    if (digits.length !== 8) return null

    setStatus('loading')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
      if (!res.ok) throw new Error('cep')
      const data = await res.json()
      setStatus('idle')
      return {
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || '',
      }
    } catch {
      setStatus('error')
      return null
    }
  }, [])

  return { status, buscar }
}
```

- [ ] **Step 3: Criar os primitivos visuais**

```tsx
// components/insider/insider-form-ui.tsx
"use client"

import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/** Classe única dos inputs — espelha o formulário da home do site. */
export const INPUT_CLS =
  'w-full rounded-xl border border-black/10 px-4 py-3 text-[#0A0A0A] outline-none transition-colors focus:border-[#FF2C03]'

/** Revela o campo quando o anterior está preenchido, sem recolher o que já apareceu. */
export function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="pt-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function InsiderField({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#0A0A0A]">
        {label}
      </label>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Criar o layout da rota**

```tsx
// app/insider/layout.tsx
import type React from 'react'
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'

const geist = Geist({ subsets: ['latin'], variable: '--font-insider-sans' })

export const metadata: Metadata = {
  title: 'Cadastro Insider — Somma Club',
  description: 'Atualize seus dados de Insider do Somma Club.',
}

export default function InsiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${geist.variable} min-h-screen bg-[#0A0A0A] text-white`}
      style={{ fontFamily: 'var(--font-insider-sans), system-ui, sans-serif' }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Criar a página**

```tsx
// app/insider/page.tsx
import { InsiderCadastroForm } from '@/components/insider/insider-cadastro-form'

export default function InsiderPage() {
  return (
    <section className="px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#FF2C03]">
            Cadastro Insider
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            Mantenha seus dados de Insider atualizados
          </h1>
          <p className="mt-4 max-w-prose text-base text-white/70 md:text-lg">
            Digite seu CPF para começar. Se você já é Insider, seus dados aparecem para conferência.
            Se ainda não é, o cadastro leva menos de 2 minutos.
          </p>
        </div>
        <InsiderCadastroForm />
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Criar um stub do formulário para a página compilar**

```tsx
// components/insider/insider-cadastro-form.tsx
"use client"

export function InsiderCadastroForm() {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 shadow-lg md:p-8">
      <p className="text-sm text-[#737373]">Formulário em construção.</p>
    </div>
  )
}
```

- [ ] **Step 7: Verificar no navegador**

Com `npm run dev` rodando, abrir `http://localhost:3000/insider` numa janela anônima (sem sessão).
Expected: a página carrega **sem redirecionar para `/login`**, com fundo quase preto, título grande à esquerda (ou acima, no mobile) e card branco arredondado à direita. Abrir também logado — deve carregar igual, sem redirecionar para `/`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json hooks/use-cep-lookup.ts app/insider components/insider
git commit -m "feat(insider): estrutura visual da página pública de cadastro"
```

---

### Task 8: Formulário completo

**Files:**
- Modify: `components/insider/insider-cadastro-form.tsx` (substitui o stub da Task 7)

**Interfaces:**
- Consumes: `INPUT_CLS`, `Reveal`, `InsiderField` de `@/components/insider/insider-form-ui`; `useCepLookup` de `@/hooks/use-cep-lookup`; máscaras e `validateSenha` de `@/lib/insider/validation`; `type InsiderPublic` de `@/lib/insider/insider-mapper`; as rotas `POST /api/insiders/lookup` e `POST /api/insiders/register`.
- Produces: `InsiderCadastroForm()` — componente cliente já consumido por `app/insider/page.tsx`.

**Comportamento:** o CPF é o único campo visível no início. Ao completar 11 dígitos válidos, dispara o lookup. Encontrado → todos os campos aparecem preenchidos de uma vez. Não encontrado → revelação progressiva. Editar o CPF depois zera o restante do formulário.

- [ ] **Step 1: Escrever o componente**

```tsx
// components/insider/insider-cadastro-form.tsx
"use client"

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { INPUT_CLS, InsiderField, Reveal } from '@/components/insider/insider-form-ui'
import { useCepLookup } from '@/hooks/use-cep-lookup'
import {
  isValidBirthDate,
  isValidCpf,
  maskCep,
  maskCpf,
  maskDate,
  maskPhone,
  maskUf,
  onlyDigits,
  validateSenha,
} from '@/lib/insider/validation'
import type { InsiderPublic } from '@/lib/insider/insider-mapper'

type FormState = {
  cpf: string
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
  senha: string
  senha_confirmacao: string
}

const FORM_VAZIO: Omit<FormState, 'cpf'> = {
  nome: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  sexo: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  senha: '',
  senha_confirmacao: '',
}

type LookupStatus = 'idle' | 'loading' | 'found' | 'new'

export function InsiderCadastroForm() {
  const [form, setForm] = useState<FormState>({ cpf: '', ...FORM_VAZIO })
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [nomeEncontrado, setNomeEncontrado] = useState('')
  const [temSenha, setTemSenha] = useState(false)
  const [fotoAtual, setFotoAtual] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [consentLgpd, setConsentLgpd] = useState(false)
  const [consentImagem, setConsentImagem] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<'novo' | 'atualizado' | null>(null)

  const cep = useCepLookup()
  const ultimoCepBuscado = useRef('')

  const set = (campo: keyof FormState, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  // --- Busca do CPF ---
  useEffect(() => {
    const digits = onlyDigits(form.cpf)

    if (digits.length !== 11 || !isValidCpf(form.cpf)) {
      setLookupStatus('idle')
      setNomeEncontrado('')
      setTemSenha(false)
      setFotoAtual('')
      ultimoCepBuscado.current = ''
      setForm((f) => ({ ...FORM_VAZIO, cpf: f.cpf }))
      return
    }

    let cancelado = false
    setLookupStatus('loading')
    setErro(null)

    fetch('/api/insiders/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: form.cpf }),
    })
      .then((res) => res.json())
      .then((data: { found?: boolean; insider?: InsiderPublic }) => {
        if (cancelado) return
        if (data?.found && data.insider) {
          const i = data.insider
          setForm((f) => ({
            cpf: f.cpf,
            nome: i.nome,
            email: i.email,
            telefone: i.telefone,
            data_nascimento: i.data_nascimento,
            sexo: i.sexo,
            cep: i.cep,
            logradouro: i.logradouro,
            numero: i.numero,
            complemento: i.complemento,
            bairro: i.bairro,
            cidade: i.cidade,
            estado: i.estado,
            senha: '',
            senha_confirmacao: '',
          }))
          ultimoCepBuscado.current = onlyDigits(i.cep)
          setNomeEncontrado(i.nome.split(' ')[0] || '')
          setTemSenha(i.tem_senha)
          setFotoAtual(i.foto_url)
          setLookupStatus('found')
        } else {
          setLookupStatus('new')
        }
      })
      .catch(() => {
        // Rede falhou: segue como cadastro novo. O servidor refaz a busca
        // por CPF no envio, então não há risco de duplicar.
        if (!cancelado) setLookupStatus('new')
      })

    return () => {
      cancelado = true
    }
  }, [form.cpf])

  // --- Autofill de endereço ---
  async function handleCepChange(valor: string) {
    const formatado = maskCep(valor)
    set('cep', formatado)

    const digits = onlyDigits(formatado)
    if (digits.length !== 8 || digits === ultimoCepBuscado.current) return

    ultimoCepBuscado.current = digits
    const endereco = await cep.buscar(digits)
    if (!endereco) return

    setForm((f) => ({
      ...f,
      logradouro: endereco.logradouro || f.logradouro,
      bairro: endereco.bairro || f.bairro,
      cidade: endereco.cidade || f.cidade,
      estado: endereco.estado || f.estado,
    }))
  }

  function handleFoto(file: File | null) {
    setFoto(file)
    setFotoPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  // --- Revelação progressiva ---
  const revelarTudo = lookupStatus === 'found'
  const iniciado = lookupStatus === 'found' || lookupStatus === 'new'

  const nomeOk = form.nome.trim().length >= 3
  const emailOk = /\S+@\S+\.\S+/.test(form.email)
  const nascOk = isValidBirthDate(form.data_nascimento)
  const cepOk = onlyDigits(form.cep).length === 8
  const enderecoOk =
    form.logradouro.trim().length >= 3 &&
    form.numero.trim().length >= 1 &&
    form.bairro.trim().length >= 2 &&
    form.cidade.trim().length >= 2 &&
    form.estado.trim().length === 2
  const telefoneOk = onlyDigits(form.telefone).length >= 10
  const sexoOk = form.sexo === 'masculino' || form.sexo === 'feminino'
  const senhaOk = validateSenha(form.senha, form.senha_confirmacao, !temSenha) === null

  const showNome = iniciado
  const showEmail = showNome && (revelarTudo || nomeOk)
  const showNascCep = showEmail && (revelarTudo || emailOk)
  const showEndereco = showNascCep && (revelarTudo || (nascOk && cepOk))
  const showTelefone = showEndereco && (revelarTudo || enderecoOk)
  const showSexo = showTelefone && (revelarTudo || telefoneOk)
  const showFotoSenha = showSexo && (revelarTudo || sexoOk)
  const showFinal = showFotoSenha && (revelarTudo || senhaOk)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const erroSenha = validateSenha(form.senha, form.senha_confirmacao, !temSenha)
    if (erroSenha) {
      setErro(erroSenha)
      return
    }

    const payload = new FormData()
    Object.entries(form).forEach(([chave, valor]) => payload.append(chave, valor))
    payload.append('consent_lgpd', String(consentLgpd))
    payload.append('consent_imagem', String(consentImagem))
    if (foto) payload.append('foto', foto)

    setEnviando(true)
    try {
      const res = await fetch('/api/insiders/register', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar o cadastro.')
      setConcluido(data.atualizado ? 'atualizado' : 'novo')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar o cadastro.')
    } finally {
      setEnviando(false)
    }
  }

  if (concluido) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-lg md:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#FF2C03]" />
        <h2 className="mt-4 text-xl font-semibold text-[#0A0A0A]">
          {concluido === 'novo' ? 'Cadastro concluído!' : 'Cadastro atualizado!'}
        </h2>
        <p className="mt-2 text-sm text-[#737373]">
          Seus dados foram salvos. Qualquer mudança, é só voltar aqui e digitar seu CPF.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 shadow-lg md:p-8"
      noValidate
    >
      <InsiderField id="cpf" label="CPF">
        <div className="relative">
          <input
            id="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={form.cpf}
            onChange={(e) => set('cpf', maskCpf(e.target.value))}
            className={INPUT_CLS}
            placeholder="000.000.000-00"
          />
          {lookupStatus === 'loading' && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#737373]" />
          )}
        </div>
      </InsiderField>

      {lookupStatus === 'found' && (
        <p className="mt-2 text-sm text-[#737373]">
          Encontramos seu cadastro{nomeEncontrado ? `, ${nomeEncontrado}` : ''}! Confira e atualize
          os dados.
        </p>
      )}
      {lookupStatus === 'new' && (
        <p className="mt-2 text-sm text-[#737373]">
          CPF não encontrado — vamos fazer o seu cadastro.
        </p>
      )}

      <Reveal show={showNome}>
        <InsiderField id="nome" label="Nome completo">
          <input
            id="nome"
            type="text"
            autoComplete="name"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            className={INPUT_CLS}
            placeholder="João Silva Santos"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showEmail}>
        <InsiderField id="email" label="E-mail">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={INPUT_CLS}
            placeholder="seu@email.com"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showNascCep}>
        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="data_nascimento" label="Data de nascimento">
            <input
              id="data_nascimento"
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', maskDate(e.target.value))}
              className={INPUT_CLS}
              placeholder="DD/MM/AAAA"
            />
          </InsiderField>
          <InsiderField id="cep" label="CEP">
            <input
              id="cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={form.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              className={INPUT_CLS}
              placeholder="00000-000"
            />
          </InsiderField>
        </div>
        {cep.status === 'loading' && (
          <p className="mt-2 text-sm text-[#737373]">Buscando endereço…</p>
        )}
        {cep.status === 'error' && (
          <p className="mt-2 text-sm text-[#737373]">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}
      </Reveal>

      <Reveal show={showEndereco}>
        <InsiderField id="logradouro" label="Endereço">
          <input
            id="logradouro"
            type="text"
            autoComplete="address-line1"
            value={form.logradouro}
            onChange={(e) => set('logradouro', e.target.value)}
            className={INPUT_CLS}
            placeholder="Rua, avenida ou quadra"
          />
        </InsiderField>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InsiderField id="numero" label="Número">
            <input
              id="numero"
              type="text"
              value={form.numero}
              onChange={(e) => set('numero', e.target.value)}
              className={INPUT_CLS}
              placeholder="101"
            />
          </InsiderField>
          <InsiderField id="complemento" label="Complemento">
            <input
              id="complemento"
              type="text"
              value={form.complemento}
              onChange={(e) => set('complemento', e.target.value)}
              className={INPUT_CLS}
              placeholder="Apto, bloco (opcional)"
            />
          </InsiderField>
        </div>

        <div className="mt-4">
          <InsiderField id="bairro" label="Bairro">
            <input
              id="bairro"
              type="text"
              value={form.bairro}
              onChange={(e) => set('bairro', e.target.value)}
              className={INPUT_CLS}
              placeholder="Asa Norte"
            />
          </InsiderField>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_88px] gap-3">
          <InsiderField id="cidade" label="Cidade">
            <input
              id="cidade"
              type="text"
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
              className={INPUT_CLS}
              placeholder="Brasília"
            />
          </InsiderField>
          <InsiderField id="estado" label="UF">
            <input
              id="estado"
              type="text"
              value={form.estado}
              onChange={(e) => set('estado', maskUf(e.target.value))}
              className={INPUT_CLS}
              placeholder="DF"
            />
          </InsiderField>
        </div>
      </Reveal>

      <Reveal show={showTelefone}>
        <InsiderField id="telefone" label="WhatsApp">
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefone}
            onChange={(e) => set('telefone', maskPhone(e.target.value))}
            className={INPUT_CLS}
            placeholder="(61) 99999-9999"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showSexo}>
        <InsiderField id="sexo" label="Sexo">
          <select
            id="sexo"
            value={form.sexo}
            onChange={(e) => set('sexo', e.target.value)}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="">Selecione uma opção</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </InsiderField>
      </Reveal>

      <Reveal show={showFotoSenha}>
        <InsiderField id="foto" label="Foto do perfil">
          <div className="flex items-center gap-3">
            {(fotoPreview || fotoAtual) && (
              <Image
                src={fotoPreview || fotoAtual}
                alt="Prévia da foto de perfil"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            )}
            <input
              id="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFoto(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-[#737373] file:mr-3 file:rounded-full file:border-0 file:bg-[#0A0A0A] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </div>
        </InsiderField>

        <div className="mt-4">
          <InsiderField id="senha" label={temSenha ? 'Nova senha' : 'Senha de acesso'}>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => set('senha', e.target.value)}
              className={INPUT_CLS}
              placeholder="Mínimo de 8 caracteres"
            />
          </InsiderField>
          {temSenha && (
            <p className="mt-1.5 text-sm text-[#737373]">
              Deixe em branco para manter a senha atual.
            </p>
          )}
        </div>

        <div className="mt-4">
          <InsiderField id="senha_confirmacao" label="Confirme a senha">
            <input
              id="senha_confirmacao"
              type="password"
              autoComplete="new-password"
              value={form.senha_confirmacao}
              onChange={(e) => set('senha_confirmacao', e.target.value)}
              className={INPUT_CLS}
              placeholder="Repita a senha"
            />
          </InsiderField>
        </div>
      </Reveal>

      <Reveal show={showFinal}>
        <div className="space-y-2.5">
          <label htmlFor="consent_lgpd" className="flex items-center gap-2.5 text-sm text-[#737373]">
            <input
              id="consent_lgpd"
              type="checkbox"
              checked={consentLgpd}
              onChange={(e) => setConsentLgpd(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#FF2C03]"
            />
            <span>
              Li e aceito a{' '}
              <a
                href="https://sommaclub.com.br/politica-de-privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#FF2C03] underline"
              >
                Política de Privacidade
              </a>{' '}
              (LGPD).
            </span>
          </label>

          <label
            htmlFor="consent_imagem"
            className="flex items-center gap-2.5 text-sm text-[#737373]"
          >
            <input
              id="consent_imagem"
              type="checkbox"
              checked={consentImagem}
              onChange={(e) => setConsentImagem(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#FF2C03]"
            />
            <span>Autorizo o uso da minha imagem.</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
        >
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {lookupStatus === 'found' ? 'Salvar alterações' : 'Concluir cadastro'}
          {!enviando && <ArrowRight className="h-4 w-4" />}
        </button>
      </Reveal>

      {erro && <p className="mt-4 text-sm font-medium text-[#EF4444]">{erro}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Checar tipos, lint e testes**

`next.config.mjs` tem `typescript.ignoreBuildErrors: true` e `eslint.ignoreDuringBuilds: true` — o `npm run build` **não** acusa erro de tipo. Verificar explicitamente:

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sem erro de tipo nos arquivos novos, sem erro de lint, todos os testes passam.

(Sobre imagens: `next.config.mjs` já tem `images.unoptimized: true`, então o `<Image>` carrega a foto do Supabase sem configurar `remotePatterns`.)

- [ ] **Step 3: Testar o fluxo de cadastro novo no navegador**

Com `npm run dev`, abrir `http://localhost:3000/insider` em janela anônima e:
1. Digitar um CPF válido ausente da base → aparece "CPF não encontrado — vamos fazer o seu cadastro."
2. Preencher nome, e-mail, nascimento e CEP real → os campos de endereço aparecem **já preenchidos** com rua/bairro/cidade/UF.
3. Completar número, WhatsApp, sexo, senha (8+ caracteres) e confirmação → consentimentos e botão aparecem.
4. Marcar os dois consentimentos e enviar.

Expected: card troca para "Cadastro concluído!". Conferir no SQL Editor:
```sql
SELECT nome, email, telefone, cidade, estado, foto_url, consent_lgpd
FROM dados_insiders WHERE cpf LIKE '%<seus 3 primeiros dígitos>%';
```

- [ ] **Step 4: Testar o fluxo de atualização**

Recarregar `/insider`, digitar o mesmo CPF.
Expected: mensagem "Encontramos seu cadastro, {Nome}!", todos os campos preenchidos de uma vez, campo de senha com o aviso "Deixe em branco para manter a senha atual", e o botão dizendo "Salvar alterações". Mudar a cidade, enviar → "Cadastro atualizado!". Conferir no banco que continua **uma única linha** para aquele CPF e que a cidade mudou.

- [ ] **Step 5: Testar upload de foto e reset por edição do CPF**

1. Repetir o fluxo escolhendo uma imagem JPG < 5MB → a prévia circular aparece; após enviar, `foto_url` no banco aponta para o bucket `insider-fotos` e a URL abre no navegador.
2. Com o formulário preenchido, apagar um dígito do CPF → todos os demais campos são limpos.

- [ ] **Step 6: Verificar responsividade**

Abrir o DevTools em 375px de largura.
Expected: uma coluna só (texto acima, card abaixo); nenhum scroll horizontal; os pares Nascimento/CEP e Número/Complemento continuam lado a lado; os inputs não provocam zoom no iOS (`app/globals.css` já força 16px).

- [ ] **Step 7: Limpar os registros de teste**

```sql
DELETE FROM dados_insiders WHERE email = '<e-mail usado nos testes>';
```

- [ ] **Step 8: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erro; `/insider` aparece na listagem de rotas.

- [ ] **Step 9: Commit**

```bash
git add components/insider/insider-cadastro-form.tsx
git commit -m "feat(insider): formulário de cadastro com busca por CPF e autofill de endereço"
```

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| Colunas novas em `dados_insiders` | 1 |
| Tabela `insider_credentials` + RLS | 1 |
| Bucket `insider-fotos` | 1 |
| Sem UNIQUE em `cpf` (dedup pela API) | 1 (índice simples) + 6 |
| Máscaras e validações portadas do site | 2 |
| `POST /api/insiders/lookup` | 5 |
| `POST /api/insiders/register` (upsert, foto, senha) | 6 |
| Rotas públicas no middleware + `/insider` pública | 4 |
| Layout Geist + fundo escuro, sem chrome | 7 |
| Card branco com o visual do site | 7 + 8 |
| Fluxo CPF → encontrado/novo | 8 |
| Revelação progressiva | 8 |
| Autofill de CEP (BrasilAPI) | 7 (hook) + 8 (uso) |
| Foto com preview | 8 |
| Senha opcional quando já existe | 2 (`validateSenha`) + 6 + 8 |
| Consentimentos LGPD/imagem | 2 + 6 + 8 |
| Painel de sucesso no próprio card | 8 |
| Resiliência: lookup falho não duplica | 8 (catch → `new`) + 6 (refaz busca) |
| Testes unitários da validação | 2 + 3 |

Sem lacunas.

**Desvio consciente da spec:** a spec previa a coluna `senha_hash` em `dados_insiders`. O plano move a senha para `insider_credentials` porque aquela tabela é lida com a chave anon no browser (`app/pagamentos/insiders/page.tsx:54`). A spec foi atualizada para refletir isso antes deste plano ser escrito.
