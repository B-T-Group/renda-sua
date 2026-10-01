-- Waived delivery fee: platform (HQ) funds the agent's pay. Audit the HQ debit per order
-- as commission_type = 'platform_funded_delivery' (recipient_type = 'rendasua', recipient = HQ user)
-- so finance can sum platform subsidy per order/period.
ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;
ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal',
    'platform_funded_delivery'
  ));
COMMENT ON COLUMN public.commission_payouts.commission_type IS 'Type of commission (base_delivery_fee, per_km_delivery_fee, item_sale, order_subtotal, platform_funded_delivery = HQ debit funding the agent pay on a waived delivery fee)';
