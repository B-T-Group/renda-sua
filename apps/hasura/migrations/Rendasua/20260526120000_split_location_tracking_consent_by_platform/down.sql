ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown';

UPDATE public.agents
SET location_tracking_consent = CASE
  WHEN location_tracking_consent_ios = 'rejected'
    OR location_tracking_consent_android = 'rejected'
    THEN 'rejected'::public.agent_location_tracking_consent
  WHEN location_tracking_consent_ios = 'accepted_bg'
    OR location_tracking_consent_android = 'accepted_bg'
    THEN 'accepted_bg'::public.agent_location_tracking_consent
  WHEN location_tracking_consent_ios = 'accepted_fg'
    OR location_tracking_consent_android = 'accepted_fg'
    THEN 'accepted_fg'::public.agent_location_tracking_consent
  WHEN location_tracking_consent_ios = 'deferred'
    OR location_tracking_consent_android = 'deferred'
    THEN 'deferred'::public.agent_location_tracking_consent
  ELSE 'not_shown'::public.agent_location_tracking_consent
END;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS location_tracking_consent_ios,
  DROP COLUMN IF EXISTS location_tracking_consent_android;
