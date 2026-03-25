-- sql/008-enrich-popup-analytics.sql
-- Enriches popup analytics: adds tracking columns to popup_clicks,
-- and creates popup_views and popup_dismissals tables.
-- Safe to run multiple times (idempotent).

-- ============================================================
-- 1. Enrich popup_clicks with additional SDK-captured columns
-- ============================================================

ALTER TABLE popup_clicks
  ADD COLUMN IF NOT EXISTS referrer        text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_source      text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium      text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign    text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS browser         text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS viewport_width  integer;

-- ============================================================
-- 2. Create popup_views table (impression tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS popup_views (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id        uuid        NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
  user_session_id text        NOT NULL,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  page            text        NOT NULL DEFAULT '',
  device_type     text        NOT NULL DEFAULT 'desktop'
                    CHECK (device_type IN ('mobile', 'desktop'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_popup_views_popup_id  ON popup_views(popup_id);
CREATE INDEX IF NOT EXISTS idx_popup_views_viewed_at ON popup_views(viewed_at);

-- RLS
ALTER TABLE popup_views ENABLE ROW LEVEL SECURITY;

-- Public insert (SDK tracks views via anon key)
CREATE POLICY IF NOT EXISTS "Public can insert views"
ON popup_views FOR INSERT
WITH CHECK (true);

-- Service role full access (analytics API)
CREATE POLICY IF NOT EXISTS "Service role can manage views"
ON popup_views FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. Create popup_dismissals table (dismiss tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS popup_dismissals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id        uuid        NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
  user_session_id text        NOT NULL,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  page            text        NOT NULL DEFAULT '',
  device_type     text        NOT NULL DEFAULT 'desktop'
                    CHECK (device_type IN ('mobile', 'desktop'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_popup_dismissals_popup_id     ON popup_dismissals(popup_id);
CREATE INDEX IF NOT EXISTS idx_popup_dismissals_dismissed_at ON popup_dismissals(dismissed_at);

-- RLS
ALTER TABLE popup_dismissals ENABLE ROW LEVEL SECURITY;

-- Public insert (SDK tracks dismissals via anon key)
CREATE POLICY IF NOT EXISTS "Public can insert dismissals"
ON popup_dismissals FOR INSERT
WITH CHECK (true);

-- Service role full access (analytics API)
CREATE POLICY IF NOT EXISTS "Service role can manage dismissals"
ON popup_dismissals FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
