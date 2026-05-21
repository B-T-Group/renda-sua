CREATE TYPE public.agent_location_tracking_consent AS ENUM (
  'not_shown',
  'accepted_fg',
  'accepted_bg',
  'rejected',
  'deferred'
);

ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent public.agent_location_tracking_consent
  NOT NULL DEFAULT 'not_shown';

COMMENT ON COLUMN public.agents.location_tracking_consent IS
  'Agent in-app location disclosure consent: not_shown, accepted_fg, accepted_bg, rejected, deferred';
