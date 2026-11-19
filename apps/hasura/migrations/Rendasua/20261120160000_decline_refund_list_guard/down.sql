-- The up migration deleted duplicate global keys and clamped the notice count.
-- Those earlier values were not stored, so down only removes the new guard.
ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_fedapay_unknown_notice_bounds;

DROP INDEX IF EXISTS public.application_configurations_global_key_uidx;
