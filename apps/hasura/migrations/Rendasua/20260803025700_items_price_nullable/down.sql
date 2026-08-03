-- Restore NOT NULL: fill any null draft prices before re-adding the constraint.
UPDATE public.items
SET price = 0
WHERE price IS NULL;

ALTER TABLE public.items
  ALTER COLUMN price SET NOT NULL;

COMMENT ON COLUMN public.items.price IS NULL;
