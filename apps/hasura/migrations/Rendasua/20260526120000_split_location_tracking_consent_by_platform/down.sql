ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown';

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS location_tracking_consent_ios,
  DROP COLUMN IF EXISTS location_tracking_consent_android;
