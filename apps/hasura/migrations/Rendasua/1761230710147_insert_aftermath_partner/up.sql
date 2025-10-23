-- Migration: insert_aftermath_partner
-- Description: Insert Aftermath Technologies partner record

INSERT INTO public.partners (
    user_id,
    company_name,
    base_delivery_fee_commission,
    per_km_delivery_fee_commission,
    item_commission
) VALUES (
    (SELECT id FROM public.users WHERE email = 'cto@aftermathtechnologies.com'),
    'Aftermath Technologies',
    15.00,
    15.00,
    5.00
);
