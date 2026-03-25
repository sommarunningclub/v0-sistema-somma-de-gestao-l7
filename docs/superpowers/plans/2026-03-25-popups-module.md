# Popups Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a popup management module in the gestão system that lets admins create, schedule and track popup campaigns displayed on the Somma Running Club public site via a lightweight SDK.

**Architecture:** Admin UI + API routes in `v0-sistema-somma-de-gestao-l7`; data in the existing Supabase project; plain-JS SDK in `sommarunningclub-novo-site-somma-club-2026/public/` reads Supabase directly via anon key + RLS. Service layer uses service role key (same pattern as `lib/services/crm.ts`). No auth checks in API routes — protection is frontend-only via ProtectedRoute (same pattern as CRM routes).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (postgres + storage), Tailwind CSS, Recharts (already installed), lucide-react, vanilla JS (SDK)

**Repos touched:**
- Primary: `/Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7` (gestão)
- Secondary: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026` (site)

---

## File Map

### Create — gestão repo

| File | Responsibility |
|------|----------------|
| `sql/006-create-popups.sql` | Tables, indexes, RLS, storage bucket |
| `sql/007-add-popups-permission.sql` | Backfill `popups: false` into existing users |
| `lib/services/popups.ts` | Supabase CRUD using service role client |
| `app/api/popups/route.ts` | GET list + POST create |
| `app/api/popups/[id]/route.ts` | PATCH update + DELETE with storage cleanup |
| `app/api/popups/[id]/stats/route.ts` | GET analytics (daily series + totals) |
| `app/api/popups/upload/route.ts` | POST upload image + DELETE orphan cleanup |
| `components/popups-card.tsx` | Single popup card (grid item) |
| `components/popups-modal.tsx` | Create/Edit modal with drag-and-drop upload |
| `app/popups/page.tsx` | Main grid page |
| `app/popups/[id]/analytics/page.tsx` | Per-popup analytics with Recharts bar chart |

### Modify — gestão repo

| File | Lines | Change |
|------|-------|--------|
| `components/protected-route.tsx` | ~12 | Add `popups: boolean` to `ModulePermissions` or the permissions type |
| `app/systems/page.tsx` | ~12–47 | Add `popups` to `ModulePermissions`, `DEFAULT_PERMISSIONS`, `MODULE_LABELS` |
| `app/page.tsx` | ~4,21,44,152,398 | Add `Megaphone` import, `PopupsPage` import, permissions entry, sidebar item, render |

### Create — site repo

| File | Responsibility |
|------|----------------|
| `public/popup-sdk.js` | Fetch active popups, render overlay, track clicks |

### Modify — site repo

| File | Change |
|------|--------|
| `app/layout.tsx` | Add `import Script from 'next/script'` + `<Script src="/popup-sdk.js" strategy="afterInteractive" />` |

---

## Task 1: SQL Migrations

**Files:**
- Create: `sql/006-create-popups.sql`
- Create: `sql/007-add-popups-permission.sql`

- [ ] **Step 1: Create migration 006**

```sql
-- sql/006-create-popups.sql

-- 1. Create popups table
CREATE TABLE popups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  image_url     text NOT NULL DEFAULT '',
  redirect_link text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT false,
  start_date    timestamptz NOT NULL DEFAULT now(),
  end_date      timestamptz,
  pages         jsonb NOT NULL DEFAULT '[]',
  frequency     text NOT NULL DEFAULT 'uma_vez'
                  CHECK (frequency IN ('uma_vez', 'sessao', 'sempre')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Create popup_clicks table
CREATE TABLE popup_clicks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id        uuid NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
  user_session_id text NOT NULL,
  clicked_at      timestamptz NOT NULL DEFAULT now(),
  page            text NOT NULL DEFAULT '',
  device_type     text NOT NULL DEFAULT 'desktop'
                    CHECK (device_type IN ('mobile', 'desktop'))
);

-- 3. Indexes
CREATE INDEX idx_popup_clicks_popup_id   ON popup_clicks(popup_id);
CREATE INDEX idx_popup_clicks_clicked_at ON popup_clicks(clicked_at);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_popups_updated_at
BEFORE UPDATE ON popups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE popups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE popup_clicks ENABLE ROW LEVEL SECURITY;

-- 6. popups: public read active only (used by SDK via anon key)
CREATE POLICY "Public can read active popups"
ON popups FOR SELECT
USING (
  is_active = true
  AND start_date <= now()
  AND (end_date IS NULL OR end_date >= now())
);

-- 7. popups: service role full access (used by lib/services/popups.ts)
CREATE POLICY "Service role full access on popups"
ON popups FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 8. popup_clicks: public insert (SDK tracks clicks via anon key)
CREATE POLICY "Public can insert clicks"
ON popup_clicks FOR INSERT
WITH CHECK (true);

-- 9. popup_clicks: service role all (analytics API)
CREATE POLICY "Service role can manage clicks"
ON popup_clicks FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 10. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('popup-images', 'popup-images', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Storage RLS
CREATE POLICY "Public read popup images"
ON storage.objects FOR SELECT
USING (bucket_id = 'popup-images');

CREATE POLICY "Service role upload popup images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'popup-images' AND auth.role() = 'service_role');

CREATE POLICY "Service role update popup images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'popup-images' AND auth.role() = 'service_role');

CREATE POLICY "Service role delete popup images"
ON storage.objects FOR DELETE
USING (bucket_id = 'popup-images' AND auth.role() = 'service_role');
```

- [ ] **Step 2: Create migration 007**

```sql
-- sql/007-add-popups-permission.sql

-- Backfill popups: false into all existing users that don't have the key yet
UPDATE users
SET permissions = permissions || '{"popups": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'popups');

-- Admin users get popups: true (same pattern as 005-add-tarefas-permission.sql)
UPDATE users
SET permissions = permissions || '{"popups": true}'::jsonb
WHERE role = 'admin';
```

- [ ] **Step 3: Run both migrations in Supabase SQL Editor**

Open the Supabase dashboard → SQL Editor → paste and run `006` first, then `007`.

- [ ] **Step 4: Verify**

Run in SQL Editor:
```sql
SELECT id, title FROM popups LIMIT 1;
SELECT id FROM popup_clicks LIMIT 1;
SELECT name FROM storage.buckets WHERE id = 'popup-images';
```
Expected: empty results (tables exist), bucket row present.

- [ ] **Step 5: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7
git add sql/006-create-popups.sql sql/007-add-popups-permission.sql
git commit -m "sql: add popups tables, RLS, storage bucket and permission backfill"
```

---

## Task 2: Service Layer

**Files:**
- Create: `lib/services/popups.ts`

- [ ] **Step 1: Create service file**

```typescript
// lib/services/popups.ts
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: must use service role key — same pattern as lib/services/crm.ts
// Do NOT import from lib/supabase-client.ts (that uses the anon key)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupFrequency = 'uma_vez' | 'sessao' | 'sempre'

export interface Popup {
  id: string
  title: string
  image_url: string
  redirect_link: string
  is_active: boolean
  start_date: string
  end_date: string | null
  pages: string[]
  frequency: PopupFrequency
  created_at: string
  updated_at: string
}

export interface PopupWithStats extends Popup {
  clicks_7d: number
}

export interface PopupClick {
  id: string
  popup_id: string
  user_session_id: string
  clicked_at: string
  page: string
  device_type: 'mobile' | 'desktop'
}

export interface PopupStats {
  total_clicks: number
  clicks_today: number
  mobile_clicks: number
  desktop_clicks: number
  daily_series: { date: string; clicks: number }[]
  recent_events: PopupClick[]
}

export interface CreatePopupInput {
  title: string
  image_url: string
  redirect_link: string
  is_active: boolean
  start_date: string
  end_date: string | null
  pages: string[]
  frequency: PopupFrequency
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPopups(): Promise<PopupWithStats[]> {
  const supabase = getSupabase()

  const { data: popups, error } = await supabase
    .from('popups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[popups] getPopups error:', error)
    return []
  }
  if (!popups?.length) return []

  // Fetch 7-day clicks for all popups in one query
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: clicks } = await supabase
    .from('popup_clicks')
    .select('popup_id')
    .gte('clicked_at', since)

  const clicksMap: Record<string, number> = {}
  clicks?.forEach((c) => {
    clicksMap[c.popup_id] = (clicksMap[c.popup_id] || 0) + 1
  })

  return popups.map((p) => ({ ...p, clicks_7d: clicksMap[p.id] || 0 }))
}

export async function getPopupById(id: string): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[popups] getPopupById error:', error)
    return null
  }
  return data
}

export async function createPopup(input: CreatePopupInput): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('[popups] createPopup error:', error)
    return null
  }
  return data
}

export async function updatePopup(
  id: string,
  input: Partial<CreatePopupInput>
): Promise<Popup | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('popups')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[popups] updatePopup error:', error)
    return null
  }
  return data
}

export async function deletePopup(id: string): Promise<boolean> {
  const supabase = getSupabase()
  const { error } = await supabase.from('popups').delete().eq('id', id)
  if (error) {
    console.error('[popups] deletePopup error:', error)
    return false
  }
  return true
}

export async function getPopupStats(id: string): Promise<PopupStats | null> {
  const supabase = getSupabase()

  // Fetch last 30 days of clicks — bounded by date, no arbitrary row cap
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: clicks, error } = await supabase
    .from('popup_clicks')
    .select('*')
    .eq('popup_id', id)
    .gte('clicked_at', thirtyDaysAgo)
    .order('clicked_at', { ascending: false })

  if (error) {
    console.error('[popups] getPopupStats error:', error)
    return null
  }

  const allClicks = clicks || []
  const todayStr = new Date().toISOString().slice(0, 10)

  const total_clicks = allClicks.length
  const clicks_today = allClicks.filter(
    (c) => c.clicked_at.slice(0, 10) === todayStr
  ).length
  const mobile_clicks = allClicks.filter((c) => c.device_type === 'mobile').length
  const desktop_clicks = allClicks.filter((c) => c.device_type === 'desktop').length

  // Build daily series for last 30 days
  const daily: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    daily[d.toISOString().slice(0, 10)] = 0
  }
  allClicks.forEach((c) => {
    const day = c.clicked_at.slice(0, 10)
    if (day in daily) daily[day]++
  })

  const daily_series = Object.entries(daily).map(([date, clicks]) => ({ date, clicks }))
  const recent_events = allClicks.slice(0, 50)

  return { total_clicks, clicks_today, mobile_clicks, desktop_clicks, daily_series, recent_events }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7
npx tsc --noEmit 2>&1 | grep popups
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/popups.ts
git commit -m "feat(popups): add service layer with CRUD and stats"
```

---

## Task 3: Upload API Route

**Files:**
- Create: `app/api/popups/upload/route.ts`

- [ ] **Step 1: Create upload route**

```typescript
// app/api/popups/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo deve ter no máximo 5MB' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado. Use JPG, PNG, WebP ou GIF.' }, { status: 400 })
    }

    const supabase = getSupabase()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('popup-images')
      .upload(path, arrayBuffer, { contentType: file.type })

    if (uploadError) {
      console.error('[popups/upload] upload error:', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload da imagem' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('popup-images')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path }, { status: 201 })
  } catch (err) {
    console.error('[popups/upload] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'path é obrigatório' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase.storage.from('popup-images').remove([path])

    if (error) {
      console.error('[popups/upload] delete error:', error)
      return NextResponse.json({ error: 'Erro ao deletar imagem' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[popups/upload] delete unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7
npx tsc --noEmit 2>&1 | grep -i "upload\|error" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/popups/upload/route.ts
git commit -m "feat(popups): add image upload API route with orphan cleanup"
```

---

## Task 4: Core API Routes

**Files:**
- Create: `app/api/popups/route.ts`
- Create: `app/api/popups/[id]/route.ts`
- Create: `app/api/popups/[id]/stats/route.ts`

- [ ] **Step 1: Create list + create route**

```typescript
// app/api/popups/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPopups, createPopup } from '@/lib/services/popups'

export async function GET() {
  const popups = await getPopups()
  return NextResponse.json(popups)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, image_url, redirect_link, is_active, start_date, end_date, pages, frequency } = body

    if (!title || !redirect_link || !start_date) {
      return NextResponse.json(
        { error: 'title, redirect_link e start_date são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['uma_vez', 'sessao', 'sempre'].includes(frequency)) {
      return NextResponse.json({ error: 'frequency inválido' }, { status: 400 })
    }

    const popup = await createPopup({
      title,
      image_url: image_url || '',
      redirect_link,
      is_active: is_active ?? false,
      start_date,
      end_date: end_date || null,
      pages: pages || [],
      frequency,
    })

    if (!popup) {
      return NextResponse.json({ error: 'Erro ao criar popup' }, { status: 500 })
    }

    return NextResponse.json(popup, { status: 201 })
  } catch (err) {
    console.error('[popups] POST error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create update + delete route**

```typescript
// app/api/popups/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updatePopup, deletePopup } from '@/lib/services/popups'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const popup = await updatePopup(id, body)
    if (!popup) {
      return NextResponse.json({ error: 'Erro ao atualizar popup' }, { status: 500 })
    }

    return NextResponse.json(popup)
  } catch (err) {
    console.error('[popups/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get image path before deleting the record
    const supabase = getSupabase()
    const { data: popup } = await supabase
      .from('popups')
      .select('image_url')
      .eq('id', id)
      .single()

    const deleted = await deletePopup(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Erro ao deletar popup' }, { status: 500 })
    }

    // Clean up image from storage if it's in our bucket
    if (popup?.image_url) {
      try {
        const url = new URL(popup.image_url)
        const pathMatch = url.pathname.match(/popup-images\/(.+)$/)
        if (pathMatch) {
          await supabase.storage.from('popup-images').remove([pathMatch[1]])
        }
      } catch {
        // Non-critical — popup was already deleted
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[popups/[id]] DELETE error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create stats route**

```typescript
// app/api/popups/[id]/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPopupStats } from '@/lib/services/popups'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const stats = await getPopupStats(id)

    if (!stats) {
      return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[popups/[id]/stats] GET error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/popups/route.ts app/api/popups/[id]/route.ts app/api/popups/[id]/stats/route.ts
git commit -m "feat(popups): add CRUD and stats API routes"
```

---

## Task 5: Permissions Integration

**Files:**
- Modify: `components/protected-route.tsx`
- Modify: `app/systems/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `popups` to permissions type in protected-route.tsx**

Find the permissions interface (the one that has `dashboard`, `crm`, `tarefas` etc.) and add `popups: boolean`. The interface may be called `ModulePermissions`, `Permissions`, or be inline in `SessionData`. Look for wherever `tarefas` is declared and add `popups` right after it.

- [ ] **Step 2: Add `popups` to systems/page.tsx**

In `app/systems/page.tsx`, find and make these three edits:

**ModulePermissions interface** — add after `tarefas: boolean`:
```typescript
popups: boolean
```

**DEFAULT_PERMISSIONS** — add after `tarefas: false`:
```typescript
popups: false,
```

**MODULE_LABELS** — add after `tarefas: "Tarefas"`:
```typescript
popups: "Pop-ups",
```

- [ ] **Step 3: Wire popups into app/page.tsx**

Make these four changes to `app/page.tsx`:

**3a. Add `Megaphone` to the lucide-react import** (line 4 — already has KanbanSquare etc.):
```typescript
import { ..., KanbanSquare, Megaphone } from "lucide-react"
```

**3b. Add PopupsPage import** (after line 21 `import TarefasPage from "./tarefas/page"`):
```typescript
import PopupsPage from "./popups/page"
```

**3c. Add `popups` to the permissions object** inside `loadPermissions()` (after `tarefas: hasPermission('tarefas')`):
```typescript
popups: hasPermission('popups'),
```

**3d. Add sidebar item** in the navigation array (after the tarefas entry `{ id: "tarefas", icon: KanbanSquare, ... }`):
```typescript
{ id: "popups", icon: Megaphone, label: "POP-UPS", permissionKey: "popups" },
```

**3e. Add conditional render** in the main content section (after the tarefas render line ~398):
```typescript
{activeSection === "popups" && permissions.popups && <PopupsPage />}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/protected-route.tsx app/systems/page.tsx app/page.tsx
git commit -m "feat(popups): integrate popups module into sidebar and permissions"
```

---

## Task 6: PopupsCard Component

**Files:**
- Create: `components/popups-card.tsx`

- [ ] **Step 1: Create component**

```typescript
// components/popups-card.tsx
'use client'

import { BarChart2, Edit2, Megaphone, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PopupWithStats } from '@/lib/services/popups'

interface PopupsCardProps {
  popup: PopupWithStats
  onEdit: (popup: PopupWithStats) => void
  onDelete: (id: string) => void
  onToggle: (id: string, value: boolean) => void
}

export default function PopupsCard({ popup, onEdit, onDelete, onToggle }: PopupsCardProps) {
  const router = useRouter()

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col group">
      {/* Image preview */}
      <div className="relative aspect-video bg-neutral-800 flex-shrink-0">
        {popup.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.image_url}
            alt={popup.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Megaphone className="w-8 h-8 text-neutral-600" />
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium border ${
            popup.is_active
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-neutral-700/80 text-neutral-400 border-neutral-600'
          }`}
        >
          {popup.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
          {popup.title}
        </h3>

        {/* Period */}
        <p className="text-xs text-neutral-500">
          {fmt(popup.start_date)} → {popup.end_date ? fmt(popup.end_date) : '∞'}
        </p>

        {/* Pages */}
        {popup.pages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {popup.pages.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700 truncate max-w-[80px]"
                title={p}
              >
                {p}
              </span>
            ))}
            {popup.pages.length > 3 && (
              <span className="text-xs text-neutral-600">
                +{popup.pages.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Click count */}
        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-auto">
          <BarChart2 className="w-3.5 h-3.5" />
          {popup.clicks_7d} cliques (7d)
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800 mt-1">
          {/* Toggle */}
          <button
            onClick={() => onToggle(popup.id, !popup.is_active)}
            title={popup.is_active ? 'Desativar' : 'Ativar'}
            className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
              popup.is_active ? 'bg-orange-500' : 'bg-neutral-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                popup.is_active ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>

          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => onEdit(popup)}
              title="Editar"
              className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => router.push(`/popups/${popup.id}/analytics`)}
              title="Ver analytics"
              className="p-1.5 text-neutral-500 hover:text-blue-400 transition-colors rounded"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(popup.id)}
              title="Excluir"
              className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "popups-card\|error" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/popups-card.tsx
git commit -m "feat(popups): add PopupsCard component"
```

---

## Task 7: PopupsModal Component

**Files:**
- Create: `components/popups-modal.tsx`

- [ ] **Step 1: Create modal component**

```typescript
// components/popups-modal.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, Loader2, ImageIcon } from 'lucide-react'
import type { Popup, PopupWithStats, CreatePopupInput, PopupFrequency } from '@/lib/services/popups'

const SITE_PAGES = [
  { value: '/', label: 'Página inicial' },
  { value: '/evolve', label: 'Evolve' },
  { value: '/check-in', label: 'Check-in' },
  { value: '/insider-conect', label: 'Insider Connect' },
  { value: '/seja-parceiro', label: 'Seja Parceiro' },
  { value: '/parceiro-somma-club', label: 'Parceiro Somma Club' },
]

interface PopupsModalProps {
  popup?: PopupWithStats | null
  onClose: () => void
  onSave: (data: CreatePopupInput) => Promise<void>
}

export default function PopupsModal({ popup, onClose, onSave }: PopupsModalProps) {
  const isEditing = !!popup

  const [title, setTitle] = useState(popup?.title || '')
  const [imageUrl, setImageUrl] = useState(popup?.image_url || '')
  const [imagePath, setImagePath] = useState<string | null>(null) // track uploaded path for orphan cleanup
  const [redirectLink, setRedirectLink] = useState(popup?.redirect_link || '')
  const [startDate, setStartDate] = useState(
    popup?.start_date ? popup.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(popup?.end_date ? popup.end_date.slice(0, 10) : '')
  const [noEndDate, setNoEndDate] = useState(!popup?.end_date)
  const [frequency, setFrequency] = useState<PopupFrequency>(popup?.frequency || 'uma_vez')
  const [pages, setPages] = useState<string[]>(popup?.pages || [])
  const [customPage, setCustomPage] = useState('')
  const [isActive, setIsActive] = useState(popup?.is_active ?? false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/popups/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error || 'Erro ao fazer upload')
        return
      }
      setImageUrl(json.url)
      setImagePath(json.path)
    } catch {
      setUploadError('Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }, [])

  const togglePage = (value: string) => {
    setPages((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    )
  }

  const addCustomPage = () => {
    const v = customPage.trim()
    if (v && !pages.includes(v)) {
      setPages((prev) => [...prev, v.startsWith('/') ? v : `/${v}`])
      setCustomPage('')
    }
  }

  const handleClose = async () => {
    // Clean up orphaned image (uploaded in this session but popup not saved/updated)
    // Applies to both create AND edit flows — imagePath is only set when a new file was uploaded
    if (imagePath) {
      await fetch(`/api/popups/upload?path=${encodeURIComponent(imagePath)}`, { method: 'DELETE' })
    }
    onClose()
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      title,
      image_url: imageUrl,
      redirect_link: redirectLink,
      is_active: isActive,
      start_date: new Date(startDate).toISOString(),
      end_date: noEndDate || !endDate ? null : new Date(endDate).toISOString(),
      pages,
      frequency,
    })
    setSaving(false)
  }

  const canSave = title.trim() && redirectLink.trim() && startDate && !uploading && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10">
          <h2 className="font-semibold text-white">
            {isEditing ? 'Editar Pop-up' : 'Novo Pop-up'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-neutral-500 hover:text-white transition-colors rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da campanha"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Imagem</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                isDragging ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-700 hover:border-neutral-600'
              }`}
            >
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-40" />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm">Trocar imagem</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-neutral-600" />
                      <p className="text-sm text-neutral-500">Arraste ou clique para fazer upload</p>
                      <p className="text-xs text-neutral-600">JPG, PNG, WebP, GIF — máx. 5MB</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>

          {/* Redirect Link */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
              Link de redirecionamento <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={redirectLink}
              onChange={(e) => setRedirectLink(e.target.value)}
              placeholder="https://sommaclub.com.br/evento"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                Data início <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Data fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={noEndDate}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-40"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noEndDate}
              onChange={(e) => { setNoEndDate(e.target.checked); if (e.target.checked) setEndDate('') }}
              className="accent-orange-500"
            />
            <span className="text-xs text-neutral-400">Sem data de fim</span>
          </label>

          {/* Frequency */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Frequência</label>
            <div className="flex rounded-lg overflow-hidden border border-neutral-700">
              {([
                { value: 'uma_vez', label: 'Uma vez' },
                { value: 'sessao', label: 'Por sessão' },
                { value: 'sempre', label: 'Sempre' },
              ] as { value: PopupFrequency; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFrequency(value)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    frequency === value
                      ? 'bg-orange-500 text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              Páginas onde exibir
            </label>
            <div className="space-y-1.5">
              {SITE_PAGES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2.5 cursor-pointer group/check">
                  <input
                    type="checkbox"
                    checked={pages.includes(value)}
                    onChange={() => togglePage(value)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-neutral-300 group-hover/check:text-white transition-colors">
                    {label}
                  </span>
                  <span className="text-xs text-neutral-600 ml-auto">{value}</span>
                </label>
              ))}
            </div>
            {/* Custom page */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customPage}
                onChange={(e) => setCustomPage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPage() } }}
                placeholder="/outra-pagina"
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button
                onClick={addCustomPage}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm transition-colors"
              >
                +
              </button>
            </div>
            {pages.filter(p => !SITE_PAGES.map(s => s.value).includes(p)).map(p => (
              <div key={p} className="flex items-center justify-between mt-1 px-2 py-1 bg-neutral-800 rounded text-xs">
                <span className="text-neutral-300">{p}</span>
                <button onClick={() => togglePage(p)} className="text-neutral-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-neutral-300">Ativar imediatamente</span>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-orange-500' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-800 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-lg bg-orange-500 text-black font-semibold text-sm hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "popups-modal\|error" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/popups-modal.tsx
git commit -m "feat(popups): add PopupsModal with drag-and-drop upload and orphan cleanup"
```

---

## Task 8: Main Popups Page

**Files:**
- Create: `app/popups/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/popups/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Plus, RefreshCw } from 'lucide-react'
import PopupsCard from '@/components/popups-card'
import PopupsModal from '@/components/popups-modal'
import type { PopupWithStats, CreatePopupInput } from '@/lib/services/popups'

export default function PopupsPage() {
  const [popups, setPopups] = useState<PopupWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingPopup, setEditingPopup] = useState<PopupWithStats | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPopups = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/popups')
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setPopups(data)
      setError(null)
    } catch {
      setError('Erro ao carregar pop-ups')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadPopups() }, [loadPopups])

  const handleSave = async (data: CreatePopupInput) => {
    try {
      const method = editingPopup ? 'PATCH' : 'POST'
      const url = editingPopup ? `/api/popups/${editingPopup.id}` : '/api/popups'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setShowModal(false)
      setEditingPopup(null)
      loadPopups(true)
    } catch {
      setError('Erro ao salvar pop-up')
    }
  }

  const handleToggle = async (id: string, value: boolean) => {
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: value } : p)))
    try {
      await fetch(`/api/popups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: value }),
      })
    } catch {
      // Revert on error
      setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !value } : p)))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/popups/${id}`, { method: 'DELETE' })
      setPopups((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Erro ao deletar pop-up')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const openEdit = (popup: PopupWithStats) => {
    setEditingPopup(popup)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingPopup(null)
    setShowModal(true)
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-orange-400" />
          <h1 className="text-lg font-semibold text-white">Pop-ups</h1>
          {popups.length > 0 && (
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
              {popups.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPopups(true)}
            disabled={refreshing}
            className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Pop-up
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-neutral-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-neutral-800 rounded w-3/4" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : popups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <Megaphone className="w-12 h-12 text-neutral-700" />
            <div>
              <p className="text-neutral-400 font-medium">Nenhum pop-up criado</p>
              <p className="text-neutral-600 text-sm mt-1">
                Crie seu primeiro pop-up para exibir no site
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar primeiro pop-up
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popups.map((popup) => (
              <PopupsCard
                key={popup.id}
                popup={popup}
                onEdit={openEdit}
                onDelete={(id) => setDeleteConfirm(id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PopupsModal
          popup={editingPopup}
          onClose={() => { setShowModal(false); setEditingPopup(null) }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir pop-up?</h3>
            <p className="text-sm text-neutral-400 mb-5">
              Esta ação é irreversível. O pop-up e sua imagem serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```

- [ ] **Step 3: Verify in browser**

Start dev server: `npm run dev`
Log in as admin → enable Pop-ups permission in /systems → click POP-UPS in sidebar.
Expected: Grid page loads, "Nenhum pop-up criado" empty state shown.
Create a popup: fill form, upload image, save → card appears in grid.

- [ ] **Step 4: Commit**

```bash
git add app/popups/page.tsx
git commit -m "feat(popups): add main popups grid page"
```

---

## Task 9: Analytics Page

**Files:**
- Create: `app/popups/[id]/analytics/page.tsx`

- [ ] **Step 1: Create analytics page**

```typescript
// app/popups/[id]/analytics/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BarChart2, MousePointer, Smartphone, Monitor } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Popup } from '@/lib/services/popups'

interface Stats {
  total_clicks: number
  clicks_today: number
  mobile_clicks: number
  desktop_clicks: number
  daily_series: { date: string; clicks: number }[]
  recent_events: {
    id: string
    clicked_at: string
    page: string
    device_type: string
    user_session_id: string
  }[]
}

export default function PopupAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [popup, setPopup] = useState<Popup | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const [popupRes, statsRes] = await Promise.all([
          fetch(`/api/popups/${id}`),
          fetch(`/api/popups/${id}/stats`),
        ])
        if (!popupRes.ok || !statsRes.ok) throw new Error('Erro ao carregar')
        const [popupData, statsData] = await Promise.all([popupRes.json(), statsRes.json()])
        setPopup(popupData)
        setStats(statsData)
      } catch {
        setError('Erro ao carregar analytics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const mobileRate = stats
    ? stats.total_clicks > 0
      ? Math.round((stats.mobile_clicks / stats.total_clicks) * 100)
      : 0
    : 0

  return (
    <div className="flex flex-col h-full bg-black overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-neutral-800">
        <button
          onClick={() => router.push('/popups')}
          className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">
            {popup?.title || 'Analytics'}
          </h1>
          {popup && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                popup.is_active
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-neutral-700 text-neutral-400 border-neutral-600'
              }`}
            >
              {popup.is_active ? 'Ativo' : 'Inativo'}
            </span>
          )}
        </div>
        <BarChart2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-neutral-900 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-neutral-900 rounded-xl animate-pulse" />
        </div>
      ) : stats ? (
        <div className="p-4 space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total de cliques', value: stats.total_clicks, icon: MousePointer, color: 'text-orange-400' },
              { label: 'Cliques hoje', value: stats.clicks_today, icon: MousePointer, color: 'text-blue-400' },
              { label: '% Mobile', value: `${mobileRate}%`, icon: Smartphone, color: 'text-green-400' },
              { label: '% Desktop', value: `${100 - mobileRate}%`, icon: Monitor, color: 'text-purple-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <Icon className={`w-4 h-4 ${color} mb-2`} />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-white mb-4">Cliques por dia — últimos 30 dias</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.daily_series} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#525252', fontSize: 10 }}
                  tickFormatter={fmtDate}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#525252', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8 }}
                  labelStyle={{ color: '#a3a3a3', fontSize: 11 }}
                  itemStyle={{ color: '#f97316', fontSize: 12 }}
                  labelFormatter={fmtDate}
                />
                <Bar dataKey="clicks" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent events */}
          {stats.recent_events.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h2 className="text-sm font-medium text-white">Cliques recentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Data/hora</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Página</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Dispositivo</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Sessão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_events.map((ev) => (
                      <tr key={ev.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                        <td className="px-4 py-2.5 text-neutral-300 whitespace-nowrap">{fmtDateTime(ev.clicked_at)}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{ev.page || '/'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${ev.device_type === 'mobile' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                            {ev.device_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-600 font-mono">
                          {ev.user_session_id.slice(0, 8)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Add GET route for single popup** (needed by analytics page)

The analytics page calls `GET /api/popups/[id]`. Add a GET handler to `app/api/popups/[id]/route.ts`:

```typescript
// Add this to app/api/popups/[id]/route.ts (before PATCH)
import { getPopupById } from '@/lib/services/popups'  // add to existing import

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const popup = await getPopupById(id)
    if (!popup) return NextResponse.json({ error: 'Popup não encontrado' }, { status: 404 })
    return NextResponse.json(popup)
  } catch (err) {
    console.error('[popups/[id]] GET error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```

- [ ] **Step 4: Verify in browser**

Create a popup → toggle active → click Analytics button on card.
Expected: Analytics page loads, shows metric cards (0 values), empty bar chart, empty recent events.

- [ ] **Step 5: Commit**

```bash
git add app/popups/[id]/analytics/page.tsx app/api/popups/[id]/route.ts
git commit -m "feat(popups): add analytics page with Recharts bar chart and GET single popup"
```

---

## Task 10: SDK + Site Integration

**Repos:** Site repo (`sommarunningclub-novo-site-somma-club-2026`)

**Files:**
- Create: `public/popup-sdk.js`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create SDK**

```javascript
// public/popup-sdk.js
// Somma Running Club - Popup SDK
// Reads active popups from Supabase directly (anon key, public RLS)

;(function () {
  'use strict'

  // ─── Configuration ───────────────────────────────────────────────────────
  var SUPABASE_URL = 'REPLACE_WITH_SUPABASE_URL'
  var SUPABASE_ANON_KEY = 'REPLACE_WITH_SUPABASE_ANON_KEY'
  var BUCKET_URL = SUPABASE_URL + '/storage/v1/object/public/popup-images'

  // ─── State ───────────────────────────────────────────────────────────────
  var queue = []
  var currentIndex = 0
  var overlay = null

  // ─── Session ID ──────────────────────────────────────────────────────────
  function getSessionId() {
    var key = 'popup_session_id'
    var id = sessionStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(key, id)
    }
    return id
  }

  // ─── Frequency check ─────────────────────────────────────────────────────
  function shouldShow(popup) {
    if (popup.frequency === 'sempre') return true
    if (popup.frequency === 'uma_vez') {
      return !localStorage.getItem('popup_shown_' + popup.id)
    }
    if (popup.frequency === 'sessao') {
      return !sessionStorage.getItem('popup_session_' + popup.id)
    }
    return true
  }

  function markShown(popup) {
    if (popup.frequency === 'uma_vez') {
      localStorage.setItem('popup_shown_' + popup.id, '1')
    } else if (popup.frequency === 'sessao') {
      sessionStorage.setItem('popup_session_' + popup.id, '1')
    }
  }

  // ─── Device detection ────────────────────────────────────────────────────
  function getDeviceType() {
    return window.innerWidth <= 768 ? 'mobile' : 'desktop'
  }

  // ─── Track click ─────────────────────────────────────────────────────────
  function trackClick(popup) {
    var body = JSON.stringify({
      popup_id: popup.id,
      user_session_id: getSessionId(),
      page: window.location.pathname,
      device_type: getDeviceType(),
    })
    fetch(SUPABASE_URL + '/rest/v1/popup_clicks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Prefer: 'return=minimal',
      },
      body: body,
    }).catch(function () {
      // Non-critical, ignore errors
    })
  }

  // ─── Render overlay ──────────────────────────────────────────────────────
  function showPopup(popup) {
    markShown(popup)

    var style = document.createElement('style')
    style.textContent = [
      '#somma-popup-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.72);animation:somma-fade-in 0.2s ease-out}',
      '#somma-popup-card{position:relative;background:#fff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.5);animation:somma-scale-in 0.2s ease-out}',
      '#somma-popup-card img{display:block;width:100%;height:auto;cursor:pointer}',
      '#somma-popup-close{position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.6);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;line-height:1;padding:0;transition:background 0.15s}',
      '#somma-popup-close:hover{background:rgba(0,0,0,0.85)}',
      '@keyframes somma-fade-in{from{opacity:0}to{opacity:1}}',
      '@keyframes somma-scale-in{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}',
    ].join('')
    document.head.appendChild(style)

    overlay = document.createElement('div')
    overlay.id = 'somma-popup-overlay'

    var card = document.createElement('div')
    card.id = 'somma-popup-card'

    var img = document.createElement('img')
    img.src = popup.image_url
    img.alt = popup.title
    img.onclick = function () {
      trackClick(popup)
      closeOverlay()
      if (popup.redirect_link) window.open(popup.redirect_link, '_blank', 'noopener')
    }

    var closeBtn = document.createElement('button')
    closeBtn.id = 'somma-popup-close'
    closeBtn.innerHTML = '&times;'
    closeBtn.setAttribute('aria-label', 'Fechar')
    closeBtn.onclick = closeOverlay

    card.appendChild(img)
    card.appendChild(closeBtn)
    overlay.appendChild(card)

    // Close on backdrop click
    overlay.onclick = function (e) {
      if (e.target === overlay) closeOverlay()
    }

    document.body.appendChild(overlay)
  }

  function closeOverlay() {
    if (overlay) {
      overlay.remove()
      overlay = null
    }
    // Show next in queue
    currentIndex++
    if (currentIndex < queue.length) {
      showPopup(queue[currentIndex])
    }
  }

  // ─── Fetch and filter ─────────────────────────────────────────────────────
  function init() {
    var pathname = window.location.pathname

    fetch(SUPABASE_URL + '/rest/v1/popups?select=*&is_active=eq.true', {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      },
    })
      .then(function (res) { return res.json() })
      .then(function (popups) {
        if (!Array.isArray(popups)) return

        queue = popups.filter(function (p) {
          // Client-side filter: check if current page is in pages array
          var pages = Array.isArray(p.pages) ? p.pages : []
          var matchesPage = pages.length === 0 || pages.indexOf(pathname) !== -1
          return matchesPage && shouldShow(p)
        })

        if (queue.length > 0) {
          // Small delay so page renders first
          setTimeout(function () { showPopup(queue[0]) }, 800)
        }
      })
      .catch(function () {
        // Non-critical, ignore errors
      })
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
```

**After creating the file, replace the placeholders:**
- `REPLACE_WITH_SUPABASE_URL` → the value of `NEXT_PUBLIC_SUPABASE_URL` from gestão's `.env`
- `REPLACE_WITH_SUPABASE_ANON_KEY` → the value of `NEXT_PUBLIC_SUPABASE_ANON_KEY` from gestão's `.env`

- [ ] **Step 2: Add Script tag to site layout.tsx**

In `app/layout.tsx`, add the import and the Script tag:

```typescript
// Add import at top (after existing imports):
import Script from 'next/script'

// In the JSX, inside <body>, after <Analytics />:
<Script src="/popup-sdk.js" strategy="afterInteractive" />
```

The body section should look like:
```tsx
<body className="font-sans antialiased">
  {children}
  <Analytics />
  <Script src="/popup-sdk.js" strategy="afterInteractive" />
</body>
```

- [ ] **Step 3: Verify site TypeScript**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
npx tsc --noEmit 2>&1 | grep -i "error" | head -10
```

- [ ] **Step 4: End-to-end test**

1. In gestão system: create a popup targeting `/check-in`, set frequency to `sempre`, activate it
2. Start site dev server: `npm run dev` in site repo
3. Visit `http://localhost:3001/check-in` (or whatever port)
4. Expected: popup overlay appears after ~800ms with the image
5. Click image → new tab opens with redirect_link
6. Click X → overlay closes
7. In gestão analytics: verify click was recorded

- [ ] **Step 5: Commit both repos**

```bash
# Site repo
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add public/popup-sdk.js app/layout.tsx
git commit -m "feat: add popup SDK with Supabase direct integration"

# Gestão repo (if any cleanup needed)
cd /Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7
git status
```

---

## Final Checklist

- [ ] SQL migrations run in Supabase (006 + 007)
- [ ] `lib/services/popups.ts` uses service role key (not anon)
- [ ] All API routes respond correctly
- [ ] Popups module appears in sidebar for users with permission
- [ ] Admin can enable popups permission per user in /systems
- [ ] Create/Edit modal saves and reloads grid
- [ ] Toggle activates/deactivates without opening modal
- [ ] Delete removes popup + cleans up storage image
- [ ] Cancel on new popup cleans up orphaned image
- [ ] Analytics page shows chart + metrics + recent events
- [ ] SDK shows popup on correct pages
- [ ] SDK respects frequency (uma_vez stays hidden on refresh)
- [ ] SDK records clicks to popup_clicks table
- [ ] Both repos committed and pushed
