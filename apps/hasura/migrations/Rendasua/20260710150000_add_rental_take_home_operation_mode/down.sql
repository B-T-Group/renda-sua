-- Enum value additions are irreversible; leave take_home in place.
-- Re-apply v1 CHECK only if all rows are business_operated.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.rental_items
    WHERE operation_mode IS DISTINCT FROM 'business_operated'::public.rental_operation_mode_enum
  ) THEN
    ALTER TABLE public.rental_items
      DROP CONSTRAINT IF EXISTS rental_items_operation_mode_v1;
    ALTER TABLE public.rental_items
      ADD CONSTRAINT rental_items_operation_mode_v1
      CHECK (operation_mode = 'business_operated'::public.rental_operation_mode_enum);
  END IF;
END $$;

COMMENT ON TABLE public.rental_items IS
  'Business-operated rental catalog items (v1: business_operated only)';
