-- Deferred signup: hold validated signup payload until OTP verification.
-- Accessible only via Hasura admin / Nest HasuraSystemService (no public role perms).

-- Handle migration from old schema (contact_value) to new schema (email/phone_number)
DO $$
BEGIN
  -- Check if table exists with old schema (has contact_value column)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'signup_attempts'
    AND column_name = 'contact_value'
  ) THEN
    -- Migrate from old schema to new schema
    -- Drop old indexes
    DROP INDEX IF EXISTS public.signup_attempts_contact_status_idx;
    DROP INDEX IF EXISTS public.signup_attempts_expires_at_idx;
    
    -- Add new columns
    ALTER TABLE public.signup_attempts
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS phone_number text;
    
    -- Migrate data: populate email/phone_number from contact_value based on channel
    UPDATE public.signup_attempts
    SET email = CASE WHEN channel = 'email' THEN contact_value ELSE NULL END,
        phone_number = CASE WHEN channel IN ('phone', 'sms') THEN contact_value ELSE NULL END
    WHERE contact_value IS NOT NULL;
    
    -- Update channel value from 'phone' to 'sms' for consistency
    UPDATE public.signup_attempts SET channel = 'sms' WHERE channel = 'phone';
    
    -- Drop old column and constraint
    ALTER TABLE public.signup_attempts DROP COLUMN IF EXISTS contact_value;
    
    -- Update check constraints
    ALTER TABLE public.signup_attempts DROP CONSTRAINT IF EXISTS signup_attempts_channel_check;
    ALTER TABLE public.signup_attempts
      ADD CONSTRAINT signup_attempts_channel_check CHECK (channel IN ('email', 'sms'));
    
    -- Update status check constraint
    ALTER TABLE public.signup_attempts DROP CONSTRAINT IF EXISTS signup_attempts_status_check;
    ALTER TABLE public.signup_attempts
      ADD CONSTRAINT signup_attempts_status_check
      CHECK (status IN ('pending', 'otp_verified', 'provisioning', 'completed', 'expired', 'failed'));
    
    -- Add contact validation check
    ALTER TABLE public.signup_attempts
      ADD CONSTRAINT signup_attempts_contact_chk CHECK (
        (channel = 'email' AND email IS NOT NULL AND length(trim(email)) > 0)
        OR (channel = 'sms' AND phone_number IS NOT NULL AND length(trim(phone_number)) > 0)
      );
    
    -- Rename columns if needed for consistency
    ALTER TABLE public.signup_attempts
      RENAME COLUMN verify_attempt_count TO verify_attempts;
    ALTER TABLE public.signup_attempts
      RENAME COLUMN auth0_verified_at TO otp_verified_at;
  ELSE
    -- Table doesn't exist or already has new schema, create it fresh
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
  END IF;
END $$;

-- Create/recreate indexes for new schema
DROP INDEX IF EXISTS public.signup_attempts_expires_at_idx;
CREATE INDEX signup_attempts_expires_at_idx
  ON public.signup_attempts (expires_at)
  WHERE status IN ('pending', 'otp_verified');

DROP INDEX IF EXISTS public.signup_attempts_email_pending_idx;
CREATE INDEX signup_attempts_email_pending_idx
  ON public.signup_attempts (email)
  WHERE email IS NOT NULL AND status IN ('pending', 'otp_verified');

DROP INDEX IF EXISTS public.signup_attempts_phone_pending_idx;
CREATE INDEX signup_attempts_phone_pending_idx
  ON public.signup_attempts (phone_number)
  WHERE phone_number IS NOT NULL AND status IN ('pending', 'otp_verified');

COMMENT ON TABLE public.signup_attempts IS
  'Short-lived signup intents. Durable users/personas are created only after OTP verification.';
