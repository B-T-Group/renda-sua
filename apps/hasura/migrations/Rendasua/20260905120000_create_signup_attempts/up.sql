-- Private staging store for deferred signup (OTP before users row).
-- Accessible only via Hasura admin / Nest HasuraSystemService (no role permissions).

CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  contact_value text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'verifying',
      'verified_pending_provision',
      'completed',
      'expired',
      'superseded',
      'failed'
    )),
  expires_at timestamptz NOT NULL,
  last_otp_sent_at timestamptz NOT NULL DEFAULT now(),
  verify_attempt_count integer NOT NULL DEFAULT 0,
  auth0_verified_at timestamptz,
  completed_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  completion_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_attempts_contact_status_idx
  ON public.signup_attempts (contact_value, status);

CREATE INDEX IF NOT EXISTS signup_attempts_expires_at_idx
  ON public.signup_attempts (expires_at)
  WHERE status IN ('pending', 'verifying', 'verified_pending_provision');

COMMENT ON TABLE public.signup_attempts IS
  'Ephemeral signup intents. PII purged after expiry/completion. No Hasura role access.';
