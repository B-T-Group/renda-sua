DELETE FROM public.delivery_failure_reasons WHERE reason_key = 'client_reported_not_delivered'
  AND NOT EXISTS (SELECT 1 FROM public.failed_deliveries f WHERE f.failure_reason_id = delivery_failure_reasons.id);
DELETE FROM public.application_configurations
 WHERE country_code IS NULL AND config_key IN (
  'client_confirm_momo_auto_complete_hours', 'client_confirm_momo_reminder_hours',
  'client_confirm_report_window_hours', 'client_report_flag_threshold', 'client_report_flag_window_days');
DROP TABLE IF EXISTS public.order_delivery_reports;
DROP INDEX IF EXISTS public.orders_awaiting_deadline_idx;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_dispute_type_check;
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS dispute_opened_at,
  DROP COLUMN IF EXISTS dispute_reason,
  DROP COLUMN IF EXISTS dispute_type,
  DROP COLUMN IF EXISTS report_window_ends_at,
  DROP COLUMN IF EXISTS delivered_at;
