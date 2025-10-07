-- Remove business-specific cancellation reasons
DELETE FROM public.order_cancellation_reasons 
WHERE id IN (12, 13, 14, 15, 16, 17, 18);

-- Drop the index
DROP INDEX IF EXISTS public.idx_order_cancellation_reasons_persona;

-- Drop the persona column
ALTER TABLE public.order_cancellation_reasons 
DROP COLUMN IF EXISTS persona;
