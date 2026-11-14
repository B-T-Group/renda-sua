-- Assistant rentals phase 1.
-- The flag stays false. Dev is turned on by hand. Production stays off.
-- Zero-result rows keep no user id and expire after 30 days.

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  status,
  version,
  tags
)
SELECT
  'assistant_rentals_enabled',
  'Assistant rentals',
  'When enabled, the in-app assistant can search rentals, quote an estimate and show rental cards. Request creation stays a button in the app. Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['assistant', 'rentals', 'mobile', 'web', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1
  FROM public.application_configurations
  WHERE config_key = 'assistant_rentals_enabled'
    AND country_code IS NULL
);

CREATE TABLE IF NOT EXISTS public.assistant_rental_zero_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query text NOT NULL,
  category_guess text,
  market text NOT NULL,
  day_bucket text NOT NULL,
  has_budget boolean NOT NULL DEFAULT false,
  buy_matches integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.assistant_rental_zero_results IS
  'Rental searches with no matches. No user id, email, phone or name. Purged after expires_at.';

CREATE INDEX IF NOT EXISTS assistant_rental_zero_results_expires_idx
  ON public.assistant_rental_zero_results (expires_at);

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS price_change_seen_at timestamptz;

COMMENT ON COLUMN public.rental_requests.price_change_seen_at IS
  'When the renter saw a price that differs from the quote. Payment stays blocked until this is set.';

INSERT INTO public.message_types (id, comment)
VALUES (
  'RENTAL_PRICE_CHANGED',
  'The business accepted a rental at a price different from the estimate.'
)
ON CONFLICT (id) DO NOTHING;
