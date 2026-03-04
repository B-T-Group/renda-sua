-- Add commission override per business location. NULL = use application_configurations default.
ALTER TABLE public.business_locations
  ADD COLUMN rendasua_item_commission_percentage DECIMAL(5,2) NULL;

COMMENT ON COLUMN public.business_locations.rendasua_item_commission_percentage IS 'Overrides application default. NULL = use application_configurations value.';
