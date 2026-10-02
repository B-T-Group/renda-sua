-- Migration: business_locations_pay_at_confirm
-- Description: Per-location "pay at confirm" flag (epic #410, issue #412).
--
--   business_locations.pay_at_confirm (boolean NOT NULL DEFAULT false):
--   when true (AND the kill switch below is on), every ASAP MoMo pickup/delivery order
--   containing an item sold from this location uses the cooked-food payment flow: the
--   client pays nothing at placement, the business confirms, then the client is asked to
--   pay the full amount (wallet-covered clients still pay immediately).
--
--   NAMING: the location column is `pay_at_confirm`; the ORDER snapshot keeps its existing
--   name `orders.pay_after_merchant_confirm` (written at create; after create only the
--   order/line snapshots are read, never this column). No orders schema change.
--
--   KILL SWITCH: application_configurations key `pay_after_confirm_location_flag_enabled`
--   (boolean, global row, default FALSE). While false the backend ignores the column for
--   NEW orders (in-flight pay-after orders continue via their snapshot). Flip it with an
--   UPDATE on the global row - no deploy needed.

ALTER TABLE public.business_locations
  ADD COLUMN IF NOT EXISTS pay_at_confirm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_locations.pay_at_confirm IS
  'When true (and kill switch pay_after_confirm_location_flag_enabled is on), orders from this location are paid AFTER the business confirms (snapshot: orders.pay_after_merchant_confirm). Owner-only. MoMo pickup/delivery, ASAP only. Default false.';

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, tags
)
SELECT
  'pay_after_confirm_location_flag_enabled',
  'Pay After Confirm (Location Flag) Enabled',
  'Kill switch for business_locations.pay_at_confirm. When false the location column is ignored for new orders (existing pay-after orders continue). Default false.',
  'boolean',
  false,
  NULL,
  'active',
  ARRAY['payments', 'momo', 'checkout']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'pay_after_confirm_location_flag_enabled'
    AND country_code IS NULL
);
