# Spec — Página pública `/insider` (cadastro e atualização de Insiders)

Data: 2026-08-05
Status: aprovada pelo usuário (abordagem B — lookup automático por CPF)

## Objetivo

Criar a página `admin.sommaclub.com.br/insider`, pública (sem login), onde o Insider digita o próprio CPF:

- **CPF encontrado** na tabela `dados_insiders` → o formulário preenche com os dados existentes e permite ajustar tudo.
- **CPF não encontrado** → fluxo de cadastro novo, com revelação progressiva de campos.

O visual replica fielmente o formulário de cadastro da home do projeto `NOVO-SITE-SOMMA-V3` (card branco sobre fundo `#0A0A0A`, botão pílula laranja, fonte Geist).

## Decisões aprovadas

1. **Acesso**: página pública self-service. Risco aceito: quem digitar um CPF válido de terceiro vê os dados cadastrados dele (verificação extra pode ser adicionada depois sem retrabalho).
2. **Benefícios**: os campos `evolve`, `dopahmina`, `tex_barbearia`, `cupom_loja_somma`, `big_box`, `assessoria_somma`, `estamina_recovery` **não aparecem** nesta página e não são alterados por ela.
3. **Endereço**: estruturado em colunas separadas, com autofill por CEP via BrasilAPI v2 (mesmo padrão de `NOVO-SITE-SOMMA-V3/components/checkout-form.tsx:163-190`).
4. **Consentimentos**: checkboxes de LGPD e uso de imagem incluídos (coletamos foto e endereço).

## Banco de dados

Migration `sql/009-insider-cadastro.sql` (aditiva, `ADD COLUMN IF NOT EXISTS`, não toca nas colunas existentes):

| coluna | tipo | observação |
|---|---|---|
| `email` | text | |
| `telefone` | text | WhatsApp, armazenado com máscara `(XX) XXXXX-XXXX` |
| `data_nascimento` | date | |
| `sexo` | text | `masculino` \| `feminino` |
| `cep` | text | `00000-000` |
| `logradouro` | text | |
| `numero` | text | |
| `complemento` | text | opcional |
| `bairro` | text | |
| `cidade` | text | |
| `estado` | text | UF, 2 letras |
| `foto_url` | text | URL pública no Storage |
| `senha_hash` | text | bcrypt (nunca exposto em API) |
| `consent_lgpd` | boolean | |
| `consent_imagem` | boolean | |
| `criado_em` | timestamptz | `DEFAULT now()` |
| `atualizado_em` | timestamptz | setado pela API a cada gravação |

A mesma migration cria o bucket de Storage **`insider-fotos`** (leitura pública, escrita apenas `service_role`), seguindo o padrão de `sql/006-create-popups.sql`.

**Sem constraint UNIQUE em `cpf`**: a base legada tem formatos mistos (com e sem máscara) e possivelmente duplicatas; a deduplicação é feita pela API (busca por ambos os formatos, UPDATE por `id`).

Execução: SQL Editor do Supabase (ou `psql` com as credenciais `POSTGRES_*` do `.env.local`).

## APIs (server-side, service role via `getAdminClient()` de `@/lib/auth/api-auth`)

### `POST /api/insiders/lookup`

- Body JSON: `{ cpf: string }`.
- Valida CPF pelo algoritmo dos dígitos verificadores → `400` se inválido.
- Busca em `dados_insiders` casando `cpf` com **e** sem máscara (`.in("cpf", [digits, formatted])`).
- Resposta: `{ found: false }` ou `{ found: true, insider: { id, nome, email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado, foto_url, tem_senha: boolean } }`.
- **Nunca** retorna `senha_hash` nem campos de benefícios.

### `POST /api/insiders/register`

- `multipart/form-data`: campos do formulário + arquivo `foto` opcional.
- Revalida tudo com zod no servidor (mesmo schema do client, módulo compartilhado).
- **Senha**: obrigatória quando o registro é novo ou não tem `senha_hash`; opcional caso contrário (em branco = mantém a atual). Mínimo 8 caracteres. Hash com bcrypt (`hashPassword` de `@/lib/auth/password`, salt 12).
- **Foto**: jpeg/png/webp, máx. 5MB, path `${cpfDigits}/${timestamp}.${ext}` no bucket `insider-fotos`; grava a URL pública em `foto_url`.
- **Upsert manual**: busca por CPF (ambos formatos); se existe → `UPDATE` por `id` (preserva o formato do CPF já gravado — a página de intelligence deriva `asaas_customer_id` dele); se não existe → `INSERT` com CPF formatado `000.000.000-00`.
- Seta `atualizado_em`. Resposta `{ success: true }` ou `{ error }` com status adequado.

### Middleware

- `lib/auth/route-permissions.ts`: adicionar `POST /api/insiders/lookup` e `POST /api/insiders/register` às rotas públicas (necessário — o pattern existente `/^\/api\/insider/` casaria e exigiria permissão `pagamentos`).
- `lib/auth/page-routes.ts`: adicionar `/insider` em `isPublicPage`.

## Front-end

### Arquivos novos

- `app/insider/layout.tsx` — carrega a fonte **Geist** (`next/font/google`, variável `--font-geist-sans`) escopada na rota; sem sidebar/chrome; metadata própria.
- `app/insider/page.tsx` — seção no layout do site novo: fundo `#0A0A0A` em tela cheia, grid 2 colunas em `md+` (texto à esquerda: eyebrow laranja "Cadastro Insider", H2, parágrafo; card à direita), 1 coluna no mobile.
- `components/insider-cadastro-form.tsx` — o formulário (card `mx-auto max-w-md rounded-3xl bg-white p-7 shadow-lg md:p-8`).
- `lib/insider/validation.ts` — máscaras (`maskCpf`, `maskDate`, `maskCep`, `maskPhone`), validadores (`isValidCpf`, `isValidBirthDate`, `brDateToISO`) e schema zod — portados de `NOVO-SITE-SOMMA-V3/lib/validation.ts`, adaptados ao **zod 3** (o site usa zod 4).

### Visual (fiel ao site novo)

- Inputs: `w-full rounded-xl border border-black/10 px-4 py-3 text-ink outline-none transition-colors focus:border-primary`.
- Labels: `mb-1.5 block text-sm font-medium text-ink`.
- Botão: pílula `rounded-full bg-primary` (`#FF2C03`, hover `#FB4C00`), full-width, "Concluir cadastro" (novo) / "Salvar alterações" (existente), com `Loader2` girando no loading.
- Erro: texto 14px `#EF4444`. Checkboxes 20×20 `accent-primary`.
- Cores via **classes arbitrárias** nos componentes novos (`bg-[#FF2C03]`, `hover:bg-[#FB4C00]`, `text-[#0A0A0A]`, `text-[#737373]`, `bg-[#0A0A0A]`): o `tailwind.config.ts` do admin já define `primary` como token shadcn usado pela UI inteira — **não sobrescrever o config**.
- Revelação progressiva com framer-motion (`height 0 → auto`, 0.3s easeOut) — **instalar `framer-motion`** (não existe no admin).

### Comportamento

1. Campo inicial: **CPF** (máscara, `inputMode=numeric`, autoFocus).
2. Ao completar 11 dígitos com verificadores válidos → chama `/api/insiders/lookup` automaticamente (spinner discreto no campo).
   - Encontrado → nota "Encontramos seu cadastro, {primeiro nome}! Confira e atualize os dados." e todos os campos aparecem preenchidos. Campos de senha com hint "Deixe em branco para manter a senha atual" quando `tem_senha`.
   - Não encontrado → nota "CPF não encontrado — vamos fazer seu cadastro." e revelação progressiva: Nome → E-mail → Nascimento + CEP (lado a lado, `grid-cols-2 gap-3`) → endereço (autofill + Número/Complemento) → WhatsApp → Sexo → Foto → Senha + confirmação → consentimentos → botão.
3. Editar o CPF depois do lookup reseta o estado e dispara nova busca ao completar 11 dígitos.
4. CEP com 8 dígitos → BrasilAPI v2 preenche logradouro/bairro/cidade/UF (editáveis); falha da API → nota "CEP não encontrado — preencha o endereço manualmente".
5. Foto: input file com preview circular; opcional.
6. Sucesso → painel de confirmação no próprio card (ícone + "Cadastro atualizado com sucesso!"), sem página `/obrigado`.

### Resiliência

Se o lookup falhar (rede), o usuário pode preencher normalmente: o `register` refaz a busca por CPF no servidor, então nunca duplica registro.

## Testes

- Unitários (jest, padrão do projeto) para `lib/insider/validation.ts`: máscaras, `isValidCpf`, regras do schema (senha obrigatória/opcional, consentimentos, CEP).
- Verificação manual do fluxo completo em dev (lookup encontrado / não encontrado / autofill CEP / upload de foto).

## Fora de escopo

- Login do insider usando a senha criada (portal futuro).
- Edição de benefícios/cupons nesta página.
- Verificação adicional de identidade no lookup.
- Rate limiting nas rotas públicas.
