-- Persist Meta CAPI matching context at checkout so Purchase (fired later on
-- order.paid) can send fbc, fbp, client IP, and user agent for Event Match Quality.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meta_capi_context jsonb;

COMMENT ON COLUMN public.orders.meta_capi_context IS
  'Client Meta CAPI matching context captured at checkout (fbc, fbp, ip, ua, action_source). Not hashed.';
