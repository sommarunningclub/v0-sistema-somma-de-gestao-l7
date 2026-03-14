# Evento Somma — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a full CRUD module for managing Somma Running Club events with automatic check-in open/close scheduling, integrated into the admin panel and consumed by the public check-in page.

**Architecture:** New `eventos` table in Supabase as the source of truth for events. CRUD API routes under `/api/eventos/` (public read) and `/api/insider/eventos/` (admin CRUD). Admin UI as a new page component `EventosSommaPage` loaded via sidebar navigation. Vercel cron job endpoint at `/api/cron/eventos` to auto-toggle check-in status. The existing `/api/checkin` route gets an optional `evento_id` FK. The public check-in site (separate deployment) will consume `/api/eventos/ativos`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel Cron

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `sql/001-create-eventos-table.sql` | Migration script for `eventos` table + `checkins` ALTER |
| `lib/types/evento.ts` | TypeScript interfaces for Evento |
| `app/api/eventos/ativos/route.ts` | Public API: active/upcoming events |
| `app/api/insider/eventos/route.ts` | Admin GET (list) + POST (create) |
| `app/api/insider/eventos/[id]/route.ts` | Admin PUT (update) + DELETE |
| `app/api/cron/eventos/route.ts` | Cron endpoint: auto open/close check-in |
| `app/eventos/page.tsx` | Admin page: event list + create/edit form |
| `vercel.json` | Cron job configuration |

### Modified Files

| File | Change |
|---|---|
| `app/page.tsx` | Add "Eventos" to sidebar nav + import EventosSommaPage |
| `app/api/checkin/route.ts` | Accept optional `evento_id` filter param |

---

## Chunk 1: Database & Types

### Task 1: SQL Migration Script

**Files:**
- Create: `sql/001-create-eventos-table.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Migration: Create `eventos` table + alter `checkins`
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create eventos table
CREATE TABLE IF NOT EXISTS eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento DATE NOT NULL,
  horario_inicio TIME DEFAULT '07:00',
  local TEXT DEFAULT 'Parque da Cidade — Brasília, DF',

  -- Check-in control
  checkin_abertura TIMESTAMPTZ,
  checkin_fechamento TIMESTAMPTZ,
  checkin_status TEXT DEFAULT 'bloqueado'
    CHECK (checkin_status IN ('aberto', 'bloqueado', 'encerrado')),

  -- Squad config
  pelotoes TEXT[] DEFAULT ARRAY['4km', '6km', '8km'],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  criado_por TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(checkin_status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON eventos;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON eventos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. Add evento_id FK to checkins (nullable for backwards compat)
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES eventos(id);
CREATE INDEX IF NOT EXISTS idx_checkins_evento ON checkins(evento_id);

-- 3. RLS policies
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- Public can read eventos
CREATE POLICY "Public read eventos" ON eventos
  FOR SELECT USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "Service role manages eventos" ON eventos
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Commit**

```bash
git add sql/001-create-eventos-table.sql
git commit -m "chore(db): add migration script for eventos table"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `lib/types/evento.ts`

- [ ] **Step 1: Create the Evento interface**

```typescript
export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_evento: string          // YYYY-MM-DD
  horario_inicio: string       // HH:mm
  local: string
  checkin_abertura: string | null   // ISO timestamp
  checkin_fechamento: string | null // ISO timestamp
  checkin_status: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes: string[]
  created_at: string
  updated_at: string
  criado_por: string | null
}

export interface EventoCreate {
  titulo: string
  descricao?: string
  data_evento: string
  horario_inicio?: string
  local?: string
  checkin_abertura?: string
  checkin_fechamento?: string
  checkin_status?: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes?: string[]
}

export interface EventoUpdate extends Partial<EventoCreate> {}

export interface EventoWithStats extends Evento {
  checkin_count: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/evento.ts
git commit -m "feat(types): add Evento interfaces"
```

---

## Chunk 2: API Routes

### Task 3: Public API — GET /api/eventos/ativos

**Files:**
- Create: `app/api/eventos/ativos/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabase = getAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // Next upcoming event or currently open event
    const { data: upcoming, error: upErr } = await supabase
      .from('eventos')
      .select('id, titulo, data_evento, horario_inicio, local, checkin_status, pelotoes, descricao')
      .or(`data_evento.gte.${today},checkin_status.eq.aberto`)
      .order('data_evento', { ascending: true })
      .limit(1)
      .single()

    if (upErr && upErr.code !== 'PGRST116') {
      console.error('[v0] Error fetching upcoming evento:', upErr)
    }

    // Recent history (past 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: historico, error: histErr } = await supabase
      .from('eventos')
      .select('id, titulo, data_evento, local, checkin_status')
      .lt('data_evento', today)
      .gte('data_evento', thirtyDaysAgo)
      .neq('id', upcoming?.id || '00000000-0000-0000-0000-000000000000')
      .order('data_evento', { ascending: false })
      .limit(10)

    if (histErr) {
      console.error('[v0] Error fetching historico:', histErr)
    }

    return NextResponse.json({
      proximo_evento: upcoming || null,
      historico: historico || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/eventos/ativos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eventos', proximo_evento: null, historico: [] },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/eventos/ativos/route.ts
git commit -m "feat(api): add GET /api/eventos/ativos — public events endpoint"
```

---

### Task 4: Admin CRUD — GET + POST /api/insider/eventos

**Files:**
- Create: `app/api/insider/eventos/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EventoCreate } from '@/lib/types/evento'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .order('data_evento', { ascending: false })

    if (error) throw new Error(error.message)

    // Get check-in counts per event
    const eventIds = (data || []).map(e => e.id)
    let countsMap: Record<string, number> = {}

    if (eventIds.length > 0) {
      const { data: counts } = await supabase
        .from('checkins')
        .select('evento_id')
        .in('evento_id', eventIds)

      if (counts) {
        for (const c of counts) {
          if (c.evento_id) {
            countsMap[c.evento_id] = (countsMap[c.evento_id] || 0) + 1
          }
        }
      }
    }

    const enriched = (data || []).map(e => ({
      ...e,
      checkin_count: countsMap[e.id] || 0,
    }))

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('[v0] Error GET /api/insider/eventos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eventos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const body: EventoCreate = await request.json()

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
    }
    if (!body.data_evento) {
      return NextResponse.json({ error: 'Data do evento é obrigatória' }, { status: 400 })
    }

    if (body.checkin_abertura && body.checkin_fechamento) {
      if (new Date(body.checkin_abertura) >= new Date(body.checkin_fechamento)) {
        return NextResponse.json(
          { error: 'Abertura do check-in deve ser anterior ao fechamento' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('eventos')
      .insert({
        titulo: body.titulo.trim(),
        descricao: body.descricao || null,
        data_evento: body.data_evento,
        horario_inicio: body.horario_inicio || '07:00',
        local: body.local || 'Parque da Cidade — Brasília, DF',
        checkin_abertura: body.checkin_abertura || null,
        checkin_fechamento: body.checkin_fechamento || null,
        checkin_status: body.checkin_status || 'bloqueado',
        pelotoes: body.pelotoes || ['4km', '6km', '8km'],
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error POST /api/insider/eventos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create evento' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/insider/eventos/route.ts
git commit -m "feat(api): add admin CRUD GET+POST /api/insider/eventos"
```

---

### Task 5: Admin CRUD — PUT + DELETE /api/insider/eventos/[id]

**Files:**
- Create: `app/api/insider/eventos/[id]/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EventoUpdate } from '@/lib/types/evento'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdminClient()
    const body: EventoUpdate = await request.json()

    if (body.checkin_abertura && body.checkin_fechamento) {
      if (new Date(body.checkin_abertura) >= new Date(body.checkin_fechamento)) {
        return NextResponse.json(
          { error: 'Abertura do check-in deve ser anterior ao fechamento' },
          { status: 400 }
        )
      }
    }

    // Build update object with only provided fields
    const updateObj: Record<string, unknown> = {}
    if (body.titulo !== undefined) updateObj.titulo = body.titulo.trim()
    if (body.descricao !== undefined) updateObj.descricao = body.descricao || null
    if (body.data_evento !== undefined) updateObj.data_evento = body.data_evento
    if (body.horario_inicio !== undefined) updateObj.horario_inicio = body.horario_inicio
    if (body.local !== undefined) updateObj.local = body.local
    if (body.checkin_abertura !== undefined) updateObj.checkin_abertura = body.checkin_abertura || null
    if (body.checkin_fechamento !== undefined) updateObj.checkin_fechamento = body.checkin_fechamento || null
    if (body.checkin_status !== undefined) updateObj.checkin_status = body.checkin_status
    if (body.pelotoes !== undefined) updateObj.pelotoes = body.pelotoes

    const { data, error } = await supabase
      .from('eventos')
      .update(updateObj)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[v0] Error PUT /api/insider/eventos/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update evento' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('eventos')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error DELETE /api/insider/eventos/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete evento' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/insider/eventos/[id]/route.ts
git commit -m "feat(api): add admin PUT+DELETE /api/insider/eventos/[id]"
```

---

### Task 6: Cron Endpoint — GET /api/cron/eventos

**Files:**
- Create: `app/api/cron/eventos/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create the cron route handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()
    const now = new Date().toISOString()

    // 1. Open: bloqueado → aberto (when checkin_abertura has passed)
    const { data: opened, error: openErr } = await supabase
      .from('eventos')
      .update({ checkin_status: 'aberto' })
      .eq('checkin_status', 'bloqueado')
      .not('checkin_abertura', 'is', null)
      .lte('checkin_abertura', now)
      .select('id, titulo')

    if (openErr) console.error('[v0] Cron open error:', openErr)

    // 2. Close: aberto → encerrado (when checkin_fechamento has passed)
    const { data: closed, error: closeErr } = await supabase
      .from('eventos')
      .update({ checkin_status: 'encerrado' })
      .eq('checkin_status', 'aberto')
      .not('checkin_fechamento', 'is', null)
      .lte('checkin_fechamento', now)
      .select('id, titulo')

    if (closeErr) console.error('[v0] Cron close error:', closeErr)

    console.log(`[v0] Cron executed: opened=${opened?.length || 0}, closed=${closed?.length || 0}`)

    return NextResponse.json({
      opened: opened || [],
      closed: closed || [],
      timestamp: now,
    })
  } catch (error) {
    console.error('[v0] Cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/eventos",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/eventos/route.ts vercel.json
git commit -m "feat(cron): add auto check-in open/close cron endpoint"
```

---

### Task 7: Modify existing checkin API to accept evento_id

**Files:**
- Modify: `app/api/checkin/route.ts`

- [ ] **Step 1: Add evento_id query param filter to GET**

In `app/api/checkin/route.ts`, after the existing `.gte('data_hora_checkin', ...)` line, add optional evento_id filtering:

```typescript
// After building the query, add:
const eventoId = request.nextUrl.searchParams.get('evento_id')

let query = supabase
  .from('checkins')
  .select('*')
  .gte('data_hora_checkin', '2026-03-11T03:00:00.000Z')
  .order('data_hora_checkin', { ascending: false })

if (eventoId) {
  query = query.eq('evento_id', eventoId)
}

const { data, error } = await query
```

- [ ] **Step 2: Commit**

```bash
git add app/api/checkin/route.ts
git commit -m "feat(api): add evento_id filter param to GET /api/checkin"
```

---

## Chunk 3: Admin UI — EventosSommaPage

### Task 8: Create the Eventos admin page

**Files:**
- Create: `app/eventos/page.tsx`

- [ ] **Step 1: Build the full admin page**

The page must include:
- Header with title "EVENTOS SOMMA" + "Novo Evento" button
- Stats cards: Total / Abertos / Bloqueados / Encerrados
- Table listing all events with columns: Título, Data, Status (badge), Horário check-in, Check-ins count, Ações
- Status badges: green for aberto, yellow/gray for bloqueado, dark gray for encerrado
- Quick toggle: button to switch between aberto ↔ bloqueado
- Duplicate button: copies event with date + 7 days and incremented edition number
- Delete with confirmation modal
- Create/Edit modal with fields: título, data_evento, horario_inicio, local, descrição, pelotões (chips), agendamento check-in (datetime-local abertura + fechamento), status manual
- Follow the exact same dark theme and patterns from `app/checkin/page.tsx` and `app/pagamentos/insiders/page.tsx`
- "use client" component
- Mobile responsive (similar patterns to checkin page)

Key UI patterns to follow (from existing codebase):
- `bg-neutral-950` page background
- `bg-neutral-900 border border-neutral-800 rounded-xl` for cards/containers
- `bg-orange-500 text-white` for primary buttons
- `text-xs font-semibold text-neutral-400 uppercase tracking-wider` for labels
- Badge colors: green-500/15 + green-400 text, yellow-500/15 + yellow-400 text
- Modal: `fixed inset-0 bg-black/70 backdrop-blur-sm z-50`
- Table: same structure as checkin page desktop table
- Icons from lucide-react: Calendar, Clock, MapPin, Users, Plus, Edit3, Trash2, Copy, Lock, Unlock, CheckCircle2

- [ ] **Step 2: Commit**

```bash
git add app/eventos/page.tsx
git commit -m "feat(ui): add Eventos admin page with full CRUD"
```

---

### Task 9: Add Eventos to sidebar navigation

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Import EventosSommaPage**

Add at top of file with other imports:
```typescript
import EventosSommaPage from "./eventos/page"
```

- [ ] **Step 2: Add nav item to sidebar**

In the navigation array (around line 139-147), add after the checkin entry:
```typescript
{ id: "eventos", icon: Calendar, label: "EVENTOS", permissionKey: "checkin" },
```

Also add `Calendar` to the lucide-react import at line 4.

- [ ] **Step 3: Add to mobile apps modal**

In the apps modal grid (around line 288-296), add:
```typescript
{ id: "eventos", icon: Calendar, label: "Eventos", permissionKey: "checkin" },
```

- [ ] **Step 4: Add to content area**

In the content rendering section (around line 382-390), add:
```typescript
{activeSection === "eventos" && permissions.checkin && <EventosSommaPage />}
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(nav): add Eventos module to sidebar and app grid"
```

---

## Chunk 4: Data Migration

### Task 10: Create data migration script

**Files:**
- Create: `sql/002-migrate-existing-checkins.sql`

- [ ] **Step 1: Write migration script**

```sql
-- ============================================================
-- Migration: Associate existing check-ins with events
-- Run AFTER creating events in the admin panel
-- ============================================================

-- Example: Create historical events and link check-ins
-- Adjust titles and dates to match actual events

-- 1. Create historical event records
INSERT INTO eventos (titulo, data_evento, checkin_status, horario_inicio)
VALUES
  ('Somma Club — Edição #01 de Março', '2026-03-07', 'encerrado', '07:00'),
  ('Somma Club — Edição #02 de Março', '2026-03-14', 'encerrado', '07:00')
ON CONFLICT DO NOTHING;

-- 2. Link check-ins by matching event date
UPDATE checkins c
SET evento_id = e.id
FROM eventos e
WHERE c.data_do_evento = e.data_evento
  AND c.evento_id IS NULL;
```

- [ ] **Step 2: Commit**

```bash
git add sql/002-migrate-existing-checkins.sql
git commit -m "chore(db): add migration script to link existing checkins to events"
```

---

## Execution Order

1. **Task 1** — SQL migration (run manually in Supabase SQL Editor)
2. **Task 2** — TypeScript types
3. **Tasks 3-6** — API routes (can be parallelized)
4. **Task 7** — Modify existing checkin API
5. **Task 8** — Admin UI page
6. **Task 9** — Sidebar integration
7. **Task 10** — Data migration (run manually after admin is working)

## Environment Variables Needed

- `CRON_SECRET` — add to Vercel env vars for cron auth (optional but recommended)

## Post-Implementation Checklist

- [ ] Run SQL migration in Supabase
- [ ] Verify APIs work locally: GET/POST/PUT/DELETE eventos
- [ ] Verify cron endpoint works: GET /api/cron/eventos
- [ ] Create first test event in admin panel
- [ ] Verify public API returns the event
- [ ] Run data migration to link old check-ins
- [ ] Add CRON_SECRET to Vercel environment variables
