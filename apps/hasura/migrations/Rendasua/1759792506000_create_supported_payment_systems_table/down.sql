-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_supported_payment_systems_updated_at ON public.supported_payment_systems;

-- Drop the supported_payment_systems table
DROP TABLE IF EXISTS public.supported_payment_systems;
