-- Designate a client's default Mobile Money number for checkout.

ALTER TABLE public.user_mobile_payment_phones
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_mobile_payment_phones_user_default
  ON public.user_mobile_payment_phones(user_id)
  WHERE is_default = TRUE;

-- Backfill: one default per user who already has registry phones (prefer verified, then oldest).
UPDATE public.user_mobile_payment_phones AS p
SET is_default = TRUE
FROM (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_mobile_payment_phones
  ORDER BY user_id, is_verified DESC, created_at ASC
) AS pick
WHERE p.id = pick.id
  AND p.is_default = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_mobile_payment_phones d
    WHERE d.user_id = p.user_id
      AND d.is_default = TRUE
  );
