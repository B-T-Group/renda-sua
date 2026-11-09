-- Reverse rental condition inspections. Evidence rows go away; S3 objects are not deleted here.

DELETE FROM public.application_configurations
 WHERE config_key IN (
   'rental_inspection_enabled',
   'rental_inspection_min_photos',
   'rental_inspection_return_reminder_hours',
   'rental_inspection_return_review_hours',
   'rental_inspection_stripe_review_hours'
 );

DROP FUNCTION IF EXISTS public.rental_relabel_unit(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rental_claim_inspection_settlement(uuid);
DROP FUNCTION IF EXISTS public.rental_apply_inspection_decision(uuid, uuid, text, text, numeric);
DROP FUNCTION IF EXISTS public.rental_escalate_return_review(uuid, integer);
DROP FUNCTION IF EXISTS public.rental_open_return_dispute(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.rental_accept_return_version(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.rental_record_handback(uuid, uuid);
DROP FUNCTION IF EXISTS public.rental_accept_pickup_version(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.rental_submit_inspection(uuid, text, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.rental_mark_started(uuid, timestamptz);

DROP TRIGGER IF EXISTS rental_custody_events_guard ON public.rental_custody_events;
DROP TRIGGER IF EXISTS rental_inspection_acks_guard ON public.rental_inspection_acks;
DROP TRIGGER IF EXISTS rental_inspection_media_guard ON public.rental_inspection_media;
DROP TRIGGER IF EXISTS rental_inspection_items_guard ON public.rental_inspection_items;
DROP TRIGGER IF EXISTS rental_inspection_versions_guard ON public.rental_inspection_versions;
DROP FUNCTION IF EXISTS public.rental_inspection_guard();

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_dispute_fkey;
ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_return_current_version_fkey;
ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_pickup_accepted_version_fkey;
ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_pickup_current_version_fkey;

DROP TABLE IF EXISTS public.rental_inspection_disputes;
DROP TABLE IF EXISTS public.rental_custody_events;
DROP TABLE IF EXISTS public.rental_inspection_acks;
DROP TABLE IF EXISTS public.rental_inspection_media;
DROP TABLE IF EXISTS public.rental_inspection_items;
DROP TABLE IF EXISTS public.rental_inspection_versions;
DROP TABLE IF EXISTS public.rental_inspections;
DROP TABLE IF EXISTS public.rental_booking_units;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_return_resolution_check;
ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_inspection_policy_check;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS settlement_completed_at,
  DROP COLUMN IF EXISTS settlement_claimed_at,
  DROP COLUMN IF EXISTS return_reminder_sent_at,
  DROP COLUMN IF EXISTS return_resolution,
  DROP COLUMN IF EXISTS return_handed_back_at,
  DROP COLUMN IF EXISTS return_current_version_id,
  DROP COLUMN IF EXISTS reserved_cancel_after,
  DROP COLUMN IF EXISTS pickup_inspection_pending,
  DROP COLUMN IF EXISTS pickup_ack_current,
  DROP COLUMN IF EXISTS pickup_accepted_version_id,
  DROP COLUMN IF EXISTS pickup_current_version_id,
  DROP COLUMN IF EXISTS allocation_version,
  DROP COLUMN IF EXISTS inspection_policy_version;
