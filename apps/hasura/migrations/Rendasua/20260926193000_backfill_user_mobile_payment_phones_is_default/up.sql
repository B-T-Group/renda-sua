-- Backfill is_default for users who already had registry MoMo phones.
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
