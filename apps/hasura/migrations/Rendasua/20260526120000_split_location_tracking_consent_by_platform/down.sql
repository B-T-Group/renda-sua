ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown';

UPDATE public.agents
SET location_tracking_consent = CASE
  WHEN location_tracking_consent_ios <> 'not_shown' THEN location_tracking_consent_ios
  ELSE location_tracking_consent_android
END;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS location_tracking_consent_ios,
  DROP COLUMN IF EXISTS location_tracking_consent_android;
