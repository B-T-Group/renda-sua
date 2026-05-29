CREATE TYPE public.agent_location_tracking_consent_old AS ENUM (
  'not_shown',
  'accepted_fg',
  'accepted_bg',
  'rejected',
  'deferred'
);

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios DROP DEFAULT,
  ALTER COLUMN location_tracking_consent_android DROP DEFAULT,
  ALTER COLUMN location_tracking_consent_web DROP DEFAULT;

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios
    TYPE public.agent_location_tracking_consent_old
    USING 'not_shown'::text::public.agent_location_tracking_consent_old,
  ALTER COLUMN location_tracking_consent_android
    TYPE public.agent_location_tracking_consent_old
    USING 'not_shown'::text::public.agent_location_tracking_consent_old;

ALTER TABLE public.agents DROP COLUMN location_tracking_consent_web;

ALTER TABLE public.agents
  ALTER COLUMN location_tracking_consent_ios SET DEFAULT 'not_shown',
  ALTER COLUMN location_tracking_consent_android SET DEFAULT 'not_shown';

DROP TYPE public.agent_location_tracking_consent;

ALTER TYPE public.agent_location_tracking_consent_old
  RENAME TO agent_location_tracking_consent;
