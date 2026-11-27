ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS expiry_notice_dismissed_at timestamptz;

COMMENT ON COLUMN public.rental_requests.expiry_notice_dismissed_at IS
  'When the business dismissed the dashboard "Request expired" notice for this no-response request. NULL while the notice is still shown.';
