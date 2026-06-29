-- Drop order_offers table and related objects
DROP TRIGGER IF EXISTS trigger_update_order_offers_updated_at ON public.order_offers;
DROP FUNCTION IF EXISTS update_order_offers_updated_at();
DROP TABLE IF EXISTS public.order_offers;
DROP TYPE IF EXISTS order_offer_status;
