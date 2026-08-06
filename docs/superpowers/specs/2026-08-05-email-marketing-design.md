# Módulo E-mail Marketing — Design Specification

**Data:** 2026-08-05
**Status:** Aprovado
**Escopo V1:** Disparo pontual + agendamento (sem réguas automáticas)

---

## Visão geral

Módulo no painel de gestão que permite montar uma campanha de e-mail, escolher a
audiência a partir de qualquer base do Supabase, escolher um template, preencher o
conteúdo e o CTA, disparar (na hora ou agendado) e acompanhar o status completo do
disparo — entregues, aberturas, cliques, bounces e descadastros.

O envio é feito pela Resend, no domínio `sommaclub.com.br`, já verificado.

### Por que isso é barato de construir

Os dois projetos (`v0-sistema-somma-de-gestao-l7` e `1-ano-SommaDay`) apontam para o
**mesmo projeto Supabase** (`riqfjewvygqsbuokvsjw`). Não há integração entre sistemas
nem sincronização de bases a fazer: as audiências já estão no banco que o painel usa.

O `1-ano-SommaDay` já tem um motor de disparo maduro (envio em lote, throttle, dedup,
webhook de tracking com verificação Svix, descadastro one-click). O V1 porta esse motor
corrigindo seus defeitos conhecidos e adiciona a camada que ele não tem: **escolha de
público, template e CTA pela interface**.

---

## Estado verificado do ambiente (2026-08-05)

| Item | Situação |
|---|---|
| Chave Resend (`1-ano-SommaDay`) | Válida |
| Domínio `sommaclub.com.br` | **Verificado**, região `sa-east-1`, envio habilitado |
| Remetente em uso | `Somma Special Day <contato@sommaclub.com.br>` |
| Webhook Resend do SommaDay | **Ativo e recebendo eventos** (último evento em 2026-08-06 UTC) |
| Histórico `email_events` | ~466 mil eventos |
| Plano Vercel | Pro (projeto sob team `Somma Running Club's projects`) → cron sem restrição de frequência |
| Infra de e-mail no painel | **Inexistente** — nenhuma dependência `resend`/`react-email` instalada |

### Bases de audiência disponíveis

| Base | Tabela | Registros | Coluna de e-mail | Observação |
|---|---|---|---|---|
| Check-ins de eventos | `checkins` | 7.484 | `email` | E-mails repetidos entre eventos — dedup obrigatória |
| Membros do clube | `cadastro_site` | 6.293 | `email` | Maior base nominal |
| Lista VIP SommaDay | `lista_vip` | 599 | `email` | Já possui histórico de tracking |
| Lista de espera assessoria | `lista_vip_assessoria` | 161 | `email` | Segmentável por cidade, sexo, status |

Alcance bruto somado: ~14,5 mil endereços. O alcance real é menor — há sobreposição
entre `checkins` e `cadastro_site`, e repetição interna em `checkins`.

**Não medido:** a contagem exata de e-mails únicos por base e a taxa histórica de
bounce/reclamação. A tentativa de medição foi bloqueada pelo classificador de permissões
do ambiente. Isso deve ser levantado na Fase 1, antes do primeiro disparo em base grande.

---

## Decisões de arquitetura

### 1. Isolamento total do SommaDay

O módulo cria tabelas próprias e **não reaproveita a `email_events` existente**.

Motivo: os dois sistemas dividem o mesmo banco. O webhook do SommaDay insere em
`email_events` incondicionalmente. Se o painel registrasse um segundo endpoint de webhook
na Resend gravando na mesma tabela, todo evento seria inserido duas vezes, corrompendo as
métricas dos dois sistemas. Com tabelas separadas, um sistema não enxerga nem afeta o outro.

### 2. Lista de supressão global

Tabela única de endereços bloqueados, aplicada **antes de qualquer disparo, em todas as
bases**. Quem descadastrou, sofreu bounce permanente ou marcou como spam nunca mais recebe,
independentemente de por qual audiência ele reapareça.

Isto é o principal mecanismo de proteção da reputação do domínio, e é justamente o que o
SommaDay não possui (lá o descadastro é por lista, guardado como array JSON).

### 3. Motor de disparo retomável

Porte do motor do SommaDay corrigindo quatro defeitos identificados:

| Defeito no SommaDay | Correção no V1 |
|---|---|
| Sem paginação na leitura de leads (teto de 1.000 do PostgREST) | Leitura paginada de 1.000 em 1.000 |
| Dedup por array JSON em `app_settings` (race condition, cresce sem limite) | Uma linha por destinatário com `UNIQUE (campaign_id, email)` |
| Sem retry em falha de lote | Retry com backoff exponencial; falhas permanecem pendentes e retomam |
| Webhook aceita qualquer requisição quando falta o secret (fail-open) | **Fail-closed**: sem secret válido, rejeita |

O padrão de gravação é *reserve-then-send*: reserva a linha do destinatário (a constraint
de unicidade garante exclusividade), envia, grava o `resend_email_id`. Se o envio falha, a
reserva é liberada. Um disparo interrompido — timeout, deploy, erro — **retoma exatamente
de onde parou, sem reenviar para ninguém**.

### 4. Execução em fatias

Um disparo para 7.484 destinatários são ~75 chamadas em lote de 100, com throttle de
600 ms ≈ 45 s. Cabe em `maxDuration = 300`, mas a união de várias bases não cabe com folga.

Solução: cada execução processa até um teto de destinatários e devolve o controle. A
campanha permanece em `enviando` e o cron retoma na execução seguinte. Não há risco de
timeout independentemente do tamanho da base.

### 5. Agendamento por cron

Cron a cada 5 minutos (`*/5 * * * *`) em `vercel.json`, protegido pelo `CRON_SECRET` no
mesmo padrão fail-closed já usado em `app/api/cron/eventos/route.ts`. A cada execução:

1. Promove campanhas `agendada` com `scheduled_at <= now()` para `enviando`.
2. Processa uma fatia de cada campanha em `enviando`.
3. Marca como `enviada` quando não restam pendentes.

Não usaremos o `scheduledAt` nativo da Resend: ele limita a 72 h e não permite cancelar ou
acompanhar o progresso pelo painel.

---

## Modelo de dados

Migração nova em `sql/009-create-email-marketing.sql`, seguindo o estilo de
`sql/006-create-popups.sql`. RLS habilitada com política exclusiva para `service_role`.

### `email_campaigns`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text NOT NULL | Nome interno, não aparece no e-mail |
| `status` | text NOT NULL | `rascunho` \| `agendada` \| `enviando` \| `enviada` \| `cancelada` \| `erro` |
| `template_key` | text NOT NULL | Identificador do layout |
| `subject` | text NOT NULL | |
| `preheader` | text | Texto de prévia da caixa de entrada |
| `content` | jsonb NOT NULL | Campos preenchidos do template |
| `cta_label` | text | Texto do botão |
| `cta_url` | text | Destino do botão |
| `audience` | jsonb NOT NULL | Ver formato abaixo |
| `scheduled_at` | timestamptz | Nulo quando é disparo imediato |
| `started_at` / `finished_at` | timestamptz | |
| `total_recipients` | integer DEFAULT 0 | Congelado no momento do disparo |
| `error` | text | |
| `created_by` | uuid | FK lógica para `users.id` |
| `created_at` / `updated_at` | timestamptz | |

### `email_campaign_recipients`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `campaign_id` | uuid NOT NULL | FK → `email_campaigns` ON DELETE CASCADE |
| `email` | text NOT NULL | Sempre em minúsculas |
| `nome` | text | |
| `source_base` | text | Base de origem, para atribuição |
| `resend_email_id` | text | Nulo enquanto reservado |
| `status` | text NOT NULL DEFAULT `'pendente'` | `pendente` \| `enviado` \| `entregue` \| `aberto` \| `clicado` \| `bounce` \| `spam` \| `falha` |
| `error` | text | |
| `sent_at` | timestamptz | |

Constraints e índices: `UNIQUE (campaign_id, email)` — a chave da dedup e da retomada;
índices em `(campaign_id, status)` e em `resend_email_id`.

#### Formato de `email_campaigns.audience`

Os filtros são **por base**, não globais — cada base tem seu próprio conjunto:

```jsonc
{
  "bases": [
    { "key": "checkins",     "filtros": { "evento_id": "uuid", "pelotao": "A", "sexo": "F" } },
    { "key": "lista_espera", "filtros": { "cidade": "Brasília" } },
    { "key": "membros",      "filtros": {} }
  ]
}
```

A união das bases é feita **após** aplicar os filtros de cada uma, e então deduplicada por
e-mail. Um endereço que aparece em duas bases selecionadas recebe uma única vez; a
`source_base` gravada é a da primeira base em que ele foi encontrado, seguindo a ordem do
array.

### `email_campaign_events`

Histórico bruto do webhook. Colunas: `id`, `campaign_id`, `recipient_id`, `email`,
`resend_email_id`, `type`, `link`, `created_at`. Índices em `campaign_id`, `resend_email_id`
e `type`.

> O índice em `resend_email_id` é o que falta na tabela equivalente do SommaDay e degrada
> as consultas de métrica lá. Aqui ele existe desde o início.

### `email_suppressions`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `email` | text NOT NULL **UNIQUE** | Minúsculas |
| `reason` | text NOT NULL | `unsubscribe` \| `bounce` \| `complaint` \| `manual` |
| `campaign_id` | uuid | Campanha que originou o bloqueio |
| `created_at` | timestamptz | |

### Permissão

Nova chave `email` em `ModulePermissions` (`lib/auth/types.ts`), mais migração
`sql/010-add-email-permission.sql` no molde exato de `sql/007-add-popups-permission.sql`:
backfill `false` para todos, `true` para `role = 'admin'`.

---

## Camada de audiência

`lib/services/email-audiences.ts` — um registro declarativo que descreve cada base:

```ts
interface AudienceSource {
  key: string            // 'membros' | 'checkins' | 'lista_vip' | 'lista_espera'
  label: string
  table: string
  emailCol: string
  nameCol: string
  filters: FilterDef[]   // filtros expostos na interface
}
```

Filtros do V1, por base:

| Base | Filtros |
|---|---|
| `checkins` | evento, pelotão, sexo |
| `cadastro_site` | nenhum (base inteira) |
| `lista_vip` | status do cupom |
| `lista_vip_assessoria` | cidade, sexo, status |

`resolveAudience(audience)` executa: consulta paginada de cada base selecionada → normaliza
e-mail para minúsculas → descarta inválidos → **deduplica por e-mail entre todas as bases**
→ remove os presentes em `email_suppressions` → devolve a lista final.

A mesma função alimenta a contagem ao vivo na interface e o disparo, garantindo que o
número exibido na revisão é exatamente o número que será enviado.

---

## Templates

3 layouts fixos em `lib/emails/templates/`, funções puras que recebem os campos e devolvem
`{ subject, html }`. HTML em tabelas com estilos inline, no padrão que já funciona no
SommaDay, adaptado à identidade do painel (preto, laranja `orange-500`).

| Template | Uso | Campos |
|---|---|---|
| `anuncio` | Comunicado com imagem de destaque | título, imagem, texto, CTA |
| `simples` | Texto corrido, sem imagem | título, texto, CTA |
| `evento` | Convite com data, hora e local | título, imagem, data, local, texto, CTA |

Todos incluem, obrigatoriamente:

- Rodapé com link de descadastro
- Cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` (one-click do Gmail)
- Preheader oculto
- `{{nome}}` interpolado com escape de HTML

O CTA é sempre **rótulo + URL**, ambos preenchidos pela interface — diferente do SommaDay,
onde a URL é constante no código.

---

## Descadastro

Rota pública `app/api/unsubscribe/route.ts` (`GET` renderiza confirmação, `POST` atende o
one-click), com token **HMAC assinado** contendo o e-mail e o `campaign_id`, gerado com o
mesmo utilitário de `lib/auth/session.ts`.

O SommaDay usa o ID do lead cru na URL, o que é enumerável — qualquer um pode descadastrar
terceiros iterando IDs. O token assinado elimina isso.

O descadastro insere em `email_suppressions` com `ON CONFLICT DO NOTHING`.

---

## Webhook de tracking

`app/api/webhooks/resend/route.ts` — endpoint **novo e independente** do SommaDay,
registrado como um segundo endpoint no dashboard da Resend.

- `/api/webhooks/` já é rota pública no middleware (`lib/auth/route-permissions.ts`).
- Verificação de assinatura Svix por HMAC-SHA256 com `timingSafeEqual`, **fail-closed**:
  sem `RESEND_WEBHOOK_SECRET`, retorna 401. Valida também a janela do `svix-timestamp`
  (5 minutos) contra replay.
- Filtra por pertinência: só processa eventos cujo `resend_email_id` existe em
  `email_campaign_recipients`. Eventos do SommaDay são ignorados silenciosamente com 200.
- Eventos tratados: `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`,
  `failed`, `delivery_delayed`.
- Progressão de status monotônica (um `delivered` atrasado não sobrescreve um `clicked`),
  no mesmo padrão `STATUS_RANK` do SommaDay.
- `bounced` e `complained` inserem automaticamente em `email_suppressions`.
- Sempre responde 200, para não provocar retentativa infinita da Resend.

---

## Interface

`app/email-marketing/page.tsx` — client component no molde exato de `app/popups/page.tsx`:
`apiFetch` para `/api/email-campaigns`, estado local, `<ErrorBanner>`, `<PageLoading>`,
busca client-side via `lib/search-utils.ts`, estética `bg-black` / `bg-neutral-900` /
accent `orange-500`.

### Lista de campanhas

Cards com nome, status, template, tamanho da audiência, data de disparo ou agendamento e,
para campanhas enviadas, as taxas de entrega e abertura.

### Modal de campanha — 4 passos

1. **Audiência** — seleção múltipla de bases, filtros por base, contagem única ao vivo já
   descontada a supressão.
2. **Conteúdo** — escolha do template, campos, rótulo e URL do CTA, com preview do HTML
   lado a lado.
3. **Revisão** — resumo, envio de teste para um endereço à escolha (assunto prefixado com
   `[TESTE]`).
4. **Disparo** — agora ou agendado (data e hora em horário de Brasília, convertidos para
   UTC na gravação).

### Tela de status

`app/email-marketing/[id]/page.tsx`, usando o `<AuthenticatedChrome>` como já faz
`app/popups/[id]/analytics`. Contém:

- Cards: total, enviados, entregues, abertos, clicados, bounces, descadastros — com
  percentual sobre entregues.
- Barra de progresso enquanto o status é `enviando`.
- Série temporal de aberturas e cliques (`recharts`, já instalado).
- Ranking de links clicados.
- Tabela de destinatários com status individual, busca e filtro por status.

### Navegação

Registro nos 5 pontos de `app/page.tsx`: import do ícone (`Mail`), import da página,
entrada no array do `<nav>` (linha ~164), entrada no grid do modal de APPs (linha ~260) e
render condicional (linha ~349), além da chave `email` no objeto `permissions` (linha ~46).
Também em `app/systems/page.tsx` (`DEFAULT_PERMISSIONS` e `MODULE_LABELS`).

---

## Rotas de API

Todas no padrão canônico do repositório: guard por early-return, log prefixado
`[email-campaigns]`, mensagens de erro em português.

| Rota | Método | Função |
|---|---|---|
| `/api/email-campaigns` | GET / POST | Listar / criar |
| `/api/email-campaigns/[id]` | GET / PATCH / DELETE | Detalhe / editar / excluir |
| `/api/email-campaigns/[id]/preview` | POST | HTML renderizado |
| `/api/email-campaigns/[id]/test` | POST | Envio de teste |
| `/api/email-campaigns/[id]/dispatch` | POST | Disparo imediato |
| `/api/email-campaigns/[id]/cancel` | POST | Cancelar agendada ou em andamento |
| `/api/email-campaigns/[id]/stats` | GET | Métricas |
| `/api/email-audiences/preview` | POST | Contagem ao vivo |
| `/api/cron/email-campaigns` | GET | Agendador |
| `/api/webhooks/resend` | POST | Tracking |
| `/api/unsubscribe` | GET / POST | Descadastro |

### Registro no controle de acesso

Em `lib/auth/route-permissions.ts`:

- `ROUTE_PERMISSIONS` recebe `{ pattern: /^\/api\/email-/, permission: 'email' }`, que
  cobre `/api/email-campaigns` e `/api/email-audiences`.
- `PUBLIC_API_ROUTES` recebe `{ pattern: /^\/api\/unsubscribe$/ }`. **Sem isso o
  descadastro retorna 401** — o destinatário não tem sessão no painel. As rotas
  `/api/webhooks/resend` e `/api/cron/email-campaigns` já estão cobertas pelos padrões
  genéricos existentes.

Em `lib/auth/page-routes.ts`, quatro registros para a tela de status
(`/email-marketing/[id]`), que roda fora da SPA:

- `SECTION_LABELS`: `email: 'E-mail Marketing'`
- `SECTION_PERMISSIONS`: `email: 'email'`
- `LEGACY_EXACT`: `'/email-marketing': '/?section=email'`
- `PAGE_PERMISSIONS`: `{ pattern: /^\/email-marketing/, permission: 'email' }`

Nas rotas de API, usar `requirePermission(req, 'email')` além do middleware (defesa em
profundidade), no padrão de `app/api/admin/users/route.ts`.

---

## Variáveis de ambiente

| Variável | Origem |
|---|---|
| `RESEND_API_KEY` | Copiada do `1-ano-SommaDay` |
| `EMAIL_FROM` | `Somma Club <contato@sommaclub.com.br>` |
| `RESEND_WEBHOOK_SECRET` | Gerada ao registrar o endpoint no dashboard da Resend |
| `CRON_SECRET` | **Ausente no `.env.local`** — existe só na Vercel; precisa ser adicionada localmente |
| `NEXT_PUBLIC_APP_URL` | Base para os links de descadastro |

Dependência nova: `resend`.

---

## Riscos

### Consentimento (LGPD) — o risco material

`cadastro_site` e `checkins` foram coletadas para matrícula e para participação em evento,
não para comunicação promocional. Disparar campanha de marketing para ~14 mil pessoas sem
opt-in explícito é exposição jurídica real, e o caminho mais curto para queimar a reputação
do domínio com denúncias de spam.

O descadastro em um clique resolve a exigência técnica, não a jurídica.

**Mitigação adotada no V1:** o módulo é construído com capacidade para todas as quatro
bases, mas a implantação é faseada — ver Fase 4. A decisão sobre coletar opt-in explícito
nas bases ficou **em aberto** e precisa ser resolvida antes da liberação das bases grandes.

### Reputação de entrega

`checkins` acumula endereços antigos, com bounce esperado acima da média. Bounce acima de
5% ou reclamação acima de 0,1% degradam a entregabilidade de todo o domínio — inclusive
dos e-mails transacionais do SommaDay, que compartilham o mesmo domínio.

**Mitigação:** supressão global automática por bounce e reclamação, e escalada gradual de
volume na Fase 4.

### Convivência com o SommaDay

Dois sistemas enviando pelo mesmo domínio e mesma chave. O isolamento por tabelas e a
filtragem por pertinência no webhook resolvem a colisão de dados; a reputação, porém, é
compartilhada e indivisível.

### Segredos no repositório

Existe um `gestao-somma.env.local.env.txt` versionado na raiz contendo `POSTGRES_PASSWORD`,
`POSTGRES_URL`, `CLICKSIGN_ACCESS_TOKEN` e `SHOPIFY_API_SECRET_KEY`. Fora do escopo deste
módulo, mas deve ser tratado — e reforça não adicionar a `RESEND_API_KEY` a nenhum arquivo
versionado.

---

## Fases de implementação

**Fase 1 — Fundação.** Migrações SQL, permissão `email`, dependência `resend`, camada de
audiência com dedup e supressão, e o levantamento pendente de e-mails únicos e taxa
histórica de bounce por base.

**Fase 2 — Motor e templates.** Os 3 templates, o motor de disparo retomável, envio de
teste, webhook e descadastro. Validado por disparo real para uma lista interna.

**Fase 3 — Interface.** Lista, modal de 4 passos, tela de status, navegação e permissões.

**Fase 4 — Implantação faseada.** Nesta ordem, medindo bounce e reclamação a cada etapa
antes de avançar:

1. Lista interna (equipe)
2. `lista_vip_assessoria` (161) — intenção declarada
3. `lista_vip` (599) — intenção declarada
4. `cadastro_site` (6.293) — só após decisão sobre consentimento
5. `checkins` (7.484) — só após decisão sobre consentimento

---

## Fora do escopo do V1

Réguas e sequências automáticas, testes A/B, editor de blocos ou HTML livre, importação de
CSV, Audiences/Broadcasts nativos da Resend, e segmentação por comportamento
(quem abriu, quem clicou).
