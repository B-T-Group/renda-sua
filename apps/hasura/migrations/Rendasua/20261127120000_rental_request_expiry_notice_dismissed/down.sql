ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS expiry_notice_dismissed_at;
