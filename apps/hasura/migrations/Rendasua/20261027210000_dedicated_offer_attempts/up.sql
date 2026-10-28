-- #594 follow-up: re-send a missed dedicated offer.
-- order_offers keeps one row per (order, agent); `dedicated_attempt` counts how many times a
-- dedicated offer was sent to that agent for the order (1 = the original send). The backend
-- re-offers an expired row only while the attempt is below `dedicated_offer_max_attempts`.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.order_offers
  ADD COLUMN IF NOT EXISTS dedicated_attempt integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.order_offers.dedicated_attempt IS
  '#594: how many times this dedicated offer was sent to the agent for the order (1 = original). Standard offers stay at 1.';

-- Config key seeded at the code default (2 = one re-send). Never a blind insert.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value, number_value,
  country_code, status, version, tags
)
SELECT v.config_key, v.config_name, v.description, v.data_type, v.boolean_value, v.number_value,
       NULL, 'active', 1, ARRAY['dedicated-agents', 'offers']::text[]
FROM (VALUES
  ('dedicated_offer_max_attempts', 'Dedicated offer max attempts',
   'How many times a dedicated offer is sent to the same agent for an order. 1 = never re-sent; 2 = one re-send after the offer expires unanswered. A declined offer is never re-sent. After the last attempt the order continues to standard dispatch.',
   'number', NULL::boolean, 2::numeric)
) AS v(config_key, config_name, description, data_type, boolean_value, number_value)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
  WHERE c.config_key = v.config_key AND c.country_code IS NULL
);
