DROP INDEX IF EXISTS public.uq_business_contracts_in_flight;

ALTER TABLE public.business_contracts
  DROP COLUMN IF EXISTS last_reminded_at;
