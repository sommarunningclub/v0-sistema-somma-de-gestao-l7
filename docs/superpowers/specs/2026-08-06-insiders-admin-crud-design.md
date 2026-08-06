# Spec — CRUD completo de Insiders no admin (`?section=insiders`)

Data: 2026-08-06
Status: aprovada pelo usuário

## Contexto

Hoje o painel `admin.sommaclub.com.br/?section=insiders` (`app/insiders/page.tsx`) só permite **listar, criar e excluir** insiders. Não existe edição — nem rota `PATCH`/`PUT`, nem modal de edição. O admin só grava 6 campos de benefício (`evolve`, `dopahmina`, `tex_barbearia`, `big_box`, `cupom_loja_somma`, `assessoria_somma`).

Em paralelo, a página pública `/insider` (spec `2026-08-05-insider-cadastro-design.md`) permite que o próprio Insider se autocadastre/atualize via CPF, preenchendo ~15 campos pessoais (email, telefone, endereço, data de nascimento, sexo, foto, consentimentos LGPD). Esse fluxo público **nunca** toca nos campos de benefício.

A tabela `dados_insiders` já tem todas essas colunas (migration `sql/009-insider-cadastro.sql`), inclusive uma, `estamina_recovery`, que hoje **nenhum dos dois fluxos grava**. Não existe coluna de status/ativo.

## Objetivo

Permitir que o admin edite todos os dados de um insider existente (benefícios + dados pessoais) e cadastre um novo insider manualmente pelo painel, reaproveitando a tabela `dados_insiders` e seguindo o mesmo padrão de CRUD já usado no módulo Membros (`app/api/membros/[id]/route.ts`, `components/edit-member-modal.tsx`).

## Decisões aprovadas

1. **Escopo dos campos**: o formulário do admin cobre TODOS os campos de `dados_insiders` (benefícios + dados pessoais + endereço + `estamina_recovery`), exceto os explicitamente fora de escopo abaixo. Ao criar um insider novo, só `nome` e `cpf` são obrigatórios — o restante pode ficar em branco e ser completado depois pelo próprio insider via `/insider`.
2. **Consentimentos LGPD**: `consent_lgpd` e `consent_imagem` aparecem no modal como badge somente leitura ("Sim"/"Não"), nunca editáveis pelo admin — evita o admin "marcar consentimento" em nome do insider.
3. **Status/ativo**: não existe hoje. Cria-se a coluna `ativo boolean not null default true`. Desativar é um `PATCH` normal (`{ ativo: false }`), não uma rota separada. A listagem do admin oculta inativos por padrão, com filtro para mostrar. O hard delete (`DELETE`, já existente) continua disponível sem mudanças.
4. **Foto**: sem upload de arquivo nesta entrega. `foto_url` fica editável como campo de texto (URL), consistente com o padrão "todos os campos, mas simples" já adotado nas outras decisões.
5. **Layout**: modal com seções (Dados básicos, Endereço, Benefícios), seguindo o padrão visual já usado no admin (`components/edit-member-modal.tsx` e o modal de criar insider atual) — não uma página dedicada.
6. **Permissão**: sem mudança. Todas as rotas de `/api/insiders/**` continuam sob `requirePermission(request, 'pagamentos')` (chave de permissão do módulo Insiders é `pagamentos`, não `insiders` — já é assim hoje).

## Banco de dados

Nova migration `sql/0XX-insiders-admin-crud.sql` (aditiva):

```sql
ALTER TABLE dados_insiders
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
```

Sem outras mudanças de schema — todas as demais colunas usadas pelo formulário já existem (`sql/009-insider-cadastro.sql`).

## API

### `app/api/insiders/[id]/route.ts` — adicionar `GET` e `PATCH`

Segue exatamente o padrão de `app/api/membros/[id]/route.ts` (`GET`/`PATCH`/`DELETE` — o `DELETE` já existe neste arquivo e não muda):

- **`GET`**: `requirePermission(request, 'pagamentos')` → busca por `id` (uuid, sem `parseId` — diferente de membros, que usa id numérico) → `select('*').eq('id', id).maybeSingle()` → `404` se não encontrado → `{ data }`.
- **`PATCH`**: `requirePermission(request, 'pagamentos')` → `pickInsiderFields(await request.json())` → `400` se objeto vazio → `.update(fields).eq('id', id).select('*')` → `404` se `data.length === 0` (nenhuma linha afetada) → `{ data: data[0] }`.

### `app/api/insiders/route.ts` (`POST`) — sem mudança estrutural

Continua igual; passa a aceitar os campos novos porque `INSIDER_COLUMNS` foi expandida (abaixo). Validação de obrigatoriedade (`nome`/`cpf`) não muda.

### `lib/api/writable-fields.ts` — expandir `INSIDER_COLUMNS`

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

Ficam de fora — nunca graváveis via esta rota, mesmo se o corpo da requisição enviar: `id`, `criado_em`, `atualizado_em` (gerenciados pelo banco/API), `consent_lgpd`, `consent_imagem` (decisão 2 acima). A tabela `insider_credentials` (senha) não é tocada por nenhuma rota deste CRUD.

### Validação de `data_nascimento`

`lib/insider/insider-mapper.ts:buildInsiderRow` hoje lança erro se `data_nascimento` não bater com `DD/MM/AAAA` — correto para o form público, onde o campo é obrigatório. No admin o campo é opcional, então o handler `PATCH`/`POST` de insiders precisa de uma conversão que aceite `""`/`undefined` sem lançar erro (grava `null`), validando o formato **apenas quando o valor não estiver vazio**. Reaproveitar `brDateToISO` de `lib/insider/validation.ts`, mas sem passar pelo `buildInsiderRow` (que é específico do fluxo público e exige todos os campos).

CPF continua sem constraint `UNIQUE` no banco (decisão já tomada na spec de cadastro público) — o admin não adiciona checagem de duplicidade nesta entrega.

## Frontend

### `app/insiders/page.tsx`

- `interface Insider` passa a declarar todas as colunas (hoje só declara os campos de benefício, embora `GET /api/insiders` já use `select('*')` e a coluna extra simplesmente fique sem tipo).
- O modal "Ver" (somente leitura, linhas 339-409 hoje) é substituído por um modal único de criar/editar (reaproveita o modal de criar atual, linhas 412-544), com 3 seções:
  - **Dados básicos**: nome, cpf, email, telefone, data_nascimento, sexo, foto_url (texto).
  - **Endereço**: cep, logradouro, numero, complemento, bairro, cidade, estado.
  - **Benefícios**: evolve, dopahmina, tex_barbearia, big_box, cupom_loja_somma, assessoria_somma, estamina_recovery.
- Badges somente leitura para `consent_lgpd`/`consent_imagem` dentro da seção Dados básicos.
- Switch "Ativo" no modal. Card da listagem mostra badge "Inativo" quando `ativo === false`. Filtro de busca ganha opção "Mostrar inativos" (oculto por padrão — a query padrão de listagem passa a filtrar `ativo=true` client-side ou via querystring, a decidir na fase de implementação).
- `handleDelete` (hard delete) continua existindo, acessível a partir do modal de edição.

### `lib/services/insiders.ts` (novo)

Espelha `lib/services/members.ts`: `getInsiders`, `getInsiderById`, `createInsider`, `updateInsider`, `deleteInsider`, usando `apiFetch`/`readJson` como o resto do app. Substitui as chamadas `fetch` inline que hoje vivem dentro de `app/insiders/page.tsx`.

## Testes

- Testes de API (jest, mesmo padrão de `lib/insider/__tests__/insider-mapper.test.ts` e `lib/auth/__tests__/insider-public-routes.test.ts`) cobrindo `GET`/`PATCH /api/insiders/[id]`: sucesso, `404` (id inexistente), `400` (corpo vazio no PATCH), e a whitelist de campos (confirma que `consent_lgpd`/`consent_imagem`/`id` enviados no corpo são ignorados).
- Verificação manual no admin: criar insider só com nome+cpf, editar cada seção do modal, desativar/reativar, conferir que a listagem oculta inativos por padrão e que o hard delete continua funcionando.

## Fora de escopo

- Reset de senha / tabela `insider_credentials` — continua exclusivo do fluxo público `/insider`.
- Upload de arquivo de foto — `foto_url` só como campo de texto/URL nesta entrega.
- Edição de `consent_lgpd`/`consent_imagem` pelo admin.
- Checagem de CPF duplicado no cadastro pelo admin.
- Paginação real de `GET /api/insiders` (hoje `.limit(100)`) — dívida técnica pré-existente, não resolvida nesta entrega.
