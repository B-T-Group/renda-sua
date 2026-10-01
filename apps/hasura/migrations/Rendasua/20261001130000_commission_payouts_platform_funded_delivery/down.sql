DELETE FROM public.commission_payouts WHERE commission_type = 'platform_funded_delivery';
ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;
ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal'
  ));
