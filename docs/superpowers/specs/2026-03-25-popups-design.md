# Pop-ups Module — Design Specification

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

A popup management module integrated into the Somma Gestão system (v0-sistema-somma-de-gestao-l7) that allows admins to create, schedule, and analyze popup campaigns displayed on the Somma Running Club public site (sommarunningclub-novo-site-somma-club-2026).

---

## Architecture

### Components

1. **Admin Module** — New sidebar module `/popups` in the gestão system (Next.js 15.5.10, App Router)
2. **Supabase Backend** — Same Supabase project as gestão system; two tables + one storage bucket
3. **SDK** — `public/popup-sdk.js` in the site repo; reads directly from Supabase via anon key

### Data Flow

```
Admin creates popup in gestão system
  → lib/services/popups.ts uses service role key (bypasses RLS)
  → saves to Supabase
  → image uploaded to bucket: popup-images

Site loads popup-sdk.js
  → SDK reads active popups from Supabase (anon key, RLS: public read)
  → fetches all active popups, filters client-side by current pathname
  → renders overlay
  → click tracked directly to popup_clicks table (anon key, RLS: public insert)
```

### Why direct Supabase in SDK (not API proxy)

- No CORS configuration needed
- No dependency on gestão server availability
- Anon key is public by design; RLS enforces access rules
- Lower latency for end users

---

## Database Schema

### Table: `popups`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| title | text | Campaign name |
| image_url | text | Public URL from storage bucket |
| redirect_link | text | URL destination on click |
| is_active | boolean | Default false |
| start_date | timestamptz | When popup starts showing |
| end_date | timestamptz | Nullable — no end date = indefinite |
| pages | jsonb | Array of pathnames, e.g. `["/", "/eventos"]` |
| frequency | text | `'uma_vez'` \| `'sessao'` \| `'sempre'` |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now(), updated via trigger |

### Table: `popup_clicks`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| popup_id | uuid | FK → popups(id) ON DELETE CASCADE |
| user_session_id | text | UUID generated via `crypto.randomUUID()`, stored in sessionStorage |
| clicked_at | timestamptz | Default now() |
| page | text | Pathname where click happened |
| device_type | text | `'mobile'` \| `'desktop'` |

### Storage Bucket: `popup-images`

- Public bucket
- Accepted file types: image/jpeg, image/png, image/webp, image/gif
- Max file size: 5MB
- Path convention: `{popup_id}/{filename}` — each re-upload uses a new filename (timestamp prefix) to avoid path collisions

### RLS Policies

**popups:**
- Public SELECT: `is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now())`
- Service role ALL: `auth.role() = 'service_role'` (used by `lib/services/popups.ts`)

Note: `lib/services/popups.ts` must instantiate its own Supabase client with `SUPABASE_SERVICE_ROLE_KEY`, following the same pattern as `lib/services/crm.ts` lines 5-10. It must NOT import the shared anon-key client from `lib/supabase-client.ts`.

**popup_clicks:**
- Public INSERT: allowed (any session can record a click)
- SELECT/UPDATE/DELETE: `auth.role() = 'service_role'` only

---

## Admin Module (`/popups`)

### Sidebar Integration

- Module key: `popups`
- Permission: `permissions.popups`
- Icon: `Megaphone` (lucide-react)
- Follows existing pattern in `app/page.tsx` conditional rendering

### Main Page (`app/popups/page.tsx`)

**Layout:**
- Header row: "Pop-ups" title + "Novo Pop-up" button (orange)
- Empty state: illustrated empty state with CTA button
- Grid: 3 columns desktop / 2 tablet / 1 mobile

**Card anatomy:**
- Image preview (16:9 aspect ratio, object-cover)
- Title
- Status badge: green "Ativo" / gray "Inativo"
- Active period: "25/03 → 30/03" or "25/03 → ∞"
- Pages: small chips (max 3 visible + "+N more")
- Click count: "42 cliques (7d)" — 7-day count via subquery on `popup_clicks`
- Actions row: toggle switch + Edit button + Delete button + Analytics button

**Interactions:**
- Toggle switch activates/deactivates inline (PATCH request, no modal)
- Delete shows confirmation dialog before proceeding
- Analytics button navigates to `/popups/[id]/analytics`

### Create/Edit Modal

**Fields:**
1. **Título** — text input, required
2. **Imagem** — drag-and-drop upload zone; shows preview after upload; accepts jpg/png/webp/gif ≤5MB; uploads to Supabase Storage immediately on file selection (not on save); filename convention: `{timestamp}-{original_name}`
3. **Link de redirecionamento** — URL input, required
4. **Data início** — date picker, required
5. **Data fim** — date picker, optional ("Sem data de fim" checkbox)
6. **Frequência** — segmented control: "Uma vez" / "Por sessão" / "Sempre"
7. **Páginas** — checkbox list of known site routes + free-text field to add custom route:
   - `/` — Página inicial
   - `/evolve` — Evolve
   - `/check-in` — Check-in
   - `/insider-conect` — Insider Connect
   - `/seja-parceiro` — Seja Parceiro
   - `/parceiro-somma-club` — Parceiro Somma Club
8. **Ativo** — toggle switch

**Behavior:**
- Image uploads immediately on file selection → stores URL + `storagePath` in component state
- Save button disabled until required fields filled
- On save: POST (create) or PATCH (edit)
- On cancel/close: if an image was uploaded but the popup was not saved, call `DELETE /api/popups/upload?path={storagePath}` to remove the orphaned file from storage

### Analytics Page (`app/popups/[id]/analytics/page.tsx`)

**Sections:**
1. Back button + popup title + status badge
2. Metric cards row: Total cliques | Cliques hoje | % Mobile | % Desktop
3. Bar chart: clicks per day (last 30 days) — using Recharts (already in project)
4. Recent events table: date/time, page, device, session ID (truncated)

---

## API Routes

All routes in `app/api/popups/`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/popups` | session | List all popups + 7-day click count per popup (subquery) |
| POST | `/api/popups` | session | Create popup |
| PATCH | `/api/popups/[id]` | session | Update popup fields |
| DELETE | `/api/popups/[id]` | session | Delete popup record + remove image from storage |
| GET | `/api/popups/[id]/stats` | session | Return full metrics + daily click series (30d) |
| POST | `/api/popups/upload` | session | Upload image to Supabase Storage, return `{ url, path }` |
| DELETE | `/api/popups/upload` | session | Delete image by `?path=` query param — used for orphaned upload cleanup |

Authentication: follows existing session pattern (`somma_session` in localStorage/cookie — same pattern as other modules).

No `/api/popups/track-click` route needed — SDK writes directly to Supabase.

**GET `/api/popups` click count query strategy:**
```sql
SELECT p.*,
  COUNT(pc.id) FILTER (WHERE pc.clicked_at >= now() - interval '7 days') AS clicks_7d
FROM popups p
LEFT JOIN popup_clicks pc ON pc.popup_id = p.id
GROUP BY p.id
ORDER BY p.created_at DESC
```

---

## SDK (`public/popup-sdk.js`)

Plain JavaScript (no framework dependencies). Loaded in site's `app/layout.tsx` via Next.js `<Script strategy="afterInteractive">`.

**Site layout.tsx change:**
```tsx
import Script from 'next/script'  // add this import

// inside <body>, after <Analytics />:
<Script src="/popup-sdk.js" strategy="afterInteractive" />
```

### Configuration (top of file)

```js
const SUPABASE_URL = 'https://xxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJ...'
```

### Logic

1. On DOM ready: detect `window.location.pathname`
2. Fetch **all** active popups from Supabase REST API (RLS filters by date + is_active server-side)
3. Filter fetched results **client-side** by whether `pages` array includes the current pathname
4. Filter by frequency using `localStorage` (`popup_shown_{id}`) and `sessionStorage` (`popup_session_{id}`)
5. Queue valid popups
6. Show first popup in queue
7. On close: show next in queue (if any)
8. On image click: record click to `popup_clicks` + redirect to `redirect_link`

### Frequency logic

| Value | Storage key | Behavior |
|-------|-------------|----------|
| `uma_vez` | localStorage `popup_shown_{id}` | Never show again after first display |
| `sessao` | sessionStorage `popup_session_{id}` | Show once per browser session |
| `sempre` | — | Always show |

### Visual

- Backdrop: `rgba(0,0,0,0.7)` fixed fullscreen overlay
- Card: centered, max-width 480px, border-radius 12px, white background
- Image: full width, aspect-ratio auto
- Close button: top-right corner, 32px circle
- Entry animation: fade-in + scale from 0.9 to 1.0 (200ms ease-out)
- Click outside card closes popup

### Session ID

Generated once per session via `crypto.randomUUID()` (available in all modern browsers), stored in `sessionStorage` as `popup_session_id`. Sent with every click event.

---

## File Structure

### Gestão System (`v0-sistema-somma-de-gestao-l7`)

```
app/
  popups/
    page.tsx                    # Main grid page
    [id]/
      analytics/
        page.tsx                # Analytics page
  page.tsx                      # MODIFY: add popups sidebar entry + conditional render
  systems/
    page.tsx                    # MODIFY: add "Pop-ups" checkbox to permissions UI
app/api/
  popups/
    route.ts                    # GET (list + 7d clicks), POST (create)
    [id]/
      route.ts                  # PATCH, DELETE
      stats/
        route.ts                # GET full stats + daily series
    upload/
      route.ts                  # POST (upload image), DELETE (orphan cleanup)
components/
  popups-card.tsx               # Individual popup card
  popups-modal.tsx              # Create/Edit modal
  protected-route.tsx           # MODIFY: add popups to PermissionsType
lib/services/
  popups.ts                     # Supabase queries — uses service role client (NOT lib/supabase-client.ts)
sql/
  006-create-popups.sql         # Migration: tables + indexes + RLS + storage bucket
  007-add-popups-permission.sql # Migration: backfill popups:false into existing users
```

### Site (`sommarunningclub-novo-site-somma-club-2026`)

```
public/
  popup-sdk.js                  # SDK script
app/
  layout.tsx                    # MODIFY: add import Script + <Script src="/popup-sdk.js" />
```

---

## Permissions Integration

Add `popups` key to the permissions interface in the gestão system:

- `components/protected-route.tsx` — add `popups` to `PermissionsType` interface
- `app/systems/page.tsx` — add `popups: false` to `DEFAULT_PERMISSIONS`, add `popups: 'Pop-ups'` to `MODULE_LABELS`, add checkbox in UI
- `app/page.tsx` — add `popups: hasPermission('popups')` to permissions object, add sidebar entry with `Megaphone` icon, add conditional render of `PopupsPage`
- Default: `false` (off by default, admin enables per user)

---

## SQL Queries (to run in Supabase SQL Editor)

### Migration 006 — Create tables, indexes, RLS, storage

```sql
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

-- 3. Indexes for analytics queries
CREATE INDEX idx_popup_clicks_popup_id  ON popup_clicks(popup_id);
CREATE INDEX idx_popup_clicks_clicked_at ON popup_clicks(clicked_at);

-- 4. Updated_at trigger
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

-- 6. RLS: public read active popups (used by SDK via anon key)
CREATE POLICY "Public can read active popups"
ON popups FOR SELECT
USING (
  is_active = true
  AND start_date <= now()
  AND (end_date IS NULL OR end_date >= now())
);

-- 7. RLS: service role full access on popups (used by lib/services/popups.ts)
CREATE POLICY "Service role full access on popups"
ON popups FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 8. RLS: public insert on popup_clicks (used by SDK via anon key)
CREATE POLICY "Public can insert clicks"
ON popup_clicks FOR INSERT
WITH CHECK (true);

-- 9. RLS: service role read/manage clicks (used by analytics API)
CREATE POLICY "Service role can manage clicks"
ON popup_clicks FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 10. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('popup-images', 'popup-images', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Storage RLS: public read images
CREATE POLICY "Public read popup images"
ON storage.objects FOR SELECT
USING (bucket_id = 'popup-images');

-- 12. Storage RLS: service role upload
CREATE POLICY "Service role upload popup images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'popup-images' AND auth.role() = 'service_role');

-- 13. Storage RLS: service role update (overwrite protection)
CREATE POLICY "Service role update popup images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'popup-images' AND auth.role() = 'service_role');

-- 14. Storage RLS: service role delete
CREATE POLICY "Service role delete popup images"
ON storage.objects FOR DELETE
USING (bucket_id = 'popup-images' AND auth.role() = 'service_role');
```

### Migration 007 — Backfill popups permission into existing users

```sql
-- Adds "popups": false to the permissions JSONB of all existing users
-- who do not yet have the key. Safe to run multiple times.
UPDATE users
SET permissions = permissions || '{"popups": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'popups');
```
