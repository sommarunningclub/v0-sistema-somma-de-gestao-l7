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
