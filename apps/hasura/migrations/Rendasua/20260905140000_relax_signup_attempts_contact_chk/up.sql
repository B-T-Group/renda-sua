-- Relax signup_attempts_contact_chk to allow null contacts for completed/expired/failed rows.
-- Completed/expired/failed rows clear PII (email/phone_number), which failed under the old constraint.

ALTER TABLE public.signup_attempts
  DROP CONSTRAINT IF EXISTS signup_attempts_contact_chk;

ALTER TABLE public.signup_attempts
  ADD CONSTRAINT signup_attempts_contact_chk CHECK (
    -- Active statuses must have contact per channel
    (status IN ('pending', 'otp_verified', 'provisioning') AND (
      (channel = 'email' AND email IS NOT NULL AND length(trim(email)) > 0)
      OR (channel = 'sms' AND phone_number IS NOT NULL AND length(trim(phone_number)) > 0)
    ))
    -- Terminal statuses may have null contacts (PII cleared)
    OR status IN ('completed', 'expired', 'failed')
  );

COMMENT ON CONSTRAINT signup_attempts_contact_chk ON public.signup_attempts IS
  'Contact must be present for active attempts; terminal statuses may clear PII.';
