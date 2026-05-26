ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent_ios public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown',
  ADD COLUMN location_tracking_consent_android public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown';

ALTER TABLE public.agents DROP COLUMN location_tracking_consent;

COMMENT ON COLUMN public.agents.location_tracking_consent_ios IS
  'Agent location disclosure consent on iOS: not_shown, accepted_fg, accepted_bg, rejected, deferred';

COMMENT ON COLUMN public.agents.location_tracking_consent_android IS
  'Agent location disclosure consent on Android: not_shown, accepted_fg, accepted_bg, rejected, deferred';
