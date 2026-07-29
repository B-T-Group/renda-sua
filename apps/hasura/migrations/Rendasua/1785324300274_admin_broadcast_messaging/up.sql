-- Admin global / broadcast messaging: campaigns, retarget dedupe, message types

CREATE TYPE public.admin_broadcast_campaign_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public.admin_broadcast_audience_type AS ENUM (
  'everyone',
  'business',
  'agent',
  'client'
);

CREATE TYPE public.admin_broadcast_template_key AS ENUM (
  'custom',
  'app_upgrade',
  'business_account_setup'
);

CREATE TYPE public.admin_broadcast_action_type AS ENUM (
  'generic',
  'app_upgrade',
  'business_account_setup'
);

CREATE TABLE public.admin_broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status public.admin_broadcast_campaign_status NOT NULL DEFAULT 'queued',
  audience_type public.admin_broadcast_audience_type NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_key public.admin_broadcast_template_key NOT NULL DEFAULT 'custom',
  action_type public.admin_broadcast_action_type NOT NULL DEFAULT 'generic',
  source_language VARCHAR(5) NOT NULL DEFAULT 'en',
  source_title TEXT,
  source_body TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  body_fr TEXT NOT NULL,
  message_hash VARCHAR(64) NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  skipped_dedupe_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_admin_broadcast_campaigns_created_at
  ON public.admin_broadcast_campaigns (created_at DESC);
CREATE INDEX idx_admin_broadcast_campaigns_status
  ON public.admin_broadcast_campaigns (status);
CREATE INDEX idx_admin_broadcast_campaigns_message_hash
  ON public.admin_broadcast_campaigns (message_hash);

CREATE TABLE public.admin_broadcast_retargets (
  user_id UUID NOT NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  message_hash VARCHAR(64) NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_campaign_id UUID REFERENCES public.admin_broadcast_campaigns(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  PRIMARY KEY (user_id, message_hash)
);

CREATE INDEX idx_admin_broadcast_retargets_last_sent_at
  ON public.admin_broadcast_retargets (last_sent_at);

INSERT INTO public.entity_types (id, comment)
VALUES ('admin_broadcast', 'Admin global broadcast campaigns')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment)
VALUES
  ('ADMIN_BROADCAST', 'Admin custom broadcast message'),
  ('ADMIN_APP_UPGRADE', 'Admin app upgrade prompt'),
  ('ADMIN_ACCOUNT_SETUP', 'Admin business account setup prompt')
ON CONFLICT (id) DO NOTHING;
