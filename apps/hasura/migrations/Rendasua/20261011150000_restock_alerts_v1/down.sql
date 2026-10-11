DROP TRIGGER IF EXISTS restock_alerts_on_order_item ON public.order_items;
DROP TRIGGER IF EXISTS restock_alerts_on_unlike ON public.user_item_likes;
DROP TRIGGER IF EXISTS restock_alerts_on_like ON public.user_item_likes;
DROP TRIGGER IF EXISTS business_inventory_emit_restock_event ON public.business_inventory;
DROP TRIGGER IF EXISTS business_inventory_stamp_restock ON public.business_inventory;
DROP FUNCTION IF EXISTS public.restock_alerts_on_order_item();
DROP FUNCTION IF EXISTS public.restock_alerts_on_unlike();
DROP FUNCTION IF EXISTS public.restock_alerts_on_like();
DROP FUNCTION IF EXISTS public.business_inventory_emit_restock_event();
DROP FUNCTION IF EXISTS public.business_inventory_stamp_restock();
DROP FUNCTION IF EXISTS public.restock_available_quantity(integer, integer, boolean, uuid);
DROP FUNCTION IF EXISTS public.restock_alerts_flag_on();
ALTER TABLE public.user_notification_preferences
  DROP COLUMN IF EXISTS restock_alerts_push_enabled,
  DROP COLUMN IF EXISTS restock_alerts_whatsapp_enabled,
  DROP COLUMN IF EXISTS restock_alerts_sms_enabled;
DROP TABLE IF EXISTS public.restock_alert_sends;
DROP TABLE IF EXISTS public.restock_item_fanouts;
DROP TABLE IF EXISTS public.restock_events;
DROP TABLE IF EXISTS public.restock_alerts;
DELETE FROM public.application_configurations
 WHERE config_key IN ('restock_alerts_v1', 'restock_alerts_whatsapp_template_approved', 'restock_alerts_cron_lock')
   AND country_code IS NULL;
