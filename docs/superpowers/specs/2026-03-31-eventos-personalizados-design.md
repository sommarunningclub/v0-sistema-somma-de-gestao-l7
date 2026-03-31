# Eventos Personalizados — Design Spec

**Data:** 2026-03-31
**Status:** Aprovado

## Objetivo

Permitir criar eventos personalizados (além dos de corrida) que aparecem no check-in público, exibem descrição, têm link clicável do endereço, e coletam inscrições com dados básicos (sem pelotão). O objetivo é quantificar participantes de eventos genéricos do Somma Running Club.

## Requisitos

1. Dois tipos de evento: `corrida` (comportamento atual) e `personalizado` (sem pelotões)
2. Descrição do evento visível no card do check-in público
3. Campo separado para link do endereço (Google Maps etc.), clicável no check-in
4. Check-in de evento personalizado pula o step de pelotão (2 steps em vez de 3)
5. Página de sucesso usa dados reais do evento (não hardcoded)
6. Admin adapta formulário e visualização conforme tipo do evento

## Mudanças

### 1. Schema (banco de dados)

Adicionar à tabela `eventos`:

```sql
ALTER TABLE eventos ADD COLUMN tipo TEXT DEFAULT 'corrida' CHECK (tipo IN ('corrida', 'personalizado'));
ALTER TABLE eventos ADD COLUMN local_url TEXT;
```

- `tipo`: default `'corrida'` — eventos existentes não são afetados
- `local_url`: link opcional do endereço (ex: URL do Google Maps)
- `descricao`: já existe, sem alteração

### 2. Tipos TypeScript

Atualizar `lib/types/evento.ts`:

```typescript
export interface Evento {
  // ... campos existentes ...
  tipo: 'corrida' | 'personalizado'
  local_url: string | null
}
```

Mesma alteração em `EventoCreate` e `EventoUpdate`.

### 3. Admin — Formulário de criação/edição

**Arquivo:** `app/eventos/page.tsx`

- Novo campo no topo: **Tipo de Evento** — select com opções "Corrida" e "Personalizado"
- Campo `local` existente permanece (nome do local)
- Novo campo **Link do endereço** — input text para URL, aparece para ambos os tipos
- Quando `tipo = 'personalizado'`:
  - Campo de pelotões é escondido (não se aplica)
- Quando `tipo = 'corrida'`:
  - Tudo funciona como hoje
- Duplicação de evento copia o `tipo` e `local_url` do original

### 4. API — Sistema de gestão

**Arquivos:** `app/api/insider/eventos/route.ts`, `app/api/insider/eventos/[id]/route.ts`

- `POST`: aceita `tipo` (default 'corrida') e `local_url`
- `PUT`: aceita `tipo` e `local_url` como campos atualizáveis
- Validação: `tipo` deve ser 'corrida' ou 'personalizado'

### 5. API — Check-in público

**Arquivo:** `app/api/eventos/ativos/route.ts`

- Incluir `tipo`, `descricao`, `local_url` nos campos retornados (select)
- Sem mudança na lógica de filtro (próximo evento / histórico)

### 6. Check-in público — Card do evento

**Arquivo (site público):** `app/check-in/page.tsx`

- Exibir `descricao` abaixo do título (se existir), em texto menor/zinc-400
- Campo `local`: se `local_url` existir, renderizar como `<a>` que abre em nova aba; caso contrário, texto puro como hoje
- Tipo do evento no objeto Evento para controlar fluxo

### 7. Check-in público — Fluxo por tipo

**Arquivo (site público):** `app/check-in/page.tsx`

**Corrida (sem mudanças — 3 steps):**
1. Selecionar evento
2. Selecionar pelotão
3. Dados pessoais → Submit

**Personalizado (2 steps):**
1. Selecionar evento
2. Dados pessoais (nome, telefone, sexo, email, CPF) → Submit

- Step indicator mostra 2 steps em vez de 3
- Campo `pelotao` vai como `null` ou string vazia no payload
- API de checkin já aceita qualquer valor em `pelotao`; ajustar para aceitar null/vazio

### 8. Página de sucesso

**Arquivo (site público):** `app/check-in/sucesso/page.tsx`

Substituir dados hardcoded por dados reais do evento. Passar via query params:
- `titulo` — título do evento
- `data` — data formatada
- `horario` — horário real do evento
- `local` — nome do local
- `local_url` — link do endereço (se existir)
- `descricao` — descrição (se existir)

Renderizar:
- Título do evento
- Data e horário reais
- Local como link clicável (se tiver URL)
- Descrição (se existir)

### 9. Admin — Tela de check-ins

**Arquivo:** `app/checkin/page.tsx`

- Para eventos personalizados: coluna "Pelotão" mostra "—"
- Filtro de pelotão desabilitado quando evento selecionado é tipo 'personalizado'

## Escopo excluído

- Campos customizáveis por evento (além dos existentes) — futuro
- Múltiplos tipos além de corrida/personalizado — futuro
- Alteração visual de branding por evento — futuro

## Projetos afetados

1. **Sistema de gestão** (`v0-sistema-somma-de-gestao-l7`): schema, tipos, API, admin UI
2. **Site público** (`sommarunningclub-novo-site-somma-club-2026`): check-in flow, sucesso page
