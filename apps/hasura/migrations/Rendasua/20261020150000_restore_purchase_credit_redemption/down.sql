-- Revert the backend (PurchaseCreditsService.restoreOne) and the Hasura metadata
-- (functions/public_restore_purchase_credit_redemption.yaml) first.
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.restore_purchase_credit_redemption(uuid);
