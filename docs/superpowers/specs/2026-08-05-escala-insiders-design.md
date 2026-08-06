# Spec — Módulo Escala (escalação de Insiders por evento)

Data: 2026-08-05
Status: design aprovado; migration já aplicada no Supabase

## Objetivo

Criar o módulo **Escala** no admin (`admin.sommaclub.com.br`), onde o coordenador monta a escala de
Insiders dos treinos do Somma: quem vai, quem corre em cada pelotão, quem vai só para apoiar
(montagem/desmontagem) e quem não vai. A visão principal é um calendário mensal, para bater o olho e
enxergar os buracos da escala do mês.

## Decisões aprovadas

1. **Âncora nos Eventos existentes** — cada escalação aponta para uma linha de `eventos`. Não há
   datas próprias: escala-se em cima do treino já cadastrado no módulo Eventos.
2. **Pelotões vêm do evento** — a escala lê `eventos.pelotoes` daquele dia (hoje o default é
   `['4km','6km','8km']`). Trocar para Iniciantes/Intermediários/Avançados é edição no módulo
   Eventos, não mudança de código.
3. **Duas dimensões independentes** — cada insider escalado tem (a) um `status` (corre / apoio /
   não vai) e (b) zero ou mais atividades do catálogo. Quem corre também pode carregar atividades.
4. **2 por pelotão é meta, não trava** — o sistema mostra `1/2`, `2/2` e sinaliza o que falta, mas
   aceita um terceiro insider no mesmo pelotão.
5. **Ausência é registro** — `nao_vai` é um registro explícito com motivo obrigatório. Quem não
   aparece na escala é "não definido", que é diferente de "recusou".
6. **Permissão própria `escala`** — nova chave em `ModulePermissions`, para liberar a escala a quem
   coordena insiders sem abrir o Check-in inteiro.
7. **Catálogo de atividades simples** — nome, descrição opcional, cor do badge e flag `ativo` (para
   aposentar uma atividade sem perder histórico).

## Banco de dados

A migration **já foi executada no Supabase** e criou `escala_atividades`, `escala_insiders` e
`escala_insider_atividades`. Estrutura verificada via schema REST:

### `escala_atividades` — catálogo de responsabilidades

| coluna | tipo | observação |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `nome` | text | NOT NULL |
| `descricao` | text | opcional |
| `cor` | text | NOT NULL, default `#F97316` — cor do badge |
| `ativo` | boolean | NOT NULL, default `true` |
| `created_at` / `updated_at` | timestamptz | `now()`, `updated_at` por trigger |

### `escala_insiders` — um insider escalado em um evento

| coluna | tipo | observação |
|---|---|---|
| `id` | uuid | PK |
| `evento_id` | uuid | NOT NULL → `eventos(id)` |
| `insider_id` | uuid | NOT NULL → `dados_insiders(id)` |
| `status` | text | NOT NULL, `corre` \| `apoio` \| `nao_vai` |
| `pelotao` | text | nulável na coluna; **obrigatório quando `status='corre'`** (CHECK) |
| `motivo` | text | nulável na coluna; **obrigatório quando `status='nao_vai'`** (CHECK) |
| `observacao` | text | livre, opcional |
| `created_at` / `updated_at` | timestamptz | `now()`, `updated_at` por trigger |

Constraints aplicadas: `UNIQUE (evento_id, insider_id)` — um insider aparece no máximo uma vez por
evento; os dois CHECKs condicionais acima; e um **trigger que valida `pelotao` contra
`eventos.pelotoes`** do evento referenciado, além de índices de consulta.

### `escala_insider_atividades` — N:N

PK composta `(escala_insider_id, atividade_id)`, com `created_at`. FK para `escala_insiders`
(cascade) e `escala_atividades`.

### Pendências de banco

- **Registrar a migration no repo** como `sql/010-create-escala.sql`, idempotente
  (`CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`), refletindo exatamente o DDL aplicado.
  O padrão do projeto é ter o arquivo versionado mesmo quando a execução foi manual.
- **RLS**: habilitar nas três tabelas com política de acesso apenas `service_role`, seguindo
  `eventos` (`sql/001-create-eventos-table.sql:54-62`). Todo o acesso do módulo passa pelas APIs
  server-side, então a chave anon não precisa enxergar nada.
- **Permissão**: migration para adicionar a chave `escala` ao JSONB de permissões dos usuários,
  liberando-a para quem já tem `checkin`, no molde de `sql/005-add-tarefas-permission.sql`.

## Regras de negócio

Concentradas em `lib/escala-rules.ts`, funções puras e testáveis:

- `META_POR_PELOTAO = 2` (constante, não constraint).
- Contagem de corredores por pelotão do evento → `{ pelotao, escalados, meta, estado }` com
  `estado ∈ completo | parcial | vazio` (`2/2`, `1/2`, `0/2`).
- Estado do dia: `completo` quando todos os pelotões batem a meta; `parcial` quando há pelo menos um
  escalado; `vazio` quando não há nenhum. Insiders em `apoio` contam à parte e não afetam a meta;
  `nao_vai` nunca conta.
- Validação de uma escalação antes de gravar: `corre` exige `pelotao` presente em
  `eventos.pelotoes`; `nao_vai` exige `motivo` e **não aceita atividades**; `apoio` aceita
  atividades e ignora `pelotao`.

A validação roda na API (mensagem de erro legível) e o banco a reforça com CHECK e trigger.

## APIs

Todas server-side, com `getAdminClient()` (service role) no padrão de `app/api/checkin/route.ts`, e
exigindo a permissão `escala` via `ROUTE_PERMISSIONS`.

| rota | função |
|---|---|
| `GET /api/escala?mes=YYYY-MM` | eventos do mês com o resumo de preenchimento — alimenta o calendário |
| `GET /api/escala/evento/[eventoId]` | escala completa do dia: insiders com status, pelotão, motivo e atividades |
| `POST /api/escala/evento/[eventoId]` | upsert de uma escalação: `{ insider_id, status, pelotao?, motivo?, observacao?, atividade_ids[] }` |
| `DELETE /api/escala/[id]` | remove a escalação (volta a "não definido") |
| `GET`/`POST /api/escala/atividades` | lista e cria atividades do catálogo |
| `PATCH`/`DELETE /api/escala/atividades/[id]` | edita e inativa/remove atividade |
| `GET /api/escala/insiders` | `{ id, nome }` dos insiders, para o seletor |

O `POST` grava `escala_insiders` e sincroniza `escala_insider_atividades` na mesma requisição
(apaga os vínculos que saíram, insere os que entraram).

`DELETE /api/escala/atividades/[id]` só remove de fato se a atividade não tiver vínculo; havendo
histórico, alterna `ativo = false` (a FK é `on delete restrict`).

### Camadas

- `lib/types/escala.ts` — tipos (`Atividade`, `EscalaInsider`, `EscalaDia`, `EscalaMes`).
- `lib/services/escala.ts` — queries Supabase, no padrão de `lib/services/tarefas.ts`.
- `lib/escala-rules.ts` — regras puras acima.
- `lib/escala-constants.ts` — `META_POR_PELOTAO`, cores default das atividades.

### Registro de rotas e permissão

- `lib/auth/types.ts` — `escala: boolean` em `ModulePermissions`.
- `lib/auth/route-permissions.ts` — `{ pattern: /^\/api\/escala/, permission: 'escala' }`.
- `lib/auth/page-routes.ts` — `SECTION_LABELS.escala = 'Escala'`,
  `SECTION_PERMISSIONS.escala = 'escala'`, `LEGACY_EXACT['/escala'] = '/?section=escala'` e
  `PAGE_PERMISSIONS` com `/^\/escala/`.
- `app/systems/page.tsx` — checkbox da permissão na tela de Administração.

## Front-end

O app é uma SPA: `app/page.tsx` guarda a sidebar e importa cada módulo de `app/<modulo>/page.tsx`.

### Arquivos novos

- `app/escala/page.tsx` — componente da seção; carrega o mês, orquestra calendário e painel do dia.
- `components/escala-calendario.tsx` — grade mensal com navegação `◀ ▶`. Só dias com evento ficam
  clicáveis; cada um mostra título curto, `escalados/meta` e destaque de pelotão vazio. Dia sem
  evento fica apagado, com atalho para criar em Eventos.
- `components/escala-dia-panel.tsx` — painel do dia: uma linha por pelotão de `eventos.pelotoes`
  com 2 slots (extras permitidos, marcados como acima da meta), bloco **Apoio** com os badges das
  atividades e bloco **Não vai** com o motivo.
- `components/escala-insider-picker.tsx` — busca de insider por nome, usando `matchesTextSearch`.
- `components/escala-atividades-manager.tsx` — CRUD do catálogo em modal, aberto pelo header.

### Registro na SPA

Em `app/page.tsx`: import de `EscalaPage`, item de nav
`{ id: "escala", icon: CalendarRange, label: "ESCALA", permissionKey: "escala" }` — posicionado logo
após EVENTOS — e o branch de render da seção.

### Visual

Segue o tema escuro dos demais módulos e reusa `ErrorBanner`, `PageLoading`, `apiFetch` e os
componentes shadcn existentes. Semáforo de preenchimento: `2/2` verde, `1/2` amarelo, `0/2`
vermelho — as mesmas famílias de cor usadas em `STATUS_CONFIG` de `app/eventos/page.tsx`.

## Testes

- Unitários (jest, padrão do projeto) para `lib/escala-rules.ts`: contagem por pelotão nos três
  estados, estado do dia, e cada ramo da validação (`corre` sem pelotão, `corre` com pelotão fora
  de `eventos.pelotoes`, `nao_vai` sem motivo, `nao_vai` com atividade, `apoio` válido).
- Verificação manual em dev: montar a escala de um sábado do zero, editar, remover, marcar ausência
  e conferir o resumo no calendário.

## Fora de escopo

- Página pública para o insider confirmar a própria presença.
- Notificações (WhatsApp/e-mail) de convocação.
- Escala recorrente ou auto-preenchimento a partir do mês anterior.
- Visão matriz insider × datas e relatório de frequência por insider.
- Vínculo entre a escala e o check-in realizado no dia (conferir quem escalou vs. quem apareceu).
