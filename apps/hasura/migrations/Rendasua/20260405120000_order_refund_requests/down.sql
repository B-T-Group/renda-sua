DROP TRIGGER IF EXISTS set_order_refund_requests_updated_at ON public.order_refund_requests;
DROP INDEX IF EXISTS idx_order_refund_requests_one_pending;
DROP INDEX IF EXISTS idx_order_refund_requests_status;
DROP INDEX IF EXISTS idx_order_refund_requests_client_id;
DROP INDEX IF EXISTS idx_order_refund_requests_business_id;
DROP INDEX IF EXISTS idx_order_refund_requests_order_id;
DROP TABLE IF EXISTS public.order_refund_requests;
ALTER TABLE public.orders DROP COLUMN IF EXISTS completed_at;
DROP TYPE IF EXISTS refund_request_status;
DROP TYPE IF EXISTS refund_request_reason;
-- Note: PostgreSQL cannot remove values from order_status enum in a simple down migration.
