-- #627 nit: restoring a purchase credit was two writes (delete the redemption, then
-- credit the grant). A crash between them lost the credit for good: the redemption was
-- gone, so no retry could find it. Now ONE function, one transaction:
--   DELETE the redemption (row-locked; a concurrent duplicate finds nothing and returns
--   no row), then add its amount back to the grant unless the grant was revoked.
-- If the credit fails (e.g. the remaining <= amount check), the delete rolls back too.
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.restore_purchase_credit_redemption(p_redemption_id uuid)
RETURNS SETOF public.purchase_credit_redemptions
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  r public.purchase_credit_redemptions;
BEGIN
  DELETE FROM public.purchase_credit_redemptions WHERE id = p_redemption_id RETURNING * INTO r;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.purchase_credit_grants
     SET remaining_amount = remaining_amount + r.amount
   WHERE id = r.grant_id
     AND revoked_at IS NULL;
  RETURN NEXT r;
END;
$$;

COMMENT ON FUNCTION public.restore_purchase_credit_redemption(uuid) IS
  'Delete a purchase-credit redemption and re-credit its grant (unless revoked) in one transaction; once per redemption';
