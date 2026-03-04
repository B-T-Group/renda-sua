-- Create one account per active business_location.
-- Currency is derived from the location's address country (same as business country).
INSERT INTO public.accounts (user_id, currency, business_location_id, available_balance, withheld_balance, is_active)
SELECT
  b.user_id,
  (
    CASE a.country
      WHEN 'CM' THEN 'XAF'::public.currency_enum
      WHEN 'GA' THEN 'XAF'::public.currency_enum
      WHEN 'CF' THEN 'XAF'::public.currency_enum
      WHEN 'TD' THEN 'XAF'::public.currency_enum
      WHEN 'GQ' THEN 'XAF'::public.currency_enum
      WHEN 'CG' THEN 'XAF'::public.currency_enum
      WHEN 'US' THEN 'USD'::public.currency_enum
      WHEN 'GB' THEN 'GBP'::public.currency_enum
      WHEN 'FR' THEN 'EUR'::public.currency_enum
      WHEN 'DE' THEN 'EUR'::public.currency_enum
      WHEN 'NG' THEN 'NGN'::public.currency_enum
      ELSE 'XAF'::public.currency_enum
    END
  ),
  bl.id,
  0,
  0,
  true
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
JOIN public.addresses a ON a.id = bl.address_id
WHERE bl.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts ac
    WHERE ac.user_id = b.user_id
      AND ac.business_location_id = bl.id
  );
