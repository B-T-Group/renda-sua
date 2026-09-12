-- Export catalog home listings are Canada (CAD). Clones consolidated from
-- XAF markets kept the wrong items.currency / shipping_currency.
UPDATE public.items
SET
  currency = 'CAD',
  shipping_currency = CASE
    WHEN shipping_currency IS NOT NULL THEN 'CAD'
    ELSE shipping_currency
  END
WHERE export_available = true
  AND (
    currency IS DISTINCT FROM 'CAD'
    OR shipping_currency IS DISTINCT FROM 'CAD'
  );
