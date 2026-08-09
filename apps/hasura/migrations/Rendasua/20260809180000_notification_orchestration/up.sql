-- Notification orchestration: per-user channel preferences + delivery analytics.

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_opted_in_at timestamptz,
  whatsapp_informational_enabled boolean NOT NULL DEFAULT false,
  marketing_enabled boolean NOT NULL DEFAULT false,
  order_updates boolean NOT NULL DEFAULT true,
  chat boolean NOT NULL DEFAULT true,
  marketplace boolean NOT NULL DEFAULT true,
  reminders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_notification_preferences IS
  'Per-user channel and category notification preferences. WhatsApp requires explicit opt-in.';

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL,
  category text NOT NULL,
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL,
  provider_message_id text,
  dedupe_key text,
  entity_type text,
  entity_id text,
  error_code text,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS notification_events_user_created_idx
  ON public.notification_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_events_type_channel_idx
  ON public.notification_events (notification_type, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_events_provider_msg_idx
  ON public.notification_events (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_events_dedupe_idx
  ON public.notification_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON TABLE public.notification_events IS
  'Lifecycle analytics for orchestrated notifications (requested/sent/delivered/failed/etc).';

CREATE TABLE IF NOT EXISTS public.notification_action_nonces (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_action_nonces_expires_idx
  ON public.notification_action_nonces (expires_at);

COMMENT ON TABLE public.notification_action_nonces IS
  'Replay protection for signed WhatsApp / deep-link action tokens.';
