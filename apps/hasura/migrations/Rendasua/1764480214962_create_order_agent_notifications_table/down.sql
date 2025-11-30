-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_order_agent_notifications_updated_at ON public.order_agent_notifications;
DROP FUNCTION IF EXISTS update_order_agent_notifications_updated_at();

-- Drop table
DROP TABLE IF EXISTS public.order_agent_notifications;

-- Drop enums
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_type;

