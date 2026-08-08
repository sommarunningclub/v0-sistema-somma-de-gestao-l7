-- sql/013-create-email-marketing.sql
-- Módulo E-mail Marketing. Tabelas isoladas do 1-ano-SommaDay,
-- que compartilha este mesmo banco.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','agendada','enviando','enviada','cancelada','erro')),
  template_key text NOT NULL,
  subject text NOT NULL,
  preheader text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_label text,
  cta_url text,
  audience jsonb NOT NULL DEFAULT '{"bases":[]}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON public.email_campaigns (scheduled_at);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns (id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text,
  source_base text,
  resend_email_id text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviado','entregue','aberto','clicado','bounce','spam','falha')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ecr_campaign_status ON public.email_campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_ecr_resend_email_id ON public.email_campaign_recipients (resend_email_id);

CREATE TABLE IF NOT EXISTS public.email_campaign_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.email_campaigns (id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.email_campaign_recipients (id) ON DELETE SET NULL,
  email text,
  resend_email_id text,
  type text NOT NULL,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ece_campaign_id ON public.email_campaign_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ece_resend_email_id ON public.email_campaign_events (resend_email_id);
CREATE INDEX IF NOT EXISTS idx_ece_type ON public.email_campaign_events (type);

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  campaign_id uuid REFERENCES public.email_campaigns (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON public.email_suppressions (email);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access email_campaigns" ON public.email_campaigns;
CREATE POLICY "Service role full access email_campaigns" ON public.email_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_campaign_recipients" ON public.email_campaign_recipients;
CREATE POLICY "Service role full access email_campaign_recipients" ON public.email_campaign_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_campaign_events" ON public.email_campaign_events;
CREATE POLICY "Service role full access email_campaign_events" ON public.email_campaign_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access email_suppressions" ON public.email_suppressions;
CREATE POLICY "Service role full access email_suppressions" ON public.email_suppressions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
