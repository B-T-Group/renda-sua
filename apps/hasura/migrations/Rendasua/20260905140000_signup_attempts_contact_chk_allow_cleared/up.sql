-- Terminal signup_attempts rows clear email/phone_number (PII). The original
-- contact check required a matching contact for every status, so
-- markAttemptCompleted / expire / fail violated signup_attempts_contact_chk.
ALTER TABLE public.signup_attempts DROP CONSTRAINT IF EXISTS signup_attempts_contact_chk;

ALTER TABLE public.signup_attempts
  ADD CONSTRAINT signup_attempts_contact_chk CHECK (
    status IN ('completed', 'expired', 'failed')
    OR (
      channel = 'email'
      AND email IS NOT NULL
      AND length(trim(email)) > 0
    )
    OR (
      channel = 'sms'
      AND phone_number IS NOT NULL
      AND length(trim(phone_number)) > 0
    )
  );
