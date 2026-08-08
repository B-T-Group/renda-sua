-- Merchant engagement: tip/reminder preference + send log for push/email cooldowns.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS tips_reminders_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.businesses.tips_reminders_enabled IS
  'When true, merchant may receive in-app tips, engagement pushes, and weekly digest emails.';

CREATE TABLE IF NOT EXISTS public.merchant_engagement_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  push_id text NOT NULL,
  channel text NOT NULL DEFAULT 'push',
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS merchant_engagement_sends_business_sent_idx
  ON public.merchant_engagement_sends (business_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS merchant_engagement_sends_business_push_idx
  ON public.merchant_engagement_sends (business_id, push_id, sent_at DESC);

COMMENT ON TABLE public.merchant_engagement_sends IS
  'Log of engagement pushes and digest emails for cooldown and once-ever milestones.';
