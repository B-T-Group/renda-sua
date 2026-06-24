-- Revert drop_supported_payment_methods: re-add the column (data is not restored).

ALTER TABLE public.supported_country_states
    ADD COLUMN IF NOT EXISTS supported_payment_methods TEXT[];

COMMENT ON COLUMN public.supported_country_states.supported_payment_methods IS 'Array of supported payment methods for this location';
