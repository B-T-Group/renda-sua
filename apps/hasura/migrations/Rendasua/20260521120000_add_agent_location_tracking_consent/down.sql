ALTER TABLE public.agents DROP COLUMN IF EXISTS location_tracking_consent;

DROP TYPE IF EXISTS public.agent_location_tracking_consent;
