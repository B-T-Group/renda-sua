-- Deferred signup: hold validated signup payload until OTP verification.
-- Accessible only via Hasura admin / Nest HasuraSystemService (no public role perms).

CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  email text,
  phone_number text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'otp_verified', 'provisioning', 'completed', 'expired', 'failed')),
  verify_attempts integer NOT NULL DEFAULT 0,
  last_otp_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  completion_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_attempts_contact_chk CHECK (
    (channel = 'email' AND email IS NOT NULL AND length(trim(email)) > 0)
    OR (channel = 'sms' AND phone_number IS NOT NULL AND length(trim(phone_number)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS signup_attempts_expires_at_idx
  ON public.signup_attempts (expires_at)
  WHERE status IN ('pending', 'otp_verified');

CREATE INDEX IF NOT EXISTS signup_attempts_email_pending_idx
  ON public.signup_attempts (email)
  WHERE email IS NOT NULL AND status IN ('pending', 'otp_verified');

CREATE INDEX IF NOT EXISTS signup_attempts_phone_pending_idx
  ON public.signup_attempts (phone_number)
  WHERE phone_number IS NOT NULL AND status IN ('pending', 'otp_verified');

COMMENT ON TABLE public.signup_attempts IS
  'Short-lived signup intents. Durable users/personas are created only after OTP verification.';
