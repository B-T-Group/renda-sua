ALTER TABLE public.signup_attempts DROP CONSTRAINT IF EXISTS signup_attempts_contact_chk;

ALTER TABLE public.signup_attempts
  ADD CONSTRAINT signup_attempts_contact_chk CHECK (
    (channel = 'email' AND email IS NOT NULL AND length(trim(email)) > 0)
    OR (channel = 'sms' AND phone_number IS NOT NULL AND length(trim(phone_number)) > 0)
  );
