CREATE TYPE public.agent_location_tracking_consent_new AS ENUM (
  'not_shown',
  'accepted',
  'deferred'
);

ALTER TABLE public.agents
  ADD COLUMN location_tracking_consent_web public.agent_location_tracking_consent NOT NULL DEFAULT 'not_shown';

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios DROP DEFAULT,
  ALTER COLUMN location_tracking_consent_android DROP DEFAULT;

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios
    TYPE public.agent_location_tracking_consent_new
    USING 'not_shown'::text::public.agent_location_tracking_consent_new,
  ALTER COLUMN location_tracking_consent_android
    TYPE public.agent_location_tracking_consent_new
    USING 'not_shown'::text::public.agent_location_tracking_consent_new,
  ALTER COLUMN location_tracking_consent_web
    TYPE public.agent_location_tracking_consent_new
    USING 'not_shown'::text::public.agent_location_tracking_consent_new;

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios SET DEFAULT 'not_shown',
  ALTER COLUMN location_tracking_consent_android SET DEFAULT 'not_shown',
  ALTER COLUMN location_tracking_consent_web SET DEFAULT 'not_shown';

DROP TYPE public.agent_location_tracking_consent;

ALTER TYPE public.agent_location_tracking_consent_new
  RENAME TO agent_location_tracking_consent;

COMMENT ON COLUMN public.agents.location_tracking_consent_ios IS
  'Agent location disclosure consent on iOS: not_shown, accepted, deferred';

COMMENT ON COLUMN public.agents.location_tracking_consent_android IS
  'Agent location disclosure consent on Android: not_shown, accepted, deferred';

COMMENT ON COLUMN public.agents.location_tracking_consent_web IS
  'Agent location disclosure consent on web: not_shown, accepted, deferred';
